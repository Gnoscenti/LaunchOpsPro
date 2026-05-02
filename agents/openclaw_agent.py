import asyncio
import json
import logging
import websockets
from typing import Any, Dict, Optional

from .base import BaseAgent

logger = logging.getLogger("LaunchOps.OpenClawAgent")

class OpenClawAgent(BaseAgent):
    """
    Agent that delegates tasks to the OpenClaw framework via WebSocket.
    """
    
    def __init__(self, llm_client=None, config=None):
        super().__init__(llm_client, config)
        self.ws_url = "wss://b86603c0-67a5-4338-891a-a0de531a0cfc.vultropenclaw.com"
        self.gateway_token = "6pUyk82skXQrbe6TBeOM"
        self.default_session_key = "agent:main:main"
        
    async def execute(self, task: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Execute a task by sending it to OpenClaw via WebSocket.
        """
        logger.info(f"Delegating task to OpenClaw: {task.get('action', 'unknown')}")
        
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
            return {
                "status": "error",
                "error": str(e)
            }
