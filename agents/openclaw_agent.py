import asyncio
import json
import logging
import os
import websockets
from typing import Any, Dict, Optional

from .base import BaseAgent

logger = logging.getLogger("LaunchOps.OpenClawAgent")

class OpenClawAgent(BaseAgent):
    """
    Agent that delegates tasks to the OpenClaw framework via WebSocket.

    The endpoint and token are runtime configuration. No provider-specific
    host or credential is embedded in source control.
    """
    
    def __init__(self, llm_client=None, config=None):
        super().__init__(
            name="OpenClaw",
            role="External Agent Gateway",
            llm_client=llm_client,
            config=config,
        )
        self.ws_url = os.getenv("OPENCLAW_WS_URL", "")
        self.gateway_token = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
        self.default_session_key = os.getenv(
            "OPENCLAW_SESSION_KEY", "agent:main:main"
        )

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Report gateway readiness without disclosing credentials."""
        return {
            "configured": bool(self.ws_url and self.gateway_token),
            "endpoint_configured": bool(self.ws_url),
            "credential_configured": bool(self.gateway_token),
            "session_key": context.get("session_key", self.default_session_key),
        }
        
    async def execute(self, task: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Execute a task by sending it to OpenClaw via WebSocket.
        """
        logger.info(f"Delegating task to OpenClaw: {task.get('action', 'unknown')}")

        if not self.ws_url or not self.gateway_token:
            return self.failure(
                "OpenClaw is not configured; set OPENCLAW_WS_URL and OPENCLAW_GATEWAY_TOKEN"
            )
        
        try:
            # Connect to OpenClaw WebSocket
            headers = {
                "Authorization": f"Bearer {self.gateway_token}"
            }
            
            async with websockets.connect(self.ws_url, extra_headers=headers) as websocket:
                # Send the task
                payload = {
                    "session_key": self.default_session_key,
                    "task": task,
                    "context": context or {}
                }
                
                await websocket.send(json.dumps(payload))
                
                # Wait for response
                response_str = await websocket.recv()
                response = json.loads(response_str)
                
                logger.info(f"Received response from OpenClaw: {response.get('status', 'unknown')}")
                return response
                
        except Exception as e:
            logger.error(f"OpenClaw execution failed: {e}")
            return self.failure(f"OpenClaw execution failed: {e}")
