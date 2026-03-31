import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, ShieldAlert, ShieldCheck, Plus, Zap, Eye } from 'lucide-react';
import clsx from 'clsx';
import { FRAUD_GRAPH_DATA, type GraphNode, type GraphEdge, type FraudGraphData } from '../data/simulationData';

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function FraudGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [graphData, setGraphData] = useState<FraudGraphData>(FRAUD_GRAPH_DATA);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [isAnimating, setIsAnimating] = useState(true);
  const [stats, setStats] = useState({ honest: 0, suspicious: 0, fraud: 0, clusters: 0 });
  const [injected, setInjected] = useState(false);
  const positionsRef = useRef<Map<string, NodePosition>>(new Map());

  // Initialize positions
  useEffect(() => {
    const newPositions = new Map<string, NodePosition>();
    graphData.nodes.forEach((node) => {
      if (!positionsRef.current.has(node.id)) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + Math.random() * 200;
        newPositions.set(node.id, {
          x: 400 + Math.cos(angle) * radius,
          y: 300 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        });
      } else {
        newPositions.set(node.id, positionsRef.current.get(node.id)!);
      }
    });
    positionsRef.current = newPositions;
    setPositions(new Map(newPositions));

    // Calc stats
    const honest = graphData.nodes.filter(n => n.type === 'honest').length;
    const suspicious = graphData.nodes.filter(n => n.type === 'suspicious').length;
    const fraud = graphData.nodes.filter(n => n.type === 'fraud_ring' || n.type === 'blocked').length;
    const clusters = new Set(graphData.nodes.filter(n => n.cluster).map(n => n.cluster)).size;
    setStats({ honest, suspicious, fraud, clusters });
  }, [graphData]);

  // Force simulation
  const simulate = useCallback(() => {
    const pos = positionsRef.current;
    const nodes = graphData.nodes;
    const edges = graphData.edges;
    const centerX = 400;
    const centerY = 300;

    nodes.forEach((node) => {
      const p = pos.get(node.id);
      if (!p) return;

      // Center gravity
      p.vx += (centerX - p.x) * 0.001;
      p.vy += (centerY - p.y) * 0.001;

      // Repulsion from all other nodes
      nodes.forEach((other) => {
        if (node.id === other.id) return;
        const op = pos.get(other.id);
        if (!op) return;
        const dx = p.x - op.x;
        const dy = p.y - op.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      });
    });

    // Attraction along edges
    edges.forEach((edge) => {
      const sp = pos.get(edge.source);
      const tp = pos.get(edge.target);
      if (!sp || !tp) return;
      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 80) * 0.005 * edge.strength;
      sp.vx += (dx / dist) * force;
      sp.vy += (dy / dist) * force;
      tp.vx -= (dx / dist) * force;
      tp.vy -= (dy / dist) * force;
    });

    // Apply velocity with damping
    nodes.forEach((node) => {
      const p = pos.get(node.id);
      if (!p) return;
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x += p.vx;
      p.y += p.vy;
      // Bounds
      p.x = Math.max(40, Math.min(760, p.x));
      p.y = Math.max(40, Math.min(560, p.y));
    });

    positionsRef.current = pos;
    setPositions(new Map(pos));
  }, [graphData]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      simulate();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isAnimating, simulate]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 800 * dpr;
    canvas.height = 600 * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, 800, 600);

    // Draw edges
    graphData.edges.forEach((edge) => {
      const sp = positions.get(edge.source);
      const tp = positions.get(edge.target);
      if (!sp || !tp) return;

      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      const isFraudEdge = sourceNode?.type === 'fraud_ring' || targetNode?.type === 'fraud_ring'
                       || sourceNode?.type === 'blocked' || targetNode?.type === 'blocked';

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tp.x, tp.y);
      ctx.strokeStyle = isFraudEdge
        ? `rgba(239, 68, 68, ${0.15 + edge.strength * 0.35})`
        : `rgba(255, 255, 255, ${0.03 + edge.strength * 0.07})`;
      ctx.lineWidth = isFraudEdge ? 1.5 : 0.5;
      ctx.stroke();
    });

    // Draw nodes
    graphData.nodes.forEach((node) => {
      const p = positions.get(node.id);
      if (!p) return;

      const isSelected = selectedNode?.id === node.id;
      const radius = isSelected ? 10 : node.type === 'fraud_ring' || node.type === 'blocked' ? 7 : node.type === 'suspicious' ? 6 : 5;

      // Glow
      if (node.type === 'fraud_ring' || node.type === 'blocked') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

      if (node.type === 'honest') {
        ctx.fillStyle = isSelected ? '#10a37f' : 'rgba(16, 163, 127, 0.6)';
      } else if (node.type === 'suspicious') {
        ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.7)';
      } else {
        ctx.fillStyle = isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.8)';
      }
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = isSelected ? 2 : 0.5;
      ctx.stroke();

      // Label for larger nodes
      if (isSelected || node.type === 'fraud_ring' || node.type === 'blocked') {
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(node.id, p.x, p.y - radius - 6);
      }
    });
  }, [positions, graphData, selectedNode]);

  // Click handler for canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = 800 / rect.width;
    const scaleY = 600 / rect.height;

    let closest: GraphNode | null = null;
    let closestDist = Infinity;

    graphData.nodes.forEach((node) => {
      const p = positions.get(node.id);
      if (!p) return;
      const dx = p.x - x * scaleX;
      const dy = p.y - y * scaleY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20 && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    });

    setSelectedNode(closest);
  };

  // Inject fraud ring
  const injectFraudRing = () => {
    if (injected) return;
    setInjected(true);

    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    // 8 new fraud nodes
    for (let i = 50; i < 58; i++) {
      newNodes.push({
        id: `X-${String(i).padStart(3, '0')}`,
        label: `Injected ${i}`,
        type: 'blocked',
        cluster: 99,
        fraudScore: 90 + Math.floor(Math.random() * 10),
      });
    }

    // Dense connections
    for (let i = 0; i < newNodes.length; i++) {
      for (let j = i + 1; j < newNodes.length; j++) {
        newEdges.push({
          source: newNodes[i].id,
          target: newNodes[j].id,
          type: 'shared_ip',
          strength: 0.9,
        });
      }
    }

    setGraphData(prev => ({
      nodes: [...prev.nodes, ...newNodes],
      edges: [...prev.edges, ...newEdges],
    }));
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-6 pt-6 md:pt-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pb-12"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3 text-white/90">
              <span className="w-8 h-8 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/40 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-[#a855f7]" />
              </span>
              Fraud Network Graph
            </h1>
            <p className="text-gray-400 font-medium">
              Live force-directed visualization of Wall 5 — Graph Network Analysis with Louvain community detection.
            </p>
          </div>
          <button
            onClick={injectFraudRing}
            disabled={injected}
            className={clsx(
              "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all",
              injected
                ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                : "bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/20 active:scale-95"
            )}
          >
            {injected ? (
              <>
                <ShieldAlert className="w-4 h-4" /> Ring Detected & Blocked
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Inject Fraud Ring
              </>
            )}
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Graph Canvas */}
          <div className="lg:col-span-9 glass-panel p-0 overflow-hidden relative">
            <div className="p-3 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#a855f7]" />
                Force-Directed Graph · {graphData.nodes.length} Nodes · {graphData.edges.length} Edges
              </span>
              <button
                onClick={() => setIsAnimating(!isAnimating)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono"
              >
                {isAnimating ? '⏸ Pause' : '▶ Resume'}
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full cursor-crosshair"
              style={{ aspectRatio: '800/600' }}
              onClick={handleCanvasClick}
            />
            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-gray-500 font-mono bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/5">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10a37f]" /> Honest</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Suspicious</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Fraud Ring</span>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {/* Stats */}
            <div className="glass-panel p-5">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 block">Network Stats</span>
              <div className="space-y-3">
                <StatRow label="Honest Riders" value={stats.honest} color="#10a37f" />
                <StatRow label="Suspicious" value={stats.suspicious} color="#f59e0b" />
                <StatRow label="Fraud Ring Members" value={stats.fraud} color="#ef4444" />
                <div className="h-px bg-white/5" />
                <StatRow label="Clusters Detected" value={stats.clusters} color="#a855f7" />
              </div>
            </div>

            {/* Selected Node Details */}
            <div className="glass-panel p-5 flex-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 block flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> Node Inspector
              </span>
              {selectedNode ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedNode.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        selectedNode.type === 'honest' && "bg-[#10a37f]/10 border border-[#10a37f]/30",
                        selectedNode.type === 'suspicious' && "bg-[#f59e0b]/10 border border-[#f59e0b]/30",
                        (selectedNode.type === 'fraud_ring' || selectedNode.type === 'blocked') && "bg-[#ef4444]/10 border border-[#ef4444]/30",
                      )}>
                        {selectedNode.type === 'honest' ? <ShieldCheck className="w-4 h-4 text-[#10a37f]" /> : <ShieldAlert className="w-4 h-4 text-[#ef4444]" />}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{selectedNode.id}</p>
                        <p className={clsx(
                          "text-[10px] uppercase font-semibold tracking-wider",
                          selectedNode.type === 'honest' ? "text-[#10a37f]" : selectedNode.type === 'suspicious' ? "text-[#f59e0b]" : "text-[#ef4444]"
                        )}>
                          {selectedNode.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fraud Score</span>
                        <span className={clsx(
                          "font-mono font-bold",
                          selectedNode.fraudScore < 30 ? "text-[#10a37f]" : selectedNode.fraudScore < 60 ? "text-[#f59e0b]" : "text-[#ef4444]"
                        )}>
                          {selectedNode.fraudScore}/100
                        </span>
                      </div>
                      {selectedNode.cluster && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cluster ID</span>
                          <span className="text-[#ef4444] font-mono font-bold">#{selectedNode.cluster}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Connections</span>
                        <span className="text-white font-mono">
                          {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                        </span>
                      </div>
                    </div>
                    {/* Fraud score bar */}
                    <div className="w-full bg-[#27272a] rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNode.fraudScore}%` }}
                        className={clsx(
                          "h-full rounded-full",
                          selectedNode.fraudScore < 30 ? "bg-[#10a37f]" : selectedNode.fraudScore < 60 ? "bg-[#f59e0b]" : "bg-[#ef4444]"
                        )}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <p className="text-xs text-gray-600 italic">Click a node to inspect</p>
              )}
            </div>

            {injected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-4 bg-[#ef4444]/5 border-[#ef4444]/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
                  <span className="text-xs font-semibold text-[#ef4444]">RING INJECTED & DETECTED</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  8 fake accounts injected. Louvain algorithm identified Cluster #99 in real-time. 
                  All 8 nodes auto-blocked. 28 edges flagged as shared-IP connections.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="font-mono font-bold text-sm" style={{ color }}>{value}</span>
    </div>
  );
}
