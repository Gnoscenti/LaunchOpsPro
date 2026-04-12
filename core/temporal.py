"""
Temporal Manager — The Heartbeat
==================================

Pomodoro/timeboxing engine that turns a ranked task list into a series of
strict time blocks. Used by FounderOSAgent.generate_daily_agenda() to
produce the "What Matters Now" sprint schedule rendered by the Dynexis
DailyCommandCenter.

Design:
  * Top-N strict cap (default 3) — the Dynexis rule: if you can't do it in
    three 25-minute blocks, it doesn't belong on today's list.
  * ROI-weighted ordering — highest ROI action gets the first (freshest)
    slot of the day.
  * Stateless — the object only formats data; actual countdown state lives
    in the React timer on the frontend. That keeps the backend free of
    per-user stopwatch state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional


@dataclass
class TemporalManager:
    """
    The On-task pomodoro logic engine.

    Fields:
        focus_minutes: length of each focus block (default 25)
        break_minutes: length of each break block (default 5)
        max_sprints:   hard cap on how many sprints a day can hold (default 3)
        start_hour:    first sprint's start time in 24-h local (default 9)
    """

    focus_minutes: int = 25
    break_minutes: int = 5
    max_sprints: int = 3
    start_hour: int = 9

    # ── Core formatters ─────────────────────────────────────────────────────

    def format_pomodoro_block(
        self,
        task_name: str,
        priority_score: int,
        sprint_index: int = 0,
        task_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Turn a single task into a pomodoro sprint block with a start time.
        start_time is advisory — the frontend timer runs from "click Start".
        """
        scheduled = self._slot_start(sprint_index)
        return {
            "task": task_name,
            "description": task_description,
            "roi_score": priority_score,
            "type": "pomodoro_sprint",
            "sprint_index": sprint_index,
            "duration_minutes": self.focus_minutes,
            "duration_seconds": self.focus_minutes * 60,
            "break_minutes": self.break_minutes,
            "scheduled_start": scheduled.isoformat(),
            "scheduled_end": (
                scheduled + timedelta(minutes=self.focus_minutes)
            ).isoformat(),
            "status": "pending",
        }

    def build_agenda(
        self,
        priorities: List[Dict[str, Any]],
        top_n: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Take a list of task dicts (each must contain `name` and `roi`) and
        return a pomodoro sprint schedule sorted by ROI descending, capped
        at `top_n` or `self.max_sprints`, whichever is smaller.
        """
        limit = min(top_n or self.max_sprints, self.max_sprints)

        # Sort by ROI descending; ties broken by original order
        ranked = sorted(
            enumerate(priorities),
            key=lambda pair: (-float(pair[1].get("roi", 0)), pair[0]),
        )

        sprints: List[Dict[str, Any]] = []
        for sprint_index, (_, task) in enumerate(ranked[:limit]):
            sprints.append(
                self.format_pomodoro_block(
                    task_name=task.get("name") or task.get("task") or "Unnamed task",
                    priority_score=int(task.get("roi", 0)),
                    sprint_index=sprint_index,
                    task_description=task.get("description"),
                )
            )
        return sprints

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _slot_start(self, sprint_index: int) -> datetime:
        """
        Compute the advisory wall-clock start time for a sprint slot.
        Each sprint takes `focus + break` minutes before the next begins.
        """
        today = datetime.now().replace(hour=self.start_hour, minute=0, second=0, microsecond=0)
        offset_minutes = sprint_index * (self.focus_minutes + self.break_minutes)
        return today + timedelta(minutes=offset_minutes)

    def total_committed_minutes(self, sprint_count: int) -> int:
        """Return the total focus time committed for N sprints."""
        return sprint_count * self.focus_minutes
