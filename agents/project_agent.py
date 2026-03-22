"""
Gnoscenti Atlas Engine - Project Agent
Deploys Taiga for agile project management: kanban, scrum, and issue tracking.
"""
from __future__ import annotations
from typing import Any, Dict
from agents.base import BaseAgent

COMPOSE_SNIPPET = """\
  taiga-back:
    image: taigaio/taiga-back:latest
    container_name: atlas_taiga_back
    restart: unless-stopped
    environment:
      - POSTGRES_DB=taiga
      - POSTGRES_USER=taiga
      - POSTGRES_PASSWORD={db_password}
      - POSTGRES_HOST=taiga_db
      - TAIGA_SECRET_KEY={secret_key}
      - TAIGA_SITES_DOMAIN=localhost:{port}
      - TAIGA_SITES_SCHEME=http
    networks:
      - atlas_network
    depends_on:
      - taiga_db
      - taiga_redis

  taiga-front:
    image: taigaio/taiga-front:latest
    container_name: atlas_taiga_front
    restart: unless-stopped
    environment:
      - TAIGA_URL=http://localhost:{port}
      - TAIGA_WEBSOCKETS_URL=ws://localhost:{port}
    ports:
      - "{port}:80"
    networks:
      - atlas_network

  taiga_db:
    image: postgres:15-alpine
    container_name: atlas_taiga_db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=taiga
      - POSTGRES_USER=taiga
      - POSTGRES_PASSWORD={db_password}
    volumes:
      - ./data/taiga_db:/var/lib/postgresql/data
    networks:
      - atlas_network

  taiga_redis:
    image: redis:7-alpine
    container_name: atlas_taiga_redis
    restart: unless-stopped
    networks:
      - atlas_network
"""

class ProjectAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Project", llm_client, config)

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Analyzing project management requirements...")
        return {
            "port": self.config.ports.get("taiga", 9000),
            "methodology": context.get("methodology", "kanban"),
            "features": [
                "Kanban boards",
                "Scrum sprints",
                "User stories and epics",
                "Issue tracking",
                "Backlog management",
                "Burndown charts",
                "Time tracking",
                "Wikis",
                "Webhooks and API",
            ],
        }

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_type = task.get("type", "deploy_taiga")
        analysis = task.get("analysis", self.analyze(task))

        if task_type == "deploy_taiga":
            import secrets
            db_password = self.vault.get("db_password", namespace="taiga") or self.vault.generate_password(24)
            secret_key = self.vault.get("secret_key", namespace="taiga") or secrets.token_hex(32)
            self.vault.set_service_credentials("taiga", {
                "db_password": db_password,
                "secret_key": secret_key,
            })
            snippet = COMPOSE_SNIPPET.format(
                db_password=db_password,
                secret_key=secret_key,
                port=analysis["port"],
            )
            return self.success(
                f"Taiga configured on port {analysis['port']}",
                compose_snippet=snippet,
                features=analysis["features"],
                admin_url=f"http://localhost:{analysis['port']}",
            )
        return self.failure(f"Unknown task type: {task.get('type')}")
