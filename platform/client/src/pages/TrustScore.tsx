/**
 * TrustScore — Synthetic Trust Framework Dashboard
 * Wired to real tRPC trust computation
 */
import { motion } from "framer-motion";
import { Shield, CheckCircle, AlertTriangle, Lock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function TrustScore() {
  const { data: trust, isLoading } = trpc.dashboard.trust.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[oklch(0.75_0.15_85)]" size={32} />
      </div>
    );
  }

  const trustMetrics = trust?.metrics ?? [];
  const certificationLevels = trust?.certifications ?? [];
  const qualitativeIndicators = trust?.qualitative ?? [];
  const overallTrust = trust?.overall ?? 0;
  const qualAvg = qualitativeIndicators.length > 0
    ? Math.round(qualitativeIndicators.reduce((sum, q) => sum + q.score, 0) / qualitativeIndicators.length)
    : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2">
          <Shield size={24} className="text-[oklch(0.75_0.15_85)]" />
          Synthetic Trust
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          EPI governance framework with cryptographic verification and 5-level certification
        </p>
      </div>

      {/* Score + Qualitative */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trust Ring */}
        <Card className="bg-card border-border flex items-center justify-center p-8">
          <div className="text-center">
            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.20 0.005 250)" strokeWidth="5" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.75 0.15 85)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${overallTrust * 2.64} ${264 - overallTrust * 2.64}`} />
                <circle cx="50" cy="50" r="32" fill="none" stroke="oklch(0.20 0.005 250)" strokeWidth="4" />
                <circle cx="50" cy="50" r="32" fill="none" stroke="oklch(0.60 0.18 160)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${qualAvg * 2.01} ${201 - qualAvg * 2.01}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-[Sora] font-bold text-[oklch(0.75_0.15_85)]">{overallTrust}</span>
                <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Composite</span>
              </div>
            </div>
            <p className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground">
              <span className="text-[oklch(0.75_0.15_85)]">Outer</span>: Quantitative &middot; <span className="text-emerald-400">Inner</span>: Qualitative
            </p>
          </div>
        </Card>

        {/* Quantitative Metrics */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground">Quantitative Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trustMetrics.map((metric) => (
              <div key={metric.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-[Sora] font-semibold text-foreground">{metric.value}{metric.unit}</span>
                    <span className={`text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm ${
                      metric.status === "healthy" ? "text-emerald-400 bg-emerald-400/10" : metric.status === "warning" ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"
                    }`}>
                      target: {metric.id === "guardian-veto" || metric.id === "incident-response" ? "<" : ">"}{metric.target}{metric.unit}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[oklch(0.20_0.005_250)] rounded-full">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, (metric.value / metric.target) * 100)}%`,
                    backgroundColor: metric.status === "healthy" ? "oklch(0.65 0.18 160)" : metric.status === "warning" ? "oklch(0.75 0.15 85)" : "oklch(0.65 0.20 25)",
                  }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Qualitative Indicators */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground">Qualitative Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {qualitativeIndicators.map((qi) => (
              <div key={qi.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{qi.label}</span>
                  <span className="text-xs font-[Sora] font-semibold text-foreground">{qi.score}/{qi.maxScore}</span>
                </div>
                <div className="w-full h-1.5 bg-[oklch(0.20_0.005_250)] rounded-full">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(qi.score / qi.maxScore) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Qualitative Average</span>
                <span className="text-sm font-[Sora] font-bold text-emerald-400">{qualAvg}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Certification Pathway */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">5-Level Certification Pathway</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {certificationLevels.map((cert, i) => (
              <motion.div
                key={cert.level}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-sm border ${
                  cert.status === "complete" ? "border-emerald-500/30 bg-emerald-500/5"
                  : cert.status === "in-progress" ? "border-[oklch(0.75_0.15_85_/_30%)] bg-[oklch(0.75_0.15_85_/_5%)]"
                  : "border-border bg-[oklch(0.14_0.005_250)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {cert.status === "complete" ? <CheckCircle size={16} className="text-emerald-400" />
                    : cert.status === "in-progress" ? <AlertTriangle size={16} className="text-[oklch(0.75_0.15_85)]" />
                    : <Lock size={16} className="text-muted-foreground" />}
                  <span className="text-[10px] font-[IBM_Plex_Mono] uppercase text-muted-foreground">Level {cert.level}</span>
                </div>
                <p className="text-xs font-medium text-foreground mb-1">{cert.name}</p>
                <p className="text-[10px] text-muted-foreground mb-3">{cert.description}</p>
                <div className="w-full h-1.5 bg-[oklch(0.20_0.005_250)] rounded-full">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${cert.progress}%`,
                    backgroundColor: cert.status === "complete" ? "oklch(0.65 0.18 160)" : "oklch(0.75 0.15 85)",
                  }} />
                </div>
                <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground mt-1 block">{cert.progress}%</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guardian System Preview */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Guardian System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { role: "Class A", desc: "Full authority: veto, emergency pause, upgrade contracts, dispute resolution", color: "oklch(0.75 0.15 85)" },
              { role: "Class B", desc: "Limited authority: vote on proposals, review decisions, flag anomalies", color: "oklch(0.60 0.18 160)" },
              { role: "Observer", desc: "View only: monitor trust metrics, review logs, verify proofs", color: "oklch(0.55 0.01 250)" },
            ].map((g) => (
              <div key={g.role} className="p-4 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]">
                <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: g.color }} />
                <p className="text-xs font-medium text-foreground mb-1">{g.role}</p>
                <p className="text-[10px] text-muted-foreground">{g.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 font-[IBM_Plex_Mono]">
            Guardian system active in public edition. Personal edition runs unhinged — no veto gates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
