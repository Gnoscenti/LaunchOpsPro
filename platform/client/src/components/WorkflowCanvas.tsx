/**
 * WorkflowCanvas — Drag-and-Drop Visual Workflow Editor
 * 
 * Atlas Orchestrator "The Forge" Design
 * Canvas-based node editor with proof-of-agent verification layer.
 * Nodes are draggable, connectable, and configurable.
 * Each node shows its proof status (pending → verified → failed).
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  GripVertical, Plus, Trash2, Settings, Play, Pause,
  CheckCircle2, AlertTriangle, Clock, Lock, Link2,
  Zap, Shield, ChevronDown, X, Save, Download,
  RotateCcw, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { agents as allAgents, type WorkflowStep, type StepStatus } from "@/lib/atlasData";

// ─── Types ──────────────────────────────────────────────────────────

interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  step: WorkflowStep;
  proofStatus: "unverified" | "pending" | "verified" | "failed";
  proofHash?: string;
}

interface CanvasConnection {
  from: string;
  to: string;
}

interface DragState {
  nodeId: string | null;
  offsetX: number;
  offsetY: number;
}

interface ConnectState {
  fromId: string | null;
}

interface Props {
  initialSteps?: WorkflowStep[];
  workflowName?: string;
  onSave?: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
}

// ─── Proof Status Colors ────────────────────────────────────────────

const proofColors: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  unverified: { bg: "bg-[oklch(0.20_0.005_250)]", border: "border-[oklch(0.30_0.005_250)]", icon: "text-muted-foreground", label: "Unverified" },
  pending: { bg: "bg-[oklch(0.20_0.04_85)]", border: "border-[oklch(0.45_0.12_85)]", icon: "text-[oklch(0.75_0.15_85)]", label: "Proving..." },
  verified: { bg: "bg-[oklch(0.18_0.04_160)]", border: "border-[oklch(0.50_0.15_160)]", icon: "text-[oklch(0.70_0.18_160)]", label: "Verified" },
  failed: { bg: "bg-[oklch(0.20_0.05_25)]", border: "border-[oklch(0.50_0.18_25)]", icon: "text-[oklch(0.65_0.20_25)]", label: "Failed" },
};

const statusColors: Record<StepStatus, string> = {
  complete: "oklch(0.70_0.18_160)",
  active: "oklch(0.75_0.15_85)",
  pending: "oklch(0.40_0.005_250)",
  failed: "oklch(0.65_0.20_25)",
  skipped: "oklch(0.35_0.005_250)",
};

// ─── Helper: Layout nodes in a DAG ─────────────────────────────────

function layoutNodes(steps: WorkflowStep[]): CanvasNode[] {
  const nodeWidth = 280;
  const nodeHeight = 120;
  const gapX = 60;
  const gapY = 40;

  // Topological sort to determine layers
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const layers: string[][] = [];
  const placed = new Set<string>();

  // BFS layer assignment
  while (placed.size < steps.length) {
    const layer: string[] = [];
    for (const step of steps) {
      if (placed.has(step.id)) continue;
      const depsReady = step.dependsOn.every(d => placed.has(d));
      if (depsReady) layer.push(step.id);
    }
    if (layer.length === 0) {
      // Circular dependency fallback — place remaining
      for (const step of steps) {
        if (!placed.has(step.id)) layer.push(step.id);
      }
    }
    layer.forEach(id => placed.add(id));
    layers.push(layer);
  }

  const nodes: CanvasNode[] = [];
  layers.forEach((layer, layerIdx) => {
    const layerWidth = layer.length * (nodeWidth + gapX) - gapX;
    const startX = 80;
    layer.forEach((stepId, nodeIdx) => {
      const step = stepMap.get(stepId)!;
      nodes.push({
        id: step.id,
        x: startX + nodeIdx * (nodeWidth + gapX),
        y: 80 + layerIdx * (nodeHeight + gapY),
        width: nodeWidth,
        height: nodeHeight,
        step,
        proofStatus: step.status === "complete" ? "verified" : "unverified",
        proofHash: step.status === "complete" ? `0x${Math.random().toString(16).slice(2, 10)}` : undefined,
      });
    });
  });

  return nodes;
}

function buildConnections(steps: WorkflowStep[]): CanvasConnection[] {
  const conns: CanvasConnection[] = [];
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      conns.push({ from: dep, to: step.id });
    }
  }
  return conns;
}

// ─── Agent Palette Item ─────────────────────────────────────────────

function AgentPaletteItem({ agent, onDragStart }: { agent: typeof allAgents[0]; onDragStart: (agentId: string) => void }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(agent.id)}
      className="flex items-center gap-2 px-3 py-2 rounded-sm bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] cursor-grab active:cursor-grabbing hover:border-[oklch(0.45_0.12_85)] transition-colors group"
    >
      <GripVertical size={12} className="text-muted-foreground group-hover:text-[oklch(0.75_0.15_85)]" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{agent.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{agent.category}</p>
      </div>
      {agent.epiScore && (
        <span className="text-[9px] font-mono text-[oklch(0.60_0.18_160)]">{agent.epiScore}</span>
      )}
    </div>
  );
}

// ─── Node Component ─────────────────────────────────────────────────

function WorkflowNode({
  node,
  isSelected,
  isConnecting,
  onMouseDown,
  onSelect,
  onDelete,
  onConnectStart,
  onConnectEnd,
}: {
  node: CanvasNode;
  isSelected: boolean;
  isConnecting: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onDelete: () => void;
  onConnectStart: () => void;
  onConnectEnd: () => void;
}) {
  const proof = proofColors[node.proofStatus];
  const agent = allAgents.find(a => a.id === node.step.agent);
  const statusColor = statusColors[node.step.status];

  return (
    <div
      className={cn(
        "absolute rounded-sm border-2 transition-shadow duration-200 select-none",
        proof.bg,
        isSelected ? "border-[oklch(0.75_0.15_85)] shadow-[0_0_20px_oklch(0.75_0.15_85_/_20%)]" : proof.border,
        "hover:shadow-[0_0_12px_oklch(0.75_0.15_85_/_10%)]"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
        onMouseDown(e);
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[oklch(0.25_0.005_250)]">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        <span className="text-xs font-semibold text-foreground truncate flex-1 font-[Sora]">
          {node.step.name}
        </span>
        <div className={cn("flex items-center gap-1", proof.icon)}>
          {node.proofStatus === "verified" && <CheckCircle2 size={12} />}
          {node.proofStatus === "pending" && <Clock size={12} className="animate-spin" />}
          {node.proofStatus === "failed" && <AlertTriangle size={12} />}
          {node.proofStatus === "unverified" && <Lock size={12} />}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-1.5">
        <p className="text-[10px] text-muted-foreground line-clamp-2">{node.step.description}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] font-mono text-[oklch(0.55_0.12_85)]">
            {agent?.name || node.step.agent}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {node.step.timeout}s
          </span>
        </div>
        {node.proofHash && (
          <div className="flex items-center gap-1 mt-1">
            <Shield size={8} className="text-[oklch(0.60_0.18_160)]" />
            <span className="text-[8px] font-mono text-[oklch(0.60_0.18_160)]">{node.proofHash}</span>
          </div>
        )}
      </div>

      {/* Connection ports */}
      {/* Input port (top center) */}
      <div
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 cursor-pointer transition-all",
          isConnecting
            ? "bg-[oklch(0.75_0.15_85)] border-[oklch(0.75_0.15_85)] scale-125"
            : "bg-[oklch(0.20_0.005_250)] border-[oklch(0.40_0.005_250)] hover:border-[oklch(0.75_0.15_85)]"
        )}
        onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(); }}
      />

      {/* Output port (bottom center) */}
      <div
        className={cn(
          "absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 cursor-pointer transition-all",
          "bg-[oklch(0.20_0.005_250)] border-[oklch(0.40_0.005_250)] hover:border-[oklch(0.75_0.15_85)] hover:bg-[oklch(0.75_0.15_85)]"
        )}
        onMouseDown={(e) => { e.stopPropagation(); onConnectStart(); }}
      />

      {/* Delete button (top right, only when selected) */}
      {isSelected && (
        <button
          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[oklch(0.50_0.18_25)] flex items-center justify-center hover:bg-[oklch(0.60_0.20_25)] transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X size={10} className="text-white" />
        </button>
      )}
    </div>
  );
}

// ─── SVG Connection Line ────────────────────────────────────────────

function ConnectionLine({
  from,
  to,
  nodes,
}: {
  from: string;
  to: string;
  nodes: CanvasNode[];
}) {
  const fromNode = nodes.find(n => n.id === from);
  const toNode = nodes.find(n => n.id === to);
  if (!fromNode || !toNode) return null;

  const x1 = fromNode.x + fromNode.width / 2;
  const y1 = fromNode.y + fromNode.height;
  const x2 = toNode.x + toNode.width / 2;
  const y2 = toNode.y;

  const midY = (y1 + y2) / 2;

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
        stroke="oklch(0.40 0.005 250)"
        strokeWidth="2"
        fill="none"
        strokeDasharray="6 3"
      />
      {/* Arrow head */}
      <polygon
        points={`${x2 - 4},${y2 - 6} ${x2 + 4},${y2 - 6} ${x2},${y2}`}
        fill="oklch(0.40 0.005 250)"
      />
    </g>
  );
}

// ─── Node Config Panel ──────────────────────────────────────────────

function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: CanvasNode;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(node.step.name);
  const [description, setDescription] = useState(node.step.description);
  const [agentId, setAgentId] = useState(node.step.agent);
  const [timeout, setTimeout_] = useState(String(node.step.timeout));
  const [maxRetries, setMaxRetries] = useState(String(node.step.maxRetries));

  const proof = proofColors[node.proofStatus];

  return (
    <div className="absolute right-0 top-0 w-80 h-full bg-[oklch(0.13_0.005_250)] border-l border-border overflow-y-auto z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-[oklch(0.75_0.15_85)]" />
          <span className="text-sm font-semibold font-[Sora] text-foreground">Node Config</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Proof Status */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-sm border", proof.bg, proof.border)}>
          <div className={proof.icon}>
            {node.proofStatus === "verified" && <CheckCircle2 size={14} />}
            {node.proofStatus === "pending" && <Clock size={14} />}
            {node.proofStatus === "failed" && <AlertTriangle size={14} />}
            {node.proofStatus === "unverified" && <Lock size={14} />}
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{proof.label}</p>
            {node.proofHash && (
              <p className="text-[9px] font-mono text-muted-foreground">{node.proofHash}</p>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Step Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onUpdate({ name })}
            className="w-full bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] rounded-sm px-3 py-2 text-sm text-foreground focus:border-[oklch(0.75_0.15_85)] focus:outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onUpdate({ description })}
            rows={3}
            className="w-full bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] rounded-sm px-3 py-2 text-sm text-foreground focus:border-[oklch(0.75_0.15_85)] focus:outline-none resize-none"
          />
        </div>

        {/* Agent */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Agent</label>
          <select
            value={agentId}
            onChange={(e) => { setAgentId(e.target.value); onUpdate({ agent: e.target.value }); }}
            className="w-full bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] rounded-sm px-3 py-2 text-sm text-foreground focus:border-[oklch(0.75_0.15_85)] focus:outline-none"
          >
            {allAgents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Timeout + Retries */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Timeout (s)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout_(e.target.value)}
              onBlur={() => onUpdate({ timeout: Number(timeout) })}
              className="w-full bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] rounded-sm px-3 py-2 text-sm text-foreground focus:border-[oklch(0.75_0.15_85)] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Max Retries</label>
            <input
              type="number"
              value={maxRetries}
              onChange={(e) => setMaxRetries(e.target.value)}
              onBlur={() => onUpdate({ maxRetries: Number(maxRetries) })}
              className="w-full bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] rounded-sm px-3 py-2 text-sm text-foreground focus:border-[oklch(0.75_0.15_85)] focus:outline-none"
            />
          </div>
        </div>

        {/* Dependencies */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Dependencies</label>
          <div className="flex flex-wrap gap-1">
            {node.step.dependsOn.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic">No dependencies (root node)</span>
            ) : (
              node.step.dependsOn.map(dep => (
                <span key={dep} className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[oklch(0.20_0.005_250)] text-muted-foreground border border-[oklch(0.25_0.005_250)]">
                  {dep}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Canvas Component ──────────────────────────────────────────

export default function WorkflowCanvas({ initialSteps, workflowName = "New Workflow", onSave, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const [connectState, setConnectState] = useState<ConnectState>({ fromId: null });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showPalette, setShowPalette] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [draggingAgent, setDraggingAgent] = useState<string | null>(null);

  // Initialize from props
  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setNodes(layoutNodes(initialSteps));
      setConnections(buildConnections(initialSteps));
    }
  }, []);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  // ─── Drag Handling ──────────────────────────────────────────────

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragState({
      nodeId,
      offsetX: e.clientX - node.x,
      offsetY: e.clientY - node.y,
    });
  }, [nodes, readOnly]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState.nodeId) {
      setNodes(prev => prev.map(n =>
        n.id === dragState.nodeId
          ? { ...n, x: (e.clientX - dragState.offsetX) / zoom, y: (e.clientY - dragState.offsetY) / zoom }
          : n
      ));
    }
  }, [dragState, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragState({ nodeId: null, offsetX: 0, offsetY: 0 });
    if (connectState.fromId) {
      setConnectState({ fromId: null });
    }
  }, [connectState]);

  // ─── Connection Handling ────────────────────────────────────────

  const handleConnectStart = useCallback((nodeId: string) => {
    if (readOnly) return;
    setConnectState({ fromId: nodeId });
  }, [readOnly]);

  const handleConnectEnd = useCallback((nodeId: string) => {
    if (connectState.fromId && connectState.fromId !== nodeId) {
      const exists = connections.some(c => c.from === connectState.fromId && c.to === nodeId);
      if (!exists) {
        setConnections(prev => [...prev, { from: connectState.fromId!, to: nodeId }]);
        // Update step dependencies
        setNodes(prev => prev.map(n =>
          n.id === nodeId
            ? { ...n, step: { ...n.step, dependsOn: [...n.step.dependsOn, connectState.fromId!] } }
            : n
        ));
      }
    }
    setConnectState({ fromId: null });
  }, [connectState, connections]);

  // ─── Node Operations ────────────────────────────────────────────

  const addNode = useCallback((agentId: string, x?: number, y?: number) => {
    const agent = allAgents.find(a => a.id === agentId);
    if (!agent) return;

    const newId = `s${Date.now()}`;
    const newNode: CanvasNode = {
      id: newId,
      x: x || 100 + Math.random() * 200,
      y: y || 100 + nodes.length * 160,
      width: 280,
      height: 120,
      step: {
        id: newId,
        name: `New ${agent.name} Step`,
        description: agent.description,
        agent: agentId,
        dependsOn: [],
        status: "pending",
        retries: 0,
        maxRetries: 2,
        timeout: 300,
      },
      proofStatus: "unverified",
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newId);
  }, [nodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setShowConfig(false);
    }
  }, [selectedNodeId]);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowStep>) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, step: { ...n.step, ...updates } } : n
    ));
  }, []);

  // ─── Canvas Drop ────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggingAgent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        addNode(draggingAgent, (e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom);
      }
      setDraggingAgent(null);
    }
  }, [draggingAgent, zoom, addNode]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ─── Export ─────────────────────────────────────────────────────

  const exportWorkflow = useCallback(() => {
    const steps = nodes.map(n => n.step);
    const json = JSON.stringify({ name: workflowName, steps, connections }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, connections, workflowName]);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex h-full relative overflow-hidden bg-[oklch(0.10_0.005_250)]">
      {/* Agent Palette (Left) */}
      {showPalette && !readOnly && (
        <div className="w-56 shrink-0 border-r border-border bg-[oklch(0.12_0.005_250)] flex flex-col z-20">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Agent Palette</span>
            <button onClick={() => setShowPalette(false)} className="text-muted-foreground hover:text-foreground">
              <ChevronDown size={12} className="rotate-90" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {allAgents.map(agent => (
              <AgentPaletteItem
                key={agent.id}
                agent={agent}
                onDragStart={(id) => setDraggingAgent(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {!showPalette && !readOnly && (
              <button
                onClick={() => setShowPalette(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] text-xs text-foreground hover:border-[oklch(0.45_0.12_85)] transition-colors"
              >
                <Plus size={12} /> Agents
              </button>
            )}
            <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)]">
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1 text-muted-foreground hover:text-foreground">
                <ZoomOut size={12} />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 text-muted-foreground hover:text-foreground">
                <ZoomIn size={12} />
              </button>
              <button onClick={() => setZoom(1)} className="p-1 text-muted-foreground hover:text-foreground">
                <Maximize2 size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-sm bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)]">
              <span className="text-[10px] font-mono text-muted-foreground">{nodes.length} nodes</span>
              <span className="text-[10px] font-mono text-muted-foreground">{connections.length} edges</span>
            </div>
            {!readOnly && (
              <>
                <button
                  onClick={exportWorkflow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[oklch(0.16_0.005_250)] border border-[oklch(0.25_0.005_250)] text-xs text-foreground hover:border-[oklch(0.45_0.12_85)] transition-colors"
                >
                  <Download size={12} /> Export
                </button>
                <button
                  onClick={() => onSave?.(nodes.map(n => n.step))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[oklch(0.75_0.15_85)] text-[oklch(0.12_0.005_250)] text-xs font-semibold hover:bg-[oklch(0.80_0.15_85)] transition-colors"
                >
                  <Save size={12} /> Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* SVG Layer (connections) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.18 0.005 250)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {connections.map((conn, i) => (
            <ConnectionLine key={`${conn.from}-${conn.to}-${i}`} from={conn.from} to={conn.to} nodes={nodes} />
          ))}
        </svg>

        {/* Node Layer */}
        <div
          ref={canvasRef}
          className="absolute inset-0 overflow-auto z-20"
          style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => { setSelectedNodeId(null); setShowConfig(false); }}
        >
          {/* Canvas minimum size for scrolling */}
          <div style={{ minWidth: 2000, minHeight: 2000, position: "relative" }}>
            {nodes.map(node => (
              <WorkflowNode
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isConnecting={connectState.fromId !== null}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                onSelect={() => { setSelectedNodeId(node.id); setShowConfig(true); }}
                onDelete={() => deleteNode(node.id)}
                onConnectStart={() => handleConnectStart(node.id)}
                onConnectEnd={() => handleConnectEnd(node.id)}
              />
            ))}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Zap size={48} className="mx-auto mb-4 text-[oklch(0.30_0.005_250)]" />
                  <p className="text-sm text-muted-foreground mb-2">Drag agents from the palette to build a workflow</p>
                  <p className="text-[10px] text-muted-foreground">Connect nodes by dragging from output port to input port</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proof Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-4 px-3 py-2 rounded-sm bg-[oklch(0.13_0.005_250_/_90%)] border border-[oklch(0.25_0.005_250)] z-30 backdrop-blur-sm">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Proof Status</span>
          {Object.entries(proofColors).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", val.bg, "border", val.border)} />
              <span className="text-[9px] text-muted-foreground">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Config Panel (Right) */}
      {showConfig && selectedNode && !readOnly && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={(updates) => updateNode(selectedNode.id, updates)}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
