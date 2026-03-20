import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShieldAlert } from 'lucide-react';
import AnimatedCounter from '../components/ui/AnimatedCounter';

const hourlyData = [
  { time: '10:00', risk: 12, riders: 400 },
  { time: '11:00', risk: 18, riders: 410 },
  { time: '12:00', risk: 45, riders: 380 },
  { time: '13:00', risk: 85, riders: 200 },
  { time: '14:00', risk: 92, riders: 90 },
  { time: '15:00', risk: 65, riders: 150 },
  { time: '16:00', risk: 30, riders: 320 },
];

const zoneData = [
  { zone: 'Delhi NCR', active: 320, protected: 280, riskScore: 88 },
  { zone: 'Mumbai', active: 410, protected: 150, riskScore: 42 },
  { zone: 'Bengaluru', active: 250, protected: 210, riskScore: 12 },
];

const riderFeed = [
  { id: 'R-4092', name: 'Arjun M.', location: 'Pune', issue: 'Bandh / Route Blocked', status: 'Protected', payout: '₹420', time: '2m ago' },
  { id: 'R-3814', name: 'Rajeev S.', location: 'Kolkata', issue: 'Severe Waterlogging', status: 'Protected', payout: '₹380', time: '14m ago' },
  { id: 'R-2901', name: 'Vikram K.', location: 'Jaipur', issue: 'Extreme Heat > 45°C', status: 'Protected', payout: '₹510', time: '1h ago' },
  { id: 'R-7723', name: 'Md. Tariq', location: 'Hyderabad', issue: 'Severe AQI > 300', status: 'Protected', payout: '₹290', time: '2h ago' },
  { id: 'R-4110', name: 'Sanjay P.', location: 'Delhi NCR', issue: 'Visibility < 50m (Fog)', status: 'Pending Review', payout: '₹---', time: '3h ago' },
  { id: 'R-1002', name: 'Amit R.', location: 'Mumbai', issue: 'Heavy Rain > 64mm', status: 'Protected', payout: '₹450', time: '4h ago' },
];

export default function AdminDashboard() {
  return (
    <div className="w-full max-w-7xl mx-auto p-6 pt-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-8 pb-12"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white/90">Platform Operations</h1>
            <p className="text-gray-400 font-medium">Live risk monitoring and parametric claims processing.</p>
          </div>
          <div className="px-3 py-1.5 bg-[#10a37f]/10 border border-[#10a37f]/20 rounded-full text-xs font-mono text-[#10a37f] flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]"></span>
            </span>
            SYSTEM NORMAL · 15ms LATENCY
          </div>
        </div>

        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-6 flex flex-col justify-between hover:bg-white/10 transition-colors">
            <span className="text-sm font-semibold text-gray-400 mb-4 tracking-wide uppercase">Active Riders</span>
            <div className="flex items-baseline gap-1">
              <AnimatedCounter value={2418} className="text-4xl font-bold tracking-tighter" />
              <span className="text-[#10a37f] text-sm ml-2.5 font-medium">+12%</span>
            </div>
          </div>
          <div className="glass-panel p-6 flex flex-col justify-between hover:bg-white/10 transition-colors">
            <span className="text-sm font-semibold text-gray-400 mb-4 tracking-wide uppercase">Active Protections</span>
            <div className="flex items-baseline gap-1">
              <AnimatedCounter value={980} className="text-4xl font-bold tracking-tighter" />
            </div>
          </div>
          <div className="glass-panel p-6 flex flex-col justify-between hover:bg-white/10 transition-colors">
            <span className="text-sm font-semibold text-gray-400 mb-4 tracking-wide uppercase">Est. Payout Pool</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl text-white/50">₹</span>
              <AnimatedCounter value={1950000} className="text-4xl font-bold tracking-tighter" />
            </div>
          </div>
          <div className="glass-panel p-6 flex flex-col justify-between border-[#ef4444]/20 bg-[linear-gradient(to_bottom_right,rgba(255,255,255,0.05),rgba(239,68,68,0.05))]">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Triggers Alert</span>
              <ShieldAlert className="w-5 h-5 text-[#ef4444]" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-white/90">Delhi NCR</span>
              <span className="text-[#ef4444] text-xs font-medium bg-[#ef4444]/20 w-fit px-2 py-0.5 rounded-sm">Heavy Rain &gt; 64mm</span>
            </div>
          </div>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 min-w-0">
            <h2 className="text-lg font-semibold text-white/80 mb-6">Disruption Risk vs Fleet Capacity</h2>
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10a37f" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10a37f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c1e', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#f2f2f3' }}
                  />
                  <Area type="monotone" dataKey="riders" name="Active Fleet" stroke="#10a37f" fillOpacity={1} fill="url(#colorRiders)" strokeWidth={2} />
                  <Area type="monotone" dataKey="risk" name="Weather Risk %" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Zone Rankings */}
          <div className="glass-panel p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-white/80 mb-6">Zone Live Action</h2>
            <div className="flex flex-col gap-5 flex-1 justify-center">
              {zoneData.map((zone, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-white/90">{zone.zone}</span>
                    <span className={zone.riskScore > 80 ? "text-[#ef4444] font-semibold" : "text-[#10a37f] font-semibold"}>
                      Risk: {zone.riskScore}%
                    </span>
                  </div>
                  <div className="w-full bg-[#27272a] rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${zone.riskScore}%` }}
                      transition={{ duration: 1, delay: idx * 0.2 }}
                      className={zone.riskScore > 80 ? "bg-[#ef4444] h-full" : "bg-[#10a37f] h-full"}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{zone.active} Active Base</span>
                    <span>{zone.protected} Protected</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Rider Feed */}
        <div className="glass-panel p-6 mt-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white/80">Live Rider Claims Feed</h2>
            <button className="text-xs font-medium text-[#10a37f] hover:text-[#0ea5e9] transition-colors">View All Logs &rarr;</button>
          </div>
          <div className="w-full overflow-x-auto hide-scrollbar">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs text-gray-500 uppercase font-semibold border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Rider ID</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Trigger / Issue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Est. Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {riderFeed.map((rider, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-white/90 font-medium group-hover:text-[#10a37f] transition-colors">{rider.name}</span>
                        <span className="text-xs">{rider.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{rider.location}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs text-gray-300">
                        {rider.issue}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={rider.status === 'Protected' ? 'text-[#10a37f]' : 'text-amber-500'}>
                        {rider.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span className={rider.status === 'Protected' ? 'text-white' : 'text-gray-500'}>{rider.payout}</span>
                        <span className="text-[10px] text-gray-600 font-sans">{rider.time}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
