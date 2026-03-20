import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Activity, Wifi, MapPin, Smartphone, UserX } from 'lucide-react';
import clsx from 'clsx';

const mockLogs = [
  { id: 'C-892', status: 'pass', time: '10:42:01', wall: 'Platform Sync', desc: 'Continuous activity for 3.2 hrs before event.' },
  { id: 'C-893', status: 'pass', time: '10:42:04', wall: 'Consensus', desc: 'Rain verified by APIs.' },
  { id: 'C-894', status: 'fail', time: '10:42:15', wall: 'Network BSSID', desc: 'WiFi signature matches distant zone (Chennai).' },
  { id: 'C-895', status: 'fail', time: '10:42:22', wall: 'Graph Analysis', desc: 'Cluster detected: 6 accounts on same IP.' },
  { id: 'C-896', status: 'pass', time: '10:42:30', wall: 'Device Hash', desc: 'Unique fingerprint matched.' },
  { id: 'C-897', status: 'fail', time: '10:42:45', wall: 'Motion Sensor', desc: 'GPS moving, accelerometer reads 0 m/s².' },
  { id: 'C-898', status: 'pass', time: '10:43:01', wall: 'Temporal Pattern', desc: 'Behavior aligns with 6-month history.' },
];

export default function FraudDefense() {
  const [logs, setLogs] = useState<typeof mockLogs>([]);
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < mockLogs.length) {
        setLogs(prev => {
          const log = mockLogs[index];
          // Prevent React duplicate key crash during HMR/StrictMode
          if (prev.some(l => l.id === log.id)) return prev;
          return [log, ...prev];
        });
        index++;
      } else {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 pt-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-8 pb-12"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3 text-white/90">
              <span className="w-8 h-8 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/40 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] animate-pulse" />
              </span>
              9-Wall Adversarial Defense
            </h1>
            <p className="text-gray-400 font-medium">Real-time anti-spoofing and anomaly detection.</p>
          </div>
          <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl flex gap-6 items-center">
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-gray-500 font-mono uppercase">Blocked Value</span>
              <span className="text-white font-bold tracking-tighter">₹48,200</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-gray-500 font-mono uppercase">Syndicates</span>
              <span className="text-[#ef4444] font-bold tracking-tighter">4 Active</span>
            </div>
          </div>
        </div>

        {/* Console Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[500px]">
          
          {/* Live Stream */}
          <div className="lg:col-span-8 glass-panel p-0 flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-center z-10">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#10a37f]" /> Sensor Feed
              </span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm flex flex-col gap-2 relative">
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    className={clsx(
                      "p-3 rounded-lg border",
                      log.status === 'pass' 
                        ? "bg-[#10a37f]/5 border-[#10a37f]/20 text-gray-300"
                        : "bg-[#ef4444]/10 border-[#ef4444]/30 text-white"
                    )}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-2">
                        <span className="opacity-50">[{log.time}]</span> 
                        <strong className={log.status === 'pass' ? "text-[#10a37f]" : "text-[#ef4444]"}>
                          {log.id}
                        </strong>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                          {log.wall}
                        </span>
                      </span>
                      {log.status === 'pass' ? <ShieldCheck className="w-4 h-4 text-[#10a37f]" /> : <ShieldAlert className="w-4 h-4 text-[#ef4444]" />}
                    </div>
                    <p className={clsx("text-xs mt-2 opacity-80", log.status === 'fail' && "text-[#ef4444]")}>
                      {log.desc}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Overlay Gradient for Fade */}
              <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#1c1c1e] to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Infrastructure Health */}
          <div className="lg:col-span-4 glass-panel p-6 flex flex-col gap-6">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Defense Vectors</span>
            
            <div className="space-y-4 flex-1">
              <WallStatus label="Tier A Data: Platform Sync" active icon={<Activity className="w-4 h-4" />} />
              <WallStatus label="Tier A Data: Graph Analysis" active icon={<UserX className="w-4 h-4" />} />
              <div className="my-4 border-t border-white/5" />
              <WallStatus label="Tier B Device: WiFi BSSID" active icon={<Wifi className="w-4 h-4" />} />
              <WallStatus label="Tier B Device: Fingerprint" active icon={<Smartphone className="w-4 h-4" />} />
              <WallStatus label="Tier B Move: Accelerometer" active icon={<MapPin className="w-4 h-4" />} />
            </div>

            <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-mono">Status: ENGAGED</span>
              <span className="text-[#10a37f] font-mono animate-pulse">Scanning...</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function WallStatus({ label, active, icon }: { label: string, active: boolean, icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm text-gray-300">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
          {icon}
        </div>
        {label}
      </div>
      <div className={clsx("w-2 h-2 rounded-full", active ? "bg-[#10a37f]" : "bg-gray-600")} />
    </div>
  );
}
