#!/usr/bin/env python3
"""
LaunchOps Founder Edition — CLI Entrypoint
The AI-Powered Business Operating System for Founders. No guardrails. Pure execution.

Usage:
  python launchops.py launch          — Run the full launch pipeline
  python launchops.py stage <name>    — Run a single pipeline stage
  python launchops.py status          — Show pipeline status
  python launchops.py coach           — Start an ExecAI coaching session
  python launchops.py funding         — Run funding readiness report
  python launchops.py formation       — Run formation structure optimizer
  python launchops.py paperwork       — Generate all legal documents
  python launchops.py ip-audit        — Run IP audit
  python launchops.py security        — Run security audit
  python launchops.py documentary     — Generate documentary narrative
  python launchops.py health          — Check system health
  python launchops.py reset           — Reset pipeline state
  python launchops.py config          — Show/edit configuration
  python launchops.py deploy          — Deploy Docker infrastructure
  python launchops.py stop            — Stop all Docker services
"""

import sys
import os
import json
import argparse
from typing import Dict
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import LaunchOpsConfig, get_config
from core.credentials import CredentialVault
from core.context import SharedContext
from core.orchestrator import AtlasOrchestrator
from tools.llm_client import LLMClient
from workflows.launch_pipeline import LaunchPipeline
from core.stage_handlers import register_all_handlers

# Agents
from agents.execai_coach import ExecAICoach
from agents.funding_intelligence import FundingIntelligenceAgent
from agents.paperwork_agent import PaperworkAgent
from agents.business_builder import BusinessBuilderAgent
from agents.documentary_tracker import DocumentaryTracker
from agents.security_agent import SecurityAgent


def build_system(config_path: str = None) -> dict:
    """Build the full LaunchOps system."""
    config = get_config()
    cfg = config.to_dict()

    # Initialize LLM client
    llm = LLMClient(cfg.get("llm", {}))

    # Initialize credential vault
    vault = CredentialVault()

    # Initialize shared context
    context = SharedContext()

    # Initialize agents
    agents = {
        "execai_coach": ExecAICoach(llm_client=llm, config=cfg),
        "funding_intelligence": FundingIntelligenceAgent(llm_client=llm, config=cfg),
        "paperwork_agent": PaperworkAgent(llm_client=llm, config=cfg),
        "business_builder": BusinessBuilderAgent(llm_client=llm, config=cfg),
        "documentary_tracker": DocumentaryTracker(llm_client=llm, config=cfg),
        "security_agent": SecurityAgent(llm_client=llm, config=cfg),
    }

    # Load optional infrastructure agents.
    # stripe_agent is deliberately excluded here — it is instantiated below
    # with the shared MCPGateway so its capabilities self-register.
    optional_agents = {
        "wordpress_agent": "agents.wordpress_agent.WordPressAgent",
        "mautic_agent": "agents.mautic_agent.MauticAgent",
        "paralegal_bot": "agents.paralegal_bot.ParalegalBot",
        "growth_agent": "agents.growth_agent.GrowthAgent",
        "analytics_agent": "agents.analytics_agent.AnalyticsAgent",
        "email_agent": "agents.email_agent.EmailAgent",
        "openclaw_agent": "agents.openclaw_agent.OpenClawAgent",
    }
    for agent_name, module_path in optional_agents.items():
        try:
            module_name, class_name = module_path.rsplit(".", 1)
            import importlib
            mod = importlib.import_module(module_name)
            cls = getattr(mod, class_name)
            agents[agent_name] = cls(llm_client=llm, config=cfg)
        except Exception:
            pass

    # ── Phase 2: MCPGateway + StripeAgent with self-registered capabilities ─
    mcp_gateway = None
    try:
        from core.mcp_gateway import MCPGateway

        mcp_gateway = MCPGateway()
    except Exception as e:
        print(f"  Warning: MCPGateway unavailable: {e}")

    try:
        from agents.stripe_agent import StripeAgent

        agents["stripe_agent"] = StripeAgent(
            llm_client=llm,
            config=cfg,
            mcp_gateway=mcp_gateway,
        )
    except Exception as e:
        print(f"  Warning: StripeAgent init failed: {e}")

    # Load new pipeline agents (Founder OS, DynExecutiv, Content Engine, Metrics)
    # These agents expect a raw OpenAI client (with .chat.completions.create),
    # not the LLMClient wrapper. Pass the underlying openai_client directly.
    raw_openai = getattr(llm, 'openai_client', None)
    new_agents = {
        "founder_os": "agents.founder_os.FounderOSAgent",
        "dynexecutiv": "agents.dynexecutiv.DynExecutivAgent",
        "content_engine": "agents.content_engine.ContentEngineAgent",
        "metrics_agent": "agents.metrics_agent.MetricsAgent",
    }
    for agent_name, module_path in new_agents.items():
        try:
            module_name, class_name = module_path.rsplit(".", 1)
            import importlib
            mod = importlib.import_module(module_name)
            cls = getattr(mod, class_name)
            agents[agent_name] = cls(llm_client=raw_openai, config=cfg)
        except Exception as e:
            print(f"  Warning: Could not load {agent_name}: {e}")

    # Initialize orchestrator
    orchestrator = AtlasOrchestrator()

    # Register all agents with the orchestrator
    for name, agent in agents.items():
        orchestrator.register_agent(name, agent)

    # Wire agents as real stage handlers (THE CRITICAL FIX)
    register_all_handlers(orchestrator, agents)

    # ── Phase 2: Register MCP capabilities for multi-agent ecosystem ─────
    # StripeAgent self-registers create_saas_subscription in its __init__.
    # This call adds the rest (paperwork, security, funding, growth, …).
    if mcp_gateway is not None:
        try:
            from core.mcp_capabilities import register_launchops_capabilities

            register_launchops_capabilities(mcp_gateway, agents)
        except Exception as e:
            print(f"  Warning: MCP capability registration failed: {e}")

    # Initialize pipeline
    pipeline = LaunchPipeline(orchestrator)

    return {
        "config": cfg,
        "llm": llm,
        "vault": vault,
        "context": context,
        "agents": agents,
        "orchestrator": orchestrator,
        "pipeline": pipeline,
        "mcp_gateway": mcp_gateway,
    }


def load_business_config() -> dict:
    """Load business configuration from file or create default."""
    config_path = os.path.expanduser("~/.launchops/business.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return json.load(f)

    default = {
        "business_name": "",
        "business_type": "",
        "industry": "",
        "description": "",
        "problem": "",
        "solution": "",
        "target_customer": "",
        "icp": "",
        "uvp": "",
        "revenue_model": "",
        "pricing": "",
        "primary_channel": "",
        "tech_stack": "",
        "founder_name": "",
        "state": "",
        "entity_type": "not_formed",
        "has_rd_component": False,
        "seeking_vc": False,
        "monthly_revenue": 0,
        "employees": 1,
        "us_citizen_owner": True,
        "has_code": True,
        "has_novel_methods": False,
        "has_brand": True,
        "has_data": False,
        "ai_assisted": True,
        "has_website": False,
        "has_contractors": False,
        "has_advisors": False,
        "seeking_funding": True,
        "has_novel_ip": False,
    }

    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w") as f:
        json.dump(default, f, indent=2)

    print(f"\n  Business config created at: {config_path}")
    print("  Edit this file with your business details, then run 'python launchops.py launch'\n")
    return default


def cmd_launch(system, args):
    """
    Run the full pipeline through the Phase 2 governed path.

    Sprint 1 hardening: CLI now goes through Phase2Executor so every agent
    action is ProofGuard-attested, even from the command line. The old
    ungoverned AtlasOrchestrator.run() is retained as an internal helper
    but is no longer exposed as a public execution path.
    """
    import asyncio
    from core.orchestrator import Phase2Executor
    from core.proofguard import ProofGuardMiddleware
    from core.logging_config import configure_logging, set_context

    configure_logging()

    business = load_business_config()
    if not business.get("business_name"):
        print("\n  Business config is empty!")
        print(f"  Edit: ~/.launchops/business.json")
        print("  Then run: python launchops.py launch\n")
        return

    orchestrator = system["orchestrator"]
    orchestrator.context.set("business", business)

    proofguard = ProofGuardMiddleware()
    executor = Phase2Executor(orchestrator, proofguard=proofguard)

    set_context(run_id=orchestrator.context.run_id)

    async def _run():
        async for event_name, data in executor.run_pipeline():
            # Print events to stdout for CLI visibility
            stage = data.get("stage", "") if isinstance(data, dict) else ""
            agent = data.get("agent", "") if isinstance(data, dict) else ""
            status = data.get("status", "") if isinstance(data, dict) else ""
            cqs = data.get("cqs_score", "") if isinstance(data, dict) else ""

            if event_name == "stage_start":
                print(f"\n  STAGE: {stage}")
            elif event_name == "proofguard_verdict":
                print(f"    ProofGuard: {agent} → {status} (CQS {cqs})")
            elif event_name == "stage_complete":
                print(f"    ✓ {stage} complete")
            elif event_name == "stage_error":
                err = data.get("error", "") if isinstance(data, dict) else str(data)
                print(f"    ✗ {stage} failed: {err}")
            elif event_name == "governance_gate_blocked":
                gate = data.get("gate", "") if isinstance(data, dict) else ""
                print(f"    ⛔ Governance gate blocked: {gate}")
            elif event_name == "pipeline_complete":
                completed = data.get("stages_completed", 0) if isinstance(data, dict) else 0
                errors = data.get("errors", 0) if isinstance(data, dict) else 0
                print(f"\n  Pipeline complete — {completed} stages, {errors} errors")

    asyncio.run(_run())


def cmd_stage(system, args):
    """Run a single stage through the governed path."""
    import asyncio
    from core.orchestrator import Phase2Executor
    from core.proofguard import ProofGuardMiddleware
    from core.logging_config import configure_logging

    configure_logging()

    business = load_business_config()
    stage = getattr(args, "stage_name", None)
    if not stage:
        print("Usage: python launchops.py stage <stage_name>")
        return

    orchestrator = system["orchestrator"]
    orchestrator.context.set("business", business)

    proofguard = ProofGuardMiddleware()
    executor = Phase2Executor(orchestrator, proofguard=proofguard)

    try:
        result = asyncio.run(executor.execute_stage(stage))
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(f"  Stage '{stage}' failed: {e}")


def cmd_status(system, args):
    pipeline = system["pipeline"]
    status = pipeline.get_status()
    print(f"\n{'='*60}")
    print("  LAUNCHOPS PIPELINE STATUS")
    print(f"{'='*60}")
    print(f"  Progress: {status['completed']}/{status['total']} ({status['progress_pct']}%)")
    print(f"  {'~'*50}")
    for stage_id, info in status["stages"].items():
        icon = "[OK]" if info["status"] == "completed" else "[!!]" if info["status"] == "failed" else "[ ]"
        print(f"  {icon} {info['name']}")
    print(f"{'='*60}\n")


def cmd_coach(system, args):
    business = load_business_config()
    coach = system["agents"]["execai_coach"]
    result = coach.execute({
        "type": "coaching_session",
        "business": business,
        "topic": getattr(args, "topic", "general_strategy"),
    })
    print(json.dumps(result, indent=2, default=str))


def cmd_funding(system, args):
    business = load_business_config()
    agent = system["agents"]["funding_intelligence"]
    return agent.execute({"type": "funding_readiness_report", "business_config": business})


def cmd_formation(system, args):
    business = load_business_config()
    agent = system["agents"]["funding_intelligence"]
    return agent.execute({
        "type": "formation_optimizer",
        "seeking_vc": business.get("seeking_vc", False),
        "has_rd": business.get("has_rd_component", False),
        "business_type": business.get("business_type", "saas"),
    })


def cmd_paperwork(system, args):
    business = load_business_config()
    agent = system["agents"]["paperwork_agent"]
    doc = getattr(args, "document", None)
    if doc:
        result = agent.execute({"type": f"generate_{doc}", "business": business})
    else:
        result = agent.execute({"type": "generate_all", "business": business})
    print(json.dumps(result, indent=2, default=str))


def cmd_ip_audit(system, args):
    business = load_business_config()
    agent = system["agents"]["paperwork_agent"]
    result = agent.execute({"type": "ip_audit", "business": business})
    print(json.dumps(result, indent=2, default=str))


def cmd_security(system, args):
    agent = system["agents"]["security_agent"]
    result = agent.execute({"type": "audit"})
    print(json.dumps(result, indent=2, default=str))


def cmd_documentary(system, args):
    agent = system["agents"]["documentary_tracker"]
    result = agent.execute({"type": "generate_narrative"})
    print(json.dumps(result, indent=2, default=str))


def cmd_health(system, args):
    llm = system["llm"]
    health = llm.health_check()
    print(f"\n{'='*60}")
    print("  LAUNCHOPS SYSTEM HEALTH")
    print(f"{'='*60}")
    for provider, status in health.items():
        icon = "[OK]" if status.get("available") else "[!!]"
        model = status.get("model", "N/A")
        error = status.get("error", "")
        print(f"  {icon} {provider}: {model} {f'({error})' if error else ''}")
    print(f"\n  Agents loaded: {len(system['agents'])}")
    for name in system["agents"]:
        print(f"    - {name}")
    print(f"{'='*60}\n")


def cmd_reset(system, args):
    system["pipeline"].reset()
    print("Pipeline state reset.")


def cmd_config(system, args):
    config_path = os.path.expanduser("~/.launchops/business.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            print(json.dumps(json.load(f), indent=2))
    else:
        print("No business config found. Run 'python launchops.py launch' to create one.")


def cmd_deploy(system, args):
    print("Deploying all Docker services...")
    os.system("docker-compose up -d")
    print("All services deployed!")


def cmd_stop(system, args):
    print("Stopping all services...")
    os.system("docker-compose down")
    print("All services stopped!")


def main():
    parser = argparse.ArgumentParser(
        description="LaunchOps Founder Edition - The AI-Powered Business Operating System for Founders.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  launch          Run the full launch pipeline
  stage <name>    Run a single pipeline stage
  status          Show pipeline status
  coach           Start ExecAI coaching session
  funding         Run funding readiness report
  formation       Run formation structure optimizer
  paperwork       Generate legal documents
  ip-audit        Run IP audit
  security        Run security audit
  documentary     Generate documentary narrative
  health          Check system health
  reset           Reset pipeline state
  config          Show configuration
  deploy          Deploy Docker infrastructure
  stop            Stop all Docker services
""",
    )

    parser.add_argument("--version", action="version", version="%(prog)s 2.0.0-founder-edition")
    parser.add_argument("command", nargs="?", default="status",
                        choices=["launch", "stage", "status", "coach", "funding",
                                 "formation", "paperwork", "ip-audit", "security",
                                 "documentary", "health", "reset", "config",
                                 "deploy", "stop"])
    parser.add_argument("stage_name", nargs="?", default=None)
    parser.add_argument("--document", "-d", help="Specific document to generate")
    parser.add_argument("--topic", "-t", help="Coaching topic")
    parser.add_argument("--skip-infra", action="store_true", help="Skip infrastructure stages")
    parser.add_argument("--config-path", "-c", dest="config_path", help="Path to config file")

    args = parser.parse_args()

    print("""
+--------------------------------------------------------------+
|                                                              |
|   LAUNCHOPS FOUNDER EDITION  v2.0                            |
|   The AI-Powered Business Operating System for Founders.                        |
|   The Canonical Integrated Founder-Grade Execution Engine.                       |
|                                                              |
|   Tier 3 - No Guardrails - Personal Edition                  |
|                                                              |
+--------------------------------------------------------------+
    """)

    system = build_system(getattr(args, "config_path", None))

    commands = {
        "launch": cmd_launch,
        "stage": cmd_stage,
        "status": cmd_status,
        "coach": cmd_coach,
        "funding": cmd_funding,
        "formation": cmd_formation,
        "paperwork": cmd_paperwork,
        "ip-audit": cmd_ip_audit,
        "security": cmd_security,
        "documentary": cmd_documentary,
        "health": cmd_health,
        "reset": cmd_reset,
        "config": cmd_config,
        "deploy": cmd_deploy,
        "stop": cmd_stop,
    }

    handler = commands.get(args.command, cmd_status)
    handler(system, args)


if __name__ == "__main__":
    main()
