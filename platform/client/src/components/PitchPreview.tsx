import { motion } from "framer-motion";
import type { ParentOption } from "@/lib/brandData";
import { productBrands } from "@/lib/brandData";
import { Rocket, Brain, Network, Film, Quote } from "lucide-react";

const MATRIX_BG = "https://d2xsxph8kpxj0f.cloudfront.net/95992963/VVszexVYyhZkgVBeKxadSN/comparison-matrix-bg-PQxskMcjCR5DPgE6rtYbFp.webp";

const iconMap: Record<string, React.ReactNode> = {
  Rocket: <Rocket size={18} />,
  Brain: <Brain size={18} />,
  Network: <Network size={18} />,
  Film: <Film size={18} />,
};

interface Props {
  parent: ParentOption;
}

export default function PitchPreview({ parent }: Props) {
  return (
    <div className="space-y-6">
      {/* Pitch Slide */}
      <motion.div
        className="border relative overflow-hidden"
        style={{
          borderColor: "oklch(0.25 0.005 250)",
          borderRadius: "3px",
          aspectRatio: "16/9",
        }}
        key={parent.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${MATRIX_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.12_0.005_250_/_85%)] via-[oklch(0.12_0.005_250_/_70%)] to-[oklch(0.12_0.005_250_/_90%)]" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-8 lg:p-12">
          {/* Top */}
          <div>
            <p
              className="font-[IBM_Plex_Mono] text-xs tracking-[0.3em] uppercase mb-4"
              style={{ color: "oklch(0.55 0.12 85)" }}
            >
              Investor Presentation — Slide Preview
            </p>
            <motion.h2
              className="font-[Sora] font-800 mb-3"
              style={{
                fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
                color: "oklch(0.95 0.01 80)",
                lineHeight: 1.1,
              }}
              key={`name-${parent.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {parent.name}
            </motion.h2>
            <p
              className="text-base lg:text-lg max-w-xl"
              style={{ color: "oklch(0.72 0.01 80)" }}
            >
              {parent.tagline}
            </p>
          </div>

          {/* Bottom — Portfolio */}
          <div>
            <p
              className="font-[IBM_Plex_Mono] text-xs tracking-[0.15em] uppercase mb-4"
              style={{ color: "oklch(0.50 0.06 250)" }}
            >
              Portfolio Assets
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {productBrands.map((product, i) => (
                <motion.div
                  key={product.id}
                  className="border p-3"
                  style={{
                    borderColor: "oklch(0.30 0.005 250)",
                    borderRadius: "2px",
                    backgroundColor: "oklch(0.14 0.005 250 / 80%)",
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: "oklch(0.65 0.08 250)" }}>{iconMap[product.icon]}</span>
                    <span
                      className="font-[Sora] font-600 text-xs"
                      style={{ color: "oklch(0.92 0.01 80)" }}
                    >
                      {product.name}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "oklch(0.50 0.01 250)" }}>
                    {product.category}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Gold accent line at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, oklch(0.75 0.15 85), oklch(0.75 0.15 85 / 20%), transparent)" }}
        />
      </motion.div>

      {/* Boardroom Pitch Quote */}
      <motion.div
        className="border p-6"
        style={{
          borderColor: "oklch(0.25 0.005 250)",
          borderRadius: "3px",
          backgroundColor: "oklch(0.14 0.005 250)",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex gap-4">
          <Quote size={24} className="shrink-0 mt-1" style={{ color: "oklch(0.75 0.15 85 / 40%)" }} />
          <div>
            <p
              className="font-[IBM_Plex_Mono] text-xs tracking-[0.15em] uppercase mb-3"
              style={{ color: "oklch(0.55 0.12 85)" }}
            >
              Boardroom Pitch
            </p>
            <motion.p
              className="text-lg leading-relaxed italic"
              style={{ color: "oklch(0.85 0.01 80)" }}
              key={`pitch-${parent.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              "{parent.boardroomPitch}"
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Why It Works */}
      <motion.div
        className="border-l-2 pl-5 py-2"
        style={{ borderColor: "oklch(0.65 0.08 250)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <p
          className="font-[IBM_Plex_Mono] text-xs tracking-[0.15em] uppercase mb-2"
          style={{ color: "oklch(0.50 0.06 250)" }}
        >
          Why This Name Works
        </p>
        <motion.p
          className="text-sm leading-relaxed"
          style={{ color: "oklch(0.72 0.01 80)" }}
          key={`why-${parent.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {parent.whyItWorks}
        </motion.p>
      </motion.div>
    </div>
  );
}
