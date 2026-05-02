import { motion } from "framer-motion";
import { domainStrategies } from "@/lib/brandData";
import { Globe, ArrowRight, Search, Users, ExternalLink } from "lucide-react";

const DOMAIN_BG = "https://d2xsxph8kpxj0f.cloudfront.net/95992963/VVszexVYyhZkgVBeKxadSN/domain-map-illustration-4L9bTPvKMx2AvL9yd82dAP.webp";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Active", color: "oklch(0.65 0.15 145)", icon: <Globe size={14} /> },
  redirect: { label: "Redirect", color: "oklch(0.75 0.15 85)", icon: <ArrowRight size={14} /> },
  seo: { label: "SEO Funnel", color: "oklch(0.65 0.08 250)", icon: <Search size={14} /> },
  community: { label: "Community", color: "oklch(0.65 0.15 300)", icon: <Users size={14} /> },
};

export default function DomainStrategy() {
  return (
    <div
      className="border relative overflow-hidden"
      style={{
        borderColor: "oklch(0.25 0.005 250)",
        borderRadius: "3px",
        backgroundColor: "oklch(0.14 0.005 250)",
      }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 opacity-[0.06] bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${DOMAIN_BG})` }}
      />

      <div className="relative z-10 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-[Sora] font-700 text-xl" style={{ color: "oklch(0.92 0.01 80)" }}>
              Domain Strategy
            </h2>
            <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 250)" }}>
              Each domain has a specific job in your funnel
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="font-[IBM_Plex_Mono] text-xs" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Domain cards */}
        <div className="space-y-3">
          {domainStrategies.map((ds, i) => {
            const cfg = statusConfig[ds.status];
            return (
              <motion.div
                key={ds.domain}
                className="border p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-300 hover:border-[oklch(0.35_0.005_250)]"
                style={{
                  borderColor: "oklch(0.25 0.005 250)",
                  borderRadius: "3px",
                  backgroundColor: "oklch(0.16 0.005 250)",
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Domain name */}
                <div className="sm:w-56 shrink-0">
                  <div className="flex items-center gap-2">
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span
                      className="font-[IBM_Plex_Mono] text-sm font-500"
                      style={{ color: "oklch(0.92 0.01 80)" }}
                    >
                      {ds.domain}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight
                  size={16}
                  className="hidden sm:block shrink-0"
                  style={{ color: "oklch(0.35 0.005 250)" }}
                />

                {/* Role */}
                <div className="flex-1">
                  <p className="font-[Sora] font-600 text-sm mb-0.5" style={{ color: cfg.color }}>
                    {ds.role}
                  </p>
                  <p className="text-sm" style={{ color: "oklch(0.55 0.01 250)" }}>
                    {ds.target}
                  </p>
                </div>

                {/* Status badge */}
                <div
                  className="shrink-0 px-3 py-1 border text-xs font-[IBM_Plex_Mono] font-500"
                  style={{
                    borderColor: cfg.color,
                    color: cfg.color,
                    borderRadius: "2px",
                    backgroundColor: `color-mix(in oklch, ${cfg.color} 8%, transparent)`,
                  }}
                >
                  {cfg.label}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Insight callout */}
        <motion.div
          className="mt-8 p-5 border-l-2"
          style={{
            borderColor: "oklch(0.75 0.15 85)",
            backgroundColor: "oklch(0.75 0.15 85 / 5%)",
            borderRadius: "0 3px 3px 0",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "oklch(0.80 0.01 80)" }}>
            <strong style={{ color: "oklch(0.75 0.15 85)" }}>Strategic Insight:</strong> You do not
            need to buy new domains. You need to assign each existing domain a specific role in your
            acquisition funnel. This is how MBA-driven venture studios like High Alpha and Science
            Inc. structure their digital presence.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
