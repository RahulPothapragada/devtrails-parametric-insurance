import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, Activity, Info, Map as MapIcon, Layers, Radio,
  Crosshair, ChevronRight, AlertCircle, Zap, CheckCircle2, Clock,
  Users, GitBranch, MapPin, Wifi, Smartphone, AlertTriangle, RotateCcw, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type Scenario, type SimEvent } from '../data/simulationData';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Map
const riderIcon = (color: string, isAttack: boolean = false) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="position: relative; background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}88;">
    ${isAttack ? '<div style="position: absolute; top: -16px; left: 6px; font-size: 16px; z-index: 100; filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.8));">⚠️</div>' : ''}
  </div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const towerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; transform: rotate(45deg); border: 1.5px solid white;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const CITIES = [
  { id: 'Mumbai', name: 'Mumbai', lat: 19.12, lng: 72.86, tier: 'Tier 1' },
  { id: 'Delhi', name: 'Delhi', lat: 28.6139, lng: 77.209, tier: 'Tier 1' },
  { id: 'Bangalore', name: 'Bangalore', lat: 12.9716, lng: 77.5946, tier: 'Tier 1' },
  { id: 'Chennai', name: 'Chennai', lat: 13.0827, lng: 80.2707, tier: 'Tier 1' },
  { id: 'Kolkata', name: 'Kolkata', lat: 22.5726, lng: 88.3639, tier: 'Tier 1' },
  { id: 'Pune', name: 'Pune', lat: 18.5204, lng: 73.8567, tier: 'Tier 2' },
  { id: 'Hyderabad', name: 'Hyderabad', lat: 17.385, lng: 78.4867, tier: 'Tier 2' },
  { id: 'Ahmedabad', name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, tier: 'Tier 2' },
  { id: 'Jaipur', name: 'Jaipur', lat: 26.9124, lng: 75.7873, tier: 'Tier 2' },
  { id: 'Lucknow', name: 'Lucknow', lat: 26.8467, lng: 80.9462, tier: 'Tier 3' },
  { id: 'Indore', name: 'Indore', lat: 22.7196, lng: 75.8577, tier: 'Tier 3' },
  { id: 'Patna', name: 'Patna', lat: 25.6093, lng: 85.1376, tier: 'Tier 3' },
  { id: 'Bhopal', name: 'Bhopal', lat: 23.2599, lng: 77.4126, tier: 'Tier 3' },
];


// ── Pre-seeded nodes — map renders instantly, API refreshes in background ──
function makeSeed(city: typeof CITIES[0]) {
  const tower = { id: `T-${city.id}`, name: `${city.name} Central Hub`, type: 'tower', lat: city.lat, lng: city.lng };
  const statuses = ['normal','normal','normal','normal','spoofing','attack'];
  const verdicts: Record<string,string> = {
    normal: 'Nominal Signal Pattern',
    spoofing: 'High Risk Location Mismatch',
    attack: 'CRITICAL: Shared Device Array (Emulation)',
  };
  const offsets = [
    [-0.008,0.01],[0.012,-0.005],[0.005,0.015],[-0.015,0.003],[0.009,-0.012],
    [-0.003,0.018],[0.018,0.002],[-0.012,-0.009],[0.007,0.007],[-0.007,-0.015],
    [0.014,0.011],[-0.011,0.013],[0.003,-0.018],[0.016,-0.007],[-0.009,0.005],
    [0.001,0.019],[-0.017,0.001],[0.011,-0.014],[-0.004,0.012],[0.019,0.004],
  ];
  const riders = offsets.map((off, i) => {
    const st = statuses[i % statuses.length];
    return {
      id: `R-seed-${city.id}-${i}`,
      name: `Rider ${i+1}`,
      type: 'rider',
      lat: city.lat + off[0],
      lng: city.lng + off[1],
      status: st,
      risk: st === 'attack' ? 'extreme' : st === 'spoofing' ? 'high' : 'low',
      fraud_score: st === 'attack' ? 95 : st === 'spoofing' ? 72 : 12,
      verdict: verdicts[st],
    };
  });
  return [tower, ...riders];
}

// ── Pipeline phases ──────────────────────────────────────────
const PIPELINE_PHASES = [
  { key: 'detecting', label: 'Detecting Disruption', icon: <Zap className="w-3.5 h-3.5" />,        pct: 22  },
  { key: 'consensus', label: 'Source Consensus',     icon: <Radio className="w-3.5 h-3.5" />,       pct: 48  },
  { key: 'defense',   label: '9-Wall Defense',       icon: <ShieldAlert className="w-3.5 h-3.5" />, pct: 80  },
  { key: 'payout',    label: 'Executing Payouts',    icon: <CheckCircle2 className="w-3.5 h-3.5" />, pct: 100 },
];

const phaseConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  trigger:    { icon: <Zap className="w-4 h-4" />,        color: '#ef4444', label: 'TRIGGER'  },
  consensus:  { icon: <Radio className="w-4 h-4" />,      color: '#3b82f6', label: 'VERIFY'   },
  claims:     { icon: <Users className="w-4 h-4" />,      color: '#f59e0b', label: 'CLAIMS'   },
  fraud_wall: { icon: <ShieldAlert className="w-4 h-4" />,color: '#8b5cf6', label: 'DEFENSE'  },
  result:     { icon: <Eye className="w-4 h-4" />,        color: '#10a37f', label: 'VERDICT'  },
  payout:     { icon: <CheckCircle2 className="w-4 h-4" />,color: '#10a37f', label: 'PAYOUT'  },
};

const wallIcons: Record<number, React.ReactNode> = {
  1: <Activity className="w-3.5 h-3.5" />,
  2: <Smartphone className="w-3.5 h-3.5" />,
  3: <Wifi className="w-3.5 h-3.5" />,
  4: <Users className="w-3.5 h-3.5" />,
  5: <GitBranch className="w-3.5 h-3.5" />,
  6: <Clock className="w-3.5 h-3.5" />,
  7: <MapPin className="w-3.5 h-3.5" />,
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  useEffect(() => { map.flyTo(center, 13, { duration: 2.5, easeLinearity: 0.25 }); }, [center, map]);
  return null;
}

export default function FraudGraphPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const incomingScenario: Scenario | null = location.state?.scenario ?? null;

  const [activeCity, setActiveCity] = useState(() =>
    incomingScenario ? CITIES.find(c => c.id === incomingScenario.cityId) ?? CITIES[0] : CITIES[0]
  );
  const [nodes, setNodes]               = useState<any[]>(() => makeSeed(activeCity));
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [mapStyle, setMapStyle]         = useState<'dark' | 'satellite'>('dark');
  const [showRadius, setShowRadius]     = useState(true);
  const [loading, setLoading]           = useState(false);

  // ── Simulation state ──────────────────────────────────────
  const [scenario, setScenario]         = useState<Scenario | null>(incomingScenario);
  const [simProgress, setSimProgress]   = useState(0);
  const [simRunning, setSimRunning]     = useState(!!incomingScenario);
  const [simComplete, setSimComplete]   = useState(false);
  const [simEvents, setSimEvents]       = useState<SimEvent[]>([]);
  const [wallStatuses, setWallStatuses] = useState<Record<number,'idle'|'scanning'|'pass'|'fail'>>({});
  const evtEndRef      = useRef<HTMLDivElement>(null);
  const evtIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    evtEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simEvents]);

  // Run simulation pipeline whenever a scenario is set
  useEffect(() => {
    if (!scenario) return;
    setSimRunning(true); setSimComplete(false);
    setSimProgress(0);   setSimEvents([]);
    setWallStatuses({ 1:'idle',2:'idle',3:'idle',4:'idle',5:'idle',6:'idle',7:'idle' });

    let idx = 0;
    evtIntervalRef.current = setInterval(() => {
      if (idx < scenario.events.length) {
        const evt = scenario.events[idx];
        setSimEvents(prev => prev.some(e => e.id === evt.id) ? prev : [...prev, evt]);
        if (evt.phase === 'fraud_wall' && evt.wallNumber) {
          const wn = evt.wallNumber;
          setWallStatuses(prev => ({ ...prev, [wn]: 'scanning' }));
          setTimeout(() => setWallStatuses(prev => ({ ...prev, [wn]: evt.status === 'success' ? 'pass' : 'fail' })), 600);
        }
        idx++;
      } else clearInterval(evtIntervalRef.current!);
    }, 1200);

    progIntervalRef.current = setInterval(() => {
      setSimProgress(p => {
        if (p >= 100) {
          clearInterval(progIntervalRef.current!);
          setSimRunning(false); setSimComplete(true);
          setTimeout(() => navigate('/payouts'), 2200);
          return 100;
        }
        return p + 2;
      });
    }, 50);

    return () => {
      clearInterval(evtIntervalRef.current!);
      clearInterval(progIntervalRef.current!);
    };
  }, [scenario?.id]);

  const resetSim = () => {
    clearInterval(evtIntervalRef.current!);
    clearInterval(progIntervalRef.current!);
    setScenario(null); setSimRunning(false); setSimComplete(false);
    setSimProgress(0); setSimEvents([]); setWallStatuses({});
    navigate('/simulate');
  };

  // ── Regular map fetch ─────────────────────────────────────
  useEffect(() => {
    setNodes(makeSeed(activeCity));
    setSelectedNode(null);
    async function fetchLiveNetwork() {
      setLoading(true);
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/admin/maps/network?city_name=${activeCity.id}`);
        if (!response.ok) throw new Error('Network Database Offline');
        const payload = await response.json();
        const baseTower = { id: `T-${activeCity.id}`, name: `${activeCity.name} Central Hub`, type: 'tower', lat: payload.city_center[0], lng: payload.city_center[1] };
        setNodes([baseTower, ...payload.nodes]);
      } catch (err) {
        console.error('Failed to sync fast mapping:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveNetwork();
  }, [activeCity]);


  const dashboardStats = useMemo(() => {
    const riderNodes = nodes.filter(n => n.type === 'rider');
    const spoofing = riderNodes.filter(n => n.status === 'spoofing').length;
    const attacks = riderNodes.filter(n => n.status === 'attack').length;
    const anomalous = spoofing + attacks;
    const anomalyPct = riderNodes.length > 0 ? Math.round(anomalous / riderNodes.length * 100) : 0;
    return {
      activeNodes: riderNodes.length,
      threatLevel: attacks > 0 ? 'CRITICAL' : spoofing > 0 ? 'WARNING' : 'SECURE',
      totalSpoofing: anomalous,
      anomalyPct,
    };
  }, [nodes]);

  // Current pipeline phase label
  const currentPhase = PIPELINE_PHASES.find(ph => simProgress < ph.pct) ?? PIPELINE_PHASES[3];

  return (
    <div className={cn("flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden", scenario && "border-t-2", scenario?.weatherType === 'rain' && 'border-blue-500/50', scenario?.weatherType === 'heatwave' && 'border-orange-500/50', scenario?.weatherType === 'bandh' && 'border-red-500/50', scenario?.weatherType === 'attack' && 'border-red-700/50')}>

      {/* ── Simulation top header bar (only when scenario active) ── */}
      <AnimatePresence>
        {scenario && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 border-b bg-card z-20"
          >
            <div className="flex items-center justify-between px-4 py-2.5 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{scenario.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{scenario.title}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{scenario.location} · {scenario.triggerType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-xl">
                {/* Mini pipeline phases */}
                <div className="flex items-center gap-1 flex-1">
                  {PIPELINE_PHASES.map((ph, i) => {
                    const done    = simProgress >= ph.pct;
                    const active  = !done && (i === 0 || simProgress >= PIPELINE_PHASES[i-1].pct);
                    return (
                      <div key={ph.key} className="flex items-center gap-1 flex-1">
                        <div className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-500 whitespace-nowrap',
                          done   && 'bg-primary/15 text-primary border border-primary/30',
                          active && 'bg-amber-500/15 text-amber-400 border border-amber-500/30 pipeline-step-active',
                          !done && !active && 'bg-muted text-muted-foreground border border-transparent',
                        )}>
                          {ph.icon} {ph.label}
                        </div>
                        {i < PIPELINE_PHASES.length - 1 && (
                          <div className={cn('h-px flex-1 rounded transition-all duration-700', done ? 'bg-primary/50' : 'bg-border')} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs font-mono font-bold text-foreground tabular-nums w-10 text-right">{simProgress}%</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {simRunning && (
                  <span className="px-3 py-1 bg-destructive/10 border border-destructive/20 rounded-full text-[10px] font-bold text-destructive flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                    LIVE
                  </span>
                )}
                {simComplete && (
                  <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> COMPLETE
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={resetSim} className="h-7 rounded-full text-xs px-3 font-bold">
                  <RotateCcw className="w-3 h-3 mr-1.5" /> Reset
                </Button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-muted">
              <motion.div
                className={cn('h-full transition-colors duration-500',
                  simComplete ? 'bg-primary' :
                  scenario.weatherType === 'rain'     ? 'bg-blue-400' :
                  scenario.weatherType === 'heatwave' ? 'bg-orange-400' :
                  scenario.weatherType === 'attack'   ? 'bg-red-500' : 'bg-red-400'
                )}
                animate={{ width: `${simProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar Controls */}
      <div className={cn("border-r bg-card flex flex-col shadow-sm z-10 shrink-0 transition-all duration-300", scenario ? "w-96" : "w-80")}>
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
               <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{scenario ? 'Live Pipeline' : 'Fraud Network'}</h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Real-time geospatial anomaly detection.</p>
        </div>

        {/* ── Simulation events log (replaces normal sidebar content when scenario active) ── */}
        {scenario ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Wall statuses */}
            <div className="p-4 border-b shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Adversarial Defense Core</p>
              <div className="grid grid-cols-2 gap-2">
                {[1,2,3,4,5,6,7].map(n => {
                  const st = wallStatuses[n] || 'idle';
                  return (
                    <div key={n} className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all duration-500',
                      st === 'idle'     && 'bg-muted border-border text-muted-foreground',
                      st === 'scanning' && 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse',
                      st === 'pass'     && 'bg-primary/10 border-primary/30 text-primary',
                      st === 'fail'     && 'bg-destructive/10 border-destructive/30 text-destructive',
                    )}>
                      {wallIcons[n]}
                      <span>Wall {n}</span>
                      {st === 'pass' && <ShieldCheck className="w-3 h-3 ml-auto" />}
                      {st === 'fail' && <ShieldAlert className="w-3 h-3 ml-auto" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Events stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <AnimatePresence>
                {simEvents.map(evt => {
                  const cfg = phaseConfig[evt.phase];
                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, x: -12, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                      className={cn(
                        'p-3 rounded-xl border text-xs shadow-sm',
                        evt.status === 'success' && 'bg-primary/5 border-primary/20',
                        evt.status === 'danger'  && 'bg-destructive/5 border-destructive/20',
                        evt.status === 'warning' && 'bg-amber-500/5 border-amber-500/20',
                        evt.status === 'info'    && 'bg-blue-500/5 border-blue-500/20',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-muted-foreground font-mono text-[10px]">{evt.timestamp}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wide flex items-center gap-1"
                          style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}15` }}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </div>
                      <p className="font-bold text-foreground leading-snug">{evt.title}</p>
                      <p className="text-muted-foreground leading-relaxed mt-0.5">{evt.description}</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={evtEndRef} />
            </div>

            {/* Settlement outcome */}
            {simComplete && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border-t bg-primary/5 shrink-0 space-y-3"
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Settlement Outcome</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Genuine Paid</p>
                    <p className="text-xl font-bold text-primary font-mono">{scenario.genuineRiders}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Fraud Blocked</p>
                    <p className="text-xl font-bold text-destructive font-mono">{scenario.fraudRiders}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Disbursed</p>
                    <p className="text-sm font-bold text-foreground">{scenario.totalPayout}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Saved</p>
                    <p className="text-sm font-bold text-destructive">{scenario.totalBlocked}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono animate-pulse">↗ Redirecting to wallet…</p>
              </motion.div>
            )}
          </div>
        ) : (

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg border border-border relative">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Active Riders</span>
              <span className="text-xl font-bold text-foreground font-mono">{loading ? '...' : dashboardStats.activeNodes}</span>
              {loading && <span className="absolute top-3 right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>}
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Threat Level</span>
              <span className={cn(
                "text-xs font-bold leading-tight pt-1 block",
                dashboardStats.threatLevel === 'SECURE' ? "text-primary" : "text-destructive"
              )}>
                {dashboardStats.threatLevel}
              </span>
            </div>
          </div>

          {/* Anomaly Rate — live computed from real rider nodes */}
          {!loading && dashboardStats.activeNodes > 0 && (
            <div className={cn(
              "p-3 rounded-lg border",
              dashboardStats.anomalyPct > 15
                ? "bg-destructive/10 border-destructive/30"
                : "bg-muted/30 border-border"
            )}>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">Anomalous Behaviour</span>
              <div className="flex items-end gap-2 mb-2">
                <span className={cn(
                  "text-2xl font-bold font-mono",
                  dashboardStats.anomalyPct > 15 ? "text-destructive" : "text-[#f59e0b]"
                )}>
                  {dashboardStats.anomalyPct}%
                </span>
                <span className="text-xs text-muted-foreground pb-0.5">
                  of riders in {activeCity.name}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", dashboardStats.anomalyPct > 15 ? "bg-destructive" : "bg-[#f59e0b]")}
                  style={{ width: `${dashboardStats.anomalyPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {dashboardStats.totalSpoofing} riders flagged · {dashboardStats.activeNodes - dashboardStats.totalSpoofing} clean
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-4">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Operational Zone</h2>
            <select 
              className="w-full bg-card border border-border rounded-xl px-4 h-11 text-sm font-bold text-foreground scrollbar-hide focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={activeCity.id}
              onChange={(e) => setActiveCity(CITIES.find(c => c.id === e.target.value)!)}
            >
              <optgroup label="Tier 1 Cities">
                {CITIES.filter(c => c.tier === 'Tier 1').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 2 Cities">
                {CITIES.filter(c => c.tier === 'Tier 2').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 3 Cities">
                {CITIES.filter(c => c.tier === 'Tier 3').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>

            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-6">Interface Controls</h2>
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border shadow-inner">
               <button 
                onClick={() => setMapStyle('dark')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                  mapStyle === 'dark' ? "bg-card text-foreground shadow-md ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 <MapIcon className="w-3.5 h-3.5" /> Dark
               </button>
               <button 
                onClick={() => setMapStyle('satellite')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                  mapStyle === 'satellite' ? "bg-card text-foreground shadow-md ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 <Layers className="w-3.5 h-3.5" /> Satellite
               </button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowRadius(!showRadius)}
              className={cn(
                "w-full justify-start h-10 rounded-xl px-4 font-bold text-xs ring-offset-background transition-all",
                showRadius ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"
              )}
            >
              <Radio className={cn("w-4 h-4 mr-3", showRadius && "animate-pulse")} />
              Toggle Tower Coverage ({showRadius ? 'ON' : 'OFF'})
            </Button>
          </div>

        </div>
        )}

        {/* Legend */}
        <div className="p-6 bg-muted/20 border-t border-border">
           <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/10" /> Connected Rider
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]" /> High-Risk Anomaly
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-[10px] h-[10px] rotate-45 bg-blue-500 border border-white" /> Network Infrastructure
             </div>
           </div>
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative bg-muted">
        {/* Weather overlay — sits over the map tile layer */}
        {scenario && (
          <div className={`weather-overlay-${scenario.weatherType}`} />
        )}

        {/* Completion success banner over the map */}
        <AnimatePresence>
          {simComplete && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] pointer-events-none"
            >
              <div className={cn(
                'flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl font-bold text-sm',
                scenario?.weatherType === 'attack'
                  ? 'bg-destructive/90 border-destructive text-white'
                  : 'bg-primary/90 border-primary text-white'
              )}>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  {scenario?.genuineRiders} riders paid · {scenario?.fraudRiders} blocked ·{' '}
                  {scenario?.totalPayout} disbursed
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <MapContainer 
          center={[activeCity.lat, activeCity.lng]} 
          zoom={13} 
          className="h-full w-full"
          style={{ cursor: 'crosshair', filter: mapStyle === 'dark' ? 'invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%) saturate(80%)' : 'none' }}
        >
          <TileLayer
            url={mapStyle === 'dark' 
              ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            }
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
          />
          <MapController center={[activeCity.lat, activeCity.lng]} />

          {/* Links intentionally removed for a cleaner interface */}

          {/* Nodes */}
          {nodes.map(node => (
            <Marker 
              key={node.id} 
              position={[node.lat, node.lng]}
              icon={node.type === 'tower' ? towerIcon : riderIcon(
                node.status === 'attack' ? '#ef4444' : 
                node.status === 'spoofing' ? '#f59e0b' : '#10a37f',
                node.status === 'attack'
              )}
              eventHandlers={{
                click: () => setSelectedNode(node),
              }}
            >
              <Popup>
                <div className="p-1 font-sans">
                  <p className="font-bold text-sm leading-none pt-1">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">{node.location}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Node Inspector */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="absolute bottom-10 left-10 right-10 md:left-auto md:right-10 md:w-96 z-[1000] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden shadow-primary/5"
            >
              <div className={cn(
                "h-1.5 w-full",
                selectedNode.status === 'attack' ? "bg-destructive shadow-[0_0_10px_var(--destructive)]" : 
                selectedNode.status === 'spoofing' ? "bg-amber-500" : "bg-primary"
              )} />
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-4">
                     {selectedNode.type === 'tower' ? (
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                           <Crosshair className="w-6 h-6 text-blue-500" />
                        </div>
                     ) : (
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border",
                          selectedNode.risk === 'extreme' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                          selectedNode.risk === 'high' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                          "bg-primary/10 border-primary/20 text-primary"
                        )}>
                           <Activity className="w-6 h-6" />
                        </div>
                     )}
                     <div>
                        <h3 className="text-xl font-bold text-foreground leading-none">{selectedNode.name}</h3>
                        <p className="text-xs text-muted-foreground font-bold mt-2 uppercase tracking-widest">{selectedNode.id}</p>
                     </div>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} className="h-8 w-8 rounded-full">
                     <Crosshair className="w-4 h-4 rotate-45" />
                   </Button>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center p-3.5 rounded-xl border bg-muted/30">
                      <div className="flex items-center gap-3">
                         <MapIcon className="w-4 h-4 text-muted-foreground" />
                         <span className="text-xs font-bold text-muted-foreground">Geospatial Center</span>
                      </div>
                      <span className="text-xs font-bold text-foreground font-mono">{selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}</span>
                   </div>

                   {selectedNode.type === 'rider' && (
                     <div className={cn(
                        "p-4 rounded-xl border flex items-center gap-4",
                        selectedNode.risk === 'extreme' ? "bg-destructive/10 border-destructive/20" : "bg-muted/50 border-border"
                     )}>
                        {selectedNode.risk === 'extreme' ? <AlertCircle className="w-5 h-5 text-destructive animate-bounce" /> : <Info className="w-5 h-5 text-primary" />}
                        <div>
                           <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-1">Safety Verdict</p>
                           <p className={cn(
                              "text-xs font-bold",
                              selectedNode.risk === 'extreme' ? "text-destructive" : 
                              selectedNode.risk === 'high' ? "text-amber-500" : "text-foreground"
                           )}>
                              {selectedNode.verdict || (selectedNode.risk === 'extreme' ? 'CRITICAL: Multi-Proxy Relay Detected' : 
                               selectedNode.risk === 'high' ? 'High Risk Location Mismatch' : 'Nominal Signal Pattern')}
                           </p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="mt-8">
                   <Button className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 font-bold">
                     Analyze Defense Packet <ChevronRight className="w-4 h-4 ml-2" />
                   </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>
  );
}
