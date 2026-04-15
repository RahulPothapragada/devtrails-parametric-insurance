import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, ShieldAlert, Zap, Radio, Users, 
  Activity, ChevronRight, RotateCcw, Play, 
  CheckCircle2, Clock, AlertTriangle,
  Wifi, Smartphone, MapPin, GitBranch, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCENARIOS, type Scenario, type SimEvent } from '../data/simulationData';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { Button } from '@/components/ui/button';

// ─── Phase → Visual mapping ─────────────────────────────
const phaseConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  trigger:     { icon: <Zap className="w-4 h-4" />, color: '#ef4444', label: 'TRIGGER' },
  consensus:   { icon: <Radio className="w-4 h-4" />, color: '#3b82f6', label: 'VERIFY' },
  claims:      { icon: <Users className="w-4 h-4" />, color: '#f59e0b', label: 'CLAIMS' },
  fraud_wall:  { icon: <ShieldAlert className="w-4 h-4" />, color: '#8b5cf6', label: 'DEFENSE' },
  result:      { icon: <Eye className="w-4 h-4" />, color: '#10a37f', label: 'VERDICT' },
  payout:      { icon: <CheckCircle2 className="w-4 h-4" />, color: '#10a37f', label: 'PAYOUT' },
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

// ─── Main Component ──────────────────────────────────────
type SimState = 'picking' | 'running' | 'complete';

export default function Simulation() {
  const [simState, setSimState] = useState<SimState>('picking');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [wallStatuses, setWallStatuses] = useState<Record<number, 'idle' | 'scanning' | 'pass' | 'fail'>>({});
  const eventEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    eventEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  const startSimulation = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setSimState('running');
    setEvents([]);
    setWallStatuses({ 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle', 5: 'idle', 6: 'idle', 7: 'idle' });

    let idx = 0;
    intervalRef.current = setInterval(() => {
      if (idx < scenario.events.length) {
        const event = scenario.events[idx];
        setEvents(prev => {
          if (prev.some(e => e.id === event.id)) return prev;
          return [...prev, event];
        });

        // Update wall statuses
        if (event.phase === 'fraud_wall' && event.wallNumber) {
          const wallNum = event.wallNumber;
          setWallStatuses(prev => ({
            ...prev,
            [wallNum]: 'scanning',
          }));
          // After a beat, set final status
          setTimeout(() => {
            setWallStatuses(prev => ({
              ...prev,
              [wallNum]: event.status === 'success' ? 'pass' : 'fail',
            }));
          }, 600);
        }

        idx++;
      } else {
        clearInterval(intervalRef.current!);
        setTimeout(() => setSimState('complete'), 800);
      }
    }, 1200);
  };

  const resetSimulation = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimState('picking');
    setSelectedScenario(null);
    setEvents([]);
    setWallStatuses({});
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-6 h-full flex flex-col">
      <AnimatePresence mode="wait">
        {simState === 'picking' && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-8 pb-12 w-full"
          >
            {/* Header */}
            <div className="text-center pt-8 md:pt-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground font-mono mb-6"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                INTERACTIVE SIMULATION ENGINE
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 text-foreground">
                Trigger a <span className="text-primary underline underline-offset-8 decoration-primary/40">disruption.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Select a real-world scenario and watch FlowSecure's AI pipeline respond in real-time — from detection through 7-wall analysis to instant payout.
              </p>
            </div>

            {/* Scenario Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto w-full px-4">
              {SCENARIOS.map((scenario, i) => (
                <motion.button
                  key={scenario.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => startSimulation(scenario)}
                  className={cn(
                    "group relative p-8 rounded-2xl border text-left transition-all duration-300",
                    "bg-card hover:bg-accent/30 hover:border-primary/50 shadow-sm hover:shadow-xl",
                    "hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  )}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-3xl shadow-inner">
                      {scenario.icon}
                    </div>
                    <Play className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{scenario.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 h-10 overflow-hidden">{scenario.subtitle}</p>
                  <div className="flex gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/50 p-2 rounded-lg w-fit">
                    <span>{scenario.totalClaims} Claims</span>
                    <span className="opacity-30">|</span>
                    <span>{scenario.location}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {(simState === 'running' || simState === 'complete') && selectedScenario && (
          <motion.div
            key="simulation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-8 pb-12 w-full h-full"
          >
            {/* Sim Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card border p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-3xl shadow-sm border">
                  {selectedScenario.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{selectedScenario.title}</h1>
                  <p className="text-sm text-muted-foreground font-medium">{selectedScenario.location} · {selectedScenario.triggerType}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {simState === 'running' && (
                  <div className="px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-full text-xs font-bold text-destructive flex items-center gap-2 shadow-sm animate-pulse">
                    <span className="relative flex h-2 w-2">
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                    </span>
                    LIVE PIPELINE
                  </div>
                )}
                {simState === 'complete' && (
                  <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    SEQUENCE COMPLETE
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={resetSimulation}
                  className="rounded-full px-5 h-9 font-bold text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" /> NEW RUN
                </Button>
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]">

              {/* Event Timeline — Left */}
              <div className="lg:col-span-8 rounded-2xl border bg-card flex flex-col overflow-hidden shadow-sm">
                <div className="p-5 border-b bg-muted/30 flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2 font-bold">
                    <Activity className="w-4 h-4 text-primary" />
                    Real-time Pipeline Logs
                  </span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded border">
                    {events.length}/{selectedScenario.events.length} Data Points
                  </span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-4 relative scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <AnimatePresence>
                    {events.map((event) => {
                      const config = phaseConfig[event.phase];
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          className={cn(
                            "p-4 rounded-xl border font-mono text-sm shadow-sm transition-all",
                            event.status === 'success' && "bg-primary/5 border-primary/20",
                            event.status === 'danger'  && "bg-destructive/5 border-destructive/20",
                            event.status === 'warning' && "bg-amber-500/5 border-amber-500/20",
                            event.status === 'info'    && "bg-blue-500/5 border-blue-500/20",
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-xs font-bold">{event.timestamp}</span>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-bold uppercase tracking-wider"
                                style={{ color: config.color, borderColor: `${config.color}40`, backgroundColor: `${config.color}15` }}
                              >
                                {config.icon} {config.label}
                              </span>
                              {event.wallNumber && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border text-muted-foreground flex items-center gap-1 font-bold">
                                  {wallIcons[event.wallNumber]} Wall {event.wallNumber}
                                </span>
                              )}
                            </div>
                            {event.status === 'success' && <ShieldCheck className="w-5 h-5 text-primary" />}
                            {event.status === 'danger'  && <ShieldAlert className="w-5 h-5 text-destructive" />}
                            {event.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                            {event.status === 'info'    && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                          </div>
                          <p className="font-bold text-foreground text-sm mb-1 font-sans">{event.title}</p>
                          <p className="text-xs leading-relaxed font-sans text-muted-foreground">
                            {event.description}
                          </p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={eventEndRef} />
                  {/* Bottom gradient fade */}
                  <div className="sticky bottom-0 left-0 w-full h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Right Panel — Defense Walls + Stats */}
              <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">

                {/* 7-Wall Status */}
                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 block">Adversarial Defense Core</span>
                  <div className="space-y-4">
                    {[
                      { n: 1, name: 'Proof of Position' },
                      { n: 2, name: 'Hardware Attestation' },
                      { n: 3, name: 'Geo-Spatial Intel' },
                      { n: 4, name: 'Consensus Oracle' },
                      { n: 5, name: 'Relationship Graph' },
                      { n: 6, name: 'Temporal Sieve' },
                      { n: 7, name: 'Identity Cross-Ref' },
                    ].map((wall) => {
                      const status = wallStatuses[wall.n] || 'idle';
                      return (
                        <div key={wall.n} className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm flex-1">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-500",
                              status === 'idle' && "bg-muted border-border text-muted-foreground",
                              status === 'scanning' && "bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse",
                              status === 'pass' && "bg-primary/10 border-primary/40 text-primary",
                              status === 'fail' && "bg-destructive/10 border-destructive/40 text-destructive shadow-sm shadow-destructive/20",
                            )}>
                              {wallIcons[wall.n]}
                            </div>
                            <div className="flex-1">
                              <span className={cn(
                                "text-[11px] font-bold transition-colors",
                                status === 'idle' ? "text-muted-foreground" : "text-foreground",
                              )}>
                                {wall.name}
                              </span>
                              <div className="h-1 w-full bg-muted rounded-full mt-1.5 overflow-hidden border">
                                <motion.div 
                                  className={cn("h-full", status === 'fail' ? "bg-destructive" : "bg-primary")}
                                  initial={{ width: 0 }}
                                  animate={{ width: status === 'idle' ? '0%' : status === 'scanning' ? '40%' : '100%' }}
                                  transition={{ duration: 0.6 }}
                                />
                              </div>
                            </div>
                          </div>
                   
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Stats */}
                <div className="rounded-2xl border bg-card p-6 shadow-sm border-primary/20">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 block">Settlement Outcome</span>
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Payouts Issued (Genuine)</span>
                      <div className="flex items-baseline gap-3 mt-2">
                        {simState === 'complete' ? (
                          <AnimatedCounter value={selectedScenario.genuineRiders} className="text-4xl font-bold text-primary tracking-tighter" prefix="" />
                        ) : (
                          <span className="text-4xl font-bold text-muted-foreground/30 tracking-tighter">---</span>
                        )}
                        {simState === 'complete' && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase">INSTANT</span>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Disbursed</span>
                        <p className={cn("text-xl font-bold mt-1 tracking-tight", simState === 'complete' ? "text-foreground" : "text-muted-foreground/30")}>
                          {simState === 'complete' ? selectedScenario.totalPayout : '₹ 0.00'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Fraud Denied</span>
                        <p className={cn("text-xl font-bold mt-1 tracking-tight", simState === 'complete' ? "text-destructive" : "text-muted-foreground/30")}>
                          {simState === 'complete' ? selectedScenario.totalBlocked : '₹ 0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complete CTA Banner */}
                {simState === 'complete' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent border-primary/30 p-6 shadow-lg shadow-primary/5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-foreground tracking-tight">System Settlement Reached</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                      Claims processed in {(selectedScenario.events.length * 1.2).toFixed(0)}s real-time. 
                      Neural decision verified against local sensor mesh. All payouts finalized on-chain.
                    </p>
                    <Button
                       onClick={resetSimulation}
                       className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    >
                      Reset Scenario <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
