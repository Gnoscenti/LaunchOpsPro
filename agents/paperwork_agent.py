"""
Paperwork Agent — LaunchOps Founder Edition
Generates ALL legal documents a startup needs, from formation through funding.
Uses GPT-4o/Claude for document generation — NOT toy models.
IP protection is paramount.

Documents generated:
  - Articles of Incorporation / Certificate of Formation
  - Operating Agreement (LLC) / Bylaws (C-Corp)
  - IP Assignment Agreement (Founder → Entity)
  - Confidential Information and Invention Assignment (CIIA)
  - Non-Disclosure Agreement (NDA) — mutual and one-way
  - Privacy Policy (GDPR/CCPA compliant)
  - Terms of Service
  - Provisional Patent Application (USPTO format)
  - Trademark Application Guidance
  - Trade Secret Documentation Protocol
  - 83(b) Election (for C-Corp stock grants)
  - SAFE Agreement (Simple Agreement for Future Equity)
  - Beneficial Ownership Information (BOI) Report Guidance
  - Contractor Agreement
  - Advisory Agreement
"""

from typing import Dict, List, Optional
from datetime import datetime
import json
import os

from .base import BaseAgent


# ── Document Templates Metadata ───────────────────────────────────────────

DOCUMENT_CATALOG = {
    "operating_agreement": {
        "name": "Operating Agreement (LLC)",
        "category": "formation",
        "priority": "critical",
        "when": "At formation — before ANY business activity",
        "cost_if_lawyer": "$1,500 - $5,000",
        "description": "Governs LLC management, member rights, profit distribution, dissolution.",
        "ip_relevance": "Must include IP assignment clause and work-for-hire provisions.",
    },
    "bylaws": {
        "name": "Corporate Bylaws (C-Corp)",
        "category": "formation",
        "priority": "critical",
        "when": "At incorporation",
        "cost_if_lawyer": "$2,000 - $5,000",
        "description": "Governs corporate operations, board meetings, officer roles, stock issuance.",
    },
    "ip_assignment": {
        "name": "IP Assignment Agreement",
        "category": "ip_protection",
        "priority": "critical",
        "when": "Day 1 of formation — BEFORE any other activity",
        "cost_if_lawyer": "$500 - $2,000",
        "description": "Transfers all founder IP (code, designs, data, inventions) to the business entity.",
        "ip_relevance": "THE most critical IP document. Without this, investors will walk.",
        "warning": "Must be executed BEFORE any funding conversations. Retroactive assignment is messy.",
    },
    "ciia": {
        "name": "Confidential Information and Invention Assignment Agreement (CIIA)",
        "category": "ip_protection",
        "priority": "critical",
        "when": "For every employee, contractor, advisor, or collaborator — before they start work",
        "cost_if_lawyer": "$500 - $1,500",
        "description": "Ensures all work product belongs to the company. Protects trade secrets.",
        "ip_relevance": "Standard in Silicon Valley. Required by all VCs before investment.",
    },
    "nda_mutual": {
        "name": "Mutual Non-Disclosure Agreement",
        "category": "ip_protection",
        "priority": "high",
        "when": "Before sharing confidential information with potential partners, vendors, or collaborators",
        "cost_if_lawyer": "$300 - $1,000",
        "description": "Both parties agree to protect each other's confidential information.",
    },
    "nda_one_way": {
        "name": "One-Way Non-Disclosure Agreement",
        "category": "ip_protection",
        "priority": "high",
        "when": "Before sharing confidential information with contractors or potential hires",
        "cost_if_lawyer": "$300 - $800",
        "description": "Recipient agrees to protect discloser's confidential information.",
    },
    "provisional_patent": {
        "name": "Provisional Patent Application",
        "category": "ip_protection",
        "priority": "high",
        "when": "Before public disclosure of any novel method, system, or process",
        "cost_if_lawyer": "$2,000 - $5,000",
        "cost_self_file": "$320 (micro entity) / $640 (small entity) USPTO fee",
        "description": "Establishes priority date for patent claims. Lasts 12 months.",
        "ip_relevance": "Gives you 'Patent Pending' status. Must file BEFORE public disclosure.",
        "warning": "You have 12 months to file a non-provisional patent or the provisional expires.",
    },
    "trade_secret_protocol": {
        "name": "Trade Secret Documentation Protocol",
        "category": "ip_protection",
        "priority": "high",
        "when": "Immediately — for any proprietary algorithms, data, or processes",
        "cost_if_lawyer": "$500 - $2,000",
        "description": "Documents what constitutes trade secrets and the measures taken to protect them.",
        "ip_relevance": "Trade secret protection requires REASONABLE MEASURES. This documents them.",
    },
    "privacy_policy": {
        "name": "Privacy Policy",
        "category": "compliance",
        "priority": "critical",
        "when": "Before collecting ANY user data — required by law",
        "cost_if_lawyer": "$1,000 - $3,000",
        "description": "GDPR, CCPA, and state privacy law compliant privacy policy.",
    },
    "terms_of_service": {
        "name": "Terms of Service",
        "category": "compliance",
        "priority": "critical",
        "when": "Before launching any public-facing product or service",
        "cost_if_lawyer": "$1,000 - $3,000",
        "description": "Governs user relationship, liability limitations, dispute resolution.",
    },
    "eighty_three_b": {
        "name": "83(b) Election",
        "category": "tax",
        "priority": "critical",
        "when": "Within 30 days of receiving restricted stock — CANNOT be late",
        "cost_if_lawyer": "$200 - $500",
        "description": "Elects to be taxed on stock at grant date (low value) rather than vesting date (high value).",
        "warning": "MUST be filed within 30 days. Missing this deadline is irreversible and can cost millions in taxes.",
    },
    "safe_agreement": {
        "name": "SAFE (Simple Agreement for Future Equity)",
        "category": "funding",
        "priority": "high",
        "when": "When raising pre-seed or seed funding from angels",
        "cost_if_lawyer": "$500 - $2,000",
        "description": "Y Combinator standard investment instrument. Converts to equity at next priced round.",
    },
    "contractor_agreement": {
        "name": "Independent Contractor Agreement",
        "category": "operations",
        "priority": "high",
        "when": "Before engaging any contractor or freelancer",
        "cost_if_lawyer": "$500 - $1,500",
        "description": "Defines scope, payment, IP ownership, confidentiality for contractor work.",
        "ip_relevance": "MUST include work-for-hire and IP assignment clauses.",
    },
    "advisory_agreement": {
        "name": "Advisory Agreement",
        "category": "operations",
        "priority": "medium",
        "when": "Before engaging any advisor (especially if granting equity)",
        "cost_if_lawyer": "$500 - $1,500",
        "description": "Defines advisor role, compensation (equity), vesting, confidentiality.",
    },
    "boi_report": {
        "name": "Beneficial Ownership Information (BOI) Report",
        "category": "compliance",
        "priority": "critical",
        "when": "Within 90 days of formation — federal requirement (FinCEN)",
        "cost_if_lawyer": "$100 - $500",
        "description": "Reports beneficial owners to FinCEN. Required by Corporate Transparency Act.",
        "warning": "Failure to file can result in $500/day penalties and criminal liability.",
    },
}


class PaperworkAgent(BaseAgent):
    """
    Legal document generation agent.
    Uses GPT-4o/Claude for high-quality, customized legal documents.
    NOT a replacement for a lawyer — but gets you 90% there.
    """

    def __init__(self, llm_client=None, config: Dict = None):
        super().__init__(
            name="paperwork_agent",
            role="Legal Document Generator & IP Protection Specialist",
            llm_client=llm_client,
            config=config or {},
        )
        self.docs_dir = os.path.expanduser("~/.launchops/legal_docs")

    # ── Phase 2: propose_plan for ProofGuard attestation ────────────────

    async def propose_plan(
        self, task_payload: Dict, context: Optional[Dict] = None
    ) -> Dict:
        """
        Draft the intended document-generation action so ProofGuard can
        attest it before the LLM fires. Paperwork is read-only from an
        infra perspective (no network writes, no credentials) but HIGH
        sensitivity because it produces legally binding artifacts that
        might include PII of the founder or company.

        Risk classification:
          low:       boilerplate templates (NDA, contractor agreement)
          medium:    formation docs (Operating Agreement, Articles, Bylaws)
          high:      IP assignment, 83(b), SAFE — involve real equity/tax
                     consequences

        IMDA pillar: "Human Accountability" — a human must sign the output.
        """
        task_type = task_payload.get("type", "generate_document")
        doc_id = task_payload.get("document_id") or task_type

        high_risk_types = {
            "generate_ip_assignment",
            "generate_83b",
            "generate_safe",
            "generate_provisional_patent",
        }
        medium_risk_types = {
            "formation_package",
            "generate_all",
            "generate_operating_agreement",
            "generate_ciia",
        }

        if task_type in high_risk_types:
            risk_tier = "high"
        elif task_type in medium_risk_types:
            risk_tier = "medium"
        else:
            risk_tier = "low"

        return {
            "agent": self.name,
            "intended_action": task_type,
            "document_id": doc_id,
            "business_name": task_payload.get("business_name"),
            "entity_type": task_payload.get("entity_type"),
            "state": task_payload.get("state"),
            "risk_tier": risk_tier,
            "imda_pillar": "Human Accountability",
            "data_sensitivity": "PII / legally binding",
            "side_effects": "file_write_only",
            "reversibility": "fully reversible before signing",
            "rationale": (
                f"{self.name} will generate a {doc_id} using LLM templates; "
                "output is a draft file on disk requiring human review and "
                "signature before it has legal effect."
            ),
        }
        os.makedirs(self.docs_dir, exist_ok=True)

    def analyze(self, context: Dict) -> Dict:
        """Analyze what documents the business needs and in what order."""
        entity_type = context.get("entity_type", "not_formed")
        stage = context.get("stage", "ideation")
        has_contractors = context.get("has_contractors", False)
        has_advisors = context.get("has_advisors", False)
        has_website = context.get("has_website", False)
        seeking_funding = context.get("seeking_funding", False)
        has_novel_ip = context.get("has_novel_ip", False)

        needed = []
        completed = self._get_completed_docs()

        for doc_id, doc in DOCUMENT_CATALOG.items():
            if doc_id in completed:
                continue

            # Formation docs
            if doc["category"] == "formation":
                if entity_type == "not_formed" or doc_id in ("operating_agreement", "bylaws"):
                    needed.append({**doc, "id": doc_id})

            # IP protection — ALWAYS needed
            elif doc["category"] == "ip_protection":
                if doc_id == "provisional_patent" and not has_novel_ip:
                    continue
                needed.append({**doc, "id": doc_id})

            # Compliance
            elif doc["category"] == "compliance":
                if doc_id == "boi_report" and entity_type == "not_formed":
                    continue
                if doc_id in ("privacy_policy", "terms_of_service") and not has_website:
                    continue
                needed.append({**doc, "id": doc_id})

            # Tax
            elif doc["category"] == "tax":
                if doc_id == "eighty_three_b" and entity_type not in ("delaware_c_corp", "c_corp"):
                    continue
                needed.append({**doc, "id": doc_id})

            # Funding
            elif doc["category"] == "funding":
                if seeking_funding:
                    needed.append({**doc, "id": doc_id})

            # Operations
            elif doc["category"] == "operations":
                if doc_id == "contractor_agreement" and has_contractors:
                    needed.append({**doc, "id": doc_id})
                if doc_id == "advisory_agreement" and has_advisors:
                    needed.append({**doc, "id": doc_id})

        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        needed.sort(key=lambda d: priority_order.get(d["priority"], 99))

        return {
            "documents_needed": needed,
            "documents_completed": list(completed.keys()),
            "total_lawyer_cost_estimate": self._estimate_lawyer_cost(needed),
            "ip_documents_needed": [d for d in needed if d["category"] == "ip_protection"],
        }

    def execute(self, task: Dict) -> Dict:
        task_type = task.get("type", "generate_document")
        handlers = {
            "generate_document": self._generate_document,
            "generate_all": self._generate_all_needed,
            "ip_audit": self._ip_audit,
            "document_status": self._document_status,
            "generate_ip_assignment": self._generate_ip_assignment,
            "generate_nda": self._generate_nda,
            "generate_operating_agreement": self._generate_operating_agreement,
            "generate_privacy_policy": self._generate_privacy_policy,
            "generate_terms_of_service": self._generate_terms_of_service,
            "generate_provisional_patent": self._generate_provisional_patent,
            "generate_trade_secret_protocol": self._generate_trade_secret_protocol,
            "generate_ciia": self._generate_ciia,
            "generate_contractor_agreement": self._generate_contractor_agreement,
            "generate_83b": self._generate_83b,
            "generate_safe": self._generate_safe,
        }
        handler = handlers.get(task_type, self._generate_document)
        return handler(task)

    # ── Document Generation ───────────────────────────────────────────────

    def _generate_document(self, task: Dict) -> Dict:
        doc_id = task.get("document_id", "")
        business = task.get("business", {})

        if doc_id not in DOCUMENT_CATALOG:
            return {"success": False, "error": f"Unknown document: {doc_id}. Available: {list(DOCUMENT_CATALOG.keys())}"}

        doc_meta = DOCUMENT_CATALOG[doc_id]

        system = f"""You are an expert startup attorney generating a {doc_meta['name']}.

IMPORTANT:
- Generate a COMPLETE, PROFESSIONAL legal document — not a summary or outline.
- Include all standard clauses and provisions.
- Use proper legal formatting with numbered sections and subsections.
- Include signature blocks.
- Add [PLACEHOLDER] for any information that needs to be filled in.
- This document should be 90%+ ready to use.
- Include a DISCLAIMER at the top that this is AI-generated and should be reviewed by an attorney.

DO NOT generate a template with just headers. Generate the FULL document text."""

        user = f"""Generate a complete {doc_meta['name']} for this business:

Business Name: {business.get('business_name', '[COMPANY NAME]')}
Entity Type: {business.get('entity_type', '[ENTITY TYPE]')}
State of Formation: {business.get('state', '[STATE]')}
Founder Name: {business.get('founder_name', '[FOUNDER NAME]')}
Business Type: {business.get('business_type', '[BUSINESS TYPE]')}
Business Description: {business.get('description', '[BUSINESS DESCRIPTION]')}
Address: {business.get('address', '[BUSINESS ADDRESS]')}

Additional context: {json.dumps({k: v for k, v in business.items() if k not in ('business_name', 'entity_type', 'state', 'founder_name', 'business_type', 'description', 'address')})}

Generate the COMPLETE document now."""

        document_text = self._call_llm(system, user)

        if document_text:
            # Save the document
            filename = f"{doc_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            filepath = os.path.join(self.docs_dir, filename)
            with open(filepath, "w") as f:
                f.write(f"# {doc_meta['name']}\n\n")
                f.write(f"Generated: {datetime.now().strftime('%B %d, %Y')}\n\n")
                f.write(f"---\n\n")
                f.write(document_text)

            self._mark_completed(doc_id, filepath)

            return {
                "success": True,
                "document_id": doc_id,
                "document_name": doc_meta["name"],
                "file_path": filepath,
                "message": f"Generated {doc_meta['name']} — saved to {filepath}",
                "warning": "AI-generated document. Have an attorney review before signing.",
            }

        return {"success": False, "error": "LLM failed to generate document. Check API configuration."}

    def _generate_all_needed(self, task: Dict) -> Dict:
        """Generate all needed documents for the business."""
        business = task.get("business", {})
        analysis = self.analyze(business)
        results = []

        for doc in analysis["documents_needed"]:
            result = self._generate_document({
                "document_id": doc["id"],
                "business": business,
            })
            results.append(result)

        return {
            "success": True,
            "documents_generated": len([r for r in results if r.get("success")]),
            "documents_failed": len([r for r in results if not r.get("success")]),
            "results": results,
        }

    # ── Specialized Document Generators ───────────────────────────────────

    def _generate_ip_assignment(self, task: Dict) -> Dict:
        """Generate IP Assignment Agreement with extra care."""
        business = task.get("business", {})

        system = """You are an IP attorney specializing in startup IP assignments.
Generate a COMPLETE Intellectual Property Assignment Agreement.

This is THE most critical document for a startup. It must:
1. Cover ALL forms of IP: patents, copyrights, trade secrets, trademarks, domain names
2. Include prior inventions schedule (what the founder keeps)
3. Include future inventions clause (work-for-hire)
4. Cover AI-assisted creations explicitly
5. Include representations and warranties
6. Be specific about the consideration (what the founder gets in exchange)
7. Include proper signature blocks and notarization language

Generate the FULL document, not a summary."""

        user = f"""Generate an IP Assignment Agreement:

Assignor (Founder): {business.get('founder_name', '[FOUNDER NAME]')}
Assignee (Company): {business.get('business_name', '[COMPANY NAME]')}
Entity Type: {business.get('entity_type', '[ENTITY TYPE]')}
State: {business.get('state', '[STATE]')}

IP Being Assigned:
- Software/Code: {business.get('has_code', True)}
- Designs/UI: {business.get('has_designs', True)}
- Brand/Name: {business.get('has_brand', True)}
- Data/Datasets: {business.get('has_data', False)}
- Novel Methods/Algorithms: {business.get('has_novel_methods', False)}
- Domain Names: {business.get('domains', '[DOMAIN NAMES]')}
- AI-Assisted Creations: {business.get('ai_assisted', True)}

Consideration: {business.get('consideration', 'Founder stock in the company')}

Generate the COMPLETE IP Assignment Agreement now."""

        document_text = self._call_llm(system, user)

        if document_text:
            filename = f"ip_assignment_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            filepath = os.path.join(self.docs_dir, filename)
            with open(filepath, "w") as f:
                f.write("# Intellectual Property Assignment Agreement\n\n")
                f.write(f"Generated: {datetime.now().strftime('%B %d, %Y')}\n\n")
                f.write("**DISCLAIMER: AI-generated document. Must be reviewed by a qualified attorney before execution.**\n\n")
                f.write("---\n\n")
                f.write(document_text)

            self._mark_completed("ip_assignment", filepath)
            return {"success": True, "file_path": filepath, "document": "IP Assignment Agreement"}

        return {"success": False, "error": "Failed to generate IP Assignment Agreement"}

    def _generate_nda(self, task: Dict) -> Dict:
        """Generate NDA (mutual or one-way)."""
        mutual = task.get("mutual", True)
        return self._generate_document({
            "document_id": "nda_mutual" if mutual else "nda_one_way",
            "business": task.get("business", {}),
        })

    def _generate_operating_agreement(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "operating_agreement", "business": task.get("business", {})})

    def _generate_privacy_policy(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "privacy_policy", "business": task.get("business", {})})

    def _generate_terms_of_service(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "terms_of_service", "business": task.get("business", {})})

    def _generate_ciia(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "ciia", "business": task.get("business", {})})

    def _generate_contractor_agreement(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "contractor_agreement", "business": task.get("business", {})})

    def _generate_83b(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "eighty_three_b", "business": task.get("business", {})})

    def _generate_safe(self, task: Dict) -> Dict:
        return self._generate_document({"document_id": "safe_agreement", "business": task.get("business", {})})

    def _generate_provisional_patent(self, task: Dict) -> Dict:
        """Generate provisional patent application with USPTO format."""
        business = task.get("business", {})

        system = """You are a patent attorney helping a startup file a provisional patent application.

Generate a COMPLETE provisional patent application in USPTO format:
1. Title of Invention
2. Cross-Reference to Related Applications (if any)
3. Background of the Invention
4. Summary of the Invention
5. Brief Description of the Drawings (if applicable)
6. Detailed Description of the Preferred Embodiment
7. Claims (at least 10 claims — independent and dependent)
8. Abstract

The description must be detailed enough to support the claims.
Include specific technical details, not vague descriptions.
This establishes the priority date — thoroughness matters."""

        user = f"""Generate a provisional patent application for:

Inventor: {business.get('founder_name', '[INVENTOR NAME]')}
Company: {business.get('business_name', '[COMPANY NAME]')}
Invention Title: {business.get('invention_title', business.get('business_name', '[INVENTION TITLE]'))}
Technology Area: {business.get('business_type', '[TECHNOLOGY AREA]')}

Description of the invention:
{business.get('invention_description', business.get('description', '[DETAILED DESCRIPTION OF THE INVENTION]'))}

Novel aspects:
{business.get('novel_aspects', '[WHAT MAKES THIS NOVEL/NON-OBVIOUS]')}

Generate the COMPLETE provisional patent application now."""

        document_text = self._call_llm(system, user)

        if document_text:
            filename = f"provisional_patent_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            filepath = os.path.join(self.docs_dir, filename)
            with open(filepath, "w") as f:
                f.write("# Provisional Patent Application\n\n")
                f.write(f"Generated: {datetime.now().strftime('%B %d, %Y')}\n\n")
                f.write("**DISCLAIMER: AI-generated document. Must be reviewed by a patent attorney before filing.**\n\n")
                f.write(f"**USPTO Filing Fee:** $320 (micro entity) / $640 (small entity) / $1,600 (large entity)\n\n")
                f.write(f"**File at:** https://www.uspto.gov/patents/apply\n\n")
                f.write("---\n\n")
                f.write(document_text)

            self._mark_completed("provisional_patent", filepath)
            return {"success": True, "file_path": filepath, "document": "Provisional Patent Application"}

        return {"success": False, "error": "Failed to generate provisional patent application"}

    def _generate_trade_secret_protocol(self, task: Dict) -> Dict:
        """Generate trade secret documentation and protection protocol."""
        business = task.get("business", {})

        system = """You are a trade secret attorney. Generate a COMPLETE Trade Secret Protection Protocol.

This document must:
1. Define what constitutes a trade secret in this business
2. Enumerate specific trade secrets (with classification levels)
3. Document the REASONABLE MEASURES taken to protect them (required by law)
4. Include access control policies
5. Include employee/contractor obligations
6. Include incident response procedures for trade secret misappropriation
7. Include a trade secret inventory template
8. Reference the Defend Trade Secrets Act (DTSA) and state UTSA provisions

This is a LEGAL document that proves the company takes reasonable measures
to protect its trade secrets — which is REQUIRED for trade secret protection."""

        user = f"""Generate a Trade Secret Protection Protocol for:

Company: {business.get('business_name', '[COMPANY NAME]')}
Business Type: {business.get('business_type', '[BUSINESS TYPE]')}

Potential trade secrets:
- Proprietary algorithms/code: {business.get('has_code', True)}
- Training data/datasets: {business.get('has_data', False)}
- Customer lists/data: {business.get('has_customers', False)}
- Business processes: True
- Pricing strategies: True
- AI model weights/configurations: {business.get('has_ai_models', False)}

Generate the COMPLETE Trade Secret Protection Protocol now."""

        document_text = self._call_llm(system, user)

        if document_text:
            filename = f"trade_secret_protocol_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            filepath = os.path.join(self.docs_dir, filename)
            with open(filepath, "w") as f:
                f.write("# Trade Secret Protection Protocol\n\n")
                f.write(f"Generated: {datetime.now().strftime('%B %d, %Y')}\n\n")
                f.write("**CONFIDENTIAL — DO NOT DISTRIBUTE**\n\n")
                f.write("---\n\n")
                f.write(document_text)

            self._mark_completed("trade_secret_protocol", filepath)
            return {"success": True, "file_path": filepath, "document": "Trade Secret Protection Protocol"}

        return {"success": False, "error": "Failed to generate trade secret protocol"}

    # ── IP Audit ──────────────────────────────────────────────────────────

    def _ip_audit(self, task: Dict) -> Dict:
        """Perform a comprehensive IP audit."""
        business = task.get("business", {})

        if self.llm_client:
            system = """You are an IP attorney performing a startup IP audit.
Be thorough, specific, and actionable. Identify ALL forms of IP and recommend
protection strategies for each."""

            user = f"""Perform a comprehensive IP audit for this business:

Business: {business.get('business_name', 'N/A')}
Type: {business.get('business_type', 'N/A')}
Has Software/Code: {business.get('has_code', True)}
Has Novel Methods: {business.get('has_novel_methods', False)}
Has Brand/Name: {business.get('has_brand', True)}
Has Training Data: {business.get('has_data', False)}
Has AI Models: {business.get('has_ai_models', False)}
Has Designs/UI: {business.get('has_designs', True)}
Has Customer Data: {business.get('has_customers', False)}
AI-Assisted Creation: {business.get('ai_assisted', True)}
Open Source Used: {business.get('uses_open_source', True)}

For each IP asset found:
1. Type of IP (patent, copyright, trade secret, trademark)
2. Current protection status
3. Recommended protection action
4. Priority (critical/high/medium/low)
5. Cost estimate
6. Timeline
7. Impact on funding eligibility

Also assess:
- Open source license compatibility risks
- AI-generated content copyright considerations
- Trade secret vs. patent decision for each protectable asset"""

            audit = self._call_llm(system, user)
        else:
            audit = "Configure LLM for IP audit."

        return {"success": True, "type": "ip_audit", "audit": audit}

    # ── Document Status ───────────────────────────────────────────────────

    def _document_status(self, task: Dict) -> Dict:
        completed = self._get_completed_docs()
        all_docs = DOCUMENT_CATALOG

        status = []
        for doc_id, doc in all_docs.items():
            status.append({
                "id": doc_id,
                "name": doc["name"],
                "category": doc["category"],
                "priority": doc["priority"],
                "completed": doc_id in completed,
                "file_path": completed.get(doc_id, {}).get("file_path"),
                "completed_at": completed.get(doc_id, {}).get("completed_at"),
            })

        return {
            "success": True,
            "total_documents": len(all_docs),
            "completed": len(completed),
            "remaining": len(all_docs) - len(completed),
            "documents": status,
        }

    # ── Internal Helpers ──────────────────────────────────────────────────

    def _get_completed_docs(self) -> Dict:
        tracker_path = os.path.join(self.docs_dir, "tracker.json")
        if os.path.exists(tracker_path):
            with open(tracker_path, "r") as f:
                return json.load(f)
        return {}

    def _mark_completed(self, doc_id: str, filepath: str):
        tracker_path = os.path.join(self.docs_dir, "tracker.json")
        completed = self._get_completed_docs()
        completed[doc_id] = {
            "file_path": filepath,
            "completed_at": datetime.now().isoformat(),
        }
        with open(tracker_path, "w") as f:
            json.dump(completed, f, indent=2)

    def _estimate_lawyer_cost(self, docs: List[Dict]) -> str:
        total_low = 0
        total_high = 0
        for doc in docs:
            cost = doc.get("cost_if_lawyer", "$0 - $0")
            import re
            nums = re.findall(r'[\d,]+', cost.replace(',', ''))
            if len(nums) >= 2:
                total_low += int(nums[0])
                total_high += int(nums[1])
            elif len(nums) == 1:
                total_low += int(nums[0])
                total_high += int(nums[0])
        return f"${total_low:,} - ${total_high:,} (if using a lawyer)"
