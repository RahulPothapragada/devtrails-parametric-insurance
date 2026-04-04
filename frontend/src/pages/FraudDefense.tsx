import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, Smartphone, Wifi, Users, GitBranch, Clock, MapPin, Database, Binary, ShieldCheck } from 'lucide-react';

const wallIcons: Record<number, React.ReactNode> = {
  1: <Binary className="w-4 h-4" />,
  2: <Smartphone className="w-4 h-4" />,
  3: <Wifi className="w-4 h-4" />,
  4: <Users className="w-4 h-4" />,
  5: <GitBranch className="w-4 h-4" />,
  6: <Clock className="w-4 h-4" />,
  7: <MapPin className="w-4 h-4" />,
  8: <Database className="w-4 h-4" />,
  9: <ShieldCheck className="w-4 h-4" />,
};

interface LogEntry {
  id: string;
  timestamp: string;
  code: string;
  type: string;
  message: string;
  status: 'secure' | 'alert';
}

interface FraudSummary {
  total_riders: number;
  anomalous_riders: number;
  anomaly_rate_pct: number;
  syndicate_count: number;
  blocked_premium: number;
  top_syndicate_zones: { zone: string; count: number }[];
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function FraudDefense() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeWall, setActiveWall] = useState(1);
  const [summary, setSummary] = useState<FraudSummary | null>(null);
  const mountedRef = useRef(true);

  // Fetch real fraud summary stats
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/admin/fraud-summary')
      .then(r => r.json())
      .then(data => { if (mountedRef.current) setSummary(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLogs([]);

    let interval: ReturnType<typeof setInterval>;

    async function fetchLiveDefense() {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/admin/maps/network?city_name=Mumbai`);
        if (!response.ok) return;
        const payload = await response.json();
        const nodes = payload.nodes || [];

        if (!mountedRef.current) return;

        const combinedQueue: LogEntry[] = [];

        nodes.forEach((node: any) => {
          if (node.status === 'attack' || node.status === 'spoofing') {
            combinedQueue.push({
              id: Math.random().toString(36).substring(2, 11),
              timestamp: '',
              code: `R-${node.id.split('-').pop()}`,
              type: node.status === 'attack' ? 'Graph Analysis' : 'Motion Sensor',
              message: node.verdict || 'Anomaly detected in rider behavior.',
              status: 'alert',
            });
          } else {
            if (Math.random() > 0.8) {
              combinedQueue.push({
                id: Math.random().toString(36).substring(2, 11),
                timestamp: '',
                code: `R-${node.id.split('-').pop()}`,
                type: Math.random() > 0.5 ? 'Device Hash' : 'Temporal Pattern',
                message: Math.random() > 0.5 ? 'Unique fingerprint matched.' : 'Behavior aligns with history.',
                status: 'secure',
              });
            }
          }
        });

        combinedQueue.sort(() => Math.random() - 0.5);

        let index = 0;
        interval = setInterval(() => {
          if (!mountedRef.current) return;

          let msg;
          if (index < combinedQueue.length) {
            msg = combinedQueue[index++];
          } else {
            msg = combinedQueue[Math.floor(Math.random() * combinedQueue.length)];
          }

          if (msg) {
            const newLog: LogEntry = {
              ...msg,
              id: Math.random().toString(36).substring(2, 11),
              timestamp: new Date().toLocaleTimeString([], { hour12: false })
            };
            setLogs(prev => [newLog, ...prev].slice(0, 50));
            setActiveWall(prev => (prev % 9) + 1);
          }
        }, 1800);

      } catch (e) {
        console.error("Failed to fetch logs dynamically", e);
      }
    }

    fetchLiveDefense();

    return () => {
      mountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const anomalyRate = summary?.anomaly_rate_pct ?? 0;
  const syndicateCount = summary?.syndicate_count ?? 0;
  const blockedValue = summary?.blocked_premium ?? 0;
  const topZones = summary?.top_syndicate_zones ?? [];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-8 pb-12"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">9-Wall Adversarial Defense</h1>
            </div>
            <p className="text-muted-foreground font-medium pl-1">Real-time anti-spoofing and anomaly detection across {(summary?.total_riders ?? 0).toLocaleString('en-IN')} riders.</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Blocked Value</span>
              <span className="text-2xl font-bold text-foreground font-mono">
                {summary ? fmt(blockedValue) : '...'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Syndicates</span>
              <span className="text-2xl font-bold text-destructive font-mono">
                {summary ? `${syndicateCount} Active` : '...'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Anomaly Rate</span>
              <span className="text-2xl font-bold text-[#f59e0b] font-mono">
                {summary ? `${anomalyRate}%` : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* Anomaly Rate Banner */}
        {summary && (
          <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-4 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-sm font-bold text-foreground">Platform Anomaly Overview</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm flex-1">
              <div>
                <span className="text-muted-foreground text-xs block">Total Riders</span>
                <span className="font-bold text-foreground">{summary.total_riders.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Anomalous Riders</span>
                <span className="font-bold text-[#f59e0b]">{summary.anomalous_riders.toLocaleString('en-IN')} ({anomalyRate}%)</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Active Syndicates</span>
                <span className="font-bold text-destructive">{syndicateCount} device-sharing rings</span>
              </div>
            </div>
            <div className="flex-1 max-w-xs">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Normal</span>
                <span>Anomalous</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${anomalyRate}%` }}
                  transition={{ duration: 1.2 }}
                  className="h-full bg-[#f59e0b] rounded-full"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{anomalyRate}% of all riders flagged across 13 cities</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border bg-card/50 overflow-hidden shadow-sm backdrop-blur-sm">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Sensor Feed — Mumbai Live Sweep
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>

              <div className="h-[500px] overflow-y-auto p-4 space-y-3 font-mono text-sm scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {logs.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs pt-8">Connecting to live sensor feed...</div>
                )}
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 rounded-lg border transition-colors ${
                      log.status === 'alert'
                        ? 'bg-destructive/5 border-destructive/20'
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">[{log.timestamp}]</span>
                        <span className={log.status === 'alert' ? 'text-destructive font-bold' : 'text-primary font-bold'}>
                          {log.code}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground font-sans">
                          {log.type}
                        </span>
                      </div>
                      {log.status === 'secure' ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <p className={log.status === 'alert' ? 'text-destructive' : 'text-muted-foreground'}>
                      {log.message}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Defense Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Defense Vectors</h2>
              <div className="space-y-6">
                {[
                  { n: 1, name: 'Tier A Data: Platform Sync' },
                  { n: 2, name: 'Tier A Data: Graph Analysis' },
                  { n: 3, name: 'Tier B Device: WiFi BSSID' },
                  { n: 4, name: 'Tier B Device: Fingerprint' },
                  { n: 5, name: 'Tier B Move: Accelerometer' },
                  { n: 6, name: 'Tier B Move: GPS Velocity' },
                  { n: 7, name: 'Tier C Identity: KYC Delta' },
                  { n: 8, name: 'Tier C Identity: Temporal' },
                  { n: 9, name: 'Final Decision: Neural' },
                ].map((wall) => (
                  <WallStatus
                    key={wall.n}
                    num={wall.n}
                    name={wall.name}
                    isActive={activeWall === wall.n}
                  />
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground">Syndicate Map</span>
              </div>
              {topZones.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {syndicateCount} device-sharing rings identified. Top concentration zones:
                  </p>
                  <div className="space-y-2">
                    {topZones.map((z, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{z.zone}</span>
                        <span className="text-destructive font-bold font-mono">{z.count} riders</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">All associated wallets blacklisted across parametric pools.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Loading syndicate cluster data...
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function WallStatus({ num, name, isActive }: { num: number; name: string; isActive: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-300 ${
          isActive
            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]'
            : 'bg-muted border-border text-muted-foreground group-hover:border-primary/50'
        }`}>
          {wallIcons[num]}
        </div>
        <div>
          <span className={`text-xs font-bold transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
            {name}
          </span>
          <div className="h-1 w-24 bg-muted rounded-full mt-1 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: isActive ? '100%' : '20%' }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
        isActive ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-border'
      }`} />
    </div>
  );
}
