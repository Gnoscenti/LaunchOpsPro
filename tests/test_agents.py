"""Offline contract tests for the canonical LaunchOpsPro agent runtime."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture(autouse=True)
def isolated_runtime(tmp_path):
    """Keep configuration and encrypted vault state out of the runner home."""
    from core import config as config_module
    from core import credentials as credentials_module

    runtime = tmp_path / "runtime"
    cfg = config_module.init_config(
        launchops_dir=runtime,
        credentials_dir=runtime / "credentials",
        data_dir=runtime / "data",
        logs_dir=runtime / "logs",
        docs_dir=runtime / "documents",
        documentary_dir=runtime / "documentary",
        business_name="TestCo",
        domain="example.test",
    )
    credentials_module._vault = credentials_module.CredentialVault(
        base_dir=runtime / "credentials"
    )
    yield cfg
    credentials_module._vault = None
    config_module._config = None


class TestConfigContract:
    def test_config_exposes_stable_agent_groups(self, isolated_runtime):
        from core.config import AtlasConfig, LaunchOpsConfig, get_config

        cfg = get_config()
        exported = cfg.to_dict()

        assert isinstance(cfg, LaunchOpsConfig)
        assert AtlasConfig is LaunchOpsConfig
        assert exported["business"]["business_name"] == "TestCo"
        assert exported["llm"]["provider"] in {"openai", "anthropic"}
        assert exported["ports"]["matomo"] == 8083


class TestCredentialVault:
    def test_round_trip_uses_isolated_encrypted_store(self, tmp_path):
        from core.credentials import CredentialVault

        vault = CredentialVault(base_dir=tmp_path / "vault")
        assert vault.set("api_key", "secret-value", namespace="service")
        assert vault.get("api_key", namespace="service") == "secret-value"
        assert b"secret-value" not in vault.vault_path.read_bytes()

    def test_passwords_are_strong_and_unique(self, tmp_path):
        from core.credentials import CredentialVault

        vault = CredentialVault(base_dir=tmp_path / "vault")
        first = vault.generate_password(32)
        second = vault.generate_password(32)

        assert len(first) == 32
        assert first != second
        with pytest.raises(ValueError):
            vault.generate_password(8)

    def test_missing_secret_returns_none(self, tmp_path):
        from core.credentials import CredentialVault

        vault = CredentialVault(base_dir=tmp_path / "vault")
        assert vault.get("missing", namespace="service") is None


class TestBaseAgentContract:
    @staticmethod
    def _agent():
        from agents.base import BaseAgent

        class ConcreteAgent(BaseAgent):
            def analyze(self, context):
                return {"context": context}

            def execute(self, task):
                if task.get("fail"):
                    return self.failure("requested failure")
                return self.success("completed", task=task)

        return ConcreteAgent(name="Test", role="Contract Test")

    def test_result_helpers_are_consistent(self):
        agent = self._agent()

        success = agent.execute({"id": 1})
        failure = agent.execute({"fail": True})

        assert success == {
            "success": True,
            "message": "completed",
            "task": {"id": 1},
        }
        assert failure["success"] is False
        assert failure["message"] == failure["error"]

    def test_logging_contract(self, caplog):
        agent = self._agent()

        with caplog.at_level(logging.INFO):
            agent.log_info("contract event")

        assert "contract event" in caplog.text

    def test_config_supports_mapping_and_attribute_access(self):
        agent = self._agent()

        assert agent.config["business"]["business_name"] == "TestCo"
        assert agent.config.business.business_name == "TestCo"
        assert agent.config.ports.get("matomo") == 8083

    def test_system_commands_default_to_no_shell(self, tmp_path):
        agent = self._agent()
        marker = tmp_path / "should-not-exist"

        result = agent.run_command(
            f"{sys.executable} -c 'print(123)' ; touch {marker}"
        )

        assert not marker.exists()
        assert result["success"] is False


class TestConstructorWiring:
    @pytest.mark.parametrize(
        ("module_name", "class_name"),
        [
            ("agents.analytics_agent", "AnalyticsAgent"),
            ("agents.email_agent", "EmailAgent"),
            ("agents.files_agent", "FilesAgent"),
            ("agents.growth_agent", "GrowthAgent"),
            ("agents.project_agent", "ProjectAgent"),
            ("agents.repo_agent", "RepoAgent"),
            ("agents.support_agent", "SupportAgent"),
            ("agents.paralegal_bot", "ParalegalBot"),
            ("agents.wordpress_agent", "WordPressAgent"),
            ("agents.mautic_agent", "MauticAgent"),
        ],
    )
    def test_dependencies_land_in_the_correct_base_fields(
        self, module_name, class_name, isolated_runtime
    ):
        import importlib

        sentinel_client = object()
        cls = getattr(importlib.import_module(module_name), class_name)
        agent = cls(llm_client=sentinel_client, config=isolated_runtime.to_dict())

        assert agent.llm_client is sentinel_client
        assert isinstance(agent.role, str) and agent.role
        assert agent.config.business.business_name == "TestCo"


class TestOfflineAgentBehavior:
    def test_paralegal_generates_public_formation_checklist(self):
        from agents.paralegal_bot import ParalegalBot

        agent = ParalegalBot()
        analysis = agent.analyze(
            {"business_name": "TestCo", "entity_type": "LLC", "state": "Delaware"}
        )
        result = agent.execute(
            {
                "type": "generate_checklist",
                "business_name": "TestCo",
                "entity_type": "LLC",
                "state": "Delaware",
            }
        )

        assert analysis["entity_type"] == "LLC"
        assert analysis["state_requirements"]
        assert result["success"] is True
        assert result["total_tasks"] >= 10

    def test_security_analysis_is_read_only_and_structured(self, monkeypatch):
        from agents.security_agent import SecurityAgent

        agent = SecurityAgent()
        monkeypatch.setattr(agent, "_check_ssl", lambda: False)
        monkeypatch.setattr(agent, "_check_firewall", lambda: True)
        monkeypatch.setattr(agent, "_check_service", lambda name: name == "docker")
        monkeypatch.setattr(agent, "_check_ssh_hardening", lambda: False)

        result = agent.analyze({"domain": "example.test", "team_size": 1})

        assert set(result["server_security"]) == {
            "ssl_configured",
            "firewall_active",
            "fail2ban_active",
            "ssh_hardened",
            "docker_running",
        }
        assert result["required_passwords"]

    def test_stripe_prepares_webhook_spec_without_live_api_call(self):
        from agents.stripe_agent import StripeAgent

        agent = StripeAgent()
        analysis = agent.analyze({"pricing_model": "subscription"})
        result = agent.execute(
            {
                "type": "configure_webhooks",
                "webhook_url": "https://example.test/stripe/webhook",
            }
        )

        assert "automatic_tax" in analysis["recommended_features"]
        assert result["success"] is True
        assert "checkout.session.completed" in result["events"]

    def test_wordpress_analysis_returns_installable_plugin_slugs(self):
        from agents.wordpress_agent import WordPressAgent

        result = WordPressAgent().analyze({"business_type": "saas"})

        assert result["recommended_theme"]
        assert "wordpress-seo" in result["essential_plugins"]

    def test_analytics_generates_tracking_code_without_deploying(self):
        from agents.analytics_agent import AnalyticsAgent

        result = AnalyticsAgent().execute(
            {
                "type": "generate_tracking_code",
                "matomo_url": "https://analytics.example.test",
                "site_id": "7",
            }
        )

        assert result["success"] is True
        assert "matomo.js" in result["tracking_code"]
        assert "signup_completed" in result["key_events"]

    def test_growth_generates_measurable_90_day_plan(self):
        from agents.growth_agent import GrowthAgent

        result = GrowthAgent().analyze(
            {
                "business_type": "saas",
                "billing_validated": False,
                "analytics_validated": False,
            }
        )

        assert result["success"] is True
        assert set(result["90_day_plan"]) == {
            "days_1_30",
            "days_31_60",
            "days_61_90",
        }
        assert result["blockers_check"]

    def test_email_analysis_and_sequence_generation_are_deterministic(self):
        from agents.email_agent import EmailAgent

        agent = EmailAgent()
        analysis = agent.analyze({"domain": "example.test", "email_volume": "low"})
        result = agent.execute(
            {"type": "generate_sequences", "business_name": "TestCo"}
        )

        assert analysis["recommended_provider"] == "postmark"
        assert result["success"] is True
        assert len(result["sequences"]) == 5

    def test_mautic_analysis_returns_campaign_plan(self):
        from agents.mautic_agent import MauticAgent

        result = MauticAgent().analyze({"business_type": "saas"})

        assert "Free trial nurture" in result["recommended_campaigns"]
        assert result["lead_scoring_criteria"]


class TestExternalGateway:
    def test_openclaw_requires_runtime_configuration(self, monkeypatch):
        monkeypatch.delenv("OPENCLAW_WS_URL", raising=False)
        monkeypatch.delenv("OPENCLAW_GATEWAY_TOKEN", raising=False)

        from agents.openclaw_agent import OpenClawAgent

        agent = OpenClawAgent()
        readiness = agent.analyze({})
        result = asyncio.run(agent.execute({"action": "status"}))

        assert readiness["configured"] is False
        assert result["success"] is False
        assert "not configured" in result["error"].lower()

    def test_openclaw_source_contains_no_provider_host_or_token(self):
        source = (Path(__file__).parent.parent / "agents" / "openclaw_agent.py").read_text()

        assert "vultropenclaw" not in source
        assert "gateway_token = \"" not in source.lower()

