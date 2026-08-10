"""Typed configuration for the canonical LaunchOpsPro runtime."""

import os
import json
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, Optional, Any


logger = logging.getLogger("launchops.config")


LAUNCHOPS_DIR = Path.home() / ".launchops"
CREDENTIALS_DIR = LAUNCHOPS_DIR / "credentials"
DATA_DIR = LAUNCHOPS_DIR / "data"
LOGS_DIR = LAUNCHOPS_DIR / "logs"
DOCS_DIR = LAUNCHOPS_DIR / "documents"
DOCUMENTARY_DIR = LAUNCHOPS_DIR / "documentary"


@dataclass
class LaunchOpsConfig:
    """
    Master configuration for LaunchOpsPro.

    Flat fields remain the persisted schema. ``to_dict`` also exposes stable
    ``business``, ``llm``, and ``ports`` groups consumed by the agent runtime.
    """

    # ── Identity ──────────────────────────────────────────────────────────
    founder_name: str = ""
    founder_email: str = ""
    business_name: str = ""
    business_type: str = "saas"          # saas, agency, ecommerce, consulting
    entity_type: str = "Delaware_C_Corp" # Delaware_C_Corp, Delaware_LLC, Home_State_LLC
    state: str = "Delaware"
    home_state: str = "California"

    # ── LLM ───────────────────────────────────────────────────────────────
    llm_provider: str = "openai"         # openai, anthropic, local
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_base_url: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # ── Infrastructure ────────────────────────────────────────────────────
    domain: str = ""
    server_ip: str = ""
    docker_compose_dir: str = "./infrastructure"

    # ── Services ──────────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    github_token: str = ""
    firebase_project_id: str = ""
    vercel_token: str = ""
    mautic_url: str = ""
    mautic_user: str = ""
    mautic_password: str = ""
    wordpress_url: str = ""
    wordpress_user: str = ""
    wordpress_password: str = ""
    vaultwarden_url: str = ""
    vaultwarden_admin_token: str = ""

    # ── Funding Profile ───────────────────────────────────────────────────
    seeking_vc: bool = True
    has_rd_component: bool = True
    us_citizen_owner: bool = True
    monthly_revenue: float = 0.0
    employees: int = 1

    # ── Paths ─────────────────────────────────────────────────────────────
    launchops_dir: Path = field(default_factory=lambda: LAUNCHOPS_DIR)
    credentials_dir: Path = field(default_factory=lambda: CREDENTIALS_DIR)
    data_dir: Path = field(default_factory=lambda: DATA_DIR)
    logs_dir: Path = field(default_factory=lambda: LOGS_DIR)
    docs_dir: Path = field(default_factory=lambda: DOCS_DIR)
    documentary_dir: Path = field(default_factory=lambda: DOCUMENTARY_DIR)

    def __post_init__(self):
        """Create all directories and load env vars."""
        for d in [self.launchops_dir, self.credentials_dir, self.data_dir,
                  self.logs_dir, self.docs_dir, self.documentary_dir]:
            d.mkdir(parents=True, exist_ok=True)
        self._load_env()
        self._load_config_file()

    # ── Env Loading ───────────────────────────────────────────────────────

    def _load_env(self):
        """Pull from environment variables — overrides defaults."""
        env_map = {
            "LAUNCHOPS_FOUNDER_NAME": "founder_name",
            "LAUNCHOPS_FOUNDER_EMAIL": "founder_email",
            "LAUNCHOPS_BUSINESS_NAME": "business_name",
            "LAUNCHOPS_BUSINESS_TYPE": "business_type",
            "LAUNCHOPS_ENTITY_TYPE": "entity_type",
            "LAUNCHOPS_STATE": "state",
            "LAUNCHOPS_HOME_STATE": "home_state",
            "LAUNCHOPS_DOMAIN": "domain",
            "LAUNCHOPS_SERVER_IP": "server_ip",
            "OPENAI_API_KEY": "openai_api_key",
            "OPENAI_API_BASE": "openai_base_url",
            "OPENAI_MODEL": "openai_model",
            "ANTHROPIC_API_KEY": "anthropic_api_key",
            "LLM_PROVIDER": "llm_provider",
            "STRIPE_SECRET_KEY": "stripe_secret_key",
            "STRIPE_PUBLISHABLE_KEY": "stripe_publishable_key",
            "GITHUB_TOKEN": "github_token",
            "FIREBASE_PROJECT_ID": "firebase_project_id",
            "VERCEL_TOKEN": "vercel_token",
            "MAUTIC_URL": "mautic_url",
            "MAUTIC_USER": "mautic_user",
            "MAUTIC_PASSWORD": "mautic_password",
            "WORDPRESS_URL": "wordpress_url",
            "WORDPRESS_USER": "wordpress_user",
            "WORDPRESS_PASSWORD": "wordpress_password",
            "VAULTWARDEN_URL": "vaultwarden_url",
            "VAULTWARDEN_ADMIN_TOKEN": "vaultwarden_admin_token",
        }
        for env_key, attr in env_map.items():
            val = os.environ.get(env_key)
            if val:
                setattr(self, attr, val)

    def _load_config_file(self):
        """Load from ~/.launchops/config.json if it exists."""
        config_path = self.launchops_dir / "config.json"
        if config_path.exists():
            try:
                with open(config_path) as f:
                    data = json.load(f)
                for key, val in data.items():
                    if hasattr(self, key):
                        setattr(self, key, val)
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Ignoring unreadable config file %s: %s", config_path, exc)

    def save(self):
        """Persist current config to disk."""
        config_path = self.launchops_dir / "config.json"
        data = {}
        for key in self.__dataclass_fields__:
            val = getattr(self, key)
            if isinstance(val, Path):
                val = str(val)
            data[key] = val
        with open(config_path, "w") as f:
            json.dump(data, f, indent=2)

    def to_dict(self) -> Dict[str, Any]:
        """Export the persisted fields plus stable agent-facing groups."""
        d = {}
        for key in self.__dataclass_fields__:
            val = getattr(self, key)
            if isinstance(val, Path):
                val = str(val)
            d[key] = val
        d["business"] = {
            "founder_name": self.founder_name,
            "founder_email": self.founder_email,
            "business_name": self.business_name,
            "business_type": self.business_type,
            "entity_type": self.entity_type,
            "state": self.state,
            "home_state": self.home_state,
            "domain": self.domain,
        }
        d["llm"] = self.get_llm_config()
        d["ports"] = {
            "wordpress": 8080,
            "mautic": 8082,
            "matomo": 8083,
            "nextcloud": 8084,
            "taiga": 9000,
            "chatwoot": 3000,
        }
        return d

    def get_llm_config(self) -> Dict[str, str]:
        """Get LLM configuration for agents."""
        if self.llm_provider == "anthropic":
            return {
                "provider": "anthropic",
                "api_key": self.anthropic_api_key,
                "model": self.anthropic_model,
            }
        return {
            "provider": "openai",
            "api_key": self.openai_api_key,
            "model": self.openai_model,
            "base_url": self.openai_base_url,
        }


# ── Singleton ─────────────────────────────────────────────────────────────

_config: Optional[LaunchOpsConfig] = None


def get_config() -> LaunchOpsConfig:
    """Get or create the global config singleton."""
    global _config
    if _config is None:
        _config = LaunchOpsConfig()
    return _config


def init_config(**kwargs) -> LaunchOpsConfig:
    """Initialize config with explicit values."""
    global _config
    _config = LaunchOpsConfig(**kwargs)
    return _config


# Temporary import compatibility for integrations built against the former
# class name. New code should use LaunchOpsConfig.
AtlasConfig = LaunchOpsConfig
