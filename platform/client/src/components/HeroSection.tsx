import { motion } from "framer-motion";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/95992963/VVszexVYyhZkgVBeKxadSN/hero-forge-bg-nDhK4czEdYRrjxevMiSaRz.webp";

export default function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "420px" }}>
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.12_0.005_250_/_60%)] via-[oklch(0.12_0.005_250_/_40%)] to-[oklch(0.12_0.005_250_/_95%)]" />

      {/* Content */}
      <div className="relative z-10 container flex flex-col justify-center" style={{ minHeight: "420px" }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="font-[IBM_Plex_Mono] text-xs tracking-[0.3em] uppercase mb-4"
            style={{ color: "oklch(0.65 0.08 250)" }}
          >
            Strategic Naming Architecture
          </p>
          <h1
            className="font-[Sora] font-800 leading-[1.05] mb-6"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
              color: "oklch(0.95 0.01 80)",
            }}
          >
            Brand{" "}
            <span style={{ color: "oklch(0.75 0.15 85)" }}>Architect</span>
          </h1>
          <p
            className="font-[Source_Sans_3] text-lg sm:text-xl max-w-2xl leading-relaxed"
            style={{ color: "oklch(0.72 0.01 80)" }}
          >
            An interactive tool for evaluating parent company names, comparing
            brand architectures, and mapping your domain portfolio to a
            boardroom-ready strategy.
          </p>
        </motion.div>

        {/* Decorative gold line */}
        <motion.div
          className="mt-10 h-px w-full max-w-md"
          style={{ background: "linear-gradient(90deg, oklch(0.75 0.15 85), transparent)" }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </section>
  );
}
