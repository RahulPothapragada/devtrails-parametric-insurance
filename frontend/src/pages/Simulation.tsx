import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, ShieldAlert, Zap, Radio, Users, 
  Activity, ChevronRight, RotateCcw, Play, 
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Wifi, Smartphone, MapPin, GitBranch, Eye
} from 'lucide-react';
import clsx from 'clsx';
import { SCENARIOS, type Scenario, type SimEvent } from '../data/simulationData';
import AnimatedCounter from '../components/ui/AnimatedCounter';

// ─── Phase → Visual mapping ─────────────────────────────
const phaseConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  trigger:     { icon: <Zap className="w-4 h-4" />, color: '#ef4444', label: 'TRIGGER' },
  consensus:   { icon: <Radio className="w-4 h-4" />, color: '#0ea5e9', label: 'VERIFY' },
  claims:      { icon: <Users className="w-4 h-4" />, color: '#f59e0b', label: 'CLAIMS' },
  fraud_wall:  { icon: <ShieldAlert className="w-4 h-4" />, color: '#a855f7', label: 'DEFENSE' },
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
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-6 pt-6 md:pt-10">
      <AnimatePresence mode="wait">
        {simState === 'picking' && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-8 pb-12"
          >
            {/* Header */}
            <div className="text-center pt-8 md:pt-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono mb-6"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]" />
                </span>
                INTERACTIVE SIMULATION ENGINE
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
                Trigger a <span className="text-gradient-primary">disruption.</span>
              </h1>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Select a real-world scenario and watch FlowSecure's AI pipeline respond in real-time — from trigger detection through 7-wall fraud analysis to instant payout.
              </p>
            </div>

            {/* Scenario Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
              {SCENARIOS.map((scenario, i) => (
                <motion.button
                  key={scenario.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => startSimulation(scenario)}
                  className={clsx(
                    "group relative p-6 rounded-2xl border text-left transition-all duration-300",
                    "bg-gradient-to-br hover:scale-[1.02] active:scale-[0.98]",
                    scenario.gradient,
                    scenario.borderColor,
                    "hover:shadow-[0_0_40px_rgba(16,163,127,0.15)]"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{scenario.icon}</span>
                    <Play className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{scenario.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{scenario.subtitle}</p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{scenario.totalClaims} claims</span>
                    <span>·</span>
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
            className="flex flex-col gap-6 pb-12"
          >
            {/* Sim Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{selectedScenario.icon}</span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white/90">{selectedScenario.title}</h1>
                  <p className="text-sm text-gray-400">{selectedScenario.location} · {selectedScenario.triggerType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {simState === 'running' && (
                  <div className="px-3 py-1.5 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-full text-xs font-mono text-[#ef4444] flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]" />
                    </span>
                    LIVE SIMULATION
                  </div>
                )}
                {simState === 'complete' && (
                  <div className="px-3 py-1.5 bg-[#10a37f]/10 border border-[#10a37f]/20 rounded-full text-xs font-mono text-[#10a37f] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    SIMULATION COMPLETE
                  </div>
                )}
                <button
                  onClick={resetSimulation}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Scenario
                </button>
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Event Timeline — Left */}
              <div className="lg:col-span-8 glass-panel p-0 flex flex-col max-h-[600px] overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/[0.03] flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#10a37f]" />
                    Event Timeline
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {events.length}/{selectedScenario.events.length} events
                  </span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-2.5 relative">
                  <AnimatePresence>
                    {events.map((event) => {
                      const config = phaseConfig[event.phase];
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -30, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                          className={clsx(
                            "p-3.5 rounded-xl border font-mono text-sm",
                            event.status === 'success' && "bg-[#10a37f]/5 border-[#10a37f]/20",
                            event.status === 'danger'  && "bg-[#ef4444]/8 border-[#ef4444]/25",
                            event.status === 'warning' && "bg-[#f59e0b]/8 border-[#f59e0b]/20",
                            event.status === 'info'    && "bg-[#0ea5e9]/8 border-[#0ea5e9]/20",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs">{event.timestamp}</span>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold uppercase tracking-wider"
                                style={{ color: config.color, borderColor: `${config.color}33`, backgroundColor: `${config.color}10` }}
                              >
                                {config.icon} {config.label}
                              </span>
                              {event.wallNumber && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 flex items-center gap-1">
                                  {wallIcons[event.wallNumber]} Wall {event.wallNumber}
                                </span>
                              )}
                            </div>
                            {event.status === 'success' && <ShieldCheck className="w-4 h-4 text-[#10a37f]" />}
                            {event.status === 'danger'  && <ShieldAlert className="w-4 h-4 text-[#ef4444]" />}
                            {event.status === 'warning' && <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />}
                            {event.status === 'info'    && <CheckCircle2 className="w-4 h-4 text-[#0ea5e9]" />}
                          </div>
                          <p className="font-semibold text-white/90 text-xs mb-1 font-sans">{event.title}</p>
                          <p className={clsx(
                            "text-xs leading-relaxed font-sans",
                            event.status === 'danger' ? "text-[#ef4444]/80" : "text-gray-400"
                          )}>
                            {event.description}
                          </p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={eventEndRef} />
                  {/* Bottom gradient */}
                  <div className="sticky bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#1c1c1e] to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Right Panel — Defense Walls + Stats */}
              <div className="lg:col-span-4 flex flex-col gap-6">

                {/* 7-Wall Status */}
                <div className="glass-panel p-5">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 block">7-Wall Defense Status</span>
                  <div className="space-y-3">
                    {[
                      { n: 1, name: 'Proof of Work' },
                      { n: 2, name: 'Device Fingerprint' },
                      { n: 3, name: 'Location Intel' },
                      { n: 4, name: 'Crowd Oracle' },
                      { n: 5, name: 'Graph Network' },
                      { n: 6, name: 'Temporal Patterns' },
                      { n: 7, name: 'Multi-Source Verify' },
                    ].map((wall) => {
                      const status = wallStatuses[wall.n] || 'idle';
                      return (
                        <div key={wall.n} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 text-sm">
                            <div className={clsx(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500",
                              status === 'idle' && "bg-white/5 border border-white/10 text-gray-500",
                              status === 'scanning' && "bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] animate-pulse",
                              status === 'pass' && "bg-[#10a37f]/10 border border-[#10a37f]/30 text-[#10a37f]",
                              status === 'fail' && "bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444]",
                            )}>
                              {wallIcons[wall.n]}
                            </div>
                            <span className={clsx(
                              "text-xs font-medium transition-colors",
                              status === 'idle' ? "text-gray-500" : "text-gray-300",
                            )}>
                              {wall.name}
                            </span>
                          </div>
                          <div className={clsx(
                            "w-2 h-2 rounded-full transition-all duration-300",
                            status === 'idle' && "bg-gray-700",
                            status === 'scanning' && "bg-[#f59e0b] animate-pulse",
                            status === 'pass' && "bg-[#10a37f]",
                            status === 'fail' && "bg-[#ef4444]",
                          )} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Stats */}
                <div className="glass-panel p-5">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 block">Outcome</span>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Genuine Riders</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        {simState === 'complete' ? (
                          <AnimatedCounter value={selectedScenario.genuineRiders} className="text-3xl font-bold text-[#10a37f] tracking-tighter" />
                        ) : (
                          <span className="text-3xl font-bold text-gray-600 tracking-tighter">---</span>
                        )}
                        {simState === 'complete' && (
                          <span className="text-xs text-[#10a37f]">paid instantly</span>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Fraud Blocked</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        {simState === 'complete' ? (
                          <AnimatedCounter value={selectedScenario.fraudRiders} className="text-3xl font-bold text-[#ef4444] tracking-tighter" />
                        ) : (
                          <span className="text-3xl font-bold text-gray-600 tracking-tighter">---</span>
                        )}
                        {simState === 'complete' && (
                          <span className="text-xs text-[#ef4444]">denied</span>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Paid Out</span>
                        <p className={clsx("text-lg font-bold mt-1", simState === 'complete' ? "text-[#10a37f]" : "text-gray-600")}>
                          {simState === 'complete' ? selectedScenario.totalPayout : '---'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Saved</span>
                        <p className={clsx("text-lg font-bold mt-1", simState === 'complete' ? "text-[#ef4444]" : "text-gray-600")}>
                          {simState === 'complete' ? selectedScenario.totalBlocked : '---'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complete CTA */}
                {simState === 'complete' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-5 bg-gradient-to-br from-[#10a37f]/10 to-transparent border-[#10a37f]/20"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ShieldCheck className="w-5 h-5 text-[#10a37f]" />
                      <span className="text-sm font-semibold text-white">Defense Successful</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                      {selectedScenario.genuineRiders} genuine riders paid in under 30 seconds. 
                      {selectedScenario.fraudRiders} fraudulent claims neutralized across {selectedScenario.id === 'spoofing_attack' ? '4 syndicates' : 'multiple checks'}.
                      ₹0 lost to fraud.
                    </p>
                    <button
                      onClick={resetSimulation}
                      className="w-full py-2.5 rounded-xl bg-[#10a37f] hover:bg-[#0d8b6b] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      Try Another Scenario <ChevronRight className="w-4 h-4" />
                    </button>
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
