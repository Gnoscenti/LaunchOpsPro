/**
 * BrandArchitect — The original brand comparison tool, now embedded in the Atlas dashboard
 */
import { motion } from "framer-motion";
import { Palette, CheckCircle, AlertTriangle, Globe, Building2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const parentOptions = [
  {
    id: "gnoscenti",
    name: "Gnoscenti",
    tagline: "From Greek gnosis — knowledge as foundation",
    scores: { recognition: 7, vcAppeal: 9, scalability: 10, ipSafety: 10, narrative: 9 },
    architecture: "Branded House",
    risk: "low",
    domains: ["thesoloprenuerforge.com", "thesoloprenuer.ai"],
  },
  {
    id: "gnoscenti-forge",
    name: "Gnoscenti Forge",
    tagline: "Intelligence meets craft — zero prior art",
    scores: { recognition: 6, vcAppeal: 9, scalability: 9, ipSafety: 10, narrative: 10 },
    architecture: "Hybrid",
    risk: "low",
    domains: ["thesoloprenuerforge.com", "thesoloprenuer.ai"],
  },
  {
    id: "solopreneur-forge",
    name: "The Solopreneur Forge",
    tagline: "Where solo founders are forged into operators",
    scores: { recognition: 8, vcAppeal: 7, scalability: 7, ipSafety: 10, narrative: 10 },
    architecture: "House of Brands",
    risk: "low",
    domains: ["thesoloprenuerforge.com", "thesoloprenuer.ai"],
  },
  {
    id: "digital-ai",
    name: "Digital AI Studios",
    tagline: "AI-powered digital studio",
    scores: { recognition: 5, vcAppeal: 6, scalability: 8, ipSafety: 3, narrative: 6 },
    architecture: "Branded House",
    risk: "high",
    domains: ["digitalaistudios.com"],
  },
];

const dimensions = ["recognition", "vcAppeal", "scalability", "ipSafety", "narrative"] as const;
const dimLabels: Record<string, string> = {
  recognition: "Brand Recognition", vcAppeal: "VC Appeal", scalability: "Scalability",
  ipSafety: "IP Safety", narrative: "Narrative Power",
};

export default function BrandArchitect() {
  const [selected, setSelected] = useState("gnoscenti");
  const option = parentOptions.find((o) => o.id === selected) || parentOptions[0];
  const totalScore = dimensions.reduce((sum, d) => sum + (option.scores[d] || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2">
          <Palette size={24} className="text-[oklch(0.75_0.15_85)]" />
          Brand Architect
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare naming strategies and brand architectures for your company
        </p>
      </div>

      {/* Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {parentOptions.map((opt) => {
          const total = dimensions.reduce((sum, d) => sum + (opt.scores[d] || 0), 0);
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`p-4 rounded-sm border text-left transition-all ${
                selected === opt.id
                  ? "border-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_8%)]"
                  : "border-border bg-card hover:border-[oklch(0.75_0.15_85_/_30%)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Building2 size={14} className={selected === opt.id ? "text-[oklch(0.75_0.15_85)]" : "text-muted-foreground"} />
                {opt.risk === "high" ? (
                  <AlertTriangle size={12} className="text-red-400" />
                ) : (
                  <CheckCircle size={12} className="text-emerald-400" />
                )}
              </div>
              <p className="text-sm font-[Sora] font-semibold text-foreground">{opt.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{opt.tagline}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-[Sora] font-bold text-foreground">{total}<span className="text-xs text-muted-foreground">/50</span></span>
                <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">{opt.architecture}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scores */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground">
              {option.name} — Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensions.map((dim) => {
              const score = option.scores[dim] || 0;
              return (
                <div key={dim} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{dimLabels[dim]}</span>
                    <span className="text-sm font-[Sora] font-bold text-foreground">{score}<span className="text-xs text-muted-foreground">/10</span></span>
                  </div>
                  <div className="w-full h-2 bg-[oklch(0.20_0.005_250)] rounded-full">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${score * 10}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      style={{
                        backgroundColor: score >= 8 ? "oklch(0.65 0.18 160)" : score >= 5 ? "oklch(0.75 0.15 85)" : "oklch(0.65 0.20 25)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-xl font-[Sora] font-bold text-[oklch(0.75_0.15_85)]">{totalScore}/50</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Architecture + Domains */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-[Sora] text-foreground">Brand Architecture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]">
                <p className="text-xs font-[IBM_Plex_Mono] text-[oklch(0.75_0.15_85)] mb-2">{option.architecture}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {option.architecture === "Branded House"
                    ? "All products carry the parent brand. Maximum brand equity transfer. Example: Google → Google Maps, Google Cloud."
                    : option.architecture === "House of Brands"
                    ? "Each product has its own brand identity. Parent is invisible to consumers. Example: P&G → Tide, Pampers."
                    : "Mix of branded and independent products. Parent visible on some, hidden on others. Example: Alphabet → Google + Waymo."}
                </p>
              </div>

              {/* Product mapping */}
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Product Portfolio</p>
                {[
                  { name: "LaunchOps", role: "Orchestration Engine" },
                  { name: "Founder Autopilot", role: "Public SaaS Product" },
                  { name: "Strategic Catalyst", role: "Coaching Layer" },
                  { name: "AI Integration Course", role: "Education Platform" },
                ].map((product) => (
                  <div key={product.name} className="flex items-center gap-2 p-2 rounded-sm border border-border/50">
                    <ArrowRight size={10} className="text-[oklch(0.75_0.15_85)]" />
                    <span className="text-xs text-foreground">{product.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">{product.role}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
                <Globe size={14} className="text-[oklch(0.75_0.15_85)]" />
                Domain Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { domain: "thesoloprenuerforge.com", role: "Primary — Landing & Sales" },
                  { domain: "thesoloprenuer.ai", role: "AI Product Portal" },
                  { domain: "digitalaistudios.com", role: "Studio Portfolio" },
                  { domain: "ai-onlinecourses.com", role: "Education Funnel" },
                  { domain: "microaistudios.com", role: "Legacy — Redirect" },
                ].map((d) => (
                  <div key={d.domain} className="flex items-center justify-between p-2 rounded-sm border border-border/50 bg-[oklch(0.14_0.005_250)]">
                    <span className="text-[11px] font-[IBM_Plex_Mono] text-foreground">{d.domain}</span>
                    <span className="text-[9px] text-muted-foreground">{d.role}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
