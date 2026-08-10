"""Shared runtime contract for LaunchOps agents.

The base class owns result formatting, configuration normalization, logging,
credential access, and guarded system helpers. Consequential actions still
belong behind the orchestrator and ProofGuard approval boundary.
"""

from typing import Any, Dict, List, Mapping, Optional
from abc import ABC, abstractmethod
from datetime import datetime
import json
import logging
import os
import secrets
import string
import subprocess


class AttrDict(dict):
    """Dictionary with read-only-style attribute access for legacy agents."""

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError as exc:
            raise AttributeError(key) from exc


def _as_attr_dict(value: Any) -> Any:
    if isinstance(value, Mapping):
        return AttrDict({key: _as_attr_dict(item) for key, item in value.items()})
    if isinstance(value, list):
        return [_as_attr_dict(item) for item in value]
    return value


class BaseAgent(ABC):
    """
    Abstract base for all LaunchOps agents.

    Agents may prepare plans and deterministic artifacts directly. External
    writes, financial actions, host mutation, and deployments must be routed
    through the orchestrator's governance path.
    """

    def __init__(
        self,
        name: str,
        role: str,
        llm_client: Any = None,
        config: Optional[Mapping[str, Any]] = None,
    ):
        if not name or not role:
            raise ValueError("Agent name and role are required")
        self.name = name
        self.role = role
        self.llm_client = llm_client
        self.config = self._normalize_config(config)
        self.logger = logging.getLogger(f"launchops.{name}")
        self.execution_history: List[Dict] = []

        # Imported lazily so the base module remains easy to import and test.
        from core.credentials import get_vault

        self.vault = get_vault()

    @staticmethod
    def _normalize_config(config: Optional[Mapping[str, Any]]) -> AttrDict:
        """Return one mapping that supports both modern and legacy readers."""
        if config is None:
            from core.config import get_config

            raw: Dict[str, Any] = get_config().to_dict()
        elif hasattr(config, "to_dict"):
            raw = dict(config.to_dict())
        else:
            raw = dict(config)

        raw.setdefault(
            "business",
            {
                "business_name": raw.get("business_name", ""),
                "business_type": raw.get("business_type", "saas"),
                "domain": raw.get("domain", ""),
                "state": raw.get("state", "Delaware"),
                "entity_type": raw.get("entity_type", "Delaware_C_Corp"),
            },
        )
        raw.setdefault(
            "llm",
            {
                "provider": raw.get("llm_provider", "openai"),
                "model": raw.get("openai_model", "gpt-4.1-mini"),
                "api_key": raw.get("openai_api_key", ""),
                "base_url": raw.get("openai_base_url", ""),
            },
        )
        raw.setdefault(
            "ports",
            {
                "wordpress": 8080,
                "mautic": 8082,
                "matomo": 8083,
                "nextcloud": 8084,
                "taiga": 9000,
                "chatwoot": 3000,
            },
        )
        return _as_attr_dict(raw)

    # ── Stable Result and Logging Contract ──────────────────────────────

    def success(self, message: str, **payload: Any) -> Dict[str, Any]:
        return {"success": True, "message": message, **payload}

    def failure(self, message: str, **payload: Any) -> Dict[str, Any]:
        return {"success": False, "message": message, "error": message, **payload}

    def log_info(self, message: str, *args: Any) -> None:
        self.logger.info(message, *args)

    def log_warning(self, message: str, *args: Any) -> None:
        self.logger.warning(message, *args)

    def log_error(self, message: str, *args: Any) -> None:
        self.logger.error(message, *args)

    def ask_llm(self, prompt: str, system: Optional[str] = None, **kwargs: Any) -> str:
        """Compatibility wrapper used by strategy-oriented agents."""
        return self._call_llm(
            system or f"You are the {self.role} agent for LaunchOpsPro.",
            prompt,
            **kwargs,
        )

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
        self.logger.info("Starting %s workflow", self.name)
        analysis = self.analyze(context)

        results = []
        for task in tasks:
            self.logger.info("Executing: %s", task.get("type", "unknown"))
            result = self.execute(task)
            results.append(result)
            self._record(task.get("type", "unknown"), result)
            if not result.get("success"):
                self.logger.error("Task failed: %s", result.get("error", "unknown"))

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
            self.logger.error("LLM call failed: %s", e)
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
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            self.logger.error(f"Failed to write {path}: {e}")
            return False

    def read_file(self, path: str) -> Optional[str]:
        try:
            with open(path, encoding="utf-8") as f:
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
