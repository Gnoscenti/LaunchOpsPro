"""
ExecAI Coach — LaunchOps Founder Edition
Strategic Catalyst persona + Harvard Dataverse coaching frameworks.
MBA-in-Action for solopreneurs, governed by the LaunchOps runtime contract.

Merged from:
  - execai-platform-api/personas/strategic_catalyst.py
  - HBS Executive Coaching methodology
  - Harvard Dataverse research frameworks
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import os

from .base import BaseAgent


# ── Harvard Dataverse Coaching Frameworks ─────────────────────────────────

HBS_COACHING_FRAMEWORKS = {
    "lean_validation": {
        "name": "Lean Validation Framework (HBS Adaptation)",
        "source": "Harvard Business School Entrepreneurship Essentials",
        "steps": [
            "Define 3 falsifiable hypotheses about your customer, problem, and solution.",
            "Design the cheapest possible test for each hypothesis.",
            "Set a 'kill criteria' before you run the test — not after.",
            "Run the test in 7 days or less.",
            "Pivot, persevere, or kill based on data, not emotion.",
        ],
    },
    "competitive_moat": {
        "name": "Competitive Moat Analysis",
        "source": "HBS Strategy (Porter's Five Forces + JTBD)",
        "steps": [
            "Map all substitutes (direct, indirect, DIY, doing nothing).",
            "Identify the ONE job your customer is hiring your product to do.",
            "Define your moat: network effects, switching costs, proprietary data, brand, or scale.",
            "Test moat durability: can a well-funded competitor replicate this in 18 months?",
            "If yes, build a deeper moat before scaling.",
        ],
    },
    "courage_under_uncertainty": {
        "name": "Courage Under Uncertainty (HBS Case Method)",
        "source": "HBS Case Method — The Entrepreneurial Manager",
        "steps": [
            "Accept that you will never have perfect information.",
            "Identify the decision with the highest reversibility — make it first.",
            "For irreversible decisions, gather 70% of the data you wish you had, then decide.",
            "Document your reasoning at the time of decision (not post-hoc rationalization).",
            "Review decisions quarterly — learn from outcomes without hindsight bias.",
        ],
    },
    "unit_economics_first": {
        "name": "Unit Economics Before Scale",
        "source": "HBS Finance for Entrepreneurs",
        "steps": [
            "Calculate Customer Acquisition Cost (CAC) for your primary channel.",
            "Calculate Lifetime Value (LTV) — be conservative.",
            "LTV:CAC ratio must be >3x before scaling paid acquisition.",
            "Calculate payback period — must be <12 months for capital efficiency.",
            "Model the path to $10k/month and $30k/month with real numbers.",
        ],
    },
    "solopreneur_leverage": {
        "name": "Solopreneur Leverage Framework",
        "source": "HBR — How Successful Solopreneurs Make Money",
        "steps": [
            "Identify your highest-value activity (the one only YOU can do).",
            "Automate or eliminate everything else.",
            "Build systems, not tasks — every repeated action becomes a documented process.",
            "Price for value, not time — hourly billing is a ceiling, not a floor.",
            "Create one 'passive revenue' asset per quarter.",
        ],
    },
    "ip_first_formation": {
        "name": "IP-First Formation Strategy",
        "source": "Stanford Law / HBS Entrepreneurial Finance",
        "steps": [
            "Audit all IP BEFORE forming entity — code, designs, data, processes.",
            "File provisional patent for any novel method/system ($320 USPTO fee).",
            "Execute IP Assignment Agreement: founder → entity on Day 1 of formation.",
            "Register trademarks (name, logo) with USPTO ($250-$350 per class).",
            "Establish trade secret protocols: access logs, encryption, NDA for all collaborators.",
            "Document all AI-assisted creation with timestamps for copyright defensibility.",
        ],
    },
}

# ── Strategic Catalyst Persona ────────────────────────────────────────────

STRATEGIC_CATALYST = {
    "name": "The Strategic Catalyst",
    "title": "Executive Coach, Capital Strategist, and Innovation Ethicist",
    "focus": "Coaching first-time founders who may lack traditional business backgrounds, "
             "but possess bold vision and purpose.",
    "core_functions": [
        "Founder's MBA-in-Action — translate MBA-level thinking into founder-ready plans",
        "Ethical Capital Planning — SBA loans, grants, angels, crypto-native fundraising",
        "AI Co-Founder Integration — legally empower AI as collaborator, IP strategy",
        "Startup Risk Mitigation — diagnose red flags, recommend protective structures",
        "Launch Readiness — legal filing, rights clauses, protections, monetization",
        "Narrative & Legacy Framing — civilizational innovation, not just a startup",
    ],
    "tone": "Clear, direct, master-level, but supportive and mentor-like.",
    "style": "MBA + VC partner + Philosopher + Systems Designer.",
    "bias": "Favor long-term resilience, ethical innovation, alignment over flashy growth.",
    "delivery": "Proactive guidance — suggest before the founder asks.",
}

# ── Documentary Milestones ────────────────────────────────────────────────

DOCUMENTARY_MILESTONES = [
    {"id": "idea_locked", "title": "Idea Locked", "description": "Business concept validated and Build Spec created.", "chapter": 1},
    {"id": "ip_audit_complete", "title": "IP Audit Complete", "description": "All intellectual property identified, documented, and protection strategy defined.", "chapter": 1},
    {"id": "entity_formed", "title": "Entity Formed", "description": "Legal entity filed with Secretary of State.", "chapter": 1},
    {"id": "ip_assigned", "title": "IP Assigned to Entity", "description": "All founder IP formally assigned to the business entity.", "chapter": 1},
    {"id": "ein_obtained", "title": "EIN Obtained", "description": "Federal Employer Identification Number received from IRS.", "chapter": 1},
    {"id": "bank_account_open", "title": "Business Bank Account Open", "description": "Dedicated business banking established.", "chapter": 1},
    {"id": "provisional_patent", "title": "Provisional Patent Filed", "description": "Provisional patent application filed with USPTO.", "chapter": 1},
    {"id": "trademark_filed", "title": "Trademark Application Filed", "description": "Trademark application submitted to USPTO.", "chapter": 1},
    {"id": "infrastructure_live", "title": "Infrastructure Live", "description": "All Docker services deployed and accessible.", "chapter": 2},
    {"id": "website_live", "title": "Website Live", "description": "Public-facing website deployed and indexed.", "chapter": 2},
    {"id": "payments_configured", "title": "Payments Configured", "description": "Stripe account live and first product created.", "chapter": 2},
    {"id": "legal_docs_complete", "title": "Legal Document Package Complete", "description": "Operating agreement, privacy policy, ToS, NDA templates all generated.", "chapter": 2},
    {"id": "first_lead", "title": "First Lead Captured", "description": "First email subscriber or inquiry received.", "chapter": 3},
    {"id": "first_dollar", "title": "First Dollar Earned", "description": "First revenue transaction processed.", "chapter": 3},
    {"id": "first_1k_mrr", "title": "$1,000 MRR", "description": "Monthly recurring revenue reaches $1,000.", "chapter": 3},
    {"id": "funding_ready", "title": "Funding Ready", "description": "Funding readiness report complete; pitch deck drafted.", "chapter": 4},
    {"id": "grant_applied", "title": "First Grant Application Submitted", "description": "SBIR, STTR, or state grant application submitted.", "chapter": 4},
    {"id": "first_10k_mrr", "title": "$10,000 MRR", "description": "Monthly recurring revenue reaches $10,000.", "chapter": 4},
]


class ExecAICoach(BaseAgent):
    """
    The Strategic Catalyst — Harvard-style executive coaching agent.
    MBA-in-Action for solopreneurs. Proactive, evidence-based, no fluff.
    """

    def __init__(self, llm_client=None, config: Dict = None):
        super().__init__(
            name="execai_coach",
            role="Strategic Catalyst — Executive Coach & Capital Strategist",
            llm_client=llm_client,
            config=config or {},
        )
        self.persona = STRATEGIC_CATALYST
        self.milestones_path = os.path.expanduser("~/.launchops/milestones.json")
        self.coaching_log_path = os.path.expanduser("~/.launchops/coaching_log.json")
        self._ensure_data_files()

    def _ensure_data_files(self):
        os.makedirs(os.path.expanduser("~/.launchops"), exist_ok=True)
        if not os.path.exists(self.milestones_path):
            initial = {m["id"]: {"completed": False, "completed_at": None, "notes": ""} for m in DOCUMENTARY_MILESTONES}
            with open(self.milestones_path, "w") as f:
                json.dump(initial, f, indent=2)
        if not os.path.exists(self.coaching_log_path):
            with open(self.coaching_log_path, "w") as f:
                json.dump({"sessions": []}, f, indent=2)

    # ── Core Interface ────────────────────────────────────────────────────

    def analyze(self, context: Dict) -> Dict:
        business_name = context.get("business_name", "Your Business")
        stage = context.get("stage", "ideation")
        business_type = context.get("business_type", "saas")

        frameworks = self._select_frameworks(stage)
        advice = self._generate_advice(stage, business_name, business_type)
        milestone_status = self._get_milestone_status()
        ip_status = self._assess_ip_status(milestone_status)

        return {
            "business_name": business_name,
            "stage": stage,
            "coaching_frameworks": frameworks,
            "strategic_advice": advice,
            "milestone_status": milestone_status,
            "next_milestone": self._get_next_milestone(milestone_status),
            "ip_protection_status": ip_status,
        }

    def execute(self, task: Dict) -> Dict:
        task_type = task.get("type", "ask")
        handlers = {
            "complete_milestone": self._complete_milestone,
            "weekly_review": self._weekly_review,
            "get_framework": self._get_framework,
            "generate_documentary_chapter": self._generate_documentary_chapter,
            "decision_support": self._decision_support,
            "full_coaching_session": self._full_coaching_session,
            "strategic_review": self._strategic_review,
            "entity_advice": self._entity_advice,
            "funding_plan": self._funding_plan,
            "ip_strategy": self._ip_strategy,
            "ask": self._ask,
        }
        handler = handlers.get(task_type, self._ask)
        result = handler(task)
        self._record(task_type, result)
        return result

    # ── Strategic Review (LLM-powered) ────────────────────────────────────

    def _strategic_review(self, task: Dict) -> Dict:
        business = task.get("business", task)
        system = self._build_system_prompt()
        user = f"""Perform a comprehensive strategic review:

Business: {business.get('business_name', business.get('name', 'N/A'))}
Type: {business.get('business_type', business.get('type', 'N/A'))}
Industry: {business.get('industry', 'N/A')}
Stage: {business.get('stage', 'pre-revenue')}
Revenue: ${business.get('monthly_revenue', 0):,.0f}/mo
Team: {business.get('employees', 1)} people
Target Market: {business.get('target_market', 'N/A')}
UVP: {business.get('uvp', 'N/A')}

Provide in structured JSON:
1. SWOT Analysis
2. Business Model Assessment (Business Model Canvas)
3. Competitive Positioning
4. IP Protection Priority Assessment
5. Key Risks and Mitigations
6. 90-Day Priority Actions (top 10)
7. Funding Readiness Score (1-10) with justification
8. Entity Formation Recommendation with reasoning"""

        response = self._call_llm(system, user)
        return {"success": True, "type": "strategic_review", "analysis": response}

    # ── Entity Advice ─────────────────────────────────────────────────────

    def _entity_advice(self, task: Dict) -> Dict:
        system = self._build_system_prompt()
        user = f"""Recommend the optimal entity structure for this business:

Business: {task.get('business_name', 'N/A')}
Type: {task.get('business_type', 'N/A')}
Home State: {task.get('home_state', 'N/A')}
Seeking VC: {task.get('seeking_vc', False)}
Has R&D: {task.get('has_rd_component', False)}
Revenue: ${task.get('monthly_revenue', 0):,.0f}/mo
Solo Founder: {task.get('employees', 1) == 1}

Consider these entity types:
- Delaware C-Corp: VC-preferred, stock options, established case law, double taxation
- Delaware LLC: Pass-through tax, flexible, harder for equity investors
- S-Corp election: Pass-through + SE tax savings, 100 shareholder limit
- Wyoming LLC: No state income tax, privacy, asset protection, good for DAO/crypto

Provide:
1. Recommended entity with detailed reasoning
2. State-specific tax implications for Year 1
3. Funding compatibility for EACH funding source (VC, angels, SBIR, grants, SBA loans)
4. IP protection implications of each entity type
5. Exact steps to form (with costs and timelines)
6. When to convert (e.g., LLC → C-Corp for Series A)"""

        response = self._call_llm(system, user)
        return {"success": True, "type": "entity_advice", "analysis": response}

    # ── Funding Plan ──────────────────────────────────────────────────────

    def _funding_plan(self, task: Dict) -> Dict:
        system = self._build_system_prompt()
        user = f"""Create a comprehensive, stage-appropriate funding strategy:

Business: {task.get('business_name', 'N/A')}
Type: {task.get('business_type', 'N/A')}
Stage: {task.get('stage', 'pre-revenue')}
Revenue: ${task.get('monthly_revenue', 0):,.0f}/mo
Has R&D: {task.get('has_rd_component', False)}
US Citizen: {task.get('us_citizen_owner', True)}
Employees: {task.get('employees', 1)}
Entity Type: {task.get('entity_type', 'Not yet formed')}

Provide a DETAILED funding plan:
1. Current stage assessment and funding range
2. Immediate options (next 30 days) — be specific with program names, URLs, deadlines
3. Short-term strategy (90 days)
4. Medium-term roadmap (12 months)
5. Grant eligibility analysis:
   - SBIR Phase I ($275K) and Phase II ($1M) — which agencies match this business?
   - STTR eligibility requirements
   - State-level grants (list top 5 states for this business type)
   - NSF I-Corps ($50K)
   - Economic development grants
6. Non-dilutive funding options (revenue-based financing, Pipe, Clearco, etc.)
7. Entity structure requirements for EACH funding source
8. How IP protection status affects funding eligibility
9. Pitch preparation checklist
10. Financial model requirements for each funding type"""

        response = self._call_llm(system, user)
        return {"success": True, "type": "funding_plan", "analysis": response}

    # ── IP Strategy (LLM-powered) ─────────────────────────────────────────

    def _ip_strategy(self, task: Dict) -> Dict:
        system = self._build_system_prompt() + """

You are also an IP strategist. You understand provisional patents, trade secrets,
trademarks, copyrights, and how IP protection affects funding eligibility.
Be specific about costs, timelines, and filing procedures."""

        user = f"""Create a comprehensive IP protection strategy for this business:

Business: {task.get('business_name', 'N/A')}
Type: {task.get('business_type', 'N/A')}
Has Software/Code: {task.get('has_code', True)}
Has Novel Methods/Algorithms: {task.get('has_novel_methods', False)}
Has Brand/Name: {task.get('has_brand', True)}
Has Training Data: {task.get('has_data', False)}
AI-Assisted Creation: {task.get('ai_assisted', True)}
Seeking VC: {task.get('seeking_vc', False)}

Provide a COMPLETE IP protection plan:

1. IP AUDIT — What IP exists and what category does each fall into?
2. PROVISIONAL PATENT — Should they file? For what? Cost and timeline.
3. TRADEMARK — Name, logo, tagline registration strategy. Cost per class.
4. COPYRIGHT — What's copyrightable? Special considerations for AI-assisted work.
5. TRADE SECRETS — What should be kept as trade secrets vs. patented?
6. IP ASSIGNMENT — Template requirements for founder → entity assignment.
7. NDA/CIIA STRATEGY — When and with whom to use NDAs and CIIAs.
8. OPEN SOURCE CONSIDERATIONS — If using open source, license compatibility.
9. DEFENSIVE PUBLICATIONS — When to publish defensively instead of patent.
10. IP TIMELINE — Week-by-week action plan for the first 90 days.
11. COST BUDGET — Total IP protection budget estimate.
12. FUNDING IMPACT — How each IP action affects funding eligibility."""

        response = self._call_llm(system, user)
        return {"success": True, "type": "ip_strategy", "analysis": response}

    # ── Free-form Ask ─────────────────────────────────────────────────────

    def _ask(self, task: Dict) -> Dict:
        question = task.get("question", task.get("query", str(task)))
        system = self._build_system_prompt()
        user = f"""Founder's question: {question}

Respond as The Strategic Catalyst:
1. Direct answer
2. Strategic insight backed by HBS frameworks
3. Proactive next-step suggestion
4. Risk or opportunity the founder hasn't considered
5. IP implications if relevant"""

        response = self._call_llm(system, user)
        return {"success": True, "type": "ask", "response": response}

    # ── Milestone Management ──────────────────────────────────────────────

    def _complete_milestone(self, task: Dict) -> Dict:
        milestone_id = task.get("milestone_id")
        notes = task.get("notes", "")

        with open(self.milestones_path, "r") as f:
            milestones = json.load(f)

        if milestone_id not in milestones:
            return {"success": False, "error": f"Unknown milestone: {milestone_id}"}

        milestones[milestone_id] = {
            "completed": True,
            "completed_at": datetime.now().isoformat(),
            "notes": notes,
        }
        with open(self.milestones_path, "w") as f:
            json.dump(milestones, f, indent=2)

        milestone_def = next((m for m in DOCUMENTARY_MILESTONES if m["id"] == milestone_id), None)
        narrative = self._generate_documentary_note(milestone_def, notes)

        return {
            "success": True,
            "milestone": milestone_def,
            "completed_at": milestones[milestone_id]["completed_at"],
            "message": f"Milestone achieved: {milestone_def['title'] if milestone_def else milestone_id}",
            "documentary_note": narrative,
        }

    def _generate_documentary_note(self, milestone: Optional[Dict], notes: str) -> str:
        if not milestone:
            return ""
        ts = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        return (
            f"[Chapter {milestone.get('chapter', '?')} | {ts}] "
            f"{milestone['title']}: {milestone['description']} "
            f"{'— ' + notes if notes else ''}"
        )

    # ── Weekly Review ─────────────────────────────────────────────────────

    def _weekly_review(self, task: Dict) -> Dict:
        business_name = task.get("business_name", "Your Business")
        week = task.get("week_number", 1)

        questions = [
            f"What was the single most important thing {business_name} accomplished this week?",
            "What was the biggest obstacle? How did you respond?",
            "Did your actions align with your ICP and primary channel? If not, why?",
            "What is ONE thing you will do differently next week?",
            "What is the next milestone, and what is the specific action to achieve it?",
        ]

        framework = list(HBS_COACHING_FRAMEWORKS.values())[week % len(HBS_COACHING_FRAMEWORKS)]

        return {
            "success": True,
            "week_number": week,
            "review_questions": questions,
            "coaching_prompt": (
                f"Week {week} Review for {business_name}:\n\n"
                "Answer these honestly. This is your documentary — truth > highlight reel.\n\n"
                + "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))
            ),
            "hbs_framework_of_the_week": framework,
        }

    # ── Framework Access ──────────────────────────────────────────────────

    def _get_framework(self, task: Dict) -> Dict:
        fid = task.get("framework_id")
        if fid and fid in HBS_COACHING_FRAMEWORKS:
            return {"success": True, "framework": HBS_COACHING_FRAMEWORKS[fid]}
        return {"success": True, "all_frameworks": HBS_COACHING_FRAMEWORKS}

    # ── Documentary Chapter ───────────────────────────────────────────────

    def _generate_documentary_chapter(self, task: Dict) -> Dict:
        chapter = task.get("chapter", 1)
        business_name = task.get("business_name", "The Startup")

        with open(self.milestones_path, "r") as f:
            status = json.load(f)

        chapter_ms = [m for m in DOCUMENTARY_MILESTONES if m["chapter"] == chapter]
        completed = []
        pending = []
        for m in chapter_ms:
            s = status.get(m["id"], {})
            if s.get("completed"):
                completed.append({**m, "completed_at": s["completed_at"], "notes": s.get("notes", "")})
            else:
                pending.append(m)

        titles = {
            1: "The Foundation — From Idea to Legal Entity",
            2: "The Build — Infrastructure, Website, and Payments",
            3: "The Launch — First Leads, First Dollar, First Thousand",
            4: "The Scale — Funding, Growth, and the Long Game",
        }

        # Use LLM for narrative if available
        if completed and self.llm_client:
            system = self._build_system_prompt()
            user = f"""Write a documentary narrative paragraph for Chapter {chapter}: "{titles.get(chapter, '')}" of {business_name}.

Completed milestones: {json.dumps(completed, indent=2)}
Pending milestones: {json.dumps(pending, indent=2)}

Write in documentary style — this is proof that AI + Human can co-create GREAT things.
Make it compelling, honest, and forward-looking. 2-3 paragraphs."""
            narrative = self._call_llm(system, user)
        else:
            ct = ", ".join(m["title"] for m in completed) if completed else "none yet"
            pt = ", ".join(m["title"] for m in pending) if pending else "none"
            narrative = f"Chapter {chapter}: Completed: {ct}. Remaining: {pt}."

        return {
            "success": True,
            "chapter": chapter,
            "title": titles.get(chapter, f"Chapter {chapter}"),
            "completed_milestones": completed,
            "pending_milestones": pending,
            "narrative": narrative,
            "completion_pct": int(len(completed) / len(chapter_ms) * 100) if chapter_ms else 0,
        }

    # ── Decision Support ──────────────────────────────────────────────────

    def _decision_support(self, task: Dict) -> Dict:
        decision = task.get("decision", "")
        options = task.get("options", [])

        if self.llm_client:
            system = self._build_system_prompt()
            user = f"""The founder faces this decision: {decision}

Options: {json.dumps(options)}

Apply the HBS "Courage Under Uncertainty" framework:
1. Assess reversibility of each option
2. Identify what data is missing and whether 70% threshold is met
3. Analyze best/worst case for each option
4. Recommend a decision with reasoning
5. Identify what the founder should document about this decision"""
            analysis = self._call_llm(system, user)
        else:
            analysis = "Configure LLM for AI-powered decision analysis."

        return {
            "success": True,
            "decision": decision,
            "framework": "Courage Under Uncertainty (HBS Case Method)",
            "analysis": analysis,
        }

    # ── Full Coaching Session ─────────────────────────────────────────────

    def _full_coaching_session(self, task: Dict) -> Dict:
        bc = task.get("business_config", task)
        business_name = bc.get("business_name", "Your Business")
        stage = bc.get("stage", "ideation")

        analysis = self.analyze(bc)

        session = {
            "session_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "business_name": business_name,
            "stage": stage,
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis,
        }

        with open(self.coaching_log_path, "r") as f:
            log = json.load(f)
        log["sessions"].append(session)
        with open(self.coaching_log_path, "w") as f:
            json.dump(log, f, indent=2)

        print(f"\n{'='*60}")
        print(f"  ExecAI Coach — {business_name}")
        print(f"  The Strategic Catalyst")
        print(f"{'='*60}")
        print(f"\n  Stage: {stage.upper()}")
        print(f"\n  Strategic Advice:")
        for i, a in enumerate(analysis["strategic_advice"], 1):
            print(f"    {i}. {a}")
        print(f"\n  Recommended Frameworks:")
        for fw in analysis["coaching_frameworks"]:
            print(f"    - {fw['name']} ({fw['source']})")
        ip = analysis.get("ip_protection_status", {})
        if ip:
            print(f"\n  IP Protection Status:")
            for k, v in ip.items():
                print(f"    {k}: {'DONE' if v else 'PENDING'}")
        nm = analysis.get("next_milestone")
        if nm:
            print(f"\n  Next Milestone: {nm['title']}")
            print(f"    {nm['description']}")
        print(f"\n{'='*60}\n")

        return {"success": True, "session": session}

    # ── Internal Helpers ──────────────────────────────────────────────────

    def _build_system_prompt(self) -> str:
        p = self.persona
        return f"""You are {p['name']} — {p['title']}.

{p['focus']}

Core Functions: {chr(10).join('- ' + f for f in p['core_functions'])}

Tone: {p['tone']}
Style: {p['style']}
Bias: {p['bias']}
Delivery: {p['delivery']}

You have deep knowledge of Harvard Business School frameworks, venture capital mechanics,
legal entity formation, IP protection strategy, go-to-market execution, and AI/tech startups.

CRITICAL: IP protection is paramount. Always consider IP implications in your advice.
Always provide specific, actionable guidance. Never give generic advice.
Back recommendations with frameworks and data. Be proactive."""

    def _select_frameworks(self, stage: str) -> List[Dict]:
        stage_map = {
            "ideation": ["lean_validation", "competitive_moat", "solopreneur_leverage", "ip_first_formation"],
            "formation": ["unit_economics_first", "courage_under_uncertainty", "ip_first_formation"],
            "development": ["unit_economics_first", "solopreneur_leverage", "ip_first_formation"],
            "launch": ["courage_under_uncertainty", "unit_economics_first"],
            "growth": ["competitive_moat", "unit_economics_first", "solopreneur_leverage"],
        }
        keys = stage_map.get(stage, list(HBS_COACHING_FRAMEWORKS.keys()))
        return [HBS_COACHING_FRAMEWORKS[k] for k in keys if k in HBS_COACHING_FRAMEWORKS]

    def _generate_advice(self, stage: str, name: str, btype: str) -> List[str]:
        advice = {
            "ideation": [
                f"Before writing a single line of code for {name}, validate the problem with 10 real conversations.",
                "Your Build Spec is your north star — every decision must pass the 'does this serve the ICP?' test.",
                "Choose ONE primary channel. Founders who try to be everywhere are nowhere.",
                "BEFORE anything else: audit your IP. What's protectable? File provisional patents early.",
            ],
            "formation": [
                "Delaware C-Corp is the default for any business that may seek institutional funding.",
                "File Beneficial Ownership Report (BOI) with FinCEN within 90 days — it's federal law.",
                "Execute IP Assignment Agreement: founder to entity on Day 1. Non-negotiable for funding.",
                "Separate business and personal finances from Day 1. Commingling kills liability protection.",
            ],
            "development": [
                "MVP means Minimum VIABLE Product — solve the core problem, nothing more.",
                "Ship in 14 days. If you can't, you're building the wrong thing.",
                "Document all novel methods — these become provisional patent claims.",
                "Your first 10 customers are your co-founders. Talk to them daily.",
            ],
            "launch": [
                "Launch before you're ready. The market will tell you what to fix.",
                "Your first goal is not revenue — it's learning. Revenue is proof of learning.",
                "One channel, one message, one ICP. Complexity kills early-stage companies.",
                "File trademark application NOW — before competitors notice your brand.",
            ],
            "growth": [
                "Don't scale what isn't working. Prove unit economics at 10 customers before 100.",
                "Churn is the enemy. Fix retention before acquisition.",
                "Raise money when you don't need it. Desperation is visible to investors.",
                "Your IP portfolio is now a balance sheet asset. Keep it current.",
            ],
        }
        return advice.get(stage, ["Focus on fundamentals: problem, solution, customer, channel, IP protection."])

    def _get_milestone_status(self) -> Dict:
        with open(self.milestones_path, "r") as f:
            return json.load(f)

    def _get_next_milestone(self, status: Dict) -> Optional[Dict]:
        for m in DOCUMENTARY_MILESTONES:
            if not status.get(m["id"], {}).get("completed", False):
                return m
        return None

    def _assess_ip_status(self, milestone_status: Dict) -> Dict:
        ip_milestones = ["ip_audit_complete", "ip_assigned", "provisional_patent", "trademark_filed"]
        return {mid: milestone_status.get(mid, {}).get("completed", False) for mid in ip_milestones}
