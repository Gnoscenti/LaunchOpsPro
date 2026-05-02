/**
 * DashboardLayout — Atlas Orchestrator Shell
 * The Forge Design: persistent sidebar + main content area
 * Dark graphite with molten gold navigation accents
 */
import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  GitBranch,
  Network,
  Workflow,
  FileText,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Bot,
  Settings,
  Palette,
  ChevronLeft,
  ChevronRight,
  Zap,
  Crown,
  Target,
  Trophy,
  Film,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  section?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} />, section: "Command" },
  { label: "Launch Pipeline", href: "/pipeline", icon: <GitBranch size={18} />, section: "Command" },
  { label: "Workflow Editor", href: "/editor", icon: <Workflow size={18} />, section: "Atlas" },
  { label: "Execution Log", href: "/orchestrator", icon: <Network size={18} />, section: "Atlas" },
  { label: "Pilot Scope", href: "/pilot", icon: <FileText size={18} />, section: "Atlas" },
  { label: "Runbook", href: "/runbook", icon: <BookOpen size={18} />, section: "Atlas" },
  { label: "Metrics", href: "/metrics", icon: <BarChart3 size={18} />, section: "Intelligence" },
  { label: "Trust Score", href: "/trust", icon: <ShieldCheck size={18} />, section: "Intelligence" },
  { label: "Agents", href: "/agents", icon: <Bot size={18} />, section: "Intelligence" },
  { label: "Configuration", href: "/config", icon: <Settings size={18} />, section: "System" },
  { label: "Brand Architect", href: "/brand", icon: <Palette size={18} />, section: "System" },
  { label: "Founder Score", href: "/founder-score", icon: <Target size={18} />, section: "Intelligence" },
  { label: "Naming Contest", href: "/contests", icon: <Trophy size={18} />, section: "System" },
  { label: "Documentary", href: "/documentary", icon: <Film size={18} />, section: "System" },
  { label: "Pricing", href: "/pricing", icon: <Crown size={18} />, section: "System" },
  { label: "Payments", href: "/payments", icon: <Receipt size={18} />, section: "System" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const sections = ["Command", "Atlas", "Intelligence", "System"];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-[oklch(0.13_0.005_250)] transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded bg-[oklch(0.75_0.15_85)] flex items-center justify-center shrink-0">
            <Zap size={16} className="text-[oklch(0.12_0.005_250)]" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-semibold font-[Sora] text-[oklch(0.75_0.15_85)] tracking-wide truncate">
                ATLAS
              </h1>
              <p className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] truncate">
                Orchestrator v2.1
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {sections.map((section) => (
            <div key={section} className="mb-4">
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-[IBM_Plex_Mono] uppercase tracking-widest text-muted-foreground">
                  {section}
                </p>
              )}
              {navItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-sm mb-0.5 transition-all duration-200 group",
                          isActive
                            ? "bg-[oklch(0.75_0.15_85_/_10%)] text-[oklch(0.75_0.15_85)] border-l-2 border-[oklch(0.75_0.15_85)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-[oklch(0.20_0.005_250)]",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <span className={cn("shrink-0", isActive && "text-[oklch(0.75_0.15_85)]")}>
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="text-sm font-medium truncate">{item.label}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-2 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-[oklch(0.20_0.005_250)]"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
