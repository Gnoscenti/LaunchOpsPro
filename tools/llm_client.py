"""
LLM Client — LaunchOps Founder Edition
Unified interface for OpenAI (GPT-4o/GPT-5) and Anthropic (Claude).
Auto-fallback: tries primary provider, falls back to secondary.
No guardrails on prompts. You're the founder, you decide what to ask.
"""

from typing import Dict, List, Optional
import os
import json


class LLMClient:
    """
    Unified LLM client. Supports OpenAI and Anthropic.
    Auto-detects available API keys and selects the best model.
    """

    def __init__(self, config: Dict = None):
        config = config or {}
        self.openai_key = config.get("openai_api_key") or os.environ.get("OPENAI_API_KEY", "")
        self.openai_base = config.get("openai_api_base") or os.environ.get("OPENAI_API_BASE", "")
        self.anthropic_key = config.get("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
        self.primary = config.get("primary_provider", "openai")
        self.model_openai = config.get("openai_model") or os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        self.model_anthropic = config.get("anthropic_model", "claude-3-5-sonnet-20241022")
        self.max_tokens = config.get("max_tokens", 4096)
        self.temperature = config.get("temperature", 0.7)

        self._openai_client = None
        self._anthropic_client = None

    @property
    def openai_client(self):
        if self._openai_client is None and self.openai_key:
            try:
                from openai import OpenAI
                kwargs = {"api_key": self.openai_key}
                if self.openai_base:
                    kwargs["base_url"] = self.openai_base
                self._openai_client = OpenAI(**kwargs)
            except ImportError:
                pass
        return self._openai_client

    @property
    def anthropic_client(self):
        if self._anthropic_client is None and self.anthropic_key:
            try:
                from anthropic import Anthropic
                self._anthropic_client = Anthropic(api_key=self.anthropic_key)
            except ImportError:
                pass
        return self._anthropic_client

    def chat(
        self,
        system: str,
        user: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Send a chat message and get a response.
        Auto-falls back to secondary provider on failure.
        """
        provider = provider or self.primary
        max_tokens = max_tokens or self.max_tokens
        temperature = temperature if temperature is not None else self.temperature

        # Try primary
        try:
            if provider == "openai":
                return self._chat_openai(system, user, model or self.model_openai, max_tokens, temperature)
            else:
                return self._chat_anthropic(system, user, model or self.model_anthropic, max_tokens, temperature)
        except Exception as e:
            print(f"[LLM] Primary ({provider}) failed: {e}")

        # Fallback
        fallback = "anthropic" if provider == "openai" else "openai"
        try:
            if fallback == "openai":
                return self._chat_openai(system, user, model or self.model_openai, max_tokens, temperature)
            else:
                return self._chat_anthropic(system, user, model or self.model_anthropic, max_tokens, temperature)
        except Exception as e:
            print(f"[LLM] Fallback ({fallback}) also failed: {e}")
            return ""

    def _chat_openai(self, system: str, user: str, model: str, max_tokens: int, temperature: float) -> str:
        if not self.openai_client:
            raise RuntimeError("OpenAI client not available. Set OPENAI_API_KEY.")

        response = self.openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    def _chat_anthropic(self, system: str, user: str, model: str, max_tokens: int, temperature: float) -> str:
        if not self.anthropic_client:
            raise RuntimeError("Anthropic client not available. Set ANTHROPIC_API_KEY.")

        response = self.anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text if response.content else ""

    def structured_output(self, system: str, user: str, schema: Dict, provider: Optional[str] = None) -> Dict:
        """Get structured JSON output from LLM."""
        enhanced_system = f"""{system}

You MUST respond with ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}

No markdown, no explanation, no code fences. ONLY the JSON object."""

        response = self.chat(enhanced_system, user, provider=provider)

        # Parse JSON from response
        try:
            # Try direct parse
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
        return {}

    def available_providers(self) -> List[str]:
        providers = []
        if self.openai_key:
            providers.append("openai")
        if self.anthropic_key:
            providers.append("anthropic")
        return providers

    def health_check(self) -> Dict:
        """Check which providers are available and working."""
        status = {}
        if self.openai_key:
            try:
                self._chat_openai("Say OK", "OK", self.model_openai, 10, 0)
                status["openai"] = {"available": True, "model": self.model_openai}
            except Exception as e:
                status["openai"] = {"available": False, "error": str(e)}
        else:
            status["openai"] = {"available": False, "error": "No API key"}

        if self.anthropic_key:
            try:
                self._chat_anthropic("Say OK", "OK", self.model_anthropic, 10, 0)
                status["anthropic"] = {"available": True, "model": self.model_anthropic}
            except Exception as e:
                status["anthropic"] = {"available": False, "error": str(e)}
        else:
            status["anthropic"] = {"available": False, "error": "No API key"}

        return status


# ── Phase 2 re-export ───────────────────────────────────────────────────────
# MCPGateway lives in core/mcp_gateway.py but is re-exported here so
# agents can write `from tools.llm_client import MCPGateway` alongside
# their existing LLMClient import. The re-export is defensive: if
# something in the MCP module fails to load we don't take down the
# LLMClient import.

try:
    from core.mcp_gateway import MCPGateway, ToolDefinition  # noqa: E402,F401
except Exception as _mcp_import_error:  # pragma: no cover
    MCPGateway = None  # type: ignore
    ToolDefinition = None  # type: ignore
    import logging as _logging

    _logging.getLogger("launchops.llm_client").warning(
        "MCPGateway unavailable: %s", _mcp_import_error
    )
