"""
Security Agent — LaunchOps Founder Edition
Bitwarden/Vaultwarden password management + server hardening + SSL + firewall.
Merged from gnoscenti-launchops security + original Vaultwarden setup.
"""

from typing import Dict, List, Optional
import subprocess
import json
import os
import secrets
import string

from .base import BaseAgent


class SecurityAgent(BaseAgent):
    """
    Full security stack:
    - Vaultwarden password management
    - Server hardening (UFW, fail2ban, SSH)
    - SSL/TLS via Let's Encrypt
    - Secure password generation
    - 2FA policy enforcement
    """

    def __init__(self, llm_client=None, config: Dict = None):
        super().__init__(
            name="security_agent",
            role="Security Infrastructure & Password Management",
            llm_client=llm_client,
            config=config or {},
        )

    def analyze(self, context: Dict) -> Dict:
        domain = context.get("domain", "")
        team_size = context.get("team_size", 1)

        server_checks = {
            "ssl_configured": self._check_ssl(),
            "firewall_active": self._check_firewall(),
            "fail2ban_active": self._check_service("fail2ban"),
            "ssh_hardened": self._check_ssh_hardening(),
            "docker_running": self._check_service("docker"),
        }
        score = sum(1 for v in server_checks.values() if v) / len(server_checks) * 100

        return {
            "server_security": server_checks,
            "security_score": f"{score:.0f}%",
            "issues": [k for k, v in server_checks.items() if not v],
            "vault_url": f"https://vault.{domain}" if domain else "http://localhost:8080",
            "required_passwords": self._identify_required_passwords(context),
            "recommendations": self._get_recommendations(server_checks, team_size),
        }

    def execute(self, task: Dict) -> Dict:
        task_type = task.get("type", "audit")
        handlers = {
            "audit": lambda t: self.analyze(t),
            "harden": self._harden_server,
            "setup_ssl": self._setup_ssl,
            "setup_firewall": self._setup_firewall,
            "deploy_bitwarden": self._deploy_bitwarden,
            "generate_passwords": self._generate_passwords,
            "setup_2fa": self._setup_2fa,
            "full_security_setup": self._full_security_setup,
        }
        handler = handlers.get(task_type, lambda t: {"success": False, "error": f"Unknown: {task_type}"})
        return handler(task)

    # ── Server Hardening ──────────────────────────────────────────────────

    def _harden_server(self, task: Dict) -> Dict:
        results = []
        results.append(("ufw", self._run("sudo ufw --force enable && sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443")))
        results.append(("fail2ban", self._run("sudo apt-get install -y fail2ban && sudo systemctl enable fail2ban && sudo systemctl start fail2ban")))
        results.append(("upgrades", self._run("sudo apt-get install -y unattended-upgrades")))
        return {"success": True, "results": dict(results)}

    def _setup_ssl(self, task: Dict) -> Dict:
        domain = task.get("domain", "")
        email = task.get("email", "")
        if not domain or not email:
            return {"success": False, "error": "Need domain and email"}
        result = self._run(f"sudo certbot --nginx -d {domain} --non-interactive --agree-tos -m {email}")
        return {"success": True, "output": result}

    def _setup_firewall(self, task: Dict) -> Dict:
        ports = task.get("ports", [22, 80, 443, 8080])
        cmds = ["sudo ufw --force enable", "sudo ufw default deny incoming", "sudo ufw default allow outgoing"]
        for p in ports:
            cmds.append(f"sudo ufw allow {p}")
        return {"success": True, "output": self._run(" && ".join(cmds)), "ports": ports}

    # ── Vaultwarden ───────────────────────────────────────────────────────

    def _deploy_bitwarden(self, task: Dict) -> Dict:
        domain = task.get("domain", "localhost")
        port = task.get("port", 8080)
        data_dir = task.get("data_dir", "/opt/vaultwarden/data")
        os.makedirs(data_dir, exist_ok=True)

        compose = f"""version: '3.8'
services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: unless-stopped
    environment:
      - DOMAIN=https://vault.{domain}
      - SIGNUPS_ALLOWED=true
      - INVITATIONS_ALLOWED=true
      - SHOW_PASSWORD_HINT=false
      - WEBSOCKET_ENABLED=true
    volumes:
      - {data_dir}:/data
    ports:
      - "{port}:80"
"""
        compose_path = os.path.join(data_dir, "docker-compose.yml")
        with open(compose_path, "w") as f:
            f.write(compose)

        try:
            subprocess.run(["docker-compose", "-f", compose_path, "up", "-d"], check=True, capture_output=True, text=True)
            return {"success": True, "vault_url": f"http://localhost:{port}", "data_dir": data_dir}
        except subprocess.CalledProcessError as e:
            return {"success": False, "error": str(e.stderr)}

    def _generate_passwords(self, task: Dict) -> Dict:
        services = task.get("services", self._identify_required_passwords(task))
        length = task.get("password_length", 32)
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        passwords = {svc: "".join(secrets.choice(alphabet) for _ in range(length)) for svc in services}
        return {"success": True, "passwords": passwords, "warning": "Store in Bitwarden immediately, then delete."}

    def _setup_2fa(self, task: Dict) -> Dict:
        return {
            "success": True,
            "instructions": [
                "Login to Vaultwarden as admin",
                "Go to Organization Settings → Policies",
                "Enable 'Two-step Login' policy",
                "Set to 'Required'",
                "Recommended: Authenticator app (Authy/Google Authenticator)",
            ],
        }

    # ── Full Setup ────────────────────────────────────────────────────────

    def _full_security_setup(self, task: Dict) -> Dict:
        results = {}
        results["hardening"] = self._harden_server(task)
        results["passwords"] = self._generate_passwords(task)
        if task.get("domain") and task.get("email"):
            results["ssl"] = self._setup_ssl(task)
        if task.get("deploy_vault", True):
            results["vault"] = self._deploy_bitwarden(task)
        return {"success": True, "results": results}

    # ── Helpers ───────────────────────────────────────────────────────────

    def _run(self, cmd: str) -> str:
        try:
            return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30).stdout.strip()
        except Exception as e:
            return str(e)

    def _check_ssl(self) -> bool:
        return os.path.exists("/etc/letsencrypt/live") or bool(self._run("which certbot 2>/dev/null"))

    def _check_firewall(self) -> bool:
        return "active" in self._run("sudo ufw status 2>/dev/null").lower()

    def _check_service(self, name: str) -> bool:
        return "active" in self._run(f"systemctl is-active {name} 2>/dev/null")

    def _check_ssh_hardening(self) -> bool:
        cfg = self._run("cat /etc/ssh/sshd_config 2>/dev/null")
        return "PermitRootLogin no" in cfg or "PasswordAuthentication no" in cfg

    def _identify_required_passwords(self, context: Dict) -> List[str]:
        return [
            "wordpress_admin", "wordpress_db", "stripe_api", "mautic_admin",
            "database_root", "vps_root", "email_admin", "vaultwarden_admin",
        ]

    def _get_recommendations(self, checks: Dict, team_size: int) -> List[str]:
        recs = []
        if not checks.get("firewall_active"):
            recs.append("Enable UFW firewall immediately")
        if not checks.get("ssl_configured"):
            recs.append("Setup SSL with Let's Encrypt")
        if not checks.get("fail2ban_active"):
            recs.append("Install fail2ban for brute-force protection")
        if team_size > 1:
            recs.append("Deploy Vaultwarden for team password management")
        return recs
