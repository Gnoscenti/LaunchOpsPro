"""
Funding Intelligence Agent
Analyzes business models against all major funding avenues and generates
a comprehensive funding readiness report.

Covers:
- Venture Capital (Seed, Series A, Series B)
- Angel Investors
- SBIR/STTR Federal Grants
- SBA Loans (7a, 504, Microloan)
- State & Local Grants
- Crowdfunding (Equity & Reward)
- Revenue-Based Financing
- Bootstrapping Optimization

Formation-to-Funding Structure Optimizer:
Recommends the optimal entity type and state of formation to maximize
eligibility across all funding avenues simultaneously.
"""

from typing import Dict, List, Optional
from datetime import datetime
import json
import os
from .base import BaseAgent


# ─────────────────────────────────────────────────────────────────────────────
# Funding Avenue Definitions
# ─────────────────────────────────────────────────────────────────────────────

FUNDING_AVENUES = {
    "venture_capital": {
        "name": "Venture Capital",
        "type": "equity",
        "stage": ["seed", "series_a", "series_b"],
        "typical_amount": "$500K – $50M+",
        "requirements": {
            "entity": ["Delaware C-Corp"],
            "ownership": "Founder must retain majority initially",
            "scalability": "10x+ return potential required",
            "market_size": "TAM > $1B preferred",
            "traction": "MRR or strong user growth metrics",
            "ip": "IP assigned to company (not founder)",
        },
        "disqualifiers": [
            "LLC structure (most VCs won't invest)",
            "S-Corp (can't have corporate shareholders)",
            "Non-Delaware incorporation (creates friction)",
            "Founder IP not assigned to company",
            "Revenue-only business with no growth story",
        ],
        "resources": [
            "https://www.ycombinator.com/apply",
            "https://angel.co/",
            "https://www.crunchbase.com/",
        ],
    },
    "angel_investors": {
        "name": "Angel Investors",
        "type": "equity",
        "stage": ["pre_seed", "seed"],
        "typical_amount": "$25K – $500K",
        "requirements": {
            "entity": ["Delaware C-Corp", "LLC (convertible note possible)"],
            "founder_story": "Compelling personal narrative",
            "market": "Clear problem and solution",
            "traction": "Early customers or strong validation",
        },
        "disqualifiers": [
            "No clear path to exit",
            "Lifestyle business framing",
        ],
        "resources": [
            "https://angel.co/",
            "https://www.angelcapitalassociation.org/",
        ],
    },
    "sbir_sttr": {
        "name": "SBIR/STTR Federal Grants",
        "type": "non_dilutive_grant",
        "stage": ["pre_seed", "seed", "series_a"],
        "typical_amount": "$50K – $2M (Phase I: $50K-$300K; Phase II: up to $2M)",
        "requirements": {
            "entity": ["For-profit US business (any structure)"],
            "employees": "< 500 employees",
            "ownership": ">51% owned by US citizens or permanent residents",
            "rd_focus": "R&D with commercial potential",
            "pi_affiliation": "Principal Investigator must be primarily employed by the business",
        },
        "disqualifiers": [
            "Non-profit organizations",
            "Foreign-owned majority",
            "No R&D component",
            "Subsidiaries of large businesses",
        ],
        "agencies": [
            "NIH (health/biotech)",
            "NSF (deep tech/AI)",
            "DoD (defense tech)",
            "DOE (energy)",
            "NASA (aerospace/AI)",
            "USDA (agtech/food)",
        ],
        "resources": [
            "https://www.sbir.gov/",
            "https://seedfund.nsf.gov/",
        ],
    },
    "sba_loans": {
        "name": "SBA Loans",
        "type": "debt",
        "stage": ["seed", "series_a", "growth"],
        "typical_amount": "$5K – $5M",
        "requirements": {
            "entity": ["Any US business entity"],
            "credit": "Personal credit score > 640 (varies by lender)",
            "time_in_business": "6+ months preferred",
            "collateral": "Personal guarantee typically required",
            "revenue": "Some revenue preferred",
        },
        "disqualifiers": [
            "Businesses engaged in illegal activities",
            "Non-US businesses",
        ],
        "programs": {
            "7a": "General purpose, up to $5M",
            "504": "Real estate/equipment, up to $5.5M",
            "microloan": "Up to $50K, ideal for early-stage",
        },
        "resources": [
            "https://www.sba.gov/funding-programs/loans",
        ],
    },
    "state_local_grants": {
        "name": "State & Local Grants",
        "type": "non_dilutive_grant",
        "stage": ["pre_seed", "seed"],
        "typical_amount": "$1K – $250K",
        "requirements": {
            "entity": ["Any business entity registered in the state"],
            "location": "Must operate in the granting jurisdiction",
            "industry": "Often targeted (tech, manufacturing, minority-owned, etc.)",
        },
        "resources": [
            "https://www.grants.gov/",
            "https://www.uschamber.com/co/run/business-financing/small-business-grants-and-programs",
        ],
    },
    "revenue_based_financing": {
        "name": "Revenue-Based Financing (RBF)",
        "type": "debt_hybrid",
        "stage": ["seed", "growth"],
        "typical_amount": "$50K – $3M",
        "requirements": {
            "entity": ["Any US business entity"],
            "revenue": "Minimum $10K-$25K MRR",
            "growth": "Consistent month-over-month revenue growth",
        },
        "providers": ["Clearco", "Capchase", "Pipe", "Arc"],
        "resources": [
            "https://clearco.com/",
            "https://capchase.com/",
        ],
    },
    "crowdfunding_equity": {
        "name": "Equity Crowdfunding (Reg CF)",
        "type": "equity",
        "stage": ["pre_seed", "seed"],
        "typical_amount": "$50K – $5M",
        "requirements": {
            "entity": ["US business entity (C-Corp or LLC)"],
            "disclosure": "Must file with SEC",
            "platform": "Must use SEC-registered intermediary",
        },
        "platforms": ["Wefunder", "Republic", "StartEngine"],
        "resources": [
            "https://wefunder.com/",
            "https://republic.com/",
        ],
    },
    "qsbs_tax_advantage": {
        "name": "QSBS Tax Exclusion (Section 1202)",
        "type": "tax_advantage",
        "stage": ["seed", "series_a"],
        "typical_amount": "Up to $10M in capital gains excluded",
        "requirements": {
            "entity": ["Delaware C-Corp ONLY"],
            "assets": "Gross assets < $50M at time of issuance",
            "holding_period": "Must hold stock for 5+ years",
            "active_business": "Must be active business (not holding company)",
        },
        "note": "This is a massive tax benefit for early investors — it makes C-Corp equity much more attractive than LLC membership interests.",
        "resources": [
            "https://www.irs.gov/taxtopics/tc409",
        ],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Formation Structure Optimizer
# ─────────────────────────────────────────────────────────────────────────────

FORMATION_MATRIX = {
    "Delaware_C_Corp": {
        "vc_eligible": True,
        "angel_eligible": True,
        "sbir_eligible": True,
        "sba_eligible": True,
        "qsbs_eligible": True,
        "reg_cf_eligible": True,
        "rbf_eligible": True,
        "state_grants_eligible": "Varies (register in home state)",
        "pros": [
            "Gold standard for VC and institutional investment",
            "QSBS Section 1202 tax exclusion for investors",
            "Flexible equity structure (common, preferred, options)",
            "Strong legal precedent (Delaware Court of Chancery)",
            "Easy to convert from LLC if needed",
        ],
        "cons": [
            "Double taxation (corporate + personal) unless S-Corp election",
            "Annual Delaware franchise tax ($400+ minimum)",
            "More administrative overhead than LLC",
        ],
        "recommended_for": ["SaaS", "Tech", "Any business seeking VC", "Any business with SBIR potential"],
        "formation_cost": "$89 Delaware filing + $50-300 registered agent/year",
    },
    "Delaware_LLC": {
        "vc_eligible": False,
        "angel_eligible": "Possible with convertible note",
        "sbir_eligible": True,
        "sba_eligible": True,
        "qsbs_eligible": False,
        "reg_cf_eligible": True,
        "rbf_eligible": True,
        "state_grants_eligible": "Varies",
        "pros": [
            "Pass-through taxation (no double tax)",
            "Flexible management structure",
            "Lower administrative overhead",
            "Easier for single-member solopreneur",
        ],
        "cons": [
            "Most VCs will not invest in LLCs",
            "No QSBS benefit for investors",
            "Complex to add equity compensation (options)",
            "Must convert to C-Corp before Series A",
        ],
        "recommended_for": ["Bootstrapped businesses", "Consulting/services", "Real estate", "Businesses not seeking VC"],
        "formation_cost": "$90 Delaware filing + $50-300 registered agent/year",
    },
    "Home_State_LLC": {
        "vc_eligible": False,
        "angel_eligible": "Possible with convertible note",
        "sbir_eligible": True,
        "sba_eligible": True,
        "qsbs_eligible": False,
        "reg_cf_eligible": True,
        "rbf_eligible": True,
        "state_grants_eligible": True,
        "pros": [
            "Single state registration (no dual filing)",
            "Access to home state grants",
            "Lower total cost if operating locally",
        ],
        "cons": [
            "Less investor-friendly than Delaware",
            "No QSBS benefit",
            "Must re-register in Delaware if seeking VC",
        ],
        "recommended_for": ["Local businesses", "Service businesses", "Businesses seeking state-specific grants"],
        "formation_cost": "Varies by state ($50-$500 filing)",
    },
}


class FundingIntelligenceAgent(BaseAgent):
    """
    Funding Intelligence Agent — analyzes business models against all major
    funding avenues and generates a comprehensive funding readiness report.
    """

    def __init__(self, llm_client=None, config: Dict = None):
        super().__init__(
            name="Funding Intelligence",
            role="Funding Strategy & Formation Optimizer",
            llm_client=llm_client,
            config=config,
        )

    def analyze(self, context: Dict) -> Dict:
        """Analyze business against all funding avenues."""
        business_type = context.get("business_type", "saas")
        entity_type = context.get("entity_type", "Delaware_C_Corp")
        has_rd = context.get("has_rd_component", False)
        seeking_vc = context.get("seeking_vc", True)
        revenue = context.get("monthly_revenue", 0)
        us_citizen = context.get("us_citizen_owner", True)

        eligible_avenues = self._calculate_eligibility(
            entity_type, has_rd, seeking_vc, revenue, us_citizen
        )
        formation_recommendation = self._recommend_formation(seeking_vc, has_rd, business_type)
        funding_roadmap = self._build_funding_roadmap(eligible_avenues, revenue)

        return {
            "eligible_avenues": eligible_avenues,
            "formation_recommendation": formation_recommendation,
            "funding_roadmap": funding_roadmap,
            "total_potential_funding": self._calculate_total_potential(eligible_avenues),
        }

    def execute(self, task: Dict) -> Dict:
        """Execute funding intelligence tasks."""
        task_type = task.get("type")

        if task_type == "funding_readiness_report":
            return self._generate_readiness_report(task)
        elif task_type == "formation_optimizer":
            return self._formation_optimizer(task)
        elif task_type == "sbir_eligibility_check":
            return self._sbir_eligibility_check(task)
        elif task_type == "vc_readiness_check":
            return self._vc_readiness_check(task)
        elif task_type == "grant_search":
            return self._grant_search(task)
        else:
            return {"success": False, "error": f"Unknown task type: {task_type}"}

    def _calculate_eligibility(
        self, entity_type: str, has_rd: bool, seeking_vc: bool, revenue: float, us_citizen: bool
    ) -> List[Dict]:
        """Calculate eligibility for each funding avenue."""
        results = []

        for avenue_id, avenue in FUNDING_AVENUES.items():
            eligible = True
            reasons = []
            blockers = []

            # Entity check
            if avenue_id == "venture_capital":
                if "C-Corp" not in entity_type and "Delaware" not in entity_type:
                    eligible = False
                    blockers.append("Must be Delaware C-Corp for VC investment")
                if not seeking_vc:
                    eligible = False
                    blockers.append("Not seeking equity investment")

            elif avenue_id == "sbir_sttr":
                if not has_rd:
                    eligible = False
                    blockers.append("No R&D component identified in business model")
                if not us_citizen:
                    eligible = False
                    blockers.append("Must be >51% US citizen/permanent resident owned")

            elif avenue_id == "revenue_based_financing":
                if revenue < 10000:
                    eligible = False
                    blockers.append(f"Need minimum $10K MRR (current: ${revenue:,.0f})")

            elif avenue_id == "qsbs_tax_advantage":
                if "C_Corp" not in entity_type and "C-Corp" not in entity_type:
                    eligible = False
                    blockers.append("QSBS only available for C-Corp equity holders")

            if eligible:
                reasons.append(f"Entity structure ({entity_type}) is compatible")

            results.append({
                "avenue_id": avenue_id,
                "avenue_name": avenue["name"],
                "type": avenue["type"],
                "eligible": eligible,
                "typical_amount": avenue["typical_amount"],
                "reasons": reasons,
                "blockers": blockers,
                "resources": avenue.get("resources", []),
            })

        return results

    def _recommend_formation(self, seeking_vc: bool, has_rd: bool, business_type: str) -> Dict:
        """Recommend optimal formation structure."""
        if seeking_vc:
            entity = "Delaware_C_Corp"
            reason = "Delaware C-Corp is required for VC investment and provides QSBS tax benefits for investors."
        elif has_rd:
            entity = "Delaware_C_Corp"
            reason = "Delaware C-Corp maximizes SBIR/STTR eligibility and positions for future VC if R&D succeeds."
        elif business_type in ["consulting", "services", "local"]:
            entity = "Home_State_LLC"
            reason = "Home state LLC minimizes overhead for service businesses not seeking institutional funding."
        else:
            entity = "Delaware_C_Corp"
            reason = "Delaware C-Corp is the default recommendation — it keeps all funding doors open."

        formation_details = FORMATION_MATRIX.get(entity, {})

        return {
            "recommended_entity": entity,
            "reason": reason,
            "formation_details": formation_details,
            "state": "Delaware",
            "registered_agent_needed": True,
            "estimated_cost": formation_details.get("formation_cost", "See state filing fees"),
        }

    def _build_funding_roadmap(self, eligible_avenues: List[Dict], current_revenue: float) -> List[Dict]:
        """Build a sequenced funding roadmap."""
        roadmap = []

        # Stage 1: Pre-Revenue
        if current_revenue == 0:
            roadmap.append({
                "stage": "Pre-Revenue (Now)",
                "priority_avenues": ["state_local_grants", "sbir_sttr", "crowdfunding_equity"],
                "action": "Apply for non-dilutive grants while building product. SBIR Phase I if R&D component exists.",
                "target_amount": "$10K – $300K",
            })

        # Stage 2: Early Revenue
        roadmap.append({
            "stage": "Early Revenue ($1K – $10K MRR)",
            "priority_avenues": ["angel_investors", "state_local_grants", "sba_loans"],
            "action": "Raise a small angel round ($50K-$250K) on a SAFE note to extend runway.",
            "target_amount": "$50K – $500K",
        })

        # Stage 3: Product-Market Fit
        roadmap.append({
            "stage": "Product-Market Fit ($10K+ MRR)",
            "priority_avenues": ["venture_capital", "revenue_based_financing"],
            "action": "Raise seed round from VCs or use RBF to scale without dilution.",
            "target_amount": "$500K – $3M",
        })

        # Stage 4: Scale
        roadmap.append({
            "stage": "Scale ($50K+ MRR)",
            "priority_avenues": ["venture_capital"],
            "action": "Series A fundraise with proven unit economics.",
            "target_amount": "$3M – $15M",
        })

        return roadmap

    def _calculate_total_potential(self, eligible_avenues: List[Dict]) -> str:
        """Calculate total potential funding from eligible avenues."""
        eligible_count = sum(1 for a in eligible_avenues if a["eligible"])
        return f"{eligible_count} funding avenues accessible (see roadmap for sequencing)"

    def _generate_readiness_report(self, task: Dict) -> Dict:
        """Generate a comprehensive funding readiness report."""
        business_config = task.get("business_config", {})
        analysis = self.analyze(business_config)

        business_name = business_config.get("business_name", "Your Business")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        report = {
            "success": True,
            "report_title": f"Funding Readiness Report — {business_name}",
            "generated_at": timestamp,
            "executive_summary": self._build_executive_summary(analysis, business_name),
            "formation_recommendation": analysis["formation_recommendation"],
            "eligible_avenues": [a for a in analysis["eligible_avenues"] if a["eligible"]],
            "blocked_avenues": [a for a in analysis["eligible_avenues"] if not a["eligible"]],
            "funding_roadmap": analysis["funding_roadmap"],
            "immediate_actions": self._get_immediate_actions(analysis),
        }

        # Save report
        report_path = os.path.expanduser(f"~/.launchops/funding_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        self._print_report(report)
        return report

    def _build_executive_summary(self, analysis: Dict, business_name: str) -> str:
        """Build executive summary of funding readiness."""
        eligible_count = len([a for a in analysis["eligible_avenues"] if a["eligible"]])
        total_count = len(analysis["eligible_avenues"])
        entity = analysis["formation_recommendation"]["recommended_entity"]

        return (
            f"{business_name} is currently eligible for {eligible_count} of {total_count} analyzed funding avenues. "
            f"The recommended entity structure is {entity.replace('_', ' ')}, which maximizes funding eligibility "
            f"while maintaining operational flexibility. "
            f"The primary near-term funding strategy is non-dilutive grants and angel investment, "
            f"transitioning to VC as product-market fit is established."
        )

    def _get_immediate_actions(self, analysis: Dict) -> List[str]:
        """Get the top 5 immediate actions for funding readiness."""
        actions = []
        rec = analysis["formation_recommendation"]

        actions.append(f"Form {rec['recommended_entity'].replace('_', ' ')} in {rec['state']} (Est. cost: {rec['estimated_cost']})")
        actions.append("Obtain EIN from IRS (free, same-day online at irs.gov)")
        actions.append("Open a dedicated business bank account (Mercury or Relay recommended for startups)")
        actions.append("File Beneficial Ownership Information (BOI) report with FinCEN within 90 days")

        # Check SBIR eligibility
        sbir = next((a for a in analysis["eligible_avenues"] if a["avenue_id"] == "sbir_sttr"), None)
        if sbir and sbir["eligible"]:
            actions.append("Register at sbir.gov and identify the next SBIR solicitation for your technology area")
        else:
            actions.append("Research state grant programs at grants.gov for your industry and location")

        return actions

    def _formation_optimizer(self, task: Dict) -> Dict:
        """Run the formation structure optimizer."""
        seeking_vc = task.get("seeking_vc", True)
        has_rd = task.get("has_rd", False)
        business_type = task.get("business_type", "saas")

        recommendation = self._recommend_formation(seeking_vc, has_rd, business_type)

        print(f"\n{'='*60}")
        print("🏛️  Formation Structure Optimizer")
        print(f"{'='*60}")
        print(f"\n✅ Recommended: {recommendation['recommended_entity'].replace('_', ' ')}")
        print(f"   State: {recommendation['state']}")
        print(f"   Reason: {recommendation['reason']}")
        print(f"   Est. Cost: {recommendation['estimated_cost']}")
        print(f"\n📋 Pros:")
        for pro in recommendation["formation_details"].get("pros", []):
            print(f"   + {pro}")
        print(f"\n⚠️  Cons:")
        for con in recommendation["formation_details"].get("cons", []):
            print(f"   - {con}")
        print(f"\n{'='*60}\n")

        return {"success": True, "recommendation": recommendation}

    def _sbir_eligibility_check(self, task: Dict) -> Dict:
        """Check SBIR/STTR eligibility."""
        business_config = task.get("business_config", {})
        employees = business_config.get("employees", 1)
        us_citizen = business_config.get("us_citizen_owner", True)
        has_rd = business_config.get("has_rd_component", False)
        for_profit = business_config.get("for_profit", True)

        checks = [
            {"requirement": "For-profit US business", "met": for_profit, "critical": True},
            {"requirement": "< 500 employees", "met": employees < 500, "critical": True},
            {"requirement": ">51% US citizen/permanent resident ownership", "met": us_citizen, "critical": True},
            {"requirement": "R&D component with commercial potential", "met": has_rd, "critical": True},
            {"requirement": "Not majority-owned by VC (for SBIR)", "met": True, "critical": False},
        ]

        all_critical_met = all(c["met"] for c in checks if c["critical"])

        return {
            "success": True,
            "eligible": all_critical_met,
            "checks": checks,
            "next_steps": [
                "Register at sbir.gov",
                "Identify relevant agencies (NSF for AI/tech, NIH for health, DoD for defense)",
                "Find open solicitations at sbir.gov/solicitations",
                "Prepare Phase I proposal (typically 15-25 pages)",
            ] if all_critical_met else ["Address the critical requirements above before applying"],
            "resources": FUNDING_AVENUES["sbir_sttr"]["resources"],
        }

    def _vc_readiness_check(self, task: Dict) -> Dict:
        """Check VC readiness."""
        business_config = task.get("business_config", {})
        entity_type = business_config.get("entity_type", "")
        mrr = business_config.get("monthly_revenue", 0)
        tam = business_config.get("tam_estimate", "")
        has_ip_assignment = business_config.get("ip_assigned_to_company", False)

        checks = [
            {"requirement": "Delaware C-Corp", "met": "C_Corp" in entity_type or "C-Corp" in entity_type, "critical": True},
            {"requirement": "IP assigned to company (not founder)", "met": has_ip_assignment, "critical": True},
            {"requirement": "Scalable business model (10x+ potential)", "met": True, "critical": True},
            {"requirement": "MRR or strong user growth", "met": mrr > 0, "critical": False},
            {"requirement": "TAM > $1B", "met": bool(tam), "critical": False},
        ]

        vc_ready = all(c["met"] for c in checks if c["critical"])

        return {
            "success": True,
            "vc_ready": vc_ready,
            "checks": checks,
            "mrr": mrr,
            "target_mrr_for_seed": "$10K – $50K MRR",
            "next_steps": [
                "Build a 10-slide pitch deck (Problem, Solution, Market, Product, Traction, Team, Financials, Ask)",
                "Create a data room (cap table, financials, product demo, customer references)",
                "Research seed-stage VCs in your space at crunchbase.com",
                "Apply to YC, Techstars, or relevant accelerators for validation + network",
            ] if vc_ready else ["Fix critical blockers above before approaching VCs"],
        }

    def _grant_search(self, task: Dict) -> Dict:
        """Provide grant search guidance."""
        industry = task.get("industry", "technology")
        state = task.get("state", "")
        business_type = task.get("business_type", "")

        grant_sources = [
            {
                "source": "Grants.gov",
                "url": "https://www.grants.gov/",
                "description": "Federal grants database — search by CFDA number for your industry",
                "best_for": "All industries, especially R&D and social impact",
            },
            {
                "source": "SBIR.gov",
                "url": "https://www.sbir.gov/",
                "description": "Federal R&D grants for small businesses",
                "best_for": "Tech, biotech, defense, AI, clean energy",
            },
            {
                "source": "SBA Small Business Grants",
                "url": "https://www.sba.gov/funding-programs/grants",
                "description": "SBA-administered grant programs",
                "best_for": "General small business, minority-owned, women-owned",
            },
            {
                "source": "Economic Development Administration (EDA)",
                "url": "https://www.eda.gov/",
                "description": "Regional economic development grants",
                "best_for": "Job creation, manufacturing, rural businesses",
            },
            {
                "source": "State Economic Development Offices",
                "url": f"https://www.sba.gov/local-assistance/resource-partners/small-business-development-centers",
                "description": f"Your state's economic development office for {state or 'your state'}",
                "best_for": "Local businesses, state-specific incentives",
            },
        ]

        return {
            "success": True,
            "industry": industry,
            "state": state,
            "grant_sources": grant_sources,
            "pro_tip": "Non-dilutive grants are the best funding — they don't cost you equity. Apply for every grant you qualify for, simultaneously with building your business.",
        }

    def _print_report(self, report: Dict):
        """Print a formatted funding readiness report."""
        print(f"\n{'='*60}")
        print(f"💰 {report['report_title']}")
        print(f"{'='*60}")
        print(f"\n📊 Executive Summary:")
        print(f"   {report['executive_summary']}")
        print(f"\n✅ Eligible Funding Avenues ({len(report['eligible_avenues'])}):")
        for avenue in report["eligible_avenues"]:
            print(f"   • {avenue['avenue_name']}: {avenue['typical_amount']}")
        print(f"\n🚫 Blocked Avenues ({len(report['blocked_avenues'])}):")
        for avenue in report["blocked_avenues"]:
            blockers = ", ".join(avenue.get("blockers", ["See requirements"]))
            print(f"   • {avenue['avenue_name']}: {blockers}")
        print(f"\n⚡ Immediate Actions:")
        for i, action in enumerate(report["immediate_actions"], 1):
            print(f"   {i}. {action}")
        print(f"\n{'='*60}\n")
