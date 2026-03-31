import { cn } from "@/lib/utils";

interface TerminalCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function TerminalCard({ title, children, className, headerAction }: TerminalCardProps) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card overflow-hidden shadow-lg relative group",
      className
    )}>
      {/* Glitch Effect Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none z-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
          </div>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>

      {/* Content */}
      <div className="p-5 relative z-10">
        {children}
      </div>
    </div>
  );
}
