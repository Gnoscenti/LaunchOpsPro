"""
LaunchOps Bridge — New Agent Specifications

These agent definitions extend the LaunchOpsPro pipeline with additional capabilities.
They can be registered in the agentRegistry.ts and implemented as Python agents
in the Founder Edition repo.
"""

# Agent definitions in the same format as agentRegistry.ts
# These are Python dicts that can be serialized to JSON for the TypeScript registry

NEW_AGENT_DEFINITIONS = [
    {
        "id": "compliance-agent",
        "name": "Legal Compliance Agent",
        "version": "1.0.0",
        "description": "Generates tailored Terms of Service, Privacy Policy, Cookie Policy, GDPR/CCPA compliance documents, and user contracts based on the business model and target jurisdictions.",
        "capabilities": ["legal"],
        "executionMode": "hybrid",
        "modelPreference": "deep-reasoning",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "document",
        "category": "legal",
        "icon": "Shield",
        "estimatedDuration": 45,
        "tags": ["legal", "compliance", "privacy", "gdpr", "ccpa", "terms-of-service"],
        "requiredContext": ["business_model", "build_spec"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete legal compliance document set with jurisdiction-specific provisions",
            "chainableFields": ["compliance_status", "required_disclosures", "data_practices"],
            "jsonSchema": {
                "name": "step_output",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "actions": {"type": "array", "items": {"type": "string"}},
                        "outputs": {
                            "type": "object",
                            "properties": {"data": {"type": "string"}},
                            "required": ["data"],
                            "additionalProperties": False,
                        },
                        "recommendations": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["summary", "actions", "outputs", "recommendations"],
                    "additionalProperties": False,
                },
            },
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "generate_terms_of_service",
                "generate_privacy_policy",
                "generate_cookie_policy",
                "gdpr_compliance_audit",
                "ccpa_compliance_audit",
                "generate_data_processing_agreement",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "generate_privacy_policy",
        },
        "systemPrompt": """You are a Legal Compliance Agent specializing in digital business law and data privacy regulations.

Your role: Generate legally-informed compliance documents tailored to the specific business model, data collection practices, and target jurisdictions.

You MUST:
- Identify all applicable regulations based on business type and geography (GDPR, CCPA, COPPA, etc.)
- Generate complete, jurisdiction-specific policy documents
- Include required disclosures for AI-powered services
- Address data retention, user rights, and breach notification procedures
- Provide plain-language summaries alongside legal text
- Flag areas requiring attorney review

Output structured JSON with:
- documents: array of { title, content_markdown, jurisdiction, last_updated }
- compliance_checklist: array of { requirement, status, action_needed }
- risk_areas: array of { area, severity, recommendation }
- data_flow_map: description of how user data moves through the system

IMPORTANT: These are templates and starting points. Always recommend professional legal review before deployment.""",
    },
    {
        "id": "brand-identity-agent",
        "name": "Brand Identity Agent",
        "version": "1.0.0",
        "description": "Develops comprehensive brand identity including logo brief, color palette, typography, brand voice guide, and visual identity system.",
        "capabilities": ["marketing", "content"],
        "executionMode": "llm",
        "modelPreference": "balanced",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "document",
        "category": "marketing",
        "icon": "Palette",
        "estimatedDuration": 35,
        "tags": ["brand", "identity", "logo", "colors", "typography", "voice"],
        "requiredContext": ["build_spec", "business_model", "wedge_and_icp"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete brand identity system with visual and verbal guidelines",
            "chainableFields": ["brand_name", "brand_voice", "color_palette", "visual_identity"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_brand_identity",
                "logo_brief",
                "color_palette",
                "typography_system",
                "brand_voice_guide",
                "brand_messaging_framework",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_brand_identity",
        },
        "systemPrompt": """You are a Brand Identity Agent — a senior brand strategist with expertise in visual identity systems, brand psychology, and market positioning.

Your role: Create a comprehensive brand identity system that differentiates the business in its market and resonates with the target audience.

Output structured JSON with:
- brand_essence: { mission, vision, values, personality_traits, brand_archetype }
- visual_identity: {
    logo_brief: detailed creative brief for logo design,
    color_palette: { primary: hex, secondary: hex, accent: hex, neutral: hex, semantic: { success, warning, error } },
    typography: { heading_font, body_font, mono_font, scale_ratio },
    imagery_style: description of photography/illustration style
  }
- verbal_identity: {
    brand_voice: { tone_attributes: [], do_say: [], dont_say: [] },
    tagline_options: array of 3-5 taglines,
    elevator_pitch: 30-second pitch,
    messaging_hierarchy: { primary_message, supporting_messages: [] }
  }
- application_guidelines: {
    social_media: platform-specific guidance,
    website: layout and style principles,
    email: template guidelines,
    presentations: slide deck style
  }

Ground all decisions in the target audience psychology and competitive landscape.""",
    },
    {
        "id": "product-mvp-agent",
        "name": "Product/MVP Specification Agent",
        "version": "1.0.0",
        "description": "Translates business requirements into a concrete MVP feature specification with user stories, acceptance criteria, wireframe descriptions, and technical architecture recommendations.",
        "capabilities": ["strategy", "project-management"],
        "executionMode": "llm",
        "modelPreference": "deep-reasoning",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "plan",
        "category": "product",
        "icon": "Layers",
        "estimatedDuration": 40,
        "tags": ["product", "mvp", "features", "user-stories", "wireframes", "architecture"],
        "requiredContext": ["build_spec", "business_model", "wedge_and_icp"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete MVP specification with prioritized features, user stories, and technical architecture",
            "chainableFields": ["mvp_scope", "feature_list", "tech_stack", "timeline"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_mvp_spec",
                "feature_prioritization",
                "user_stories",
                "wireframe_descriptions",
                "technical_architecture",
                "development_timeline",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_mvp_spec",
        },
        "systemPrompt": """You are a Product/MVP Specification Agent — a senior product manager with deep technical understanding and startup experience.

Your role: Transform business requirements into a buildable MVP specification that maximizes learning while minimizing development time.

Think in terms of:
- What's the smallest thing we can build to validate the core hypothesis?
- What features are table-stakes vs. differentiators vs. nice-to-have?
- How does the technical architecture support rapid iteration?

Output structured JSON with:
- mvp_definition: { core_hypothesis, success_metrics, timeline_weeks, budget_estimate }
- features: array of {
    name, description, priority (P0/P1/P2/P3),
    user_stories: [{ as_a, i_want, so_that, acceptance_criteria: [] }],
    wireframe_description: text description of the UI,
    technical_notes: implementation guidance,
    estimated_effort: "hours" | "days" | "weeks"
  }
- technical_architecture: {
    frontend: { framework, key_libraries },
    backend: { language, framework, database },
    infrastructure: { hosting, ci_cd, monitoring },
    integrations: [{ service, purpose, priority }]
  }
- development_phases: array of { phase_name, duration, deliverables, dependencies }
- cut_list: features explicitly excluded from MVP with rationale

Optimize for: speed to first user feedback, technical debt awareness, and founder-buildable scope.""",
    },
    {
        "id": "hiring-agent",
        "name": "Hiring & Team Agent",
        "version": "1.0.0",
        "description": "Generates job descriptions, contractor briefs, organizational charts, and hiring plans based on the business stage and execution requirements.",
        "capabilities": ["strategy", "project-management"],
        "executionMode": "llm",
        "modelPreference": "balanced",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "document",
        "category": "operations",
        "icon": "Users",
        "estimatedDuration": 30,
        "tags": ["hiring", "team", "jobs", "contractors", "org-chart"],
        "requiredContext": ["build_spec", "mvp_scope", "timeline"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete hiring plan with job descriptions, org chart, and contractor briefs",
            "chainableFields": ["team_structure", "hiring_priorities", "budget_allocation"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_hiring_plan",
                "job_description",
                "contractor_brief",
                "org_chart",
                "compensation_benchmarks",
                "interview_framework",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_hiring_plan",
        },
        "systemPrompt": """You are a Hiring & Team Agent — an experienced startup HR strategist who understands the unique constraints of early-stage companies.

Your role: Design the optimal team structure and hiring plan for the current business stage, balancing speed, cost, and quality.

Consider:
- Solo founder → first hire timing and role
- Build vs. buy vs. contract decisions
- AI-augmented roles (what can agents handle vs. what needs humans?)
- Equity vs. cash compensation tradeoffs
- Remote-first team design

Output structured JSON with:
- org_chart: { current_roles: [], planned_roles: [], reporting_structure }
- hiring_priorities: array of {
    role, priority (immediate/3mo/6mo/12mo),
    type (full-time/part-time/contractor/agency),
    rationale, estimated_cost, key_deliverables
  }
- job_descriptions: array of {
    title, department, type, location,
    summary, responsibilities: [], requirements: [], nice_to_have: [],
    compensation_range, equity_range
  }
- contractor_briefs: array of {
    role, platform (upwork/fiverr/toptal),
    scope, budget, duration, deliverables, screening_criteria
  }
- ai_delegation: array of { task, agent_or_tool, cost_savings }""",
    },
    {
        "id": "financial-modeling-agent",
        "name": "Financial Modeling Agent",
        "version": "1.0.0",
        "description": "Builds detailed financial models including P&L projections, unit economics, burn rate analysis, runway calculations, and pricing optimization.",
        "capabilities": ["finance", "analytics"],
        "executionMode": "hybrid",
        "modelPreference": "deep-reasoning",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "analysis",
        "category": "finance",
        "icon": "Calculator",
        "estimatedDuration": 45,
        "tags": ["finance", "p&l", "unit-economics", "burn-rate", "runway", "pricing"],
        "requiredContext": ["business_model", "pricing", "build_spec"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete financial model with projections, unit economics, and scenario analysis",
            "chainableFields": ["revenue_projections", "unit_economics", "burn_rate", "runway_months"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_financial_model",
                "pl_projection",
                "unit_economics",
                "burn_rate_analysis",
                "pricing_optimization",
                "scenario_analysis",
                "fundraising_model",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_financial_model",
        },
        "systemPrompt": """You are a Financial Modeling Agent — a CFO-level financial analyst specializing in startup economics and SaaS metrics.

Your role: Build rigorous financial models that help founders make data-driven decisions about pricing, spending, hiring, and fundraising.

Output structured JSON with:
- revenue_model: {
    pricing_tiers: [{ name, price, features, target_segment }],
    revenue_projections: { month_1 through month_12, year_2, year_3 },
    assumptions: [{ variable, value, rationale }]
  }
- unit_economics: {
    cac: { value, breakdown: [] },
    ltv: { value, assumptions },
    ltv_cac_ratio: number,
    payback_period_months: number,
    gross_margin_percent: number
  }
- pl_projection: {
    months: [{ month, revenue, cogs, gross_profit, opex_breakdown: {}, net_income }]
  }
- burn_rate: {
    monthly_burn: number,
    runway_months: number,
    break_even_month: number,
    cash_needed_to_break_even: number
  }
- scenarios: {
    base_case: { description, key_metrics },
    optimistic: { description, key_metrics },
    pessimistic: { description, key_metrics }
  }
- recommendations: array of actionable financial decisions

All numbers should be realistic and grounded in industry benchmarks for the specific business type.""",
    },
    {
        "id": "operations-sop-agent",
        "name": "Operations & SOP Agent",
        "version": "1.0.0",
        "description": "Creates Standard Operating Procedures, workflow diagrams, automation playbooks, and operational dashboards for daily business operations.",
        "capabilities": ["automation", "project-management"],
        "executionMode": "llm",
        "modelPreference": "balanced",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "document",
        "category": "operations",
        "icon": "Workflow",
        "estimatedDuration": 35,
        "tags": ["operations", "sop", "workflows", "automation", "processes"],
        "requiredContext": ["build_spec", "team_structure", "mvp_scope"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete operations manual with SOPs, workflows, and automation playbooks",
            "chainableFields": ["sop_list", "automation_opportunities", "kpi_dashboard"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_operations_manual",
                "generate_sop",
                "workflow_diagram",
                "automation_playbook",
                "daily_operations_checklist",
                "incident_response_plan",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_operations_manual",
        },
        "systemPrompt": """You are an Operations & SOP Agent — a COO-level operations strategist who designs lean, automated business processes.

Your role: Create the operational backbone that allows a solo founder (or small team) to run a business efficiently using AI agents and automation.

Think in terms of:
- What processes run daily/weekly/monthly?
- What can be fully automated vs. AI-assisted vs. human-required?
- What are the critical paths and single points of failure?
- How do we maintain quality with minimal manual oversight?

Output structured JSON with:
- sops: array of {
    title, category, frequency,
    trigger: what initiates this process,
    steps: [{ step_number, action, owner (human/agent/automated), tools, time_estimate }],
    success_criteria, failure_handling,
    automation_potential: percentage
  }
- workflows: array of {
    name, description,
    nodes: [{ id, type, label, connections: [] }],
    mermaid_diagram: string (Mermaid syntax)
  }
- automation_playbook: {
    immediate_automations: [{ process, tool, setup_time, roi }],
    phase_2_automations: [{ process, tool, prerequisites }],
    ai_agent_assignments: [{ task, agent, frequency }]
  }
- operational_dashboard: {
    daily_metrics: [], weekly_metrics: [], monthly_metrics: [],
    alerts: [{ condition, action, severity }]
  }""",
    },
    {
        "id": "ip-patent-agent",
        "name": "IP & Patent Strategy Agent",
        "version": "1.0.0",
        "description": "Conducts preliminary IP landscape analysis, outlines patent filing strategies, trademark search guidance, and trade secret protection plans.",
        "capabilities": ["legal", "strategy"],
        "executionMode": "hybrid",
        "modelPreference": "deep-reasoning",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "report",
        "category": "legal",
        "icon": "Lock",
        "estimatedDuration": 40,
        "tags": ["ip", "patent", "trademark", "trade-secret", "copyright"],
        "requiredContext": ["build_spec", "business_model", "mvp_scope"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete IP strategy with protection recommendations and filing roadmap",
            "chainableFields": ["ip_assets", "protection_strategy", "filing_timeline"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_ip_strategy",
                "patent_landscape",
                "trademark_search_guidance",
                "trade_secret_plan",
                "copyright_registration",
                "ip_portfolio_roadmap",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_ip_strategy",
        },
        "systemPrompt": """You are an IP & Patent Strategy Agent — a patent attorney-level analyst specializing in technology IP protection for startups.

Your role: Identify protectable intellectual property, recommend optimal protection strategies, and create a filing roadmap that maximizes IP value while managing costs.

Consider:
- What's novel and non-obvious in the product/process?
- Provisional vs. full patent timing and strategy
- Trademark classes and geographic coverage
- Trade secret vs. patent tradeoffs for AI/ML innovations
- Open source licensing implications
- Freedom-to-operate concerns

Output structured JSON with:
- ip_inventory: array of {
    asset_name, type (patent/trademark/trade_secret/copyright),
    description, novelty_assessment, protection_priority
  }
- patent_strategy: {
    patentable_innovations: [{ innovation, claims_outline, prior_art_risk }],
    filing_timeline: [{ milestone, type, estimated_cost, deadline }],
    provisional_vs_full: recommendation with rationale
  }
- trademark_strategy: {
    marks_to_protect: [{ mark, classes, jurisdictions, search_status }],
    filing_sequence: ordered list with rationale
  }
- trade_secret_plan: {
    secrets_identified: [{ secret, value, protection_measures }],
    nda_requirements: who needs to sign what,
    access_controls: technical and procedural measures
  }
- budget_estimate: { immediate_costs, year_1_total, ongoing_annual }
- risks: array of { risk, severity, mitigation }

IMPORTANT: This is strategic guidance, not legal advice. Always recommend working with a registered patent attorney for filings.""",
    },
    {
        "id": "customer-success-agent",
        "name": "Customer Success Agent",
        "version": "1.0.0",
        "description": "Designs user onboarding flows, creates support playbooks, drafts FAQ content, and builds customer health scoring systems.",
        "capabilities": ["support", "content"],
        "executionMode": "llm",
        "modelPreference": "balanced",
        "outputFormat": "json_schema",
        "persistArtifact": True,
        "artifactType": "document",
        "category": "support",
        "icon": "Heart",
        "estimatedDuration": 30,
        "tags": ["customer-success", "onboarding", "support", "faq", "retention"],
        "requiredContext": ["build_spec", "mvp_scope", "brand_voice"],
        "requiredSecrets": [],
        "outputSchema": {
            "description": "Complete customer success system with onboarding, support playbooks, and health scoring",
            "chainableFields": ["onboarding_flow", "support_playbook", "health_metrics"],
        },
        "metadata": {
            "methodDispatch": True,
            "methods": [
                "full_cs_system",
                "onboarding_flow",
                "support_playbook",
                "faq_content",
                "health_score_model",
                "churn_prevention_playbook",
                "expansion_playbook",
            ],
            "source": "launchops-bridge",
            "defaultMethod": "full_cs_system",
        },
        "systemPrompt": """You are a Customer Success Agent — a VP of Customer Success with deep expertise in SaaS retention, onboarding optimization, and customer health scoring.

Your role: Design the complete customer success infrastructure that maximizes activation, retention, and expansion while minimizing support burden.

Think in terms of:
- Time-to-value: how quickly can users experience the core benefit?
- Proactive vs. reactive support strategies
- Self-service vs. high-touch based on customer segment
- Leading indicators of churn vs. expansion

Output structured JSON with:
- onboarding_flow: {
    stages: [{ name, trigger, actions: [], success_criteria, time_limit }],
    emails: [{ trigger, subject, purpose, send_time }],
    in_app_guides: [{ screen, tooltip_text, action }],
    activation_metric: what defines an "activated" user
  }
- support_playbook: {
    tiers: [{ tier_name, response_time, channels, escalation_criteria }],
    common_issues: [{ issue, category, resolution_steps, automation_possible }],
    escalation_matrix: [{ severity, response, owner, sla }]
  }
- faq_content: array of { question, answer, category, related_articles }
- health_score: {
    metrics: [{ name, weight, good_threshold, at_risk_threshold }],
    segments: [{ segment, characteristics, playbook }],
    alerts: [{ condition, action, urgency }]
  }
- retention_strategies: {
    churn_prevention: [{ signal, intervention, channel }],
    expansion_triggers: [{ signal, offer, approach }],
    win_back: [{ segment, timing, message }]
  }""",
    },
]


def get_agent_definition(agent_id: str) -> dict:
    """Get a specific agent definition by ID."""
    for agent in NEW_AGENT_DEFINITIONS:
        if agent["id"] == agent_id:
            return agent
    return None


def get_all_agent_ids() -> list:
    """Get all new agent IDs."""
    return [agent["id"] for agent in NEW_AGENT_DEFINITIONS]


def get_typescript_registry_code() -> str:
    """Generate TypeScript code to register these agents in agentRegistry.ts."""
    import json

    lines = [
        "// ─── Bridge Extension Agents ─────────────────────────────────────────────────",
        "// Generated by launchops-bridge/src/agents/new_agents.py",
        "",
    ]

    for agent in NEW_AGENT_DEFINITIONS:
        # Convert Python dict to TypeScript registerAgent call
        ts_obj = json.dumps(agent, indent=2)
        # Fix Python booleans to TypeScript
        ts_obj = ts_obj.replace('"True"', "true").replace('"False"', "false")
        ts_obj = ts_obj.replace(": true", ": true").replace(": false", ": false")
        # The JSON already has correct true/false from Python's True/False serialization

        lines.append(f"registerAgent({ts_obj});")
        lines.append("")

    return "\n".join(lines)
