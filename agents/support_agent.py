"""
Gnoscenti Atlas Engine - Support Agent
Deploys Chatwoot for live chat, ticketing, and multi-channel customer support.
"""
from __future__ import annotations
from typing import Any, Dict
from agents.base import BaseAgent

COMPOSE_SNIPPET = """\
  chatwoot:
    image: chatwoot/chatwoot:latest
    container_name: atlas_chatwoot
    restart: unless-stopped
    environment:
      - SECRET_KEY_BASE={secret_key}
      - FRONTEND_URL=http://localhost:{port}
      - DEFAULT_LOCALE=en
      - RAILS_ENV=production
      - POSTGRES_HOST=chatwoot_db
      - POSTGRES_DATABASE=chatwoot
      - POSTGRES_USERNAME=chatwoot
      - POSTGRES_PASSWORD={db_password}
      - REDIS_URL=redis://chatwoot_redis:6379
    volumes:
      - ./data/chatwoot/storage:/app/storage
    ports:
      - "{port}:3000"
    networks:
      - atlas_network
    depends_on:
      - chatwoot_db
      - chatwoot_redis
    command: bundle exec rails s -p 3000 -b 0.0.0.0

  chatwoot_db:
    image: postgres:15-alpine
    container_name: atlas_chatwoot_db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=chatwoot
      - POSTGRES_USER=chatwoot
      - POSTGRES_PASSWORD={db_password}
    volumes:
      - ./data/chatwoot_db:/var/lib/postgresql/data
    networks:
      - atlas_network

  chatwoot_redis:
    image: redis:7-alpine
    container_name: atlas_chatwoot_redis
    restart: unless-stopped
    networks:
      - atlas_network
"""

class SupportAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Support", llm_client, config)

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Analyzing customer support requirements...")
        return {
            "port": self.config.ports.get("chatwoot", 3000),
            "channels": ["Live chat widget", "Email inbox", "API channel"],
            "features": [
                "Shared team inbox",
                "Canned responses",
                "Private notes",
                "Contact management",
                "Conversation labels",
                "Mobile apps (iOS/Android)",
                "Reports and analytics",
                "Webhooks and API",
            ],
        }

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_type = task.get("type", "deploy_chatwoot")
        analysis = task.get("analysis", self.analyze(task))

        if task_type == "deploy_chatwoot":
            import secrets
            db_password = self.vault.get("db_password", namespace="chatwoot") or self.vault.generate_password(24)
            secret_key = self.vault.get("secret_key", namespace="chatwoot") or secrets.token_hex(64)
            self.vault.set_service_credentials("chatwoot", {
                "db_password": db_password,
                "secret_key": secret_key,
            })
            snippet = COMPOSE_SNIPPET.format(
                db_password=db_password,
                secret_key=secret_key,
                port=analysis["port"],
            )
            return self.success(
                f"Chatwoot configured on port {analysis['port']}",
                compose_snippet=snippet,
                features=analysis["features"],
                admin_url=f"http://localhost:{analysis['port']}",
            )
        return self.failure(f"Unknown task type: {task.get('type')}")
