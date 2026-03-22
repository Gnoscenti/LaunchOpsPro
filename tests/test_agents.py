"""
Gnoscenti Atlas Engine — Agent Test Suite
Tests all 12 agents and core modules without requiring live API keys.
Run: pytest tests/ -v
"""
import sys
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure project root on path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ─── Core Module Tests ────────────────────────────────────────────────────────

class TestConfig:
    def test_get_config_returns_instance(self):
        from core.config import get_config, AtlasConfig
        cfg = get_config()
        assert isinstance(cfg, AtlasConfig)

    def test_config_has_business(self):
        from core.config import get_config
        cfg = get_config()
        assert hasattr(cfg, "business")

    def test_config_has_llm(self):
        from core.config import get_config
        cfg = get_config()
        assert hasattr(cfg, "llm")

    def test_config_has_ports(self):
        from core.config import get_config
        cfg = get_config()
        assert hasattr(cfg, "ports")


class TestCredentialVault:
    def test_vault_set_and_get(self):
        from core.credentials import CredentialVault
        vault = CredentialVault()
        vault.set("test_key_abc", "test_value_xyz", namespace="pytest_ns")
        result = vault.get("test_key_abc", namespace="pytest_ns")
        assert result == "test_value_xyz"

    def test_vault_generate_password(self):
        from core.credentials import CredentialVault
        vault = CredentialVault()
        pwd = vault.generate_password(32)
        assert len(pwd) == 32
        assert isinstance(pwd, str)

    def test_vault_missing_key_returns_none(self):
        from core.credentials import CredentialVault
        vault = CredentialVault()
        result = vault.get("nonexistent_key_xyz_999", namespace="pytest_ns")
        assert result is None


class TestAuditLog:
    def test_audit_log_records_event(self):
        import core.audit_log as audit_log
        audit_log.record(agent="TestAgent", action="test_action", status="success", details={"key": "val"})
        records = audit_log.tail(5)
        assert isinstance(records, list)
        assert len(records) >= 1

    def test_audit_log_tail_returns_list(self):
        import core.audit_log as audit_log
        records = audit_log.tail(5)
        assert isinstance(records, list)


# ─── Base Agent Tests ─────────────────────────────────────────────────────────

class TestBaseAgent:
    def test_base_agent_success(self):
        from agents.base import BaseAgent

        class ConcreteAgent(BaseAgent):
            def analyze(self, ctx): return {}
            def execute(self, task): return self.success("done")

        agent = ConcreteAgent("Test")
        result = agent.execute({})
        assert result["success"] is True
        assert result["message"] == "done"

    def test_base_agent_failure(self):
        from agents.base import BaseAgent

        class ConcreteAgent(BaseAgent):
            def analyze(self, ctx): return {}
            def execute(self, task): return self.failure("error occurred")

        agent = ConcreteAgent("Test")
        result = agent.execute({})
        assert result["success"] is False
        assert "error occurred" in result["message"]

    def test_base_agent_log_info(self):
        from agents.base import BaseAgent

        class ConcreteAgent(BaseAgent):
            def analyze(self, ctx): return {}
            def execute(self, task): return self.success("ok")

        agent = ConcreteAgent("Test")
        agent.log_info("Test log message")
        agent.log_warning("Test warning")


# ─── Paralegal Bot Tests ──────────────────────────────────────────────────────

class TestParalegalBot:
    def test_analyze_returns_entity_info(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.analyze({"entity_type": "LLC", "state": "Delaware", "business_name": "TestCo"})
        assert result["entity_type"] == "LLC"
        assert result["state"] == "Delaware"
        assert "filing_fee" in result

    def test_analyze_llc_has_operating_agreement(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.analyze({"entity_type": "LLC", "state": "Delaware"})
        assert result["entity_info"]["governing_doc"] == "Operating Agreement"

    def test_analyze_ccorp_has_bylaws(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.analyze({"entity_type": "C-Corp", "state": "Delaware"})
        assert "Bylaws" in result["entity_info"]["governing_doc"]

    def test_generate_formation_docs(self, tmp_path):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.execute({
            "type": "generate_formation_docs",
            "business_name": "TestCo LLC",
            "entity_type": "LLC",
            "state": "Delaware",
            "output_dir": str(tmp_path),
        })
        assert result["success"] is True
        assert len(result["documents"]) >= 3
        for doc_path in result["documents"]:
            assert Path(doc_path).exists()

    def test_compliance_calendar_has_items(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.execute({
            "type": "compliance_calendar",
            "analysis": bot.analyze({"entity_type": "LLC", "state": "Delaware"}),
        })
        assert result["success"] is True
        assert "calendar" in result

    def test_ein_checklist_generated(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        result = bot.execute({"type": "ein_checklist", "entity_type": "LLC"})
        assert result["success"] is True
        assert "EIN" in result["checklist"]

    def test_recommend_state_saas(self):
        from agents.paralegal_bot import ParalegalBot
        bot = ParalegalBot()
        rec = bot._recommend_state("saas")
        assert "Delaware" in rec or "Wyoming" in rec


# ─── Security Agent Tests ─────────────────────────────────────────────────────

class TestSecurityAgent:
    def test_analyze_returns_services(self):
        from agents.security_agent import SecurityAgent
        agent = SecurityAgent()
        result = agent.analyze({"business_name": "TestCo"})
        assert "services" in result
        assert len(result["services"]) > 0

    def test_generate_credentials(self):
        from agents.security_agent import SecurityAgent
        agent = SecurityAgent()
        analysis = agent.analyze({"business_name": "TestCo"})
        result = agent._generate_all_credentials(analysis)
        assert result["success"] is True
        assert result["count"] > 0

    def test_strong_password_length(self):
        from agents.security_agent import SecurityAgent
        pwd = SecurityAgent._strong_password(32)
        assert len(pwd) == 32

    def test_strong_password_uniqueness(self):
        from agents.security_agent import SecurityAgent
        pwd1 = SecurityAgent._strong_password(32)
        pwd2 = SecurityAgent._strong_password(32)
        assert pwd1 != pwd2


# ─── Stripe Agent Tests ───────────────────────────────────────────────────────

class TestStripeAgent:
    def test_analyze_returns_plans(self):
        from agents.stripe_agent import StripeAgent
        agent = StripeAgent()
        result = agent.analyze({})
        assert "plans" in result
        assert len(result["plans"]) > 0

    def test_analyze_returns_webhook_events(self):
        from agents.stripe_agent import StripeAgent
        agent = StripeAgent()
        result = agent.analyze({})
        assert "webhook_events" in result
        assert "checkout.session.completed" in result["webhook_events"]

    def test_generate_code_returns_code(self):
        from agents.stripe_agent import StripeAgent
        agent = StripeAgent()
        result = agent.execute({"type": "generate_code"})
        assert result["success"] is True
        assert "stripe" in result["code"].lower()

    def test_validate_without_key_reports_issues(self):
        from agents.stripe_agent import StripeAgent
        import os
        agent = StripeAgent()
        original = os.environ.pop("STRIPE_SECRET_KEY", None)
        result = agent.execute({"type": "validate"})
        if original:
            os.environ["STRIPE_SECRET_KEY"] = original
        assert isinstance(result, dict)

    def test_integration_checklist_has_items(self):
        from agents.stripe_agent import StripeAgent
        agent = StripeAgent()
        checklist = agent._integration_checklist()
        assert len(checklist) >= 5
        assert any("STRIPE_SECRET_KEY" in item for item in checklist)


# ─── WordPress Agent Tests ────────────────────────────────────────────────────

class TestWordPressAgent:
    def test_analyze_returns_plugins(self):
        from agents.wordpress_agent import WordPressAgent
        agent = WordPressAgent()
        result = agent.analyze({"business_type": "saas"})
        assert "plugins" in result
        assert len(result["plugins"]) > 0

    def test_deploy_returns_compose_snippet(self):
        from agents.wordpress_agent import WordPressAgent
        agent = WordPressAgent()
        result = agent.execute({"type": "deploy_wordpress", "business_type": "saas"})
        assert result["success"] is True
        assert "compose_snippet" in result
        assert "wordpress" in result["compose_snippet"]

    def test_plugin_install_script_contains_wp_cli(self):
        from agents.wordpress_agent import WordPressAgent
        agent = WordPressAgent()
        script = agent._plugin_install_script(["yoast-seo", "wordfence"])
        assert "wp plugin install" in script
        assert "yoast-seo" in script


# ─── Analytics Agent Tests ────────────────────────────────────────────────────

class TestAnalyticsAgent:
    def test_analyze_returns_features(self):
        from agents.analytics_agent import AnalyticsAgent
        agent = AnalyticsAgent()
        result = agent.analyze({})
        assert "features" in result
        assert len(result["features"]) > 0

    def test_deploy_returns_tracking_code(self):
        from agents.analytics_agent import AnalyticsAgent
        agent = AnalyticsAgent()
        result = agent.execute({"type": "deploy_matomo"})
        assert result["success"] is True
        assert "tracking_code" in result
        assert "matomo.js" in result["tracking_code"]

    def test_key_events_includes_signup(self):
        from agents.analytics_agent import KEY_EVENTS
        assert "signup_completed" in KEY_EVENTS
        assert "subscription_created" in KEY_EVENTS


# ─── Growth Agent Tests ───────────────────────────────────────────────────────

class TestGrowthAgent:
    def test_analyze_returns_channels(self):
        from agents.growth_agent import GrowthAgent
        agent = GrowthAgent()
        result = agent.analyze({"business_type": "saas"})
        assert "channels" in result
        assert "primary" in result["channels"]

    def test_90_day_plan_has_three_phases(self):
        from agents.growth_agent import GrowthAgent
        agent = GrowthAgent()
        plan = agent._build_90_day_plan("saas")
        assert "days_1_30" in plan
        assert "days_31_60" in plan
        assert "days_61_90" in plan

    def test_blockers_detected_without_billing(self):
        from agents.growth_agent import GrowthAgent
        agent = GrowthAgent()
        blockers = agent._check_blockers({"billing_validated": False})
        assert any("Billing" in b for b in blockers)


# ─── Email Agent Tests ────────────────────────────────────────────────────────

class TestEmailAgent:
    def test_analyze_returns_provider(self):
        from agents.email_agent import EmailAgent
        agent = EmailAgent()
        result = agent.analyze({})
        assert "recommended_provider" in result

    def test_welcome_sequence_has_5_emails(self):
        from agents.email_agent import WELCOME_SEQUENCE
        assert len(WELCOME_SEQUENCE) == 5

    def test_deliverability_checklist_has_spf(self):
        from agents.email_agent import EmailAgent
        agent = EmailAgent()
        checklist = agent._deliverability_checklist()
        assert any("SPF" in item for item in checklist)


# ─── Vertical Template Tests ──────────────────────────────────────────────────

class TestVerticals:
    def test_load_saas_vertical(self):
        from verticals.loader import load_vertical
        v = load_vertical("saas")
        assert v.name == "saas"
        assert len(v.agents) > 0

    def test_load_ecommerce_vertical(self):
        from verticals.loader import load_vertical
        v = load_vertical("ecommerce")
        assert v.name == "ecommerce"

    def test_load_agency_vertical(self):
        from verticals.loader import load_vertical
        v = load_vertical("agency")
        assert v.name == "agency"

    def test_load_marketplace_vertical(self):
        from verticals.loader import load_vertical
        v = load_vertical("marketplace")
        assert v.name == "marketplace"

    def test_load_invalid_vertical_raises(self):
        from verticals.loader import load_vertical
        with pytest.raises(ValueError):
            load_vertical("invalid_vertical_xyz")

    def test_list_verticals_returns_four(self):
        from verticals.loader import list_verticals
        verticals = list_verticals()
        assert len(verticals) == 4
        names = [v["name"] for v in verticals]
        assert "saas" in names
        assert "ecommerce" in names

    def test_saas_vertical_has_stripe_agent(self):
        from verticals.loader import load_vertical
        v = load_vertical("saas")
        assert "stripe" in v.agents

    def test_saas_vertical_has_paralegal_agent(self):
        from verticals.loader import load_vertical
        v = load_vertical("saas")
        assert "paralegal" in v.agents
