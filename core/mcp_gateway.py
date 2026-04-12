"""
MCP Gateway — Phase 2 Agent-to-Agent Ecosystem Bridge
======================================================

Wraps LaunchOps agents behind the Model Context Protocol (MCP) so that:

  1. Internal tools can be exposed as MCP-compliant capabilities for other
     agents (internal or external) to discover via /mcp/discover.
  2. LaunchOps agents can negotiate with external companies' MCP servers
     (a Bank Agent, a Vendor Agent, etc.) using a standardized protocol.
  3. LLM calls inject MCP tool definitions automatically so the model can
     pick the right capability without hand-rolled function-calling glue.

SDK note:
    The public Anthropic MCP Python SDK is `mcp` (PyPI: `mcp`). Its API uses
    `ClientSession`, `mcp.types.Tool`, and transport adapters rather than the
    `MCPClient` / `ToolDefinition` names in the original spec. To keep this
    module importable whether or not the SDK is installed, we try the real
    SDK first and fall back to thin local shims that implement the same
    surface area. Swap in your preferred SDK by adjusting the import block.

Environment:
    DEFAULT_LLM_MODEL     Default model when mcp_client.generate() is called
    LLM_API_KEY           API key for the underlying LLM provider
    EXTERNAL_MCP_TOKEN    Bearer token for outbound /mcp/discover calls
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore

logger = logging.getLogger("LaunchOps.MCPGateway")


# ── SDK shim ───────────────────────────────────────────────────────────────
#
# Try the real MCP SDK first. If either the package or the expected symbols
# are missing, fall back to local dataclass shims so the rest of the module
# — and anything that imports it — continues to work.

try:
    # If someone publishes or vendors an MCPClient/ToolDefinition pair:
    from mcp import MCPClient as _MCPClient  # type: ignore
    from mcp import ToolDefinition as _ToolDefinition  # type: ignore

    _MCP_SDK_AVAILABLE = True
except Exception:  # ImportError or AttributeError
    _MCP_SDK_AVAILABLE = False

    @dataclass
    class _ToolDefinition:  # type: ignore[no-redef]
        """
        Local stand-in for mcp.ToolDefinition. Same public fields:
            name, description, input_schema
        """

        name: str
        description: str
        input_schema: Dict[str, Any] = field(default_factory=dict)

    class _MCPClient:  # type: ignore[no-redef]
        """
        Local stand-in for mcp.MCPClient. Provides a `generate()` coroutine
        so downstream code can await a tool-augmented completion even when
        the real SDK isn't installed. Falls back to the existing LaunchOps
        LLMClient so no new env vars are required.
        """

        def __init__(self, default_model: Optional[str] = None, api_key: Optional[str] = None):
            self.default_model = default_model
            self.api_key = api_key
            # Lazy import: avoids circular imports if core/mcp_gateway.py is
            # loaded during module init before tools/llm_client.py is ready.
            self._llm = None

        def _ensure_llm(self):
            if self._llm is None:
                try:
                    from tools.llm_client import LLMClient  # type: ignore

                    self._llm = LLMClient()
                except Exception as e:
                    logger.warning("LLMClient unavailable for MCP shim: %s", e)
                    self._llm = False  # sentinel: tried and failed
            return self._llm

        async def generate(
            self,
            system: str,
            prompt: str,
            tools: Optional[List[Any]] = None,
            model: Optional[str] = None,
        ) -> str:
            """
            Shim generate(): routes through LaunchOps LLMClient so agents
            still get a response even without the real MCP SDK. Tool
            definitions are included in the system prompt as a JSON hint so
            the model at least knows what capabilities exist.
            """
            llm = self._ensure_llm()
            if not llm:
                return "[MCP shim: no LLM client configured]"

            tool_hint = ""
            if tools:
                import json

                tool_specs = []
                for t in tools:
                    if hasattr(t, "name"):
                        tool_specs.append(
                            {
                                "name": t.name,
                                "description": getattr(t, "description", ""),
                                "input_schema": getattr(t, "input_schema", {}),
                            }
                        )
                if tool_specs:
                    tool_hint = (
                        "\n\nAvailable MCP tools (JSON):\n" + json.dumps(tool_specs)
                    )

            augmented_system = system + tool_hint
            try:
                return llm.chat(
                    system=augmented_system,
                    user=prompt,
                    model=model or self.default_model,
                )
            except Exception as e:
                logger.error("MCP shim generate() failed: %s", e)
                return f"[MCP shim error: {e}]"


# Re-export the names the rest of the app uses
MCPClient = _MCPClient
ToolDefinition = _ToolDefinition


# ── Gateway ────────────────────────────────────────────────────────────────


ToolCallable = Callable[..., Any]


class MCPGateway:
    """
    The MCP integration layer. Bridges LaunchOps agents to both internal
    tools and external agent ecosystems securely.

    Usage:
        gateway = MCPGateway()
        gateway.expose_capability(
            name="stripe.create_product",
            description="Create a Stripe product with a recurring price",
            schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "amount_cents": {"type": "integer"},
                },
                "required": ["name", "amount_cents"],
            },
            func=stripe_agent.create_product,
        )

        await gateway.execute_agent_chain(
            system_prompt="You are the LaunchOps Revenue Agent.",
            task="Create a $49/mo starter plan for LaunchOps",
            allowed_tools=["stripe.create_product"],
        )
    """

    def __init__(self) -> None:
        self.mcp_client = MCPClient(
            default_model=os.getenv("DEFAULT_LLM_MODEL", "claude-3-5-sonnet-latest"),
            api_key=os.getenv("LLM_API_KEY"),
        )
        self.registered_tools: Dict[str, Dict[str, Any]] = {}
        self._sdk_available = _MCP_SDK_AVAILABLE

        if not self._sdk_available:
            logger.info(
                "MCP SDK not detected — using local shim. "
                "Install the `mcp` package to enable full agent-to-agent discovery."
            )

    # ── Capability registration ─────────────────────────────────────────────

    def expose_capability(
        self,
        name: str,
        description: str,
        schema: Dict[str, Any],
        func: ToolCallable,
    ) -> None:
        """
        Register an internal agent capability as an MCP-compliant tool.

        Other agents (internal via execute_agent_chain, external via
        /mcp/discover) can then find and invoke it.
        """
        tool_def = ToolDefinition(
            name=name, description=description, input_schema=schema
        )
        self.registered_tools[name] = {
            "definition": tool_def,
            "executable": func,
        }
        logger.info("MCP tool registered: %s", name)

    def list_capabilities(self) -> List[Dict[str, Any]]:
        """Dump all registered capabilities for /mcp/discover responses."""
        out = []
        for name, entry in self.registered_tools.items():
            td = entry["definition"]
            out.append(
                {
                    "name": getattr(td, "name", name),
                    "description": getattr(td, "description", ""),
                    "input_schema": getattr(td, "input_schema", {}),
                }
            )
        return out

    async def invoke_local(self, name: str, **kwargs: Any) -> Any:
        """
        Invoke a locally-registered MCP tool by name. Used by the LLM
        execution loop when the model picks a tool from allowed_tools.
        """
        entry = self.registered_tools.get(name)
        if entry is None:
            raise KeyError(f"MCP tool not registered: {name}")

        func = entry["executable"]
        if callable(func):
            import inspect

            if inspect.iscoroutinefunction(func):
                return await func(**kwargs)
            return func(**kwargs)
        raise TypeError(f"Registered MCP tool {name!r} is not callable")

    # ── Agent-to-Agent bridge ───────────────────────────────────────────────

    async def negotiate_with_external_agent(
        self, target_mcp_url: str, request_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Allow LaunchOps agents to dynamically query an external company's MCP
        server (e.g., a Bank or a Vendor) via /mcp/discover.
        """
        if httpx is None:
            raise RuntimeError("httpx not installed — cannot negotiate with external MCP")

        logger.info("MCP negotiation → %s", target_mcp_url)
        token = os.getenv("EXTERNAL_MCP_TOKEN", "")
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{target_mcp_url.rstrip('/')}/mcp/discover",
                json=request_payload,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    # ── Tool-augmented LLM execution ────────────────────────────────────────

    async def execute_agent_chain(
        self,
        system_prompt: str,
        task: str,
        allowed_tools: List[str],
        model: Optional[str] = None,
    ) -> str:
        """
        Run a tool-augmented LLM completion. `allowed_tools` must reference
        capability names previously registered via `expose_capability`.

        With the real MCP SDK, tools are passed in the native protocol format
        and the model selects them autonomously. With the shim, tools are
        summarized in the system prompt so the model still knows what's
        available — function-call execution then happens via invoke_local().
        """
        tools_to_inject = [
            self.registered_tools[t]["definition"]
            for t in allowed_tools
            if t in self.registered_tools
        ]

        missing = [t for t in allowed_tools if t not in self.registered_tools]
        if missing:
            logger.warning("MCP tools requested but not registered: %s", missing)

        return await self.mcp_client.generate(
            system=system_prompt,
            prompt=task,
            tools=tools_to_inject,
            model=model,
        )
