"""
Gnoscenti Atlas Engine - Files Agent
Deploys Nextcloud for secure file storage, sharing, and collaboration.
"""
from __future__ import annotations
from typing import Any, Dict
from agents.base import BaseAgent

COMPOSE_SNIPPET = """\
  nextcloud:
    image: nextcloud:27-apache
    container_name: atlas_nextcloud
    restart: unless-stopped
    environment:
      - MYSQL_HOST=nextcloud_db
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD={db_password}
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD={admin_password}
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost {domain}
    volumes:
      - ./data/nextcloud:/var/www/html
    ports:
      - "{port}:80"
    networks:
      - atlas_network
    depends_on:
      - nextcloud_db

  nextcloud_db:
    image: mariadb:10.11
    container_name: atlas_nextcloud_db
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD={db_root_password}
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD={db_password}
    volumes:
      - ./data/nextcloud_db:/var/lib/mysql
    networks:
      - atlas_network
"""

class FilesAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Files", llm_client, config)

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Analyzing file storage requirements...")
        team_size = context.get("team_size", 1)
        storage_gb = max(50, team_size * 20)
        return {
            "port": self.config.ports.get("nextcloud", 8082),
            "storage_gb": storage_gb,
            "features": [
                "File sync and share",
                "End-to-end encryption",
                "Mobile apps (iOS/Android)",
                "Office document editing (Collabora)",
                "Calendar and contacts",
                "Video calls (Talk)",
                "Activity monitoring",
                "External storage support (S3, FTP)",
            ],
        }

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_type = task.get("type", "deploy_nextcloud")
        analysis = task.get("analysis", self.analyze(task))

        if task_type == "deploy_nextcloud":
            db_password = self.vault.get("db_password", namespace="nextcloud") or self.vault.generate_password(24)
            db_root_password = self.vault.get("db_root_password", namespace="nextcloud") or self.vault.generate_password(24)
            admin_password = self.vault.get("admin_password", namespace="nextcloud") or self.vault.generate_password(20)
            self.vault.set_service_credentials("nextcloud", {
                "db_password": db_password,
                "db_root_password": db_root_password,
                "admin_password": admin_password,
            })
            domain = self.config.business.domain or "localhost"
            snippet = COMPOSE_SNIPPET.format(
                db_password=db_password,
                db_root_password=db_root_password,
                admin_password=admin_password,
                domain=domain,
                port=analysis["port"],
            )
            return self.success(
                f"Nextcloud configured on port {analysis['port']}",
                compose_snippet=snippet,
                features=analysis["features"],
                admin_url=f"http://localhost:{analysis['port']}",
                admin_user="admin",
            )
        return self.failure(f"Unknown task type: {task.get('type')}")
