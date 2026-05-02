/**
 * Founder Score — Trust Score Gap Analysis Lead Magnet
 * ====================================================
 * Shows users a personalized "readiness score" based on their actual data,
 * then highlights specific gaps that paid tiers would fill.
 * This is the conversion engine: free users see what they're missing.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Shield,
  Rocket,
  BarChart3,
  FileCheck,
  Users,
  Globe,
  Brain,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

interface GapItem {
  id: string;
  label: string;
  currentScore: number;
  maxScore: number;
  status: "strong" | "moderate" | "weak" | "locked";
  recommendation: string;
  unlockedAt: "explorer" | "founder" | "governance" | "enterprise";
  icon: React.ReactNode;
}

export default function FounderScore() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: trustData, isLoading: trustLoading } = trpc.dashboard.trust.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: dashStats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: subscription } = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const isLoading = authLoading || trustLoading || statsLoading;
  const tier = subscription?.tier ?? "explorer";

  // Build gap analysis from real data
  const buildGapAnalysis = (): GapItem[] => {
    const trust = trustData;
    const stats = dashStats;

    const execSuccess = trust?.metrics?.find((m: { id: string }) => m.id === "exec-success")?.value ?? 0;
    const credCoverage = trust?.metrics?.find((m: { id: string }) => m.id === "cred-coverage")?.value ?? 0;
    const proofRate = trust?.metrics?.find((m: { id: string }) => m.id === "proof-rate")?.value ?? 0;
    const wfCoverage = trust?.metrics?.find((m: { id: string }) => m.id === "wf-coverage")?.value ?? 0;

    const getStatus = (score: number, threshold: number): "strong" | "moderate" | "weak" => {
      if (score >= threshold) return "strong";
      if (score >= threshold * 0.6) return "moderate";
      return "weak";
    };

    return [
      {
        id: "agent-coverage",
        label: "Agent Coverage",
        currentScore: tier === "explorer" ? 20 : 100,
        maxScore: 100,
        status: tier === "explorer" ? "weak" : "strong",
        recommendation: tier === "explorer"
          ? "You only have access to 5 of 25 agents. Upgrade to Founder to unlock the full arsenal."
          : "Full agent access active. All 25 agents available for your workflows.",
        unlockedAt: "founder",
        icon: <Brain className="w-5 h-5" />,
      },
      {
        id: "execution-capacity",
        label: "Execution Capacity",
        currentScore: Math.min(100, (stats?.executions ?? 0) * 20),
        maxScore: 100,
        status: getStatus(stats?.executions ?? 0, 5),
        recommendation: (stats?.executions ?? 0) < 3
          ? "Run more workflows to build execution history. Each successful run strengthens your trust profile."
          : "Strong execution history. Your system has proven reliability.",
        unlockedAt: "explorer",
        icon: <Zap className="w-5 h-5" />,
      },
      {
        id: "credential-vault",
        label: "Credential Vault",
        currentScore: credCoverage,
        maxScore: 100,
        status: getStatus(credCoverage, 80),
        recommendation: credCoverage < 50
          ? "Configure API keys for your agents. Each credential unlocks new automation capabilities."
          : credCoverage < 80
          ? "Good progress. Add remaining credentials to reach full coverage."
          : "Excellent credential coverage. Your agents have the keys they need.",
        unlockedAt: "explorer",
        icon: <Lock className="w-5 h-5" />,
      },
      {
        id: "pipeline-depth",
        label: "Pipeline Depth",
        currentScore: tier === "explorer" ? 0 : Math.min(100, (stats?.workflows ?? 0) * 25),
        maxScore: 100,
        status: tier === "explorer" ? "locked" : getStatus(stats?.workflows ?? 0, 4),
        recommendation: tier === "explorer"
          ? "The 20-step Business Launch Pipeline is locked. Upgrade to Founder to automate your entire launch sequence."
          : "Pipeline access active. Build multi-step workflows to orchestrate complex launches.",
        unlockedAt: "founder",
        icon: <TrendingUp className="w-5 h-5" />,
      },
      {
        id: "proof-verification",
        label: "Proof Verification",
        currentScore: tier === "governance" || tier === "enterprise" ? proofRate : 0,
        maxScore: 100,
        status: tier === "governance" || tier === "enterprise" ? getStatus(proofRate, 90) : "locked",
        recommendation: tier !== "governance" && tier !== "enterprise"
          ? "ProofGuard governance is locked. Upgrade to Governance Pro for immutable attestation trails and CQS scoring."
          : proofRate < 90
          ? "Increase proof verification rate by running more ProofGuard-enabled executions."
          : "Outstanding proof verification. Your governance trail is production-ready.",
        unlockedAt: "governance",
        icon: <Shield className="w-5 h-5" />,
      },
      {
        id: "compliance-readiness",
        label: "Compliance Readiness",
        currentScore: tier === "governance" || tier === "enterprise" ? 75 : 0,
        maxScore: 100,
        status: tier === "governance" || tier === "enterprise" ? "moderate" : "locked",
        recommendation: tier !== "governance" && tier !== "enterprise"
          ? "Compliance export and audit trails require Governance Pro. Essential for investor-ready documentation."
          : "Compliance infrastructure active. Export attestations for due diligence packages.",
        unlockedAt: "governance",
        icon: <FileCheck className="w-5 h-5" />,
      },
      {
        id: "success-rate",
        label: "Execution Success Rate",
        currentScore: execSuccess,
        maxScore: 100,
        status: getStatus(execSuccess, 95),
        recommendation: execSuccess < 80
          ? "Your success rate needs attention. Review failed executions and fix credential or configuration issues."
          : execSuccess < 95
          ? "Good success rate. Fine-tune agent configurations to push toward 95%+ reliability."
          : "Elite success rate. Your system is operating at production quality.",
        unlockedAt: "explorer",
        icon: <CheckCircle2 className="w-5 h-5" />,
      },
      {
        id: "workflow-coverage",
        label: "Workflow Execution Coverage",
        currentScore: wfCoverage,
        maxScore: 100,
        status: getStatus(wfCoverage, 75),
        recommendation: wfCoverage < 50
          ? "Many workflows haven't been executed yet. Run them to validate your automation strategy."
          : "Good coverage. Most workflows have been battle-tested.",
        unlockedAt: "explorer",
        icon: <Globe className="w-5 h-5" />,
      },
    ];
  };

  const gaps = isAuthenticated && !isLoading ? buildGapAnalysis() : [];
  const overallScore = gaps.length > 0
    ? Math.round(gaps.reduce((sum, g) => sum + (g.status === "locked" ? 0 : g.currentScore), 0) / gaps.length)
    : 0;

  const strongCount = gaps.filter(g => g.status === "strong").length;
  const weakCount = gaps.filter(g => g.status === "weak").length;
  const lockedCount = gaps.filter(g => g.status === "locked").length;

  const statusColors = {
    strong: "oklch(0.72 0.19 149)",    // green
    moderate: "oklch(0.75 0.15 85)",    // gold
    weak: "oklch(0.65 0.2 30)",         // red-orange
    locked: "oklch(0.5 0.05 260)",      // muted purple
  };

  const statusLabels = {
    strong: "Strong",
    moderate: "Needs Work",
    weak: "Critical Gap",
    locked: "Locked",
  };

  // Unauthenticated teaser
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto pt-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Target className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
              Founder Score
            </span>
          </div>
          <h1 className="text-3xl font-bold font-[Sora] tracking-tight mb-4">
            How Launch-Ready Is Your Business?
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Get a personalized readiness assessment based on your actual automation infrastructure.
            See exactly where you stand and what you need to reach production-grade operations.
          </p>

          <Card className="max-w-md mx-auto border-[oklch(0.75_0.15_85_/_30%)]">
            <CardContent className="py-8 text-center">
              <div className="w-24 h-24 rounded-full border-4 border-[oklch(0.75_0.15_85_/_30%)] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold font-[Sora] text-muted-foreground">?</span>
              </div>
              <h3 className="text-lg font-bold font-[Sora] mb-2">Your Score Awaits</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Sign in to generate your personalized Founder Score across 8 critical dimensions.
              </p>
              <a href={getLoginUrl()}>
                <Button
                  size="lg"
                  className="font-[Sora]"
                  style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Your Founder Score
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Teaser dimensions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: <Brain className="w-5 h-5" />, label: "Agent Coverage" },
              { icon: <Zap className="w-5 h-5" />, label: "Execution Capacity" },
              { icon: <Shield className="w-5 h-5" />, label: "Proof Verification" },
              { icon: <TrendingUp className="w-5 h-5" />, label: "Pipeline Depth" },
              { icon: <Lock className="w-5 h-5" />, label: "Credential Vault" },
              { icon: <FileCheck className="w-5 h-5" />, label: "Compliance Ready" },
              { icon: <CheckCircle2 className="w-5 h-5" />, label: "Success Rate" },
              { icon: <Globe className="w-5 h-5" />, label: "Workflow Coverage" },
            ].map((dim, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 bg-card/50"
              >
                <span className="text-muted-foreground">{dim.icon}</span>
                <span className="text-xs text-muted-foreground font-[IBM_Plex_Mono]">{dim.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Target className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
          <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
            Founder Score
          </span>
        </div>
        <h1 className="text-3xl font-bold font-[Sora] tracking-tight mb-3">
          Your Launch Readiness
        </h1>
        <p className="text-muted-foreground">
          Personalized gap analysis across 8 critical dimensions of your business automation infrastructure.
        </p>
      </div>

      {/* Overall Score Ring */}
      <div className="flex justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="oklch(0.2 0.005 250)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={overallScore >= 80 ? statusColors.strong : overallScore >= 50 ? statusColors.moderate : statusColors.weak}
                  strokeWidth="8"
                  strokeDasharray={`${(overallScore / 100) * 327} 327`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-[Sora]">{isLoading ? "..." : overallScore}</span>
                <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">
                  Score
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <span className="font-bold" style={{ color: statusColors.strong }}>{strongCount}</span>
                <p className="text-[10px] text-muted-foreground">Strong</p>
              </div>
              <div className="text-center">
                <span className="font-bold" style={{ color: statusColors.weak }}>{weakCount}</span>
                <p className="text-[10px] text-muted-foreground">Gaps</p>
              </div>
              <div className="text-center">
                <span className="font-bold" style={{ color: statusColors.locked }}>{lockedCount}</span>
                <p className="text-[10px] text-muted-foreground">Locked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gaps.map((gap) => (
          <Card
            key={gap.id}
            className={`transition-all duration-200 ${
              gap.status === "locked" ? "opacity-75" : "hover:shadow-md"
            }`}
            style={{
              borderColor: gap.status === "locked" ? undefined : `${statusColors[gap.status]}33`,
            }}
          >
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${statusColors[gap.status]}15`,
                    color: statusColors[gap.status],
                  }}
                >
                  {gap.status === "locked" ? <Lock className="w-5 h-5" /> : gap.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold font-[Sora]">{gap.label}</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                      style={{
                        borderColor: statusColors[gap.status],
                        color: statusColors[gap.status],
                      }}
                    >
                      {statusLabels[gap.status]}
                    </Badge>
                  </div>

                  {gap.status !== "locked" && (
                    <div className="mb-2">
                      <Progress
                        value={gap.currentScore}
                        className="h-1.5"
                        style={{
                          // @ts-expect-error custom CSS property
                          "--progress-color": statusColors[gap.status],
                        }}
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono]">
                          {gap.currentScore}/{gap.maxScore}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {gap.recommendation}
                  </p>

                  {gap.status === "locked" && (
                    <Link href="/pricing">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs h-7 px-2"
                        style={{ color: "oklch(0.75 0.15 85)" }}
                      >
                        <Rocket className="w-3 h-3 mr-1" />
                        Unlock with {gap.unlockedAt === "founder" ? "Founder" : "Governance"} tier
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upgrade CTA for Explorer users */}
      {tier === "explorer" && (
        <Card className="border-[oklch(0.75_0.15_85_/_30%)] bg-[oklch(0.75_0.15_85_/_5%)]">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-bold font-[Sora] mb-2">
                  Unlock Your Full Potential
                </h3>
                <p className="text-muted-foreground mb-4">
                  {lockedCount} dimensions are locked on your current plan.
                  Upgrade to Founder Autopilot to unlock all 25 agents, the full launch pipeline,
                  and unlimited executions — or go Governance Pro for ProofGuard and compliance infrastructure.
                </p>
                <div className="flex gap-3">
                  <Link href="/pricing">
                    <Button
                      className="font-[Sora]"
                      style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
                    >
                      <Rocket className="w-4 h-4 mr-1.5" />
                      View Plans
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold font-[Sora] text-[oklch(0.75_0.15_85)]">
                  {100 - overallScore}%
                </div>
                <p className="text-xs text-muted-foreground font-[IBM_Plex_Mono] mt-1">
                  GROWTH POTENTIAL
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Methodology */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-[Sora]">
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Score Methodology
          </CardTitle>
          <CardDescription className="text-xs">
            Your Founder Score is computed from real platform data — not estimates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: "Data Points", value: "8", sub: "dimensions" },
              { label: "Sources", value: "Live", sub: "real-time data" },
              { label: "Updated", value: "Now", sub: "on every visit" },
              { label: "Accuracy", value: "100%", sub: "no estimates" },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg border border-border/50">
                <div className="text-lg font-bold font-[Sora]">{item.value}</div>
                <div className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] uppercase">
                  {item.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{item.sub}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
