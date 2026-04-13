"""
Base Agent — LaunchOps Founder Edition
All agents inherit from this. No permission checks. Full Tier 3 access.
Includes shell execution, file I/O, Docker, and LLM utilities.
"""

from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod
from datetime import datetime
import json
import logging
import os
import secrets
import string
import subprocess


class BaseAgent(ABC):
    """
    Abstract base for all LaunchOps agents.
    Tier 3: no permission boundaries, no approval gates, full local access.
    """

    def __init__(self, name: str, role: str, llm_client=None, config: Dict = None):
        self.name = name
        self.role = role
        self.llm_client = llm_client
        self.config = config or {}
        self.logger = logging.getLogger(f"launchops.{name}")
        self.execution_history: List[Dict] = []

    # ── Abstract Interface ────────────────────────────────────────────────

    @abstractmethod
    def analyze(self, context: Dict) -> Dict:
        """Analyze the current state and return recommendations."""
        ...

    @abstractmethod
    def execute(self, task: Dict) -> Dict:
        """Execute a task. Returns result dict with at least 'success' key."""
        ...

    def validate(self, result: Dict) -> Dict:
        """Optional validation. Override per agent."""
        return {"valid": True, "result": result}

    # ── Full Workflow ─────────────────────────────────────────────────────

    def run(self, context: Dict, tasks: List[Dict]) -> Dict:
        """Run analyze → execute all tasks → validate."""
        self.logger.info(f"Starting {self.name} workflow")
        analysis = self.analyze(context)

        results = []
        for task in tasks:
            self.logger.info(f"Executing: {task.get('type', 'unknown')}")
            result = self.execute(task)
            results.append(result)
            self._record(task.get("type", "unknown"), result)
            if not result.get("success"):
                self.logger.error(f"Task failed: {result.get('error', 'unknown')}")

        validation = self.validate({"results": results})
        return {
            "agent": self.name,
            "analysis": analysis,
            "results": results,
            "validation": validation,
            "success": validation.get("valid", False),
            "timestamp": datetime.now().isoformat(),
        }

    def _record(self, action: str, result: Dict):
        self.execution_history.append({
            "timestamp": datetime.now().isoformat(),
            "agent": self.name,
            "action": action,
            "result": result,
        })

    # ── LLM ───────────────────────────────────────────────────────────────

    def _call_llm(self, system: str, user: str, **kwargs) -> str:
        """Call the LLM. Works with LLMClient wrapper, raw OpenAI, or Anthropic clients."""
        if self.llm_client is None:
            return "[LLM not configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY]"
        try:
            # Detect LLMClient wrapper (has a callable .chat method, not an object)
            # LLMClient.chat is a method that takes (system, user, ...) directly
            if callable(getattr(self.llm_client, "chat", None)) and not hasattr(
                self.llm_client.chat, "completions"
            ):
                # This is our LLMClient wrapper — call .chat(system, user) directly
                return self.llm_client.chat(
                    system=system,
                    user=user,
                    model=kwargs.get("model") or self.config.get("model"),
                    max_tokens=kwargs.get("max_tokens"),
                    temperature=kwargs.get("temperature"),
                )
            elif hasattr(self.llm_client, "chat") and hasattr(self.llm_client.chat, "completions"):
                # Raw OpenAI client
                model = kwargs.get("model") or self.config.get("model") or "gpt-4.1-mini"
                resp = self.llm_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=kwargs.get("temperature", 0.7),
                    max_tokens=kwargs.get("max_tokens", 4096),
                )
                return resp.choices[0].message.content
            elif hasattr(self.llm_client, "messages"):
                # Raw Anthropic client
                resp = self.llm_client.messages.create(
                    model=kwargs.get("model") or self.config.get("model") or "claude-3-5-sonnet-20241022",
                    system=system,
                    messages=[{"role": "user", "content": user}],
                    max_tokens=kwargs.get("max_tokens", 4096),
                )
                return resp.content[0].text
            else:
                return "[Unknown LLM client type]"
        except Exception as e:
            self.logger.error(f"LLM call failed: {e}")
            return f"[LLM Error: {e}]"

    # ── Shell / System ────────────────────────────────────────────────────

    def run_command(
        self,
        command: str,
        cwd: str = None,
        timeout: int = 300,
        allow_shell: bool = False,
    ) -> Dict:
        """
        Execute a system command safely.

        By default ``shell=False`` — the command string is split via
        ``shlex.split`` and executed without a shell interpreter, which
        prevents injection attacks when ``command`` contains untrusted
        input. Pass ``allow_shell=True`` **only** when the command
        requires shell features (pipes, ``&&`` chaining, redirects) AND
        the caller guarantees the command string is not user-derived.
        """
        import shlex

        try:
            if allow_shell:
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
            else:
                args = shlex.split(command)
                result = subprocess.run(
                    args,
                    shell=False,
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"Command timed out after {timeout}s"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def write_file(self, path: str, content: str) -> bool:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
            return True
        except Exception as e:
            self.logger.error(f"Failed to write {path}: {e}")
            return False

    def read_file(self, path: str) -> Optional[str]:
        try:
            with open(path) as f:
                return f.read()
        except Exception as e:
            self.logger.error(f"Failed to read {path}: {e}")
            return None

    def generate_secure_password(self, length: int = 32) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    # ── Docker ────────────────────────────────────────────────────────────

    def check_docker(self) -> bool:
        return self.run_command("docker --version").get("success", False)

    def deploy_docker_compose(self, compose_file: str, project_name: str) -> Dict:
        if not self.check_docker():
            return {"success": False, "error": "Docker not available"}
        return self.run_command(
            f"docker compose -f {compose_file} -p {project_name} up -d"
        )

    def wait_for_service(self, url: str, timeout: int = 60) -> bool:
        import time
        try:
            import requests
        except ImportError:
            return False
        start = time.time()
        while time.time() - start < timeout:
            try:
                r = requests.get(url, timeout=5)
                if r.status_code < 500:
                    return True
            except Exception:
                pass
            time.sleep(5)
        return False

    def __repr__(self):
        return f"<{self.__class__.__name__} name={self.name!r}>"
