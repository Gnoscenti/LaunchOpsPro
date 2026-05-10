"""
Application settings — loaded from environment variables.
All values have safe defaults so the server starts in MOCK_MODE
without any configuration.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    # OpenAI / LLM
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", "EMPTY"))
    openai_api_base: str = field(
        default_factory=lambda: os.getenv(
            "OPENAI_API_BASE", "https://api.openai.com/v1"
        )
    )
    openai_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o")
    )

    # Runtime
    mock_mode: bool = field(
        default_factory=lambda: os.getenv("MOCK_MODE", "true").lower() == "true"
    )
    max_agent_iterations: int = field(
        default_factory=lambda: int(os.getenv("MAX_AGENT_ITERATIONS", "10"))
    )

    # Storage paths
    workspace_path: str = field(
        default_factory=lambda: os.getenv("WORKSPACE_PATH", "/app/data/workspace")
    )
    artifacts_path: str = field(
        default_factory=lambda: os.getenv("ARTIFACTS_PATH", "/app/data/artifacts")
    )

    # Server
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8001")))
    dashboard_origin: str = field(
        default_factory=lambda: os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000")
    )


settings = Settings()
