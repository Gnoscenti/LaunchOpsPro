"""
API Authentication — LaunchOps Sprint 1 Hardening
===================================================

Simple API-key authentication for all write endpoints. Keys are stored
hashed (SHA-256) in the LAUNCHOPS_API_KEYS env var as a comma-separated
list. The dev bypass (LAUNCHOPS_DEV_MODE=true) disables auth for local
development only — it is NOT a production setting.

Usage in routes:

    from core.auth import require_auth

    @router.post("/atlas/v2/execute", dependencies=[Depends(require_auth)])
    async def execute(...):
        ...

Or apply to an entire router:

    router = APIRouter(dependencies=[Depends(require_auth)])

Environment:
    LAUNCHOPS_API_KEYS      Comma-separated API keys (unhashed). On first
                            boot, if this is unset, a random key is generated
                            and printed to stdout.
    LAUNCHOPS_DEV_MODE      If "true", auth is bypassed on ALL routes.
                            NEVER set this in production.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import time
import threading
from typing import Dict, List, Optional, Set, Tuple

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

logger = logging.getLogger("LaunchOps.auth")

# ── Key store ──────────────────────────────────────────────────────────────
#
# Keys are stored as (salt_hex, pbkdf2_hex) tuples. The salt is a random
# 16-byte value generated when the key is first hashed. PBKDF2-SHA256 with
# 100,000 iterations provides resistance to offline brute-force even if the
# hash store is leaked. This replaces the unsalted SHA-256 from Sprint 1.

_DEV_MODE = os.getenv("LAUNCHOPS_DEV_MODE", "false").lower() == "true"
_RAW_KEYS: str = os.getenv("LAUNCHOPS_API_KEYS", "")
_KEY_ENTRIES: List[Tuple[bytes, bytes]] = []  # list of (salt, hash) pairs
_PBKDF2_ITERATIONS = 100_000


def _hash_key_salted(key: str, salt: Optional[bytes] = None) -> Tuple[bytes, bytes]:
    """
    Hash a key with PBKDF2-HMAC-SHA256 and a random salt.
    Returns (salt, derived_key) as raw bytes.
    """
    if salt is None:
        salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        key.strip().encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
    )
    return salt, dk


def _init_keys() -> None:
    global _KEY_ENTRIES
    if _RAW_KEYS:
        for k in _RAW_KEYS.split(","):
            k = k.strip()
            if k:
                salt, dk = _hash_key_salted(k)
                _KEY_ENTRIES.append((salt, dk))
        logger.info("API auth initialized with %d key(s) (PBKDF2-SHA256)", len(_KEY_ENTRIES))
    elif not _DEV_MODE:
        generated = f"lops_{secrets.token_urlsafe(32)}"
        salt, dk = _hash_key_salted(generated)
        _KEY_ENTRIES.append((salt, dk))
        logger.warning(
            "No LAUNCHOPS_API_KEYS set. Auto-generated key (copy this):\n"
            "  %s\n"
            "Set LAUNCHOPS_API_KEYS=%s in .env to persist it.",
            generated,
            generated,
        )
    else:
        logger.warning(
            "LAUNCHOPS_DEV_MODE=true — API authentication is DISABLED. "
            "Do not use this in production."
        )


_init_keys()


# ── Rate limiting ──────────────────────────────────────────────────────────
# Simple in-memory token-bucket rate limiter per IP. Limits failed auth
# attempts to 10 per minute per IP. Successful auth does not consume tokens.

_RATE_LIMIT_MAX = 10            # max failures per window
_RATE_LIMIT_WINDOW = 60         # window in seconds
_rate_limit_lock = threading.Lock()
_rate_limit_buckets: Dict[str, List[float]] = {}


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the client is within rate limit, False if blocked."""
    now = time.monotonic()
    with _rate_limit_lock:
        bucket = _rate_limit_buckets.get(client_ip, [])
        # Prune old entries
        bucket = [t for t in bucket if now - t < _RATE_LIMIT_WINDOW]
        _rate_limit_buckets[client_ip] = bucket
        if len(bucket) >= _RATE_LIMIT_MAX:
            return False
        return True


def _record_failure(client_ip: str) -> None:
    """Record a failed auth attempt for rate limiting."""
    now = time.monotonic()
    with _rate_limit_lock:
        bucket = _rate_limit_buckets.setdefault(client_ip, [])
        bucket.append(now)

# ── FastAPI dependency ──────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_auth(
    request: Request,
    api_key: Optional[str] = Security(_api_key_header),
) -> None:
    """
    FastAPI dependency that enforces API key auth on protected routes.

    Checks:
      1. X-API-Key header
      2. Authorization: Bearer <key> header (fallback)
      3. ?api_key=<key> query param (convenience for EventSource GETs)

    Security features:
      - PBKDF2-HMAC-SHA256 with per-key random salt (100k iterations)
      - Constant-time comparison via hmac.compare_digest
      - Token-bucket rate limiter: 10 failed attempts/minute per IP

    Raises 401 if no valid key is found (unless DEV_MODE is on).
    Raises 429 if the client has exceeded the rate limit.
    """
    if _DEV_MODE:
        return

    if not _KEY_ENTRIES:
        raise HTTPException(500, "API keys not configured. Set LAUNCHOPS_API_KEYS.")

    # Rate limit check
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            429,
            detail="Too many failed authentication attempts. Try again later.",
            headers={"Retry-After": str(_RATE_LIMIT_WINDOW)},
        )

    # Try X-API-Key header first
    if api_key and _verify(api_key):
        return

    # Fallback: Authorization: Bearer <key>
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer_key = auth_header.removeprefix("Bearer ").strip()
        if _verify(bearer_key):
            return

    # Fallback: query param (for EventSource which can't set headers)
    query_key = request.query_params.get("api_key", "")
    if query_key and _verify(query_key):
        return

    # All attempts failed — record for rate limiting
    _record_failure(client_ip)

    raise HTTPException(
        401,
        detail="Invalid or missing API key. Send via X-API-Key header, "
        "Authorization: Bearer <key>, or ?api_key=<key> query param.",
    )


def _verify(candidate: str) -> bool:
    """
    Check a candidate key against all stored (salt, hash) entries.
    Uses PBKDF2-SHA256 with the stored salt and constant-time comparison.
    """
    for salt, stored_dk in _KEY_ENTRIES:
        _, candidate_dk = _hash_key_salted(candidate, salt=salt)
        if hmac.compare_digest(candidate_dk, stored_dk):
            return True
    return False


# ── Public helpers ──────────────────────────────────────────────────────────


def is_dev_mode() -> bool:
    return _DEV_MODE
