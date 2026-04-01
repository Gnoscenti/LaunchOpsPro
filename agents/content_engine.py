"""Content Engine agent — 30-day content calendar, post templates, and tracking.

Content types:
  1. Build-in-public (daily) — what you built today, with proof
  2. Proof (revenue/deployments) — screenshots, metrics, customer wins
  3. Breakdowns (how systems work) — educational, authority-building

Platforms: X (Twitter), LinkedIn, YouTube Shorts
Success targets: 1000 new YouTube subs/week, 100 new course subs/week
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
import json


# ------------------------------------------------------------------
# Post Templates (no LLM needed — instant use)
# ------------------------------------------------------------------

POST_TEMPLATES = {
    "build_in_public": {
        "x_twitter": (
            "Day {{day_number}} of building {{product_name}} in public.\n\n"
            "Today I {{what_you_did}}.\n\n"
            "Result: {{result}}\n\n"
            "Proof: {{proof_url}}\n\n"
            "Tomorrow: {{tomorrow_plan}}\n\n"
            "#BuildInPublic #SoloFounder #AI"
        ),
        "linkedin": (
            "Day {{day_number}} building {{product_name}}.\n\n"
            "The problem: {{problem}}\n"
            "What I built: {{what_you_did}}\n"
            "The result: {{result}}\n\n"
            "Key lesson: {{lesson}}\n\n"
            "Follow along as I document the entire journey from zero to revenue.\n\n"
            "#BuildInPublic #Entrepreneurship #AI #SoloFounder"
        ),
        "youtube_short_script": (
            "HOOK (0-3s): \"I just {{dramatic_action}} and here's what happened.\"\n"
            "SHOW (3-20s): Screen recording of {{what_you_did}} with voiceover.\n"
            "RESULT (20-40s): \"The result? {{result}}\"\n"
            "CTA (40-50s): \"Follow for daily builds. Link in bio for the full course.\"\n"
            "TAGS: #BuildInPublic #AI #SoloFounder #Startup"
        ),
    },
    "proof": {
        "x_twitter": (
            "{{metric_name}}: {{metric_value}}\n\n"
            "{{context_sentence}}\n\n"
            "Here's the screenshot: {{proof_url}}\n\n"
            "The system that made this possible: {{system_name}}\n\n"
            "Full breakdown: {{link}}\n\n"
            "#Revenue #SoloFounder #BuildInPublic"
        ),
        "linkedin": (
            "{{metric_name}} hit {{metric_value}} this week.\n\n"
            "Here's exactly how:\n"
            "1. {{step_1}}\n"
            "2. {{step_2}}\n"
            "3. {{step_3}}\n\n"
            "No team. No funding. Just systems.\n\n"
            "I'm documenting the entire playbook at {{link}}\n\n"
            "#Revenue #Entrepreneurship #AI"
        ),
    },
    "breakdown": {
        "x_twitter": (
            "How I built {{system_name}} (thread):\n\n"
            "1/ {{point_1}}\n"
            "2/ {{point_2}}\n"
            "3/ {{point_3}}\n"
            "4/ {{point_4}}\n"
            "5/ Want the full blueprint? {{link}}\n\n"
            "#AI #Automation #BuildInPublic"
        ),
        "linkedin": (
            "I automated {{process_name}} and it saves me {{time_saved}} per week.\n\n"
            "Here's the architecture:\n\n"
            "{{architecture_description}}\n\n"
            "The tools:\n"
            "- {{tool_1}}\n"
            "- {{tool_2}}\n"
            "- {{tool_3}}\n\n"
            "Full walkthrough: {{link}}\n\n"
            "#Automation #AI #Productivity #Entrepreneurship"
        ),
        "youtube_short_script": (
            "HOOK (0-3s): \"This system runs my entire business while I sleep.\"\n"
            "EXPLAIN (3-30s): Walk through {{system_name}} architecture on screen.\n"
            "PROOF (30-45s): Show live dashboard with real numbers.\n"
            "CTA (45-55s): \"Full course at aiintegrationcourse.com\"\n"
            "TAGS: #AI #Automation #SoloFounder"
        ),
    },
}


# ------------------------------------------------------------------
# UTM Builder
# ------------------------------------------------------------------

def build_utm_url(
    base_url: str,
    source: str,
    medium: str,
    campaign: str,
    content: str = "",
) -> str:
    """Build a Matomo/GA-compatible UTM-tagged URL."""
    url = f"{base_url}?utm_source={source}&utm_medium={medium}&utm_campaign={campaign}"
    if content:
        url += f"&utm_content={content}"
    return url


# ------------------------------------------------------------------
# Content Engine Agent
# ------------------------------------------------------------------

class ContentEngineAgent:
    """Generates 30-day content calendars, fills post templates,
    and tracks content performance via Matomo UTMs."""

    name = "content_engine"

    def __init__(self, llm_client=None, config=None):
        if llm_client:
            self.client = llm_client
        elif OpenAI:
            api_key = os.environ.get("OPENAI_API_KEY", "")
            base_url = os.environ.get("OPENAI_API_BASE", os.environ.get("OPENAI_BASE_URL", ""))
            kwargs = {"api_key": api_key} if api_key else {}
            if base_url:
                kwargs["base_url"] = base_url
            self.client = OpenAI(**kwargs)
        else:
            self.client = None
        self.model = (config or {}).get("model", os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))

    def generate_30_day_calendar(
        self,
        product_name: str,
        current_mrr: float,
        key_milestones: List[str],
        base_url: str = "https://aiintegrationcourse.com",
    ) -> Dict[str, Any]:
        """Generate a 30-day content calendar across X, LinkedIn, YouTube."""

        system_msg = """You are a content strategist for a solo founder doing build-in-public.
Target: 1000 new YouTube subscribers/week, 100 new course subscriptions/week.

Content mix per week:
  - 5x Build-in-public posts (daily, Mon-Fri)
  - 2x Proof posts (revenue screenshots, deployment wins)
  - 2x Breakdown posts (how the systems work)
  - 3x YouTube Shorts (Mon, Wed, Fri)
  - 1x LinkedIn long-form (Sunday)

Every post must include a UTM-tagged link back to the course.

Output a JSON array of 30 objects, one per day, each with:
  day: integer (1-30)
  date: ISO date string
  content_type: "build_in_public" | "proof" | "breakdown"
  platforms: list of "x" | "linkedin" | "youtube_short"
  topic: string — specific topic for the day
  hook: string — the opening line
  utm_campaign: string — campaign name for tracking
"""

        user_msg = f"""Product: {product_name}
Current MRR: ${current_mrr:,.2f}
Key milestones to highlight: {json.dumps(key_milestones)}
Start date: {date.today().isoformat()}
Base URL for UTMs: {base_url}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=4096,
        )

        return {
            "type": "content_calendar",
            "start_date": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    def generate_post(
        self,
        content_type: str,
        platform: str,
        variables: Dict[str, str],
    ) -> Dict[str, Any]:
        """Fill a post template with provided variables."""

        template_group = POST_TEMPLATES.get(content_type, {})
        template = template_group.get(platform, "")

        if not template:
            return {"error": f"No template for {content_type}/{platform}"}

        # Fill template variables
        filled = template
        for key, value in variables.items():
            filled = filled.replace("{{" + key + "}}", str(value))

        # Add UTM link
        utm_url = build_utm_url(
            base_url=variables.get("link", "https://aiintegrationcourse.com"),
            source=platform,
            medium="social",
            campaign=variables.get("utm_campaign", f"{content_type}_{date.today().isoformat()}"),
            content=variables.get("utm_content", ""),
        )

        return {
            "type": "post",
            "platform": platform,
            "content_type": content_type,
            "text": filled,
            "utm_url": utm_url,
            "char_count": len(filled),
        }

    def generate_youtube_short_script(
        self,
        topic: str,
        key_points: List[str],
        cta_url: str = "https://aiintegrationcourse.com",
    ) -> Dict[str, Any]:
        """Generate a YouTube Shorts script (under 60 seconds)."""

        system_msg = """You are a YouTube Shorts scriptwriter for a solo founder.
Rules:
  - Hook in first 3 seconds (pattern interrupt or bold claim)
  - Show, don't tell — describe screen recordings and visuals
  - Under 60 seconds total
  - End with clear CTA to the course

Output a JSON object:
  hook: string (0-3 seconds)
  body: list of objects with "timestamp" and "action" and "voiceover"
  cta: string (last 5-10 seconds)
  estimated_duration: integer (seconds)
  tags: list of strings
"""

        user_msg = f"""Topic: {topic}
Key points to cover: {json.dumps(key_points)}
CTA URL: {cta_url}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=1024,
        )

        return {
            "type": "youtube_short_script",
            "topic": topic,
            "response": response.choices[0].message.content,
        }
