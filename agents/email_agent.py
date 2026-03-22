"""
Gnoscenti Atlas Engine - Email Agent
Configures transactional email (SMTP) and generates email sequence templates.
Supports: Mailgun, SendGrid, Postmark, AWS SES, and self-hosted Postal.
"""
from __future__ import annotations
from typing import Any, Dict, List
from agents.base import BaseAgent


EMAIL_PROVIDERS = {
    "mailgun": {
        "smtp_host": "smtp.mailgun.org",
        "smtp_port": 587,
        "free_tier": "5,000 emails/month for 3 months",
        "pricing": "$0.80/1000 emails after free tier",
        "best_for": "Developers, API-first",
    },
    "sendgrid": {
        "smtp_host": "smtp.sendgrid.net",
        "smtp_port": 587,
        "free_tier": "100 emails/day forever",
        "pricing": "$19.95/month for 50k emails",
        "best_for": "Marketing + transactional",
    },
    "postmark": {
        "smtp_host": "smtp.postmarkapp.com",
        "smtp_port": 587,
        "free_tier": "100 emails/month",
        "pricing": "$1.25/1000 emails",
        "best_for": "Highest deliverability, transactional",
    },
    "ses": {
        "smtp_host": "email-smtp.us-east-1.amazonaws.com",
        "smtp_port": 587,
        "free_tier": "62,000 emails/month (from EC2)",
        "pricing": "$0.10/1000 emails",
        "best_for": "High volume, AWS users",
    },
}

WELCOME_SEQUENCE = [
    {
        "day": 0,
        "subject": "Welcome to {business_name} — here's how to get started",
        "goal": "Activate user — guide to first value moment",
        "cta": "Complete your profile",
    },
    {
        "day": 1,
        "subject": "Quick tip: the #1 thing successful {business_name} users do first",
        "goal": "Drive feature adoption",
        "cta": "Try [key feature]",
    },
    {
        "day": 3,
        "subject": "Are you getting value from {business_name}?",
        "goal": "Check in, offer help",
        "cta": "Book a 15-min onboarding call",
    },
    {
        "day": 7,
        "subject": "Your first week with {business_name} — what's next",
        "goal": "Reinforce value, introduce advanced features",
        "cta": "Explore [advanced feature]",
    },
    {
        "day": 14,
        "subject": "Upgrade to unlock [premium feature]",
        "goal": "Trial-to-paid conversion",
        "cta": "Start your paid plan",
    },
]


class EmailAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Email", llm_client, config)

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Analyzing email configuration requirements...")
        business_type = context.get("business_type", "saas")
        email_volume = context.get("email_volume", "low")  # low | medium | high

        recommended_provider = "postmark" if email_volume == "low" else "sendgrid"

        return {
            "recommended_provider": recommended_provider,
            "providers": EMAIL_PROVIDERS,
            "sequences": WELCOME_SEQUENCE,
            "dns_records": self._dns_records(context.get("domain", "yourdomain.com")),
            "deliverability_checklist": self._deliverability_checklist(),
        }

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_type = task.get("type", "configure_email")
        analysis = task.get("analysis", self.analyze(task))

        if task_type == "configure_email":
            return self._configure(task, analysis)
        elif task_type == "generate_sequences":
            return self._generate_sequences(task)
        return self.failure(f"Unknown task type: {task.get('type')}")

    def _configure(self, ctx: Dict, analysis: Dict) -> Dict[str, Any]:
        provider_name = ctx.get("provider", analysis["recommended_provider"])
        provider = EMAIL_PROVIDERS.get(provider_name, EMAIL_PROVIDERS["postmark"])
        business_name = ctx.get("business_name", self.config.business.business_name)

        config_snippet = f"""# Email Configuration — {provider_name.title()}
SMTP_HOST={provider['smtp_host']}
SMTP_PORT={provider['smtp_port']}
SMTP_USER=your_api_key_here
SMTP_PASSWORD=your_api_key_here
FROM_EMAIL=hello@{ctx.get('domain', 'yourdomain.com')}
FROM_NAME={business_name}
"""
        sequences = [
            {**seq, "subject": seq["subject"].format(business_name=business_name)}
            for seq in WELCOME_SEQUENCE
        ]

        return self.success(
            f"Email configured with {provider_name.title()}",
            provider=provider,
            config_snippet=config_snippet,
            welcome_sequence=sequences,
            dns_records=analysis["dns_records"],
            deliverability_checklist=analysis["deliverability_checklist"],
        )

    def _generate_sequences(self, ctx: Dict) -> Dict[str, Any]:
        business_name = ctx.get("business_name", self.config.business.business_name)
        sequences = [
            {**seq, "subject": seq["subject"].format(business_name=business_name)}
            for seq in WELCOME_SEQUENCE
        ]
        return self.success("Email sequences generated", sequences=sequences)

    def _dns_records(self, domain: str) -> List[Dict]:
        return [
            {"type": "TXT", "name": domain, "value": "v=spf1 include:mailgun.org ~all", "purpose": "SPF"},
            {"type": "TXT", "name": f"_dmarc.{domain}", "value": "v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}", "purpose": "DMARC"},
            {"type": "CNAME", "name": f"email.{domain}", "value": "mailgun.org", "purpose": "DKIM (varies by provider)"},
        ]

    def _deliverability_checklist(self) -> List[str]:
        return [
            "[ ] SPF record configured",
            "[ ] DKIM signing enabled",
            "[ ] DMARC policy set (start with p=none)",
            "[ ] Custom sending domain configured (not shared IP)",
            "[ ] Unsubscribe link in every marketing email",
            "[ ] Physical address in email footer (CAN-SPAM)",
            "[ ] Bounce handling configured",
            "[ ] Complaint rate < 0.1%",
        ]
