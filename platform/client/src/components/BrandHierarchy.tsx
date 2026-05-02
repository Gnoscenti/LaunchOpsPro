import { motion } from "framer-motion";
import type { ParentOption } from "@/lib/brandData";
import { productBrands } from "@/lib/brandData";
import { Rocket, Brain, Network, Film } from "lucide-react";

const TREE_BG = "https://d2xsxph8kpxj0f.cloudfront.net/95992963/VVszexVYyhZkgVBeKxadSN/brand-tree-illustration-XBfPBbReMKNZSzkezKYZtV.webp";

const iconMap: Record<string, React.ReactNode> = {
  Rocket: <Rocket size={20} />,
  Brain: <Brain size={20} />,
  Network: <Network size={20} />,
  Film: <Film size={20} />,
};

interface Props {
  parent: ParentOption;
}

export default function BrandHierarchy({ parent }: Props) {
  return (
    <div
      className="border relative overflow-hidden"
      style={{
        borderColor: "oklch(0.25 0.005 250)",
        borderRadius: "3px",
        backgroundColor: "oklch(0.14 0.005 250)",
      }}
    >
      {/* Background illustration */}
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${TREE_BG})` }}
      />

      <div className="relative z-10 p-6 lg:p-8">
        <h2 className="font-[Sora] font-700 text-xl mb-2" style={{ color: "oklch(0.92 0.01 80)" }}>
          Brand Hierarchy
        </h2>
        <p className="text-sm mb-8" style={{ color: "oklch(0.55 0.01 250)" }}>
          How your products organize under the selected parent company
        </p>

        {/* Parent node */}
        <motion.div
          className="mx-auto max-w-md text-center mb-2"
          key={parent.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="inline-block px-8 py-5 border-2"
            style={{
              borderColor: "oklch(0.75 0.15 85)",
              borderRadius: "3px",
              backgroundColor: "oklch(0.18 0.005 250)",
              boxShadow: "0 0 30px oklch(0.75 0.15 85 / 15%), 0 0 60px oklch(0.75 0.15 85 / 5%)",
            }}
          >
            <p
              className="font-[IBM_Plex_Mono] text-xs tracking-[0.2em] uppercase mb-1"
              style={{ color: "oklch(0.55 0.12 85)" }}
            >
              Parent Entity
            </p>
            <h3 className="font-[Sora] font-800 text-2xl" style={{ color: "oklch(0.95 0.01 80)" }}>
              {parent.name}
            </h3>
            <p className="text-sm mt-1" style={{ color: "oklch(0.60 0.01 250)" }}>
              {parent.archetype}
            </p>
          </div>
        </motion.div>

        {/* Connecting line */}
        <div className="flex justify-center">
          <motion.div
            className="w-px h-12"
            style={{ backgroundColor: "oklch(0.75 0.15 85 / 40%)" }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          />
        </div>

        {/* Horizontal connector */}
        <div className="flex justify-center">
          <motion.div
            className="h-px w-full max-w-3xl"
            style={{ backgroundColor: "oklch(0.75 0.15 85 / 30%)" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          />
        </div>

        {/* Product nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-0">
          {productBrands.map((product, i) => (
            <motion.div
              key={product.id}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Vertical connector from horizontal line */}
              <div className="flex justify-center">
                <div
                  className="w-px h-6"
                  style={{ backgroundColor: "oklch(0.75 0.15 85 / 30%)" }}
                />
              </div>

              {/* Product card */}
              <div
                className="border p-4 transition-all duration-300 hover:border-[oklch(0.65_0.08_250)]"
                style={{
                  borderColor: "oklch(0.25 0.005 250)",
                  borderRadius: "3px",
                  backgroundColor: "oklch(0.16 0.005 250)",
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center mb-3 border"
                  style={{
                    borderColor: "oklch(0.30 0.005 250)",
                    borderRadius: "2px",
                    color: "oklch(0.65 0.08 250)",
                  }}
                >
                  {iconMap[product.icon]}
                </div>
                <h4 className="font-[Sora] font-600 text-sm mb-1" style={{ color: "oklch(0.92 0.01 80)" }}>
                  {product.name}
                </h4>
                <p
                  className="font-[IBM_Plex_Mono] text-xs mb-2"
                  style={{ color: "oklch(0.55 0.12 85)" }}
                >
                  {product.category}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 250)" }}>
                  {product.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
