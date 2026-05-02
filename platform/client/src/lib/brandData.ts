export interface ParentOption {
  id: string;
  letter: string;
  name: string;
  tagline: string;
  whyItWorks: string;
  boardroomPitch: string;
  strengths: { label: string; score: number }[];
  archetype: string;
  domainOwned: boolean;
  domain: string;
}

export interface ProductBrand {
  id: string;
  name: string;
  category: string;
  description: string;
  currentName: string;
  icon: string;
}

export interface DomainStrategy {
  domain: string;
  role: string;
  target: string;
  status: "active" | "redirect" | "seo" | "community";
}

export const parentOptions: ParentOption[] = [
  {
    id: "microai-studios",
    letter: "A",
    name: "MicroAI Studios",
    tagline: "The AI Venture Studio building infrastructure for the one-person unicorn.",
    whyItWorks:
      "It perfectly captures the 'solopreneur' (Micro) and the 'venture builder' (Studios) aspect. It is already your GitHub DAO name and you own the .com.",
    boardroomPitch:
      "MicroAI Studios is a venture lab building the infrastructure for the next million AI-powered solopreneurs.",
    strengths: [
      { label: "Brand Recognition", score: 92 },
      { label: "VC Appeal", score: 78 },
      { label: "Domain Strength", score: 95 },
      { label: "Scalability", score: 85 },
      { label: "Market Clarity", score: 88 },
    ],
    archetype: "The Venture Lab",
    domainOwned: true,
    domain: "microaistudios.com",
  },
  {
    id: "gnoscenti-group",
    letter: "B",
    name: "Gnoscenti Group",
    tagline: "An AI holding company deploying MBA-grade intelligence into vertical SaaS.",
    whyItWorks:
      "'Cognoscenti' means people who are especially well informed about a particular subject. 'Gnoscenti' sounds like a high-end intelligence firm or private equity group.",
    boardroomPitch:
      "Gnoscenti Group is an AI holding company that deploys MBA-grade intelligence into vertical SaaS and founder automation.",
    strengths: [
      { label: "Brand Recognition", score: 65 },
      { label: "VC Appeal", score: 94 },
      { label: "Domain Strength", score: 70 },
      { label: "Scalability", score: 92 },
      { label: "Market Clarity", score: 72 },
    ],
    archetype: "The Intelligence Firm",
    domainOwned: false,
    domain: "gnoscenti.com",
  },
  {
    id: "solopreneur-forge",
    letter: "C",
    name: "The Solopreneur Forge",
    tagline: "An AI-native incubator taking founders from idea to revenue.",
    whyItWorks:
      "You own the domain. 'Forge' implies heavy lifting, building, and durability. It shifts the narrative from 'software company' to 'business builder.'",
    boardroomPitch:
      "The Solopreneur Forge is an AI-native incubator that takes founders from idea to revenue using our proprietary LaunchOps engine.",
    strengths: [
      { label: "Brand Recognition", score: 80 },
      { label: "VC Appeal", score: 72 },
      { label: "Domain Strength", score: 90 },
      { label: "Scalability", score: 68 },
      { label: "Market Clarity", score: 95 },
    ],
    archetype: "The Incubator",
    domainOwned: true,
    domain: "thesoloprenuerforge.com",
  },
  {
    id: "atlas-foundry",
    letter: "D",
    name: "Atlas Foundry",
    tagline: "Building autonomous business systems powered by core orchestration.",
    whyItWorks:
      "You already use 'Atlas' as the orchestrator engine in LaunchOps. Atlas holds up the world; a foundry builds the metal. It sounds incredibly strong to enterprise and VC partners.",
    boardroomPitch:
      "Atlas Foundry builds autonomous business systems powered by our core Atlas orchestration engine.",
    strengths: [
      { label: "Brand Recognition", score: 75 },
      { label: "VC Appeal", score: 90 },
      { label: "Domain Strength", score: 60 },
      { label: "Scalability", score: 96 },
      { label: "Market Clarity", score: 82 },
    ],
    archetype: "The Enterprise Builder",
    domainOwned: false,
    domain: "atlasfoundry.com",
  },
];

export const productBrands: ProductBrand[] = [
  {
    id: "founder-autopilot",
    name: "Founder Autopilot",
    category: "Business Creation Engine",
    description:
      "The B2B SaaS platform for automated business formation and scaling. Consumer-facing product that tells users exactly what it does.",
    currentName: "LaunchOps Founder Edition / Founder Autopilot",
    icon: "Rocket",
  },
  {
    id: "execai",
    name: "ExecAI",
    category: "Executive Coaching & Intelligence",
    description:
      "The proprietary Harvard-trained AI strategic coaching layer. The Strategic Catalyst Engine powering MBA-grade decisions.",
    currentName: "ExecAI / ExecAI Platform",
    icon: "Brain",
  },
  {
    id: "atlas-orchestrator",
    name: "Atlas Orchestrator",
    category: "Multi-Agent Framework",
    description:
      "The underlying multi-agent coordination framework. B2B Enterprise licensing opportunity for companies needing agent orchestration.",
    currentName: "Atlas / microai-launchops",
    icon: "Network",
  },
  {
    id: "golden-age-media",
    name: "Golden Age Media",
    category: "Education & Media Arm",
    description:
      "The documentary, YouTube, and education arm. Customer acquisition engine unifying AI Integration Course and GoldenAgeMindset.",
    currentName: "AI Integration Course / GoldenAgeMindset",
    icon: "Film",
  },
];

export const domainStrategies: DomainStrategy[] = [
  {
    domain: "microaistudios.com",
    role: "Corporate Holding Page",
    target: "Investor relations, mission statement, portfolio overview",
    status: "active",
  },
  {
    domain: "thesoloprenuer.ai",
    role: "Product Landing Page",
    target: "Redirects to Founder Autopilot main product page",
    status: "redirect",
  },
  {
    domain: "thesoloprenuerforge.com",
    role: "Community Hub",
    target: "Discord, Skool, or community platform for users",
    status: "community",
  },
  {
    domain: "ai-onlinecourses.com",
    role: "SEO Magnet",
    target: "Top-of-funnel content feeding into Golden Age Academy",
    status: "seo",
  },
  {
    domain: "digitalaistudios.com",
    role: "Brand Reserve",
    target: "Available for future product line or redirect to parent",
    status: "redirect",
  },
];

export const architectureModels = [
  {
    id: "house-of-brands",
    name: "House of Brands",
    description: "Each product has independent identity. Parent company is invisible to consumers.",
    examples: "Procter & Gamble, Alphabet/Google",
    fit: "low" as const,
    reason: "You need a unified story for VCs and the documentary narrative.",
  },
  {
    id: "branded-house",
    name: "Branded House",
    description: "One master brand across all products. Sub-brands are extensions.",
    examples: "Google (Maps, Drive, Docs), Virgin",
    fit: "medium" as const,
    reason: "Products are too diverse for a single brand identity.",
  },
  {
    id: "hybrid",
    name: "Hybrid (Endorsed)",
    description: "Strong parent brand endorses distinct sub-brands. Best of both worlds.",
    examples: "Marriott (Courtyard by Marriott), High Alpha",
    fit: "high" as const,
    reason: "Perfect for your ecosystem: strong parent + distinct product brands.",
  },
];
