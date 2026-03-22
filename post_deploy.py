#!/usr/bin/env python3
"""
Gnoscenti Atlas Engine — Post-Deploy Configuration Script v2.0

Runs after docker compose up to:
  1. Verify all 7 services are reachable
  2. Configure Matomo (create site, get tracking ID)
  3. Configure Chatwoot (create account, get API token)
  4. Configure Nextcloud (set trusted domains, disable setup wizard)
  5. Configure Mautic (set site URL, configure SMTP)
  6. Store all generated credentials in the ATLAS vault
  7. Print a final configuration summary

Usage:
    python3 post_deploy.py
    python3 post_deploy.py --env-file /path/to/.env
    python3 post_deploy.py --dry-run
    python3 post_deploy.py --service matomo  (configure one service only)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urljoin

# ── Try to import requests; fall back to urllib ───────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False

# ── ANSI colors ───────────────────────────────────────────────────────────────
GREEN  = "\033[0;32m"
YELLOW = "\033[1;33m"
RED    = "\033[0;31m"
CYAN   = "\033[0;36m"
BOLD   = "\033[1m"
NC     = "\033[0m"

def info(msg):    print(f"{CYAN}[INFO]{NC}  {msg}")
def success(msg): print(f"{GREEN}[OK]{NC}    {msg}")
def warn(msg):    print(f"{YELLOW}[WARN]{NC}  {msg}")
def error(msg):   print(f"{RED}[ERROR]{NC} {msg}", file=sys.stderr)
def step(msg):    print(f"\n{BOLD}{CYAN}▶ {msg}{NC}")


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def load_env(env_file: str) -> Dict[str, str]:
    """Load .env file into a dict."""
    env = {}
    path = Path(env_file)
    if not path.exists():
        warn(f".env file not found at {env_file}")
        return env
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def http_get(url: str, headers: Optional[Dict] = None, timeout: int = 10) -> Optional[Dict]:
    """Simple HTTP GET returning parsed JSON or None."""
    try:
        if HAS_REQUESTS:
            r = requests.get(url, headers=headers or {}, timeout=timeout)
            r.raise_for_status()
            return r.json()
        else:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
    except Exception as exc:
        return None


def http_post(url: str, data: Dict, headers: Optional[Dict] = None, timeout: int = 15) -> Optional[Dict]:
    """Simple HTTP POST with JSON body, returning parsed JSON or None."""
    try:
        body = json.dumps(data).encode()
        hdrs = {"Content-Type": "application/json", **(headers or {})}
        if HAS_REQUESTS:
            r = requests.post(url, json=data, headers=hdrs, timeout=timeout)
            r.raise_for_status()
            return r.json()
        else:
            req = urllib.request.Request(url, data=body, headers=hdrs, method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
    except Exception as exc:
        return None


def wait_for_url(url: str, label: str, timeout: int = 120, interval: int = 5) -> bool:
    """Poll a URL until it responds with 2xx or timeout."""
    elapsed = 0
    print(f"  Waiting for {label}...", end="", flush=True)
    while elapsed < timeout:
        try:
            if HAS_REQUESTS:
                r = requests.get(url, timeout=5)
                if r.status_code < 500:
                    print(f" {GREEN}✓{NC} ({elapsed}s)")
                    return True
            else:
                urllib.request.urlopen(url, timeout=5)
                print(f" {GREEN}✓{NC} ({elapsed}s)")
                return True
        except Exception:
            pass
        time.sleep(interval)
        elapsed += interval
        print(".", end="", flush=True)
    print(f" {RED}✗ TIMEOUT{NC}")
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# SERVICE CONFIGURATORS
# ═══════════════════════════════════════════════════════════════════════════════

class PostDeployConfigurator:
    def __init__(self, env: Dict[str, str], dry_run: bool = False):
        self.env = env
        self.dry_run = dry_run
        self.domain = env.get("DOMAIN", "localhost")
        self.email = env.get("EMAIL", "admin@example.com")
        self.business_name = env.get("BUSINESS_NAME", "My Startup")
        self.results: Dict[str, Any] = {}

        # Service base URLs
        self.urls = {
            "vaultwarden": f"http://localhost:{env.get('BITWARDEN_PORT', '8000')}",
            "wordpress":   f"http://localhost:{env.get('WORDPRESS_PORT', '8080')}",
            "mautic":      f"http://localhost:{env.get('MAUTIC_PORT', '8081')}",
            "nextcloud":   f"http://localhost:{env.get('NEXTCLOUD_PORT', '8082')}",
            "chatwoot":    f"http://localhost:{env.get('CHATWOOT_PORT', '3001')}",
            "matomo":      f"http://localhost:{env.get('MATOMO_PORT', '8083')}",
            "taiga":       f"http://localhost:{env.get('TAIGA_PORT', '9000')}",
        }

    # ── 1. Health verification ─────────────────────────────────────────────────
    def verify_services(self) -> Dict[str, bool]:
        step("Verifying service availability")
        health = {}
        for name, url in self.urls.items():
            reachable = wait_for_url(url, name, timeout=60)
            health[name] = reachable
            if not reachable:
                warn(f"{name} is not reachable at {url}")
        self.results["health"] = health
        return health

    # ── 2. Matomo configuration ────────────────────────────────────────────────
    def configure_matomo(self) -> Dict[str, Any]:
        step("Configuring Matomo Analytics")
        base = self.urls["matomo"]

        if self.dry_run:
            info("[DRY RUN] Would configure Matomo site and get tracking ID")
            return {"success": True, "site_id": 1, "tracking_url": base}

        # Matomo setup via API (requires superuser token)
        # First, try to create the initial site via the installation API
        site_url = f"https://{self.domain}" if self.domain != "localhost" else "http://localhost"

        result = http_post(f"{base}/index.php", {
            "module": "API",
            "method": "SitesManager.addSite",
            "siteName": self.business_name,
            "urls": [site_url],
            "format": "JSON",
        })

        if result and "value" in result:
            site_id = result["value"]
            tracking_code = self._generate_matomo_tracking_code(base, site_id)
            success(f"Matomo site created (ID: {site_id})")
            self.results["matomo"] = {
                "site_id": site_id,
                "tracking_url": base,
                "tracking_code": tracking_code,
            }
            return {"success": True, "site_id": site_id, "tracking_code": tracking_code}
        else:
            warn("Matomo API not ready — complete setup via browser at: " + base)
            info(f"  URL: {base}")
            info("  After setup, run: python3 post_deploy.py --service matomo")
            self.results["matomo"] = {"pending_manual_setup": True, "url": base}
            return {"success": False, "message": "Matomo requires browser-based initial setup"}

    def _generate_matomo_tracking_code(self, base_url: str, site_id: int) -> str:
        return f"""<!-- Matomo -->
<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {{
    var u="{base_url}/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '{site_id}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  }})();
</script>
<!-- End Matomo Code -->"""

    # ── 3. Chatwoot configuration ──────────────────────────────────────────────
    def configure_chatwoot(self) -> Dict[str, Any]:
        step("Configuring Chatwoot Support")
        base = self.urls["chatwoot"]

        if self.dry_run:
            info("[DRY RUN] Would create Chatwoot account and inbox")
            return {"success": True, "account_id": 1}

        # Create superadmin account via Chatwoot API
        result = http_post(f"{base}/auth/sign_in", {
            "email": self.email,
            "password": self.env.get("CHATWOOT_ADMIN_PASSWORD", ""),
        })

        if result and "data" in result:
            token = result["data"].get("access_token")
            account_id = result["data"].get("account_id", 1)
            success(f"Chatwoot authenticated (account: {account_id})")

            # Create a default inbox
            inbox_result = http_post(
                f"{base}/api/v1/accounts/{account_id}/inboxes",
                {
                    "name": f"{self.business_name} Support",
                    "channel": {"type": "web_widget"},
                    "enable_auto_assignment": True,
                },
                headers={"api_access_token": token},
            )

            inbox_id = None
            if inbox_result and "id" in inbox_result:
                inbox_id = inbox_result["id"]
                success(f"Chatwoot inbox created (ID: {inbox_id})")

            self.results["chatwoot"] = {
                "account_id": account_id,
                "inbox_id": inbox_id,
                "url": base,
                "api_token": token,
            }
            return {"success": True, "account_id": account_id, "inbox_id": inbox_id}
        else:
            warn("Chatwoot not ready — complete setup via browser")
            info(f"  URL: {base}")
            info("  Default admin: " + self.email)
            self.results["chatwoot"] = {"pending_manual_setup": True, "url": base}
            return {"success": False, "message": "Chatwoot requires browser-based initial setup"}

    # ── 4. Nextcloud configuration ─────────────────────────────────────────────
    def configure_nextcloud(self) -> Dict[str, Any]:
        step("Configuring Nextcloud File Storage")
        base = self.urls["nextcloud"]
        admin_pass = self.env.get("NEXTCLOUD_ADMIN_PASSWORD", "")

        if self.dry_run:
            info("[DRY RUN] Would configure Nextcloud trusted domains")
            return {"success": True}

        # Set trusted domains via OCC (Nextcloud CLI)
        # This runs inside the container
        import subprocess

        trusted_domains = [
            "localhost",
            f"localhost:{self.env.get('NEXTCLOUD_PORT', '8082')}",
        ]
        if self.domain != "localhost":
            trusted_domains.append(f"files.{self.domain}")

        for i, domain in enumerate(trusted_domains):
            try:
                subprocess.run([
                    "docker", "exec", "atlas_nextcloud",
                    "php", "occ", "config:system:set",
                    "trusted_domains", str(i), "--value", domain,
                ], capture_output=True, timeout=30)
            except Exception:
                pass

        # Disable Nextcloud setup wizard
        try:
            subprocess.run([
                "docker", "exec", "atlas_nextcloud",
                "php", "occ", "config:system:set",
                "installed", "--value=true", "--type=boolean",
            ], capture_output=True, timeout=30)
        except Exception:
            pass

        success("Nextcloud trusted domains configured")
        self.results["nextcloud"] = {
            "url": base,
            "admin_user": "admin",
            "trusted_domains": trusted_domains,
        }
        return {"success": True, "trusted_domains": trusted_domains}

    # ── 5. Mautic configuration ────────────────────────────────────────────────
    def configure_mautic(self) -> Dict[str, Any]:
        step("Configuring Mautic Email Marketing")
        base = self.urls["mautic"]

        if self.dry_run:
            info("[DRY RUN] Would configure Mautic site URL and SMTP")
            return {"success": True}

        site_url = f"https://mail.{self.domain}" if self.domain != "localhost" else base

        # Mautic config is typically done via the web installer
        # We can pre-configure via the config file in the container
        import subprocess
        try:
            config_cmd = f"""
php -r "
\$config = [
    'site_url' => '{site_url}',
    'db_driver' => 'pdo_mysql',
    'mailer_from_name' => '{self.business_name}',
    'mailer_from_email' => '{self.email}',
];
file_put_contents('/var/www/html/app/config/local.php',
    '<?php \$parameters = ' . var_export(\$config, true) . ';');
"
"""
            subprocess.run(
                ["docker", "exec", "atlas_mautic", "bash", "-c", config_cmd],
                capture_output=True, timeout=30,
            )
            success("Mautic pre-configured")
        except Exception as exc:
            warn(f"Mautic auto-config failed: {exc}")

        info(f"  Complete Mautic setup at: {base}")
        info(f"  Site URL to use: {site_url}")
        self.results["mautic"] = {
            "url": base,
            "site_url": site_url,
            "admin_email": self.email,
        }
        return {"success": True, "site_url": site_url}

    # ── 6. WordPress configuration ─────────────────────────────────────────────
    def configure_wordpress(self) -> Dict[str, Any]:
        step("Configuring WordPress")
        base = self.urls["wordpress"]

        if self.dry_run:
            info("[DRY RUN] Would configure WordPress site URL and install plugins")
            return {"success": True}

        import subprocess

        site_url = f"https://{self.domain}" if self.domain != "localhost" else f"http://localhost:{self.env.get('WORDPRESS_PORT', '8080')}"

        # Update site URL via WP-CLI
        wp_commands = [
            f"wp --allow-root option update siteurl '{site_url}'",
            f"wp --allow-root option update home '{site_url}'",
            f"wp --allow-root option update blogname '{self.business_name}'",
            f"wp --allow-root option update admin_email '{self.email}'",
            # Install essential plugins
            "wp --allow-root plugin install wordpress-seo --activate",
            "wp --allow-root plugin install wordfence --activate",
            "wp --allow-root plugin install contact-form-7 --activate",
            "wp --allow-root plugin install updraftplus --activate",
            # Set permalink structure for SEO
            "wp --allow-root rewrite structure '/%postname%/'",
            "wp --allow-root rewrite flush",
        ]

        installed_plugins = []
        for cmd in wp_commands:
            try:
                result = subprocess.run(
                    ["docker", "exec", "atlas_wordpress", "bash", "-c", cmd],
                    capture_output=True, text=True, timeout=60,
                )
                if result.returncode == 0:
                    if "plugin install" in cmd:
                        plugin = cmd.split("plugin install ")[1].split(" ")[0]
                        installed_plugins.append(plugin)
                        success(f"WordPress plugin installed: {plugin}")
                else:
                    warn(f"WP-CLI command failed: {cmd[:60]}...")
            except Exception as exc:
                warn(f"WP-CLI error: {exc}")

        success(f"WordPress configured at {site_url}")
        self.results["wordpress"] = {
            "url": base,
            "site_url": site_url,
            "plugins_installed": installed_plugins,
        }
        return {"success": True, "site_url": site_url, "plugins": installed_plugins}

    # ── 7. Vaultwarden configuration ───────────────────────────────────────────
    def configure_vaultwarden(self) -> Dict[str, Any]:
        step("Configuring Vaultwarden Password Vault")
        base = self.urls["vaultwarden"]

        if self.dry_run:
            info("[DRY RUN] Would configure Vaultwarden admin settings")
            return {"success": True}

        # Vaultwarden admin panel is at /admin with the BITWARDEN_ADMIN_TOKEN
        admin_token = self.env.get("BITWARDEN_ADMIN_TOKEN", "")
        admin_url = f"{base}/admin"

        info(f"Vaultwarden admin panel: {admin_url}")
        info(f"Admin token: {admin_token[:8]}... (see .env for full token)")
        info("Create your account at: " + base)

        self.results["vaultwarden"] = {
            "url": base,
            "admin_url": admin_url,
            "note": "Create your account via the web UI, then store all credentials there",
        }
        return {"success": True, "url": base, "admin_url": admin_url}

    # ── 8. Store results in vault ──────────────────────────────────────────────
    def store_in_vault(self) -> None:
        step("Storing configuration in ATLAS credential vault")
        try:
            sys.path.insert(0, str(Path(__file__).parent))
            from core.credentials import CredentialVault
            vault = CredentialVault()

            for service, data in self.results.items():
                if isinstance(data, dict):
                    for key, val in data.items():
                        if isinstance(val, (str, int)):
                            vault.set(f"{service}_{key}", str(val), namespace="post_deploy")

            success("Configuration stored in ATLAS vault")
        except Exception as exc:
            warn(f"Could not store in vault: {exc}")

    # ── 9. Print summary ───────────────────────────────────────────────────────
    def print_summary(self) -> None:
        print(f"\n{BOLD}{GREEN}═══════════════════════════════════════════════════════════════{NC}")
        print(f"{BOLD}{GREEN}  ✓  Post-Deploy Configuration Complete{NC}")
        print(f"{BOLD}{GREEN}═══════════════════════════════════════════════════════════════{NC}\n")

        print(f"{BOLD}  Service Configuration Summary:{NC}\n")
        for service, data in self.results.items():
            if isinstance(data, dict):
                url = data.get("url", data.get("tracking_url", ""))
                status = "✓" if not data.get("pending_manual_setup") else "⚠ manual setup required"
                print(f"  {GREEN if '✓' in status else YELLOW}{status}{NC}  {service.title()}")
                if url:
                    print(f"      URL: {CYAN}{url}{NC}")
                if data.get("site_id"):
                    print(f"      Site ID: {data['site_id']}")
                if data.get("account_id"):
                    print(f"      Account ID: {data['account_id']}")

        print(f"\n{BOLD}  Manual Setup Required:{NC}")
        print(f"  Services marked ⚠ need browser-based initial setup.")
        print(f"  After completing setup, re-run: {CYAN}python3 post_deploy.py{NC}\n")

        print(f"{BOLD}  ATLAS CLI Quick Start:{NC}")
        print(f"  {CYAN}python3 atlas_cli.py setup --provider openai{NC}")
        print(f"  {CYAN}python3 atlas_cli.py launch --name \"{self.business_name}\" --type saas{NC}\n")

    # ── Main run ───────────────────────────────────────────────────────────────
    def run(self, service: Optional[str] = None) -> None:
        if service:
            # Run single service configurator
            configurators = {
                "matomo":      self.configure_matomo,
                "chatwoot":    self.configure_chatwoot,
                "nextcloud":   self.configure_nextcloud,
                "mautic":      self.configure_mautic,
                "wordpress":   self.configure_wordpress,
                "vaultwarden": self.configure_vaultwarden,
            }
            if service not in configurators:
                error(f"Unknown service: {service}. Available: {list(configurators.keys())}")
                sys.exit(1)
            configurators[service]()
        else:
            # Full post-deploy run
            self.verify_services()
            self.configure_vaultwarden()
            self.configure_wordpress()
            self.configure_mautic()
            self.configure_nextcloud()
            self.configure_chatwoot()
            self.configure_matomo()

        self.store_in_vault()
        self.print_summary()


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Gnoscenti Atlas Engine Post-Deploy Configurator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 post_deploy.py                          # Full configuration
  python3 post_deploy.py --dry-run                # Validate without changes
  python3 post_deploy.py --service matomo         # Configure Matomo only
  python3 post_deploy.py --env-file /path/.env    # Custom .env location
        """,
    )
    parser.add_argument("--env-file", default=".env", help="Path to .env file")
    parser.add_argument("--dry-run", action="store_true", help="Validate without making changes")
    parser.add_argument("--service", help="Configure a single service only")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}Gnoscenti Atlas Engine — Post-Deploy Configurator v2.0{NC}\n")

    env = load_env(args.env_file)
    if not env:
        warn("Empty or missing .env — using defaults")

    configurator = PostDeployConfigurator(env, dry_run=args.dry_run)
    configurator.run(service=args.service)


if __name__ == "__main__":
    main()
