import { motion } from "framer-motion";
import type { ParentOption } from "@/lib/brandData";

interface Props {
  options: ParentOption[];
  selected: string;
}

function ScoreBar({ score, isSelected, delay }: { score: number; isSelected: boolean; delay: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-2 overflow-hidden"
        style={{ backgroundColor: "oklch(0.20 0.005 250)", borderRadius: "1px" }}
      >
        <motion.div
          className="h-full"
          style={{
            backgroundColor: isSelected ? "oklch(0.75 0.15 85)" : "oklch(0.45 0.06 250)",
            borderRadius: "1px",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span
        className="font-[IBM_Plex_Mono] text-xs w-8 text-right tabular-nums"
        style={{ color: isSelected ? "oklch(0.75 0.15 85)" : "oklch(0.55 0.01 250)" }}
      >
        {score}
      </span>
    </div>
  );
}

export default function ComparisonMatrix({ options, selected }: Props) {
  const categories = options[0].strengths.map((s) => s.label);

  return (
    <div
      className="border p-4 sm:p-6 lg:p-8"
      style={{
        borderColor: "oklch(0.25 0.005 250)",
        borderRadius: "3px",
        backgroundColor: "oklch(0.14 0.005 250)",
      }}
    >
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="font-[Sora] font-700 text-lg sm:text-xl" style={{ color: "oklch(0.92 0.01 80)" }}>
          Comparison Matrix
        </h2>
        <span
          className="font-[IBM_Plex_Mono] text-xs tracking-[0.15em] uppercase"
          style={{ color: "oklch(0.50 0.06 250)" }}
        >
          Scoring 0–100
        </span>
      </div>

      {/* Scrollable wrapper for mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div style={{ minWidth: "640px" }}>
          {/* Header row */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "130px repeat(4, 1fr)" }}>
            <div />
            {options.map((opt) => (
              <div
                key={opt.id}
                className={`text-center pb-3 border-b-2 transition-colors duration-300 ${
                  opt.id === selected ? "border-[oklch(0.75_0.15_85)]" : "border-transparent"
                }`}
              >
                <p
                  className="font-[Sora] font-600 text-sm"
                  style={{ color: opt.id === selected ? "oklch(0.95 0.01 80)" : "oklch(0.60 0.01 250)" }}
                >
                  {opt.name}
                </p>
                <p
                  className="font-[IBM_Plex_Mono] text-xs mt-0.5"
                  style={{ color: "oklch(0.45 0.06 250)" }}
                >
                  Option {opt.letter}
                </p>
              </div>
            ))}
          </div>

          {/* Score rows */}
          {categories.map((cat, ci) => (
            <div
              key={cat}
              className="grid gap-4 py-4 border-b"
              style={{
                gridTemplateColumns: "130px repeat(4, 1fr)",
                borderColor: "oklch(0.20 0.005 250)",
              }}
            >
              <div className="flex items-center">
                <span
                  className="text-sm font-500"
                  style={{ color: "oklch(0.65 0.01 80)" }}
                >
                  {cat}
                </span>
              </div>
              {options.map((opt) => {
                const score = opt.strengths[ci].score;
                return (
                  <ScoreBar
                    key={opt.id}
                    score={score}
                    isSelected={opt.id === selected}
                    delay={ci * 0.05}
                  />
                );
              })}
            </div>
          ))}

          {/* Total row */}
          <div
            className="grid gap-4 pt-5 mt-2"
            style={{ gridTemplateColumns: "130px repeat(4, 1fr)" }}
          >
            <div className="flex items-center">
              <span className="font-[Sora] font-700 text-sm" style={{ color: "oklch(0.75 0.15 85)" }}>
                Total Score
              </span>
            </div>
            {options.map((opt) => {
              const total = opt.strengths.reduce((sum, s) => sum + s.score, 0);
              const isActive = opt.id === selected;
              return (
                <div key={opt.id} className="flex items-center justify-center">
                  <motion.span
                    className="font-[Sora] font-800 text-2xl tabular-nums"
                    style={{ color: isActive ? "oklch(0.75 0.15 85)" : "oklch(0.50 0.01 250)" }}
                    key={`${opt.id}-${total}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {total}
                  </motion.span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
