"""
ProofGuard Middleware — Phase 2 Governance Layer
=================================================

The Control Plane: Interfaces with the ProofGuard AI TypeScript/Supabase backend
to enforce CQS (Cognitive Quality Score) and IMDA/AICM compliance before any
agent is allowed to fire.

Flow:
    agent.propose_plan() → ProofGuard.attest_action() → [HITL if required] → agent.execute()

Environment:
    PROOFGUARD_API_URL       Base URL to the /api/attest route (default localhost:3000)
    PROOFGUARD_API_KEY       Bearer token for the Next.js/Supabase API
    ENABLE_HUMAN_APPROVAL    If "true", every stage goes through HITL regardless of CQS
    PROOFGUARD_HITL_TIMEOUT  Max seconds to wait for a human decision (default 3600)
    PROOFGUARD_POLL_INTERVAL Seconds between HITL polls (default 5)

    REMOVED (Sprint 1 hardening):
    PROOFGUARD_FAIL_OPEN was removed. The system is now fail-closed by
    design — if ProofGuard is unreachable, actions are BLOCKED.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

try:
    import httpx
except ImportError:  # pragma: no cover — httpx is in requirements.txt
    httpx = None  # type: ignore

logger = logging.getLogger("LaunchOps.ProofGuard")


# ── Exceptions ──────────────────────────────────────────────────────────────


class SecurityError(Exception):
    """Raised when ProofGuard blocks or rejects an execution intent."""


# ── Status constants ────────────────────────────────────────────────────────


STATUS_APPROVED = "APPROVED"
STATUS_BLOCKED = "BLOCKED"
STATUS_REJECTED = "REJECTED"
STATUS_REQUIRES_HITL = "REQUIRES_HITL"


# ── Middleware ──────────────────────────────────────────────────────────────


class ProofGuardMiddleware:
    """
    Async governance client for the ProofGuard AI control plane.

    Fail-secure by default: if the ProofGuard API is unreachable, attestation
    returns BLOCKED. Override with PROOFGUARD_FAIL_OPEN=true for local dev only.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        hitl_enabled: Optional[bool] = None,
    ):
        self.api_url = api_url or os.getenv(
            "PROOFGUARD_API_URL", "http://localhost:3000/api/attest"
        )
        self.api_key = api_key or os.getenv("PROOFGUARD_API_KEY", "")
        self.hitl_enabled = (
            hitl_enabled
            if hitl_enabled is not None
            else os.getenv("ENABLE_HUMAN_APPROVAL", "false").lower() == "true"
        )
        # FAIL-CLOSED by design. If ProofGuard is unreachable, actions are
        # BLOCKED, not auto-approved. There is no env-var escape hatch.
        # This is a deliberate architectural decision — governance must be
        # reliable even when the control plane is down.
        self.fail_open = False
        self.hitl_timeout = int(os.getenv("PROOFGUARD_HITL_TIMEOUT", "3600"))
        self.poll_interval = int(os.getenv("PROOFGUARD_POLL_INTERVAL", "5"))

    # ── Attestation ─────────────────────────────────────────────────────────

    async def attest_action(
        self,
        agent_name: str,
        stage: str,
        proposed_action: Dict[str, Any],
        risk_tier: str = "medium",
        imda_pillar: str = "Technical Robustness",
    ) -> Dict[str, Any]:
        """
        Send a proposed execution intent to ProofGuard for CQS scoring and
        IMDA/AICM policy evaluation.

        Contract matches proofguard-ai's POST /api/attest endpoint:
          request:
            agentId         short agent identifier (maps to attestations.agentId)
            agentName       human-readable name
            pipelineStage   LaunchOps stage name
            action          short verb describing the intent
            actionJson      full structured plan object
            riskTier        low | medium | high | critical
            imdaPillar      one of the 4 IMDA Model Governance pillars
            enforceHitl     override flag

          response:
            status          APPROVED | BLOCKED | REJECTED | REQUIRES_HITL
            cqsScore        0-100 cognitive quality score
            attestationId   att_<nanoid16> for later polling
            flagged         bool — true if ProofGuard flagged this intent
            guardrailsTriggered  list of guardrail ruleIds
            reason          human-readable explanation
        """
        # Derive a short "action" verb from the plan
        action_verb = (
            proposed_action.get("intended_action")
            or proposed_action.get("type")
            or f"{stage}_execute"
        )

        payload = {
            "agentId": agent_name,
            "agentName": agent_name,
            "pipelineStage": stage,
            "action": str(action_verb)[:256],
            "actionJson": proposed_action,
            "riskTier": risk_tier,
            "imdaPillar": imda_pillar,
            "enforceHitl": self.hitl_enabled,
        }

        logger.info(
            "[ProofGuard] Attestation request agent=%s stage=%s action=%s risk=%s",
            agent_name,
            stage,
            action_verb,
            risk_tier,
        )

        if httpx is None:
            return self._fail_result("httpx not installed")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=self._auth_headers(),
                )
                response.raise_for_status()
                data = response.json()
                # Normalize camelCase → snake_case so the rest of the
                # middleware can stay framework-agnostic
                normalized = {
                    "status": data.get("status"),
                    "cqs_score": data.get("cqsScore", data.get("cqs_score", 0)),
                    "attestation_id": data.get(
                        "attestationId", data.get("attestation_id")
                    ),
                    "flagged": data.get("flagged", False),
                    "risk_tier": data.get("riskTier", data.get("risk_tier")),
                    "guardrails_triggered": data.get("guardrailsTriggered", []),
                    "reason": data.get("reason"),
                }
                logger.info(
                    "[ProofGuard] attestation=%s status=%s cqs=%s flagged=%s",
                    normalized["attestation_id"],
                    normalized["status"],
                    normalized["cqs_score"],
                    normalized["flagged"],
                )
                return normalized
        except httpx.HTTPError as e:
            logger.error("ProofGuard attest failed: %s", e)
            return self._fail_result(f"Governance layer unreachable: {e}")

    # ── Human-in-the-Loop ───────────────────────────────────────────────────

    async def wait_for_hitl(
        self,
        attestation_id: str,
        poll_interval: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> bool:
        """
        Poll the ProofGuard dashboard until the founder clicks Approve / Reject.

        Raises:
            PermissionError  if the human rejects
            TimeoutError     if no decision is made within `timeout` seconds
        """
        poll_interval = poll_interval or self.poll_interval
        timeout = timeout or self.hitl_timeout

        logger.warning(
            "[ProofGuard] PAUSED — awaiting HITL decision (id=%s, timeout=%ds)",
            attestation_id,
            timeout,
        )
        logger.warning("Check the ProofGuard dashboard to approve or reject.")

        if httpx is None:
            raise PermissionError("httpx not installed — cannot poll HITL")

        elapsed = 0
        while elapsed < timeout:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(
                        f"{self.api_url}/status/{attestation_id}",
                        headers=self._auth_headers(),
                    )
                    res.raise_for_status()
                    status_data = res.json()
                    status = status_data.get("status")

                    if status == STATUS_APPROVED:
                        logger.info("[ProofGuard] Human override granted. Resuming.")
                        return True
                    if status == STATUS_REJECTED:
                        raise PermissionError(
                            status_data.get("reason")
                            or "Human operator rejected this execution intent."
                        )
            except httpx.HTTPError as e:
                logger.warning("HITL poll error (will retry): %s", e)

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        raise TimeoutError(
            f"HITL timeout after {timeout}s for attestation {attestation_id}"
        )

    # ── Audit (optional post-execution write-back) ──────────────────────────

    async def record_execution(
        self,
        attestation_id: Optional[str],
        result: Dict[str, Any],
        success: bool,
    ) -> None:
        """
        Best-effort write-back to ProofGuard after a stage completes so the
        control plane can close the loop (reflection scoring, narrative logs).
        Silently swallows errors — audit is not allowed to block execution.
        """
        if not attestation_id or httpx is None:
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{self.api_url}/audit/{attestation_id}",
                    json={"success": success, "result": result},
                    headers=self._auth_headers(),
                )
        except Exception as e:
            logger.debug("ProofGuard audit write-back skipped: %s", e)

    # ── Internals ───────────────────────────────────────────────────────────

    def _auth_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _fail_result(self, reason: str) -> Dict[str, Any]:
        """Fail-closed: unreachable ProofGuard always returns BLOCKED."""
        logger.error("[ProofGuard] FAIL-CLOSED — action blocked: %s", reason)
        return {
            "status": STATUS_BLOCKED,
            "cqs_score": 0,
            "attestation_id": None,
            "reason": reason,
        }
