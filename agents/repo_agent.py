"""
Gnoscenti Atlas Engine - Repo Intelligence Agent
Analyzes GitHub repositories, detects gaps, and generates CI/CD configurations.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from agents.base import BaseAgent


ESSENTIAL_FILES = {
    "README.md": "Project documentation",
    ".gitignore": "Git ignore rules",
    ".env.example": "Environment variable template",
    "LICENSE": "Open source license",
    "CHANGELOG.md": "Version history",
    "CONTRIBUTING.md": "Contribution guidelines",
    "Dockerfile": "Container definition",
    "docker-compose.yml": "Multi-service orchestration",
}

GITHUB_ACTIONS_CI = """\
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest tests/ -v --tb=short
      - name: Lint
        run: |
          pip install ruff
          ruff check .

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Security scan
        uses: pypa/gh-action-pip-audit@v1.0.8
"""


class RepoAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Repo", llm_client, config)
        self._github = None

    def _get_github(self):
        if self._github:
            return self._github
        try:
            from github import Github
            token = (
                self.vault.get("github_token", namespace="repo")
                or os.getenv("GITHUB_TOKEN")
            )
            if token:
                self._github = Github(token)
        except ImportError:
            self.log_warning("PyGithub not installed — run: pip install PyGithub")
        return self._github

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Analyzing repository structure...")
        repo_path = context.get("repo_path", ".")
        path = Path(repo_path)

        findings = []
        missing = []
        for filename, description in ESSENTIAL_FILES.items():
            if (path / filename).exists():
                findings.append(f"✅ {filename} — {description}")
            else:
                missing.append(filename)
                findings.append(f"❌ {filename} — {description} (MISSING)")

        # Check for .env exposure
        if (path / ".env").exists():
            gitignore = (path / ".gitignore").read_text() if (path / ".gitignore").exists() else ""
            if ".env" not in gitignore:
                findings.append("🚨 .env file found but NOT in .gitignore — SECURITY RISK")

        return {
            "repo_path": repo_path,
            "findings": findings,
            "missing_files": missing,
            "ci_config": GITHUB_ACTIONS_CI,
            "score": round((len(ESSENTIAL_FILES) - len(missing)) / len(ESSENTIAL_FILES) * 100),
        }

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_type = task.get("type", "analyze_repo")
        analysis = task.get("analysis", self.analyze(task))

        if task_type == "analyze_repo":
            return self.success(
                f"Repository analysis complete — score: {analysis['score']}/100",
                **analysis,
            )
        elif task_type == "create_repo":
            return self._create_github_repo(task)
        elif task_type == "setup_ci":
            return self._setup_ci(task)
        return self.failure(f"Unknown task type: {task.get('type')}")

    def _create_github_repo(self, ctx: Dict) -> Dict[str, Any]:
        gh = self._get_github()
        if not gh:
            return self.failure("GitHub token required — set GITHUB_TOKEN")
        try:
            user = gh.get_user()
            repo_name = ctx.get("repo_name", self.config.business.business_name.lower().replace(" ", "-"))
            private = ctx.get("private", True)
            repo = user.create_repo(
                name=repo_name,
                description=ctx.get("description", "Created by Gnoscenti Atlas Engine"),
                private=private,
                auto_init=True,
            )
            return self.success(
                f"GitHub repository created: {repo.full_name}",
                repo_url=repo.html_url,
                clone_url=repo.clone_url,
                private=private,
            )
        except Exception as exc:
            return self.failure(f"Failed to create repo: {exc}", error=str(exc))

    def _setup_ci(self, ctx: Dict) -> Dict[str, Any]:
        repo_path = Path(ctx.get("repo_path", "."))
        ci_dir = repo_path / ".github" / "workflows"
        ci_dir.mkdir(parents=True, exist_ok=True)
        ci_file = ci_dir / "ci.yml"
        ci_file.write_text(GITHUB_ACTIONS_CI)
        return self.success(
            f"GitHub Actions CI configured at {ci_file}",
            ci_file=str(ci_file),
        )
