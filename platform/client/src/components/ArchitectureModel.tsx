import { motion } from "framer-motion";
import { architectureModels } from "@/lib/brandData";
import { Check, X, Minus } from "lucide-react";

const fitConfig = {
  low: { label: "Low Fit", color: "oklch(0.55 0.22 25)", icon: <X size={16} /> },
  medium: { label: "Medium Fit", color: "oklch(0.75 0.15 85)", icon: <Minus size={16} /> },
  high: { label: "Best Fit", color: "oklch(0.65 0.15 145)", icon: <Check size={16} /> },
};

export default function ArchitectureModel() {
  return (
    <div>
      <div className="mb-8">
        <p
          className="font-[IBM_Plex_Mono] text-xs tracking-[0.3em] uppercase mb-2"
          style={{ color: "oklch(0.55 0.12 85)" }}
        >
          Brand Architecture
        </p>
        <h2 className="font-[Sora] font-700 text-2xl" style={{ color: "oklch(0.92 0.01 80)" }}>
          Which Model Fits Your Ecosystem?
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {architectureModels.map((model, i) => {
          const fit = fitConfig[model.fit];
          const isBest = model.fit === "high";
          return (
            <motion.div
              key={model.id}
              className={`border p-6 relative overflow-hidden transition-all duration-300 ${
                isBest ? "border-[oklch(0.65_0.15_145)]" : "border-border"
              }`}
              style={{
                borderRadius: "3px",
                backgroundColor: isBest ? "oklch(0.65 0.15 145 / 5%)" : "oklch(0.14 0.005 250)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {isBest && (
                <div
                  className="absolute top-0 right-0 px-3 py-1 text-xs font-[IBM_Plex_Mono] font-600"
                  style={{
                    backgroundColor: "oklch(0.65 0.15 145)",
                    color: "oklch(0.12 0.005 250)",
                    borderRadius: "0 3px 0 3px",
                  }}
                >
                  Recommended
                </div>
              )}

              {/* Fit badge */}
              <div className="flex items-center gap-2 mb-4">
                <span style={{ color: fit.color }}>{fit.icon}</span>
                <span className="font-[IBM_Plex_Mono] text-xs font-500" style={{ color: fit.color }}>
                  {fit.label}
                </span>
              </div>

              <h3 className="font-[Sora] font-700 text-lg mb-2" style={{ color: "oklch(0.92 0.01 80)" }}>
                {model.name}
              </h3>

              <p className="text-sm mb-4 leading-relaxed" style={{ color: "oklch(0.60 0.01 250)" }}>
                {model.description}
              </p>

              <div
                className="text-xs font-[IBM_Plex_Mono] mb-4 p-2 border"
                style={{
                  borderColor: "oklch(0.22 0.005 250)",
                  borderRadius: "2px",
                  backgroundColor: "oklch(0.12 0.005 250)",
                  color: "oklch(0.55 0.01 250)",
                }}
              >
                Examples: {model.examples}
              </div>

              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.72 0.01 80)" }}>
                <strong style={{ color: fit.color }}>Why:</strong> {model.reason}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
