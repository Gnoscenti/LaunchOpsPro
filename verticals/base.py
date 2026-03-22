"""
Gnoscenti Atlas Engine — Vertical Template Base Class
Each vertical defines the exact agents to run, in what order, and with what config.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List


class VerticalTemplate(ABC):
    """Base class for all ATLAS vertical templates."""

    name: str = "base"
    description: str = ""
    agents: List[str] = []  # Agent names in execution order

    def __init__(self):
        self.results: Dict[str, Any] = {}

    @abstractmethod
    def get_agent_config(self, agent_name: str, context: Dict) -> Dict:
        """Return agent-specific config for this vertical."""
        ...

    def deploy(self, name: str, output_dir: str = "./output", **kwargs) -> Dict[str, Any]:
        """Run all agents for this vertical in order."""
        from core.config import get_config
        cfg = get_config()
        cfg.business.business_name = name

        context = {
            "business_name": name,
            "business_type": self.name,
            "output_dir": output_dir,
            **kwargs,
        }

        results = {"vertical": self.name, "business_name": name, "agents": {}}
        for agent_name in self.agents:
            agent_cfg = self.get_agent_config(agent_name, context)
            agent = self._load_agent(agent_name)
            if agent:
                result = agent.execute({**context, **agent_cfg})
                results["agents"][agent_name] = result
                if not result.get("success"):
                    results["warning"] = f"Agent {agent_name} failed: {result.get('message')}"

        results["success"] = True
        results["message"] = f"{self.name.title()} vertical deployed for {name}"
        return results

    def _load_agent(self, agent_name: str):
        """Dynamically load an agent by name."""
        agent_map = {
            "security": ("agents.security_agent", "SecurityAgent"),
            "paralegal": ("agents.paralegal_bot", "ParalegalBot"),
            "stripe": ("agents.stripe_agent", "StripeAgent"),
            "wordpress": ("agents.wordpress_agent", "WordPressAgent"),
            "mautic": ("agents.mautic_agent", "MauticAgent"),
            "support": ("agents.support_agent", "SupportAgent"),
            "files": ("agents.files_agent", "FilesAgent"),
            "project": ("agents.project_agent", "ProjectAgent"),
            "analytics": ("agents.analytics_agent", "AnalyticsAgent"),
            "growth": ("agents.growth_agent", "GrowthAgent"),
            "email": ("agents.email_agent", "EmailAgent"),
            "repo": ("agents.repo_agent", "RepoAgent"),
        }
        if agent_name not in agent_map:
            return None
        module_path, class_name = agent_map[agent_name]
        try:
            import importlib
            module = importlib.import_module(module_path)
            cls = getattr(module, class_name)
            return cls()
        except Exception as exc:
            print(f"[WARNING] Could not load agent {agent_name}: {exc}")
            return None
