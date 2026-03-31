import { Link, useLocation } from "wouter";
import { Terminal, Activity, FileText, Settings, Shield, Play, Database, Github } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Activity, label: "DASHBOARD" },
    { href: "/launch", icon: Play, label: "LAUNCH_RUN" },
    { href: "/spec", icon: FileText, label: "BUSINESS_SPEC" },
    { href: "/logs", icon: Database, label: "SYSTEM_LOGS" },
    { href: "/permissions", icon: Shield, label: "ACCESS_CONTROL" },
    { href: "/connectors", icon: Settings, label: "CONNECTORS" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-border bg-card/30 backdrop-blur-sm flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-lg tracking-tight leading-none">
                FOUNDER
              </h1>
              <span className="font-mono text-primary text-sm tracking-wider">
                _AUTOPILOT
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-mono text-muted-foreground mb-4 px-2">
            // NAVIGATION_MODULE
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 font-mono text-sm group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_var(--primary)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}>
                  <item.icon className={cn("w-4 h-4", isActive && "animate-pulse")} />
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_var(--primary)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-green-500">SYSTEM ONLINE</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>CPU_LOAD</span>
                <span>12%</span>
              </div>
              <div className="flex justify-between">
                <span>MEMORY</span>
                <span>1.4GB</span>
              </div>
              <div className="w-full bg-muted h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-primary h-full w-[12%]" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-screen relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <span>root@founder-autopilot</span>
            <span className="text-border">/</span>
            <span className="text-foreground">{location === "/" ? "dashboard" : location.slice(1)}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/Gnoscenti/founder-autopilot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
