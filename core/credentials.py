"""Fernet-encrypted local credential storage for LaunchOpsPro."""

import json
import os
import secrets
import string
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

try:
    from cryptography.fernet import Fernet
except ImportError:
    Fernet = None

from .config import get_config


class CredentialVault:
    """
    Encrypted credential storage. Stores API keys, tokens, and secrets
    locally with Fernet symmetric encryption. Keys never leave the machine.
    """

    def __init__(self, base_dir: Optional[Path] = None):
        config = get_config()
        credentials_dir = Path(base_dir) if base_dir else config.credentials_dir
        credentials_dir.mkdir(parents=True, exist_ok=True)
        self.vault_path = credentials_dir / "vault.enc"
        self.key_path = credentials_dir / "vault.key"
        self._fernet: Optional[Any] = None
        self._credentials: Dict[str, Dict[str, Any]] = {}
        if Fernet is None:
            raise RuntimeError(
                "cryptography is required; LaunchOpsPro will not store credentials as plaintext"
            )
        self._encrypted = True
        self._init_encryption()
        self._load()

    def _init_encryption(self):
        if not self._encrypted:
            return
        if self.key_path.exists():
            with open(self.key_path, "rb") as f:
                key = f.read()
        else:
            key = Fernet.generate_key()
            with open(self.key_path, "wb") as f:
                f.write(key)
            os.chmod(self.key_path, 0o600)
        self._fernet = Fernet(key)

    def _load(self):
        if not self.vault_path.exists():
            self._credentials = {}
            return
        try:
            with open(self.vault_path, "rb") as f:
                raw = f.read()
            if self._encrypted and self._fernet:
                raw = self._fernet.decrypt(raw)
            self._credentials = json.loads(raw.decode("utf-8"))
        except Exception as e:
            print(f"[vault] Warning: Could not load credentials: {e}")
            self._credentials = {}

    def _save(self):
        data = json.dumps(self._credentials, indent=2).encode("utf-8")
        if self._encrypted and self._fernet:
            data = self._fernet.encrypt(data)
        with open(self.vault_path, "wb") as f:
            f.write(data)
        os.chmod(self.vault_path, 0o600)

    # ── Public API ────────────────────────────────────────────────────────

    def store(self, service: str, credential_type: str, value: str,
              metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Store a credential. Overwrites if exists."""
        if service not in self._credentials:
            self._credentials[service] = {}
        self._credentials[service][credential_type] = {
            "value": value,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata or {},
        }
        self._save()
        return True

    def retrieve(self, service: str, credential_type: str) -> Optional[str]:
        """Retrieve a credential value."""
        entry = self._credentials.get(service, {}).get(credential_type)
        return entry["value"] if entry else None

    def list_services(self) -> List[str]:
        return list(self._credentials.keys())

    def list_credentials(self, service: str) -> List[str]:
        return list(self._credentials.get(service, {}).keys())

    def delete(self, service: str, credential_type: Optional[str] = None) -> bool:
        if service not in self._credentials:
            return False
        if credential_type:
            self._credentials[service].pop(credential_type, None)
        else:
            del self._credentials[service]
        self._save()
        return True

    def export_env(self, service: str) -> Dict[str, str]:
        """Export all credentials for a service as env-var-style dict."""
        result = {}
        for cred_type, entry in self._credentials.get(service, {}).items():
            env_key = f"{service.upper()}_{cred_type.upper()}"
            result[env_key] = entry["value"]
        return result

    def bulk_store_from_env(self, env_map: Dict[str, tuple]):
        """
        Bulk import from environment variables.
        env_map: {"ENV_VAR_NAME": ("service", "credential_type")}
        """
        for env_key, (service, cred_type) in env_map.items():
            val = os.environ.get(env_key)
            if val:
                self.store(service, cred_type, val)

    # ── Stable Agent-Facing API ──────────────────────────────────────────

    def set(self, key: str, value: str, namespace: str = "launchops") -> bool:
        """Store a named secret inside a namespace."""
        return self.store(namespace, key, value)

    def get(self, key: str, namespace: str = "launchops") -> Optional[str]:
        """Retrieve a named secret from a namespace."""
        return self.retrieve(namespace, key)

    def generate_password(self, length: int = 32) -> str:
        """Generate a cryptographically secure password."""
        if length < 16:
            raise ValueError("Generated passwords must be at least 16 characters")
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    def set_service_credentials(self, service: str, credentials: Dict[str, str]) -> None:
        """Persist a set of credentials for one service."""
        for credential_type, value in credentials.items():
            self.store(service, credential_type, value)


# ── Singleton ─────────────────────────────────────────────────────────────

_vault: Optional[CredentialVault] = None


def get_vault() -> CredentialVault:
    global _vault
    if _vault is None:
        _vault = CredentialVault()
    return _vault
