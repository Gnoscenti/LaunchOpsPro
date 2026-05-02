import { motion } from "framer-motion";
import type { ParentOption } from "@/lib/brandData";
import { Check, Globe } from "lucide-react";

interface Props {
  options: ParentOption[];
  selected: string;
  onSelect: (id: string) => void;
}

export default function ParentSelector({ options, selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <h2
        className="font-[Sora] font-700 text-sm tracking-[0.2em] uppercase mb-4"
        style={{ color: "oklch(0.55 0.12 85)" }}
      >
        Parent Company Options
      </h2>

      {options.map((opt, i) => {
        const isActive = opt.id === selected;
        return (
          <motion.button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`w-full text-left p-4 border transition-all duration-300 relative overflow-hidden ${
              isActive
                ? "border-[oklch(0.75_0.15_85)] bg-[oklch(0.18_0.005_250)]"
                : "border-border bg-card hover:border-[oklch(0.75_0.15_85_/_30%)] hover:bg-[oklch(0.16_0.005_250)]"
            }`}
            style={{ borderRadius: "3px" }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Glow effect for active */}
            {isActive && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: "inset 0 0 30px oklch(0.75 0.15 85 / 8%), 0 0 20px oklch(0.75 0.15 85 / 12%)",
                }}
                layoutId="parentGlow"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <div className="relative z-10">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="font-[IBM_Plex_Mono] text-xs font-600 w-6 h-6 flex items-center justify-center border"
                    style={{
                      borderColor: isActive ? "oklch(0.75 0.15 85)" : "oklch(0.35 0.005 250)",
                      color: isActive ? "oklch(0.75 0.15 85)" : "oklch(0.55 0.01 250)",
                      borderRadius: "2px",
                    }}
                  >
                    {opt.letter}
                  </span>
                  <h3
                    className="font-[Sora] font-600 text-base"
                    style={{ color: isActive ? "oklch(0.95 0.01 80)" : "oklch(0.80 0.01 80)" }}
                  >
                    {opt.name}
                  </h3>
                </div>
                {isActive && <Check size={16} style={{ color: "oklch(0.75 0.15 85)" }} />}
              </div>

              {/* Tagline */}
              <p
                className="text-sm leading-relaxed mb-3"
                style={{ color: "oklch(0.60 0.01 250)" }}
              >
                {opt.tagline}
              </p>

              {/* Domain badge */}
              <div className="flex items-center gap-1.5">
                <Globe size={12} style={{ color: "oklch(0.50 0.06 250)" }} />
                <span
                  className="font-[IBM_Plex_Mono] text-xs"
                  style={{ color: opt.domainOwned ? "oklch(0.65 0.15 145)" : "oklch(0.55 0.01 250)" }}
                >
                  {opt.domain}
                  {opt.domainOwned && " (owned)"}
                </span>
              </div>
            </div>
          </motion.button>
        );
      })}

      {/* Archetype badge */}
      <div
        className="mt-6 p-4 border"
        style={{
          borderColor: "oklch(0.25 0.005 250)",
          borderRadius: "3px",
          backgroundColor: "oklch(0.14 0.005 250)",
        }}
      >
        <p
          className="font-[IBM_Plex_Mono] text-xs tracking-[0.15em] uppercase mb-1"
          style={{ color: "oklch(0.50 0.06 250)" }}
        >
          Archetype
        </p>
        <p className="font-[Sora] font-600 text-lg" style={{ color: "oklch(0.75 0.15 85)" }}>
          {options.find((o) => o.id === selected)?.archetype}
        </p>
      </div>
    </div>
  );
}
