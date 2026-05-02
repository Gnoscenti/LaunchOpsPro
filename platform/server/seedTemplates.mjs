/**
 * Seed the workflow_templates table with pre-built templates.
 * Run: node server/seedTemplates.mjs
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

const templates = [
  {
    name: "Business Launch Pipeline",
    description:
      "Complete 20-stage business launch pipeline from formation to revenue. The full LaunchOps Founder Edition workflow — entity formation, IP protection, infrastructure deployment, funding strategy, and go-to-market execution.",
    category: "business-launch",
    icon: "Rocket",
    complexity: "advanced",
    tags: JSON.stringify(["formation", "funding", "infrastructure", "legal", "marketing"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "business-builder", label: "Build Spec Intake", description: "Define your business: name, domain, industry, value proposition, target market", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "execai-coach", label: "Strategic Assessment", description: "Harvard-framework analysis: Porter's Five Forces, Blue Ocean, JTBD", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "formation-advisor", label: "Entity Formation", description: "Optimal entity type, state of incorporation, funding-qualified structure", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "paperwork-agent", label: "Legal Documents", description: "Operating Agreement, IP Assignment, NDA, Privacy Policy, Terms of Service", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "paperwork-agent", label: "IP Protection", description: "Provisional patent, trade secret docs, trademark search, copyright registration", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "funding-intelligence", label: "Funding Strategy", description: "Analyze all funding pathways: grants, SBIR/STTR, angel, VC, revenue-based", sortOrder: 5, position: { x: 660, y: 240 } },
        { agentId: "security-agent", label: "Security Infrastructure", description: "SSL, firewall, Bitwarden vault, security audit checklist", sortOrder: 6, position: { x: 100, y: 400 } },
        { agentId: "repo-agent", label: "Repository Setup", description: "GitHub repo with CI/CD, branch protection, automated testing", sortOrder: 7, position: { x: 380, y: 400 } },
        { agentId: "wordpress-agent", label: "Website Deployment", description: "WordPress + WooCommerce, professional theme, essential plugins", sortOrder: 8, position: { x: 660, y: 400 } },
        { agentId: "stripe-agent", label: "Payment Processing", description: "Stripe products, pricing, checkout flows, subscription billing", sortOrder: 9, position: { x: 100, y: 560 } },
        { agentId: "email-agent", label: "Email Infrastructure", description: "SPF, DKIM, DMARC, warm-up sequences, deliverability optimization", sortOrder: 10, position: { x: 380, y: 560 } },
        { agentId: "mautic-agent", label: "Marketing Automation", description: "Mautic campaigns, lead scoring, automated email sequences", sortOrder: 11, position: { x: 660, y: 560 } },
        { agentId: "analytics-agent", label: "Analytics Setup", description: "Matomo tracking, goal configuration, dashboard creation", sortOrder: 12, position: { x: 100, y: 720 } },
        { agentId: "growth-agent", label: "Go-to-Market Plan", description: "Customer acquisition channels, content strategy, growth metrics", sortOrder: 13, position: { x: 380, y: 720 } },
        { agentId: "support-agent", label: "Customer Support", description: "Chatwoot setup, automated responses, escalation rules", sortOrder: 14, position: { x: 660, y: 720 } },
        { agentId: "project-agent", label: "Project Management", description: "Milestones, sprints, task assignments, progress tracking", sortOrder: 15, position: { x: 100, y: 880 } },
        { agentId: "files-agent", label: "Document Storage", description: "Nextcloud for document storage and team collaboration", sortOrder: 16, position: { x: 380, y: 880 } },
        { agentId: "execai-coach", label: "90-Day Ops Plan", description: "Executive coaching: first 90 days roadmap with milestones", sortOrder: 17, position: { x: 660, y: 880 } },
        { agentId: "documentary-tracker", label: "Documentary Entry", description: "Log launch milestone, generate narrative for solopreneur documentary", sortOrder: 18, position: { x: 100, y: 1040 } },
        { agentId: "execai-coach", label: "Launch Review", description: "Final strategic review, risk assessment, and next quarter planning", sortOrder: 19, position: { x: 380, y: 1040 } },
      ],
    }),
  },
  {
    name: "SaaS Product Launch",
    description:
      "Streamlined SaaS product launch workflow. Covers product definition, technical infrastructure, payment integration, and customer acquisition funnel.",
    category: "saas",
    icon: "Cloud",
    complexity: "intermediate",
    tags: JSON.stringify(["saas", "product", "subscription", "technical"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "business-builder", label: "Product Definition", description: "Define SaaS product: features, pricing tiers, target personas", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "execai-coach", label: "Market Positioning", description: "Competitive analysis, positioning strategy, unique value proposition", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "repo-agent", label: "Technical Stack", description: "Repository setup, CI/CD pipeline, staging/production environments", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "security-agent", label: "Security & Auth", description: "Authentication system, API security, data encryption, compliance", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "stripe-agent", label: "Subscription Billing", description: "Stripe subscription products, trial periods, upgrade/downgrade flows", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "wordpress-agent", label: "Marketing Site", description: "Landing page, feature showcase, pricing page, blog", sortOrder: 5, position: { x: 660, y: 240 } },
        { agentId: "email-agent", label: "Onboarding Emails", description: "Welcome sequence, activation emails, trial expiry reminders", sortOrder: 6, position: { x: 100, y: 400 } },
        { agentId: "analytics-agent", label: "Product Analytics", description: "Event tracking, conversion funnels, cohort analysis, churn metrics", sortOrder: 7, position: { x: 380, y: 400 } },
        { agentId: "support-agent", label: "Help Desk", description: "Knowledge base, ticket system, in-app chat widget", sortOrder: 8, position: { x: 660, y: 400 } },
        { agentId: "growth-agent", label: "Launch Campaign", description: "Product Hunt launch, content marketing, referral program", sortOrder: 9, position: { x: 100, y: 560 } },
      ],
    }),
  },
  {
    name: "E-Commerce Store Setup",
    description:
      "Complete e-commerce store deployment. From product catalog to payment processing, shipping, and marketing automation.",
    category: "ecommerce",
    icon: "ShoppingCart",
    complexity: "intermediate",
    tags: JSON.stringify(["ecommerce", "store", "products", "shipping"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "business-builder", label: "Store Strategy", description: "Product catalog, pricing strategy, brand positioning", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "wordpress-agent", label: "WooCommerce Setup", description: "WordPress + WooCommerce, theme, product pages, cart, checkout", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "stripe-agent", label: "Payment Gateway", description: "Stripe checkout, Apple Pay, Google Pay, multi-currency support", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "security-agent", label: "Store Security", description: "SSL, PCI compliance, fraud prevention, secure checkout", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "email-agent", label: "Transactional Email", description: "Order confirmations, shipping updates, review requests", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "mautic-agent", label: "Cart Recovery", description: "Abandoned cart emails, retargeting sequences, loyalty programs", sortOrder: 5, position: { x: 660, y: 240 } },
        { agentId: "analytics-agent", label: "Store Analytics", description: "Revenue tracking, product performance, customer lifetime value", sortOrder: 6, position: { x: 100, y: 400 } },
        { agentId: "growth-agent", label: "Marketing Plan", description: "Social media, influencer outreach, seasonal campaigns", sortOrder: 7, position: { x: 380, y: 400 } },
      ],
    }),
  },
  {
    name: "Agency Client Onboarding",
    description:
      "Structured client onboarding workflow for agencies. Covers intake, project setup, communication channels, and deliverable tracking.",
    category: "agency",
    icon: "Users",
    complexity: "beginner",
    tags: JSON.stringify(["agency", "client", "onboarding", "project"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "business-builder", label: "Client Intake", description: "Client requirements, scope definition, success criteria", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "paperwork-agent", label: "Contracts & NDA", description: "Service agreement, NDA, scope of work, payment terms", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "project-agent", label: "Project Setup", description: "Project board, milestones, task assignments, timeline", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "support-agent", label: "Communication", description: "Client portal, Slack channel, weekly check-in schedule", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "files-agent", label: "Asset Library", description: "Shared drive, brand assets, deliverable templates", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "stripe-agent", label: "Invoicing", description: "Recurring invoices, milestone payments, expense tracking", sortOrder: 5, position: { x: 660, y: 240 } },
      ],
    }),
  },
  {
    name: "Marketplace Platform",
    description:
      "Two-sided marketplace setup. Covers seller onboarding, buyer experience, payment splitting, and trust/safety systems.",
    category: "marketplace",
    icon: "Store",
    complexity: "advanced",
    tags: JSON.stringify(["marketplace", "platform", "two-sided", "payments"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "business-builder", label: "Platform Design", description: "Marketplace model, commission structure, seller/buyer personas", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "execai-coach", label: "Network Effects Strategy", description: "Chicken-and-egg problem, liquidity strategy, growth loops", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "formation-advisor", label: "Platform Entity", description: "Entity structure for marketplace, liability protection, terms of service", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "repo-agent", label: "Technical Platform", description: "Repository, API architecture, real-time messaging, search", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "stripe-agent", label: "Payment Splitting", description: "Stripe Connect, seller payouts, escrow, dispute handling", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "security-agent", label: "Trust & Safety", description: "Identity verification, content moderation, fraud detection", sortOrder: 5, position: { x: 660, y: 240 } },
        { agentId: "wordpress-agent", label: "Marketing Site", description: "Landing pages for sellers and buyers, SEO, content", sortOrder: 6, position: { x: 100, y: 400 } },
        { agentId: "analytics-agent", label: "Platform Metrics", description: "GMV, take rate, seller/buyer retention, search conversion", sortOrder: 7, position: { x: 380, y: 400 } },
        { agentId: "growth-agent", label: "Supply Acquisition", description: "Seller recruitment, onboarding automation, quality standards", sortOrder: 8, position: { x: 660, y: 400 } },
        { agentId: "support-agent", label: "Dispute Resolution", description: "Buyer protection, seller support, automated resolution flows", sortOrder: 9, position: { x: 100, y: 560 } },
      ],
    }),
  },
  {
    name: "Funding Round Preparation",
    description:
      "Prepare for a funding round. Covers financials, pitch materials, data room, investor targeting, and legal preparation.",
    category: "funding",
    icon: "DollarSign",
    complexity: "advanced",
    tags: JSON.stringify(["funding", "investors", "pitch", "legal", "financials"]),
    definition: JSON.stringify({
      steps: [
        { agentId: "funding-intelligence", label: "Funding Landscape", description: "Analyze all funding pathways: VC, angel, grants, SBIR, revenue-based", sortOrder: 0, position: { x: 100, y: 80 } },
        { agentId: "execai-coach", label: "Pitch Strategy", description: "Narrative arc, key metrics, competitive positioning, ask structure", sortOrder: 1, position: { x: 380, y: 80 } },
        { agentId: "business-builder", label: "Financial Model", description: "Revenue projections, unit economics, burn rate, runway analysis", sortOrder: 2, position: { x: 660, y: 80 } },
        { agentId: "paperwork-agent", label: "Legal Prep", description: "Cap table cleanup, SAFE/convertible note templates, due diligence docs", sortOrder: 3, position: { x: 100, y: 240 } },
        { agentId: "files-agent", label: "Data Room", description: "Organized data room: financials, legal, product, team, market", sortOrder: 4, position: { x: 380, y: 240 } },
        { agentId: "funding-intelligence", label: "Investor Targeting", description: "Identify best-fit investors, warm intro strategy, outreach sequence", sortOrder: 5, position: { x: 660, y: 240 } },
        { agentId: "email-agent", label: "Investor Outreach", description: "Email sequences, follow-up cadence, meeting scheduling", sortOrder: 6, position: { x: 100, y: 400 } },
        { agentId: "analytics-agent", label: "Traction Dashboard", description: "Real-time metrics dashboard for investor meetings", sortOrder: 7, position: { x: 380, y: 400 } },
      ],
    }),
  },
];

async function seed() {
  console.log("Seeding workflow templates...");

  for (const template of templates) {
    await db.execute(
      sql`INSERT INTO workflow_templates (name, description, category, icon, complexity, definition, tags, cloneCount, createdAt, updatedAt)
          VALUES (${template.name}, ${template.description}, ${template.category}, ${template.icon}, ${template.complexity}, ${template.definition}, ${template.tags}, 0, NOW(), NOW())
          ON DUPLICATE KEY UPDATE description = ${template.description}, definition = ${template.definition}, tags = ${template.tags}, updatedAt = NOW()`
    );
    console.log(`  ✓ ${template.name}`);
  }

  console.log(`\nSeeded ${templates.length} templates successfully.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
