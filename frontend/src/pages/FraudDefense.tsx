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

export default function FraudDefense() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeWall, setActiveWall] = useState(1);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLogs([]); // Reset logs on mount for a clean start

    const messages = [
      { code: 'C-898', type: 'Temporal Pattern', msg: 'Behavior aligns with 6-month history.', status: 'secure' },
      { code: 'C-897', type: 'Motion Sensor', msg: 'GPS moving, accelerometer reads 0 m/s².', status: 'alert' },
      { code: 'C-896', type: 'Device Hash', msg: 'Unique fingerprint matched.', status: 'secure' },
      { code: 'C-895', type: 'Graph Analysis', msg: 'Cluster detected: 6 accounts on same IP.', status: 'alert' },
    ];

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        code: msg.code,
        type: msg.type,
        message: msg.msg,
        status: msg.status as 'secure' | 'alert',
      };

      setLogs(prev => [newLog, ...prev].slice(0, 50));
      setActiveWall(prev => (prev % 9) + 1);
    }, 2500);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

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
            <p className="text-muted-foreground font-medium pl-1">Real-time anti-spoofing and anomaly detection.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Blocked Value</span>
              <span className="text-2xl font-bold text-foreground font-mono">₹48,200</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Syndicates</span>
              <span className="text-2xl font-bold text-destructive font-mono">4 Active</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border bg-card/50 overflow-hidden shadow-sm backdrop-blur-sm">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Sensor Feed
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>
              
              <div className="h-[500px] overflow-y-auto p-4 space-y-3 font-mono text-sm scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
              <p className="text-xs text-muted-foreground leading-relaxed">
                4 known spoofing clusters identified in Kurla and Navi Mumbai. All associated wallets blacklisted across parametric pools.
              </p>
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
