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
from typing import Optional, Set

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

logger = logging.getLogger("LaunchOps.auth")

# ── Key store ──────────────────────────────────────────────────────────────

_DEV_MODE = os.getenv("LAUNCHOPS_DEV_MODE", "false").lower() == "true"
_RAW_KEYS: str = os.getenv("LAUNCHOPS_API_KEYS", "")
_HASHED_KEYS: Set[str] = set()


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.strip().encode()).hexdigest()


def _init_keys() -> None:
    global _RAW_KEYS, _HASHED_KEYS
    if _RAW_KEYS:
        _HASHED_KEYS = {_hash_key(k) for k in _RAW_KEYS.split(",") if k.strip()}
        logger.info("API auth initialized with %d key(s)", len(_HASHED_KEYS))
    elif not _DEV_MODE:
        # Auto-generate a key so the system boots securely even if the
        # operator forgot to set one.
        generated = f"lops_{secrets.token_urlsafe(32)}"
        _HASHED_KEYS = {_hash_key(generated)}
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

    Raises 401 if no valid key is found (unless DEV_MODE is on).
    """
    if _DEV_MODE:
        return

    if not _HASHED_KEYS:
        # No keys configured and not in dev mode — should not happen after
        # _init_keys, but fail-closed just in case.
        raise HTTPException(500, "API keys not configured. Set LAUNCHOPS_API_KEYS.")

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

    raise HTTPException(
        401,
        detail="Invalid or missing API key. Send via X-API-Key header, "
        "Authorization: Bearer <key>, or ?api_key=<key> query param.",
    )


def _verify(candidate: str) -> bool:
    """Constant-time comparison of a candidate key against all stored hashes."""
    candidate_hash = _hash_key(candidate)
    return any(
        hmac.compare_digest(candidate_hash, stored) for stored in _HASHED_KEYS
    )


# ── Public helpers ──────────────────────────────────────────────────────────


def is_dev_mode() -> bool:
    return _DEV_MODE
