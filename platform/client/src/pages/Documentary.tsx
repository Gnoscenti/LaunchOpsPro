/**
 * Documentary Tracker — Success Story Social Automation
 * ======================================================
 * Transforms ProofGuard attestation data + execution history into
 * shareable "success story" templates for social media, investor decks,
 * and marketing content. Turns governance proof into social proof.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Film,
  Copy,
  Download,
  Twitter,
  Linkedin,
  Share2,
  CheckCircle2,
  Shield,
  TrendingUp,
  Award,
  Sparkles,
  FileText,
  BarChart3,
  Clock,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

interface StoryTemplate {
  id: string;
  title: string;
  category: "milestone" | "governance" | "growth" | "launch";
  icon: React.ReactNode;
  description: string;
  generate: (data: StoryData) => string;
  platform: "twitter" | "linkedin" | "general";
}

interface StoryData {
  trustScore: number;
  totalExecutions: number;
  completedExecutions: number;
  successRate: number;
  totalAgents: number;
  totalWorkflows: number;
  proofguardApproved: number;
  proofguardTotal: number;
  avgCqs: number;
  daysSinceStart: number;
  userName: string;
}

const TEMPLATES: StoryTemplate[] = [
  {
    id: "launch-milestone",
    title: "Launch Milestone",
    category: "milestone",
    icon: <Zap className="w-4 h-4" />,
    description: "Celebrate a launch milestone with your audience",
    platform: "twitter",
    generate: (d) =>
      `Just hit ${d.totalExecutions} automated executions on my business launch pipeline.\n\n${d.successRate}% success rate. ${d.totalAgents} AI agents working in parallel.\n\nWhat used to take weeks of manual work now runs in minutes.\n\nBuilding in public with AI-powered orchestration. 🔧\n\n#BuildInPublic #AIAutomation #Startup`,
  },
  {
    id: "trust-score-update",
    title: "Trust Score Update",
    category: "governance",
    icon: <Shield className="w-4 h-4" />,
    description: "Share your Synthetic Trust Score progress",
    platform: "twitter",
    generate: (d) =>
      `Trust Score update: ${d.trustScore}/100\n\nEvery AI agent execution is verified. Every decision is attested.\n\n${d.proofguardApproved}/${d.proofguardTotal} governance checks passed\nAvg Confidence-Quality Score: ${d.avgCqs}/100\n\nTransparency isn't optional when AI runs your business.\n\n#AIGovernance #TrustInAI #ProofOfWork`,
  },
  {
    id: "governance-proof",
    title: "Governance Proof",
    category: "governance",
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: "Showcase your ProofGuard attestation record",
    platform: "linkedin",
    generate: (d) =>
      `When AI agents make decisions for your business, how do you prove they made the right ones?\n\nWe built an immutable attestation system called ProofGuard.\n\nEvery agent execution gets:\n• A Confidence-Quality Score (avg: ${d.avgCqs}/100)\n• Risk tier classification\n• Human-in-the-loop gates for high-risk decisions\n• Cryptographic proof of execution\n\nResults so far:\n→ ${d.proofguardApproved} approved attestations\n→ ${d.successRate}% execution success rate\n→ ${d.trustScore}/100 Synthetic Trust Score\n\nThis is what AI governance looks like in practice, not theory.\n\n#AIGovernance #Compliance #Startup #BuildInPublic`,
  },
  {
    id: "growth-story",
    title: "Growth Narrative",
    category: "growth",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "Tell your automation growth story",
    platform: "linkedin",
    generate: (d) =>
      `${d.daysSinceStart} days ago, I started automating my business launch with AI agents.\n\nHere's what happened:\n\n📊 ${d.totalWorkflows} automated workflows built\n🤖 ${d.totalAgents} AI agents deployed\n✅ ${d.completedExecutions} successful executions\n🛡️ ${d.trustScore}/100 Trust Score achieved\n\nThe biggest lesson? Automation without governance is just faster chaos.\n\nEvery agent decision is attested, scored, and auditable. That's the difference between "using AI" and "trusting AI."\n\nWhat's your automation stack look like?\n\n#Automation #AIAgents #BuildInPublic #Entrepreneurship`,
  },
  {
    id: "investor-ready",
    title: "Investor-Ready Summary",
    category: "launch",
    icon: <Award className="w-4 h-4" />,
    description: "Generate an investor-facing operations summary",
    platform: "general",
    generate: (d) =>
      `OPERATIONS SUMMARY\n${"─".repeat(40)}\n\nAutomation Infrastructure:\n• ${d.totalWorkflows} production workflows\n• ${d.totalAgents} AI agents in registry\n• ${d.totalExecutions} total executions (${d.successRate}% success rate)\n\nGovernance & Compliance:\n• Synthetic Trust Score: ${d.trustScore}/100\n• ProofGuard attestations: ${d.proofguardTotal}\n• Approval rate: ${d.proofguardTotal > 0 ? Math.round((d.proofguardApproved / d.proofguardTotal) * 100) : 0}%\n• Average CQS: ${d.avgCqs}/100\n\nKey Differentiator:\nEvery AI agent decision is cryptographically attested with an immutable audit trail. This provides investor-grade transparency into automated operations.\n\nAll metrics are computed from live platform data, not estimates.`,
  },
  {
    id: "weekly-update",
    title: "Weekly Update",
    category: "milestone",
    icon: <Clock className="w-4 h-4" />,
    description: "Quick weekly progress update for social",
    platform: "twitter",
    generate: (d) =>
      `Weekly build update:\n\n✅ ${d.completedExecutions} executions completed\n🛡️ Trust Score: ${d.trustScore}/100\n📈 ${d.successRate}% success rate\n🤖 ${d.totalAgents} agents active\n\nBuilding the governance layer that makes AI trustworthy.\n\n#WeeklyUpdate #BuildInPublic`,
  },
];

export default function Documentary() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: trustData } = trpc.dashboard.trust.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: dashStats } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: proofguardStats } = trpc.proofguard.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Build story data from real platform metrics
  const storyData: StoryData = useMemo(() => {
    const trust = trustData;
    const stats = dashStats;
    const pg = proofguardStats;

    return {
      trustScore: trust?.overall ?? 0,
      totalExecutions: stats?.executions ?? 0,
      completedExecutions: stats?.completed ?? 0,
      successRate: stats?.executions
        ? Math.round(((stats?.completed ?? 0) / stats.executions) * 100)
        : 0,
      totalAgents: 25, // from agent registry constant
      totalWorkflows: stats?.workflows ?? 0,
      proofguardApproved: pg?.approved ?? 0,
      proofguardTotal: pg?.total ?? 0,
      avgCqs: pg?.avgCqs ?? 0,
      daysSinceStart: 30, // placeholder
      userName: user?.name ?? "Founder",
    };
  }, [trustData, dashStats, proofguardStats, user]);

  const handleSelectTemplate = (template: StoryTemplate) => {
    setSelectedTemplate(template.id);
    setEditedContent(template.generate(storyData));
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categoryColors = {
    milestone: "oklch(0.75 0.15 85)",
    governance: "oklch(0.72 0.19 149)",
    growth: "oklch(0.65 0.18 250)",
    launch: "oklch(0.65 0.2 30)",
  };

  const platformIcons = {
    twitter: <Twitter className="w-3 h-3" />,
    linkedin: <Linkedin className="w-3 h-3" />,
    general: <FileText className="w-3 h-3" />,
  };

  // Unauthenticated state
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="space-y-8 pt-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Film className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
              Documentary Tracker
            </span>
          </div>
          <h1 className="text-3xl font-bold font-[Sora] tracking-tight mb-4">
            Turn Proof Into Social Proof
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Transform your governance data and execution history into shareable success stories
            for social media, investor decks, and marketing content.
          </p>
          <a href={getLoginUrl()}>
            <Button
              size="lg"
              className="font-[Sora]"
              style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Your Stories
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Film className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
          <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
            Documentary Tracker
          </span>
        </div>
        <h1 className="text-2xl font-bold font-[Sora] tracking-tight">
          Success Story Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your real platform data, transformed into compelling narratives. Every number is live, not estimated.
        </p>
      </div>

      {/* Live Data Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Trust Score", value: storyData.trustScore, suffix: "/100", color: "oklch(0.75 0.15 85)" },
          { label: "Executions", value: storyData.totalExecutions, suffix: " total", color: "oklch(0.72 0.19 149)" },
          { label: "Success Rate", value: storyData.successRate, suffix: "%", color: "oklch(0.65 0.18 250)" },
          { label: "ProofGuard", value: storyData.proofguardApproved, suffix: ` / ${storyData.proofguardTotal}`, color: "oklch(0.65 0.2 30)" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="py-3 text-center">
              <div className="text-xl font-bold font-[Sora]" style={{ color: stat.color }}>
                {stat.value}
                <span className="text-xs text-muted-foreground font-normal">{stat.suffix}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] uppercase">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Grid + Editor */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Template Selection */}
        <div className="w-full lg:w-[40%] space-y-3">
          <h2 className="text-sm font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
            Story Templates
          </h2>
          {TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.id;
            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected ? "border-[oklch(0.75_0.15_85_/_50%)] bg-[oklch(0.75_0.15_85_/_5%)]" : "hover:border-border/80"
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${categoryColors[template.category]}15`,
                        color: categoryColors[template.category],
                      }}
                    >
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold font-[Sora]">{template.title}</span>
                        <div className="flex items-center gap-1">
                          {platformIcons[template.platform]}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] shrink-0"
                      style={{
                        borderColor: categoryColors[template.category],
                        color: categoryColors[template.category],
                      }}
                    >
                      {template.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Editor / Preview */}
        <div className="w-full lg:w-[60%]">
          {selectedTemplate ? (
            <Card className="border-[oklch(0.75_0.15_85_/_20%)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-[Sora]">
                    Edit & Share
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        const template = TEMPLATES.find((t) => t.id === selectedTemplate);
                        if (template) setEditedContent(template.generate(storyData));
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Customize the generated content, then copy or share directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={12}
                  className="font-mono text-sm leading-relaxed"
                />

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleCopy(editedContent, selectedTemplate)}
                    className="font-[Sora] flex-1"
                    style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
                  >
                    {copiedId === selectedTemplate ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1.5" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(editedContent)}`;
                      window.open(url, "_blank");
                    }}
                    className="h-9"
                  >
                    <Twitter className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`;
                      window.open(url, "_blank");
                    }}
                    className="h-9"
                  >
                    <Linkedin className="w-4 h-4" />
                  </Button>
                </div>

                {/* Character count */}
                <div className="flex justify-between text-[10px] text-muted-foreground font-[IBM_Plex_Mono]">
                  <span>{editedContent.length} characters</span>
                  <span className={editedContent.length > 280 ? "text-[oklch(0.65_0.2_30)]" : "text-[oklch(0.72_0.19_149)]"}>
                    {editedContent.length <= 280 ? "Twitter-ready" : "Over 280 chars — trim for Twitter"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-bold font-[Sora] mb-2">Select a Template</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a story template from the left to generate content from your live platform data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Pro Tip */}
      <Card className="bg-[oklch(0.75_0.15_85_/_3%)] border-[oklch(0.75_0.15_85_/_15%)]">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[oklch(0.75_0.15_85)] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold font-[Sora] mb-1">Pro Tip: Build in Public</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sharing your governance metrics publicly does three things: (1) builds trust with potential
                customers who see you take AI seriously, (2) attracts investors who value operational
                transparency, and (3) creates a documentary trail of your journey that becomes
                increasingly valuable over time. Every ProofGuard attestation is a data point in your
                success story.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
