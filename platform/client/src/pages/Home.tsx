/**
 * Brand Architect — "The Forge" Design System
 * Dark graphite surfaces, molten gold accents, industrial craft aesthetic.
 * Asymmetric layout with persistent control panel + main viewport.
 */
import { useState } from "react";
import HeroSection from "@/components/HeroSection";
import ParentSelector from "@/components/ParentSelector";
import ComparisonMatrix from "@/components/ComparisonMatrix";
import BrandHierarchy from "@/components/BrandHierarchy";
import DomainStrategy from "@/components/DomainStrategy";
import ArchitectureModel from "@/components/ArchitectureModel";
import PitchPreview from "@/components/PitchPreview";
import { parentOptions } from "@/lib/brandData";

export default function Home() {
  const [selectedParent, setSelectedParent] = useState(parentOptions[0].id);
  const [activeView, setActiveView] = useState<"compare" | "hierarchy" | "domains" | "pitch">("compare");

  const selected = parentOptions.find((p) => p.id === selectedParent)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <HeroSection />

      {/* Main Tool Area */}
      <div className="container py-8 lg:py-12">
        {/* View Switcher */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: "compare" as const, label: "Comparison Matrix" },
            { key: "hierarchy" as const, label: "Brand Hierarchy" },
            { key: "domains" as const, label: "Domain Strategy" },
            { key: "pitch" as const, label: "Pitch Preview" },
          ].map((view) => (
            <button
              key={view.key}
              onClick={() => setActiveView(view.key)}
              className={`px-5 py-2.5 text-sm font-medium font-[Sora] tracking-wide transition-all duration-300 border ${
                activeView === view.key
                  ? "border-[oklch(0.75_0.15_85)] text-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_8%)] glow-gold-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-[oklch(0.75_0.15_85_/_40%)]"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {view.label}
            </button>
          ))}
        </div>

        {/* Two-column layout: 30% control panel / 70% viewport */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Control Panel */}
          <aside className="w-full lg:w-[30%] shrink-0">
            <ParentSelector
              options={parentOptions}
              selected={selectedParent}
              onSelect={setSelectedParent}
            />
          </aside>

          {/* Right Main Viewport */}
          <main className="w-full lg:w-[70%]">
            {activeView === "compare" && (
              <ComparisonMatrix options={parentOptions} selected={selectedParent} />
            )}
            {activeView === "hierarchy" && (
              <BrandHierarchy parent={selected} />
            )}
            {activeView === "domains" && <DomainStrategy />}
            {activeView === "pitch" && <PitchPreview parent={selected} />}
          </main>
        </div>

        {/* Architecture Model Section */}
        <div className="mt-16">
          <ArchitectureModel />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground font-[IBM_Plex_Mono]">
            Brand Architect v1.0 — Strategic Naming Tool
          </p>
          <p className="text-sm text-muted-foreground">
            Built with AI + Human Co-Creation
          </p>
        </div>
      </footer>
    </div>
  );
}
