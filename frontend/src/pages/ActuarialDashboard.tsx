import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Activity, Zap, X, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
type Tier = 'tier_1' | 'tier_2' | 'tier_3';
type HealthStatus = 'healthy' | 'optimal' | 'watch' | 'critical';

interface WeekPoint { week: string; lr: number; premium: number; payout: number; claims: number; }
interface CityData {
  name: string; state: string; tier: Tier;
  lr: number; bcr: number; status: HealthStatus;
  totalPremium: number; totalPayout: number; totalClaims: number;
  monsoonMult: number;
  urbanPct: number; semiUrbanPct: number; ruralPct: number;
  trend: WeekPoint[];
}

// ─── Config ───────────────────────────────────────────────────────
const STATUS_CFG: Record<HealthStatus, { color: string; label: string; bg: string; border: string }> = {
  healthy:  { color: '#10a37f', label: 'HEALTHY',       bg: 'rgba(16,163,127,0.12)',  border: 'rgba(16,163,127,0.30)' },
  optimal:  { color: '#0ea5e9', label: 'OPTIMAL',       bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.30)' },
  watch:    { color: '#f59e0b', label: '⚡ WATCH',      bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.40)' },
  critical: { color: '#ef4444', label: '🚨 SUSPENDED',  bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.50)' },
};
const TIER_LABEL: Record<Tier, string>  = { tier_1: 'Metro', tier_2: 'Major City', tier_3: 'Emerging' };
const TIER_COLOR: Record<Tier, string>  = { tier_1: '#a78bfa', tier_2: '#60a5fa', tier_3: '#34d399' };

function getStatus(lr: number): HealthStatus {
  if (lr > 0.85) return 'critical';
  if (lr > 0.70) return 'watch';
  if (lr > 0.55) return 'optimal';
  return 'healthy';
}

// ─── Deterministic weekly trend builder ───────────────────────────
const mkTrend = (lrs: number[], premBase: number): WeekPoint[] =>
  lrs.map((lr, i) => {
    const premium = Math.round(premBase * (0.94 + (i % 3) * 0.02));
    return { week: `W${i + 1}`, lr, premium, payout: Math.round(premium * lr), claims: Math.round(premium * lr / 280) };
  });

// ─── City Data (matches backend seed exactly) ─────────────────────
const CITIES: CityData[] = [
  // Tier 1 — Metros (1000 riders × ₹62 avg/week)
  { name: 'Mumbai',    state: 'Maharashtra',    tier: 'tier_1', lr: 0.63, bcr: 0.63, status: 'optimal',
    totalPremium: 496000, totalPayout: 312480, totalClaims: 967,  monsoonMult: 2.2,
    urbanPct: 71, semiUrbanPct: 21, ruralPct: 8,
    trend: mkTrend([0.52,0.55,0.67,0.71,0.68,0.63,0.58,0.61], 62000) },
  { name: 'Delhi',     state: 'Delhi',          tier: 'tier_1', lr: 0.84, bcr: 0.84, status: 'watch',
    totalPremium: 496000, totalPayout: 416640, totalClaims: 1204, monsoonMult: 1.6,
    urbanPct: 68, semiUrbanPct: 24, ruralPct: 8,
    trend: mkTrend([0.91,0.88,0.82,0.79,0.81,0.86,0.84,0.83], 62000) },
  { name: 'Bangalore', state: 'Karnataka',      tier: 'tier_1', lr: 0.58, bcr: 0.58, status: 'optimal',
    totalPremium: 496000, totalPayout: 287680, totalClaims: 891,  monsoonMult: 1.8,
    urbanPct: 75, semiUrbanPct: 18, ruralPct: 7,
    trend: mkTrend([0.54,0.56,0.60,0.58,0.57,0.55,0.62,0.60], 62000) },
  { name: 'Chennai',   state: 'Tamil Nadu',     tier: 'tier_1', lr: 0.69, bcr: 0.69, status: 'optimal',
    totalPremium: 496000, totalPayout: 342240, totalClaims: 1058, monsoonMult: 2.0,
    urbanPct: 65, semiUrbanPct: 25, ruralPct: 10,
    trend: mkTrend([0.72,0.68,0.65,0.71,0.69,0.68,0.70,0.72], 62000) },
  { name: 'Kolkata',   state: 'West Bengal',    tier: 'tier_1', lr: 0.72, bcr: 0.72, status: 'watch',
    totalPremium: 496000, totalPayout: 357120, totalClaims: 1109, monsoonMult: 2.4,
    urbanPct: 62, semiUrbanPct: 25, ruralPct: 13,
    trend: mkTrend([0.68,0.71,0.75,0.73,0.70,0.72,0.74,0.73], 62000) },
  // Tier 2 — Major Cities (1000 riders × ₹45 avg/week)
  { name: 'Pune',      state: 'Maharashtra',    tier: 'tier_2', lr: 0.55, bcr: 0.55, status: 'healthy',
    totalPremium: 360000, totalPayout: 198000,  totalClaims: 614,  monsoonMult: 1.8,
    urbanPct: 60, semiUrbanPct: 25, ruralPct: 15,
    trend: mkTrend([0.52,0.54,0.56,0.55,0.53,0.56,0.55,0.57], 45000) },
  { name: 'Hyderabad', state: 'Telangana',      tier: 'tier_2', lr: 0.62, bcr: 0.62, status: 'optimal',
    totalPremium: 360000, totalPayout: 223200,  totalClaims: 692,  monsoonMult: 1.5,
    urbanPct: 65, semiUrbanPct: 22, ruralPct: 13,
    trend: mkTrend([0.59,0.62,0.64,0.61,0.63,0.62,0.60,0.63], 45000) },
  { name: 'Ahmedabad', state: 'Gujarat',        tier: 'tier_2', lr: 0.65, bcr: 0.65, status: 'optimal',
    totalPremium: 360000, totalPayout: 234000,  totalClaims: 725,  monsoonMult: 1.4,
    urbanPct: 58, semiUrbanPct: 28, ruralPct: 14,
    trend: mkTrend([0.63,0.68,0.65,0.66,0.64,0.65,0.63,0.66], 45000) },
  { name: 'Jaipur',    state: 'Rajasthan',      tier: 'tier_2', lr: 0.67, bcr: 0.67, status: 'optimal',
    totalPremium: 360000, totalPayout: 241200,  totalClaims: 747,  monsoonMult: 1.3,
    urbanPct: 55, semiUrbanPct: 30, ruralPct: 15,
    trend: mkTrend([0.65,0.69,0.68,0.67,0.65,0.68,0.67,0.68], 45000) },
  // Tier 3 — Emerging (1000 riders × ₹30 avg/week)
  { name: 'Lucknow',   state: 'Uttar Pradesh',  tier: 'tier_3', lr: 0.59, bcr: 0.59, status: 'optimal',
    totalPremium: 240000, totalPayout: 141600,  totalClaims: 439,  monsoonMult: 2.0,
    urbanPct: 50, semiUrbanPct: 30, ruralPct: 20,
    trend: mkTrend([0.56,0.58,0.61,0.59,0.57,0.60,0.59,0.60], 30000) },
  { name: 'Indore',    state: 'Madhya Pradesh', tier: 'tier_3', lr: 0.52, bcr: 0.52, status: 'healthy',
    totalPremium: 240000, totalPayout: 124800,  totalClaims: 387,  monsoonMult: 1.5,
    urbanPct: 55, semiUrbanPct: 28, ruralPct: 17,
    trend: mkTrend([0.50,0.52,0.54,0.51,0.53,0.52,0.50,0.53], 30000) },
  { name: 'Patna',     state: 'Bihar',          tier: 'tier_3', lr: 0.89, bcr: 0.89, status: 'critical',
    totalPremium: 240000, totalPayout: 213600,  totalClaims: 662,  monsoonMult: 2.8,
    urbanPct: 45, semiUrbanPct: 30, ruralPct: 25,
    trend: mkTrend([0.95,0.91,0.88,0.92,0.86,0.89,0.93,0.90], 30000) },
  { name: 'Bhopal',    state: 'Madhya Pradesh', tier: 'tier_3', lr: 0.53, bcr: 0.53, status: 'healthy',
    totalPremium: 240000, totalPayout: 127200,  totalClaims: 394,  monsoonMult: 1.6,
    urbanPct: 52, semiUrbanPct: 28, ruralPct: 20,
    trend: mkTrend([0.51,0.53,0.55,0.52,0.54,0.53,0.51,0.54], 30000) },
];

// ─── Platform Totals ──────────────────────────────────────────────
const PLATFORM = {
  totalPremium: CITIES.reduce((s, c) => s + c.totalPremium, 0),
  totalPayout:  CITIES.reduce((s, c) => s + c.totalPayout,  0),
  totalClaims:  CITIES.reduce((s, c) => s + c.totalClaims,  0),
};
const PLATFORM_BCR = PLATFORM.totalPayout / PLATFORM.totalPremium;

// ─── Sub-components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function LRBar({ lr, status }: { lr: number; status: HealthStatus }) {
  const pct = Math.min(lr * 100, 100);
  const cfg = STATUS_CFG[status];
  return (
    <div className="relative w-full h-2.5 bg-white/5 rounded-full overflow-visible mt-1 mb-3">
      {/* zone dividers */}
      {[55, 70, 85].map(p => (
        <div key={p} className="absolute top-0 bottom-0 w-px"
          style={{ left: `${p}%`, background: p === 85 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)' }} />
      ))}
      {/* fill */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(to right, #10a37f44, ${cfg.color})` }}
      />
      {/* dot */}
      <motion.div
        initial={{ left: '0%' }}
        animate={{ left: `${Math.min(pct - 1, 97)}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#0f0f11] shadow-lg"
        style={{ backgroundColor: cfg.color }}
      />
    </div>
  );
}

function CityCard({ city, selected, onClick }: { city: CityData; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CFG[city.status];
  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      className="glass-panel p-5 cursor-pointer transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? cfg.color : 'rgba(255,255,255,0.06)',
        background: selected ? cfg.bg : undefined,
        borderWidth: selected ? '1.5px' : '1px',
      }}
    >
      {/* pulse for critical */}
      {city.status === 'critical' && (
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.12), transparent 70%)' }}
        />
      )}

      {/* header */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="font-semibold text-white/90 text-sm leading-tight">{city.name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{city.state}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-semibold" style={{ color: TIER_COLOR[city.tier] }}>
            {TIER_LABEL[city.tier]}
          </span>
          <StatusBadge status={city.status} />
        </div>
      </div>

      {/* LR label */}
      <div className="flex justify-between items-center text-xs mt-3">
        <span className="text-gray-500">Loss Ratio</span>
        <span className="font-mono font-bold" style={{ color: cfg.color }}>
          {(city.lr * 100).toFixed(1)}%
        </span>
      </div>
      <LRBar lr={city.lr} status={city.status} />

      {/* metrics */}
      <div className="grid grid-cols-3 gap-1 mt-2">
        {[
          { label: 'BCR', val: city.bcr.toFixed(2) },
          { label: 'Claims', val: city.totalClaims.toLocaleString() },
          { label: 'Payout', val: `₹${(city.totalPayout / 100000).toFixed(1)}L` },
        ].map(m => (
          <div key={m.label} className="text-center">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest">{m.label}</p>
            <p className="text-xs font-mono font-bold text-white/80 mt-0.5">{m.val}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-ping" style={{ background: cfg.color }} />
      )}
    </motion.div>
  );
}

function DetailPanel({ city, onClose }: { city: CityData; onClose: () => void }) {
  const cfg = STATUS_CFG[city.status];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-panel p-3 text-xs space-y-1 border border-white/10">
        <p className="font-semibold text-white/80">{label}</p>
        <p style={{ color: '#10a37f' }}>Premium: ₹{payload[0]?.payload?.premium?.toLocaleString()}</p>
        <p style={{ color: cfg.color }}>Payout: ₹{payload[0]?.payload?.payout?.toLocaleString()}</p>
        <p className="text-gray-400">Loss Ratio: {(payload[0]?.payload?.lr * 100).toFixed(1)}%</p>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden"
    >
      <div className="glass-panel p-6 mt-0 border-t-2" style={{ borderColor: cfg.color }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-white/90">{city.name} — 8-Week Actuarial Trend</h3>
            <p className="text-xs text-gray-400 mt-1">
              {city.state} · {TIER_LABEL[city.tier]} · Avg BCR: <span style={{ color: cfg.color }}>{(city.bcr * 100).toFixed(1)}%</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart */}
          <div className="lg:col-span-2">
            <p className="text-xs text-gray-500 mb-3">Loss Ratio Trend (red line = 85% suspension threshold)</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={city.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="week" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0.3, 1.1]} stroke="#52525b" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0.85} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: '85% Limit', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                  <ReferenceLine y={0.55} stroke="#10a37f" strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: 'Target', position: 'right', fill: '#10a37f', fontSize: 10 }} />
                  <Area type="monotone" dataKey="lr" stroke={cfg.color} strokeWidth={2}
                    fill="url(#lrGrad)" dot={{ fill: cfg.color, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: cfg.color }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Area Breakdown + Stats */}
          <div className="flex flex-col gap-4">
            <div className="glass-panel p-4">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Payout Area Split</p>
              {[
                { label: 'Urban', pct: city.urbanPct, color: '#0ea5e9' },
                { label: 'Semi-Urban', pct: city.semiUrbanPct, color: '#f59e0b' },
                { label: 'Rural', pct: city.ruralPct, color: '#10a37f' },
              ].map(a => (
                <div key={a.label} className="mb-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{a.label}</span>
                    <span className="font-mono" style={{ color: a.color }}>{a.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${a.pct}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="h-full rounded-full" style={{ background: a.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-panel p-4 space-y-3">
              {[
                { label: '8-Wk Premium Pool', val: `₹${(city.totalPremium / 100000).toFixed(2)}L` },
                { label: '8-Wk Claims Paid',  val: `₹${(city.totalPayout  / 100000).toFixed(2)}L` },
                { label: 'Total Claims',        val: city.totalClaims.toLocaleString() },
                { label: 'Avg Claim Size',      val: `₹${Math.round(city.totalPayout / city.totalClaims).toLocaleString()}` },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{s.label}</span>
                  <span className="text-xs font-mono font-bold text-white/80">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stress Test ───────────────────────────────────────────────────
interface StressRow {
  name: string; tier: Tier; currentLr: number; stressLr: number;
  currentStatus: HealthStatus; stressStatus: HealthStatus; wouldFlip: boolean;
}

function StressTestPanel() {
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);

  const results = useMemo<StressRow[]>(() =>
    CITIES.map(c => {
      const sl = Math.min(c.lr * c.monsoonMult, 2.5);
      return {
        name: c.name, tier: c.tier,
        currentLr: c.lr, stressLr: sl,
        currentStatus: c.status, stressStatus: getStatus(sl),
        wouldFlip: sl > 0.85 && c.lr <= 0.85,
      };
    }), []);

  const suspendCount = results.filter(r => r.stressLr > 0.85).length;

  const handleRun = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setRan(true); }, 1200);
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Monsoon Stress Test Simulator
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Projects Loss Ratios under a 14-day extreme monsoon scenario (IMD worst-case: 300mm/6hrs, Jul 2024)
          </p>
        </div>
        {!ran && (
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><span className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full" />Running…</>
            ) : (
              <><span>🌧️</span> Run Stress Test</>
            )}
          </button>
        )}
        {ran && (
          <button onClick={() => setRan(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Reset
          </button>
        )}
      </div>

      <AnimatePresence>
        {ran && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}>

            {/* Summary banner */}
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  {suspendCount} of 13 cities would trigger enrolment suspension
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Methodology: current LR × city-specific IMD monsoon intensity multiplier
                </p>
              </div>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-widest border-b border-white/5">
                    <th className="py-2 text-left">City</th>
                    <th className="py-2 text-left">Tier</th>
                    <th className="py-2 text-right">Current LR</th>
                    <th className="py-2 text-right">Monsoon Mult</th>
                    <th className="py-2 text-right">Projected LR</th>
                    <th className="py-2 text-center">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.map((r, i) => {
                    const stressColor = r.stressLr > 0.85 ? '#ef4444' : r.stressLr > 0.70 ? '#f59e0b' : '#0ea5e9';
                    return (
                      <motion.tr key={r.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={r.stressLr > 0.85 ? 'bg-red-500/5' : ''}>
                        <td className="py-2.5 font-medium text-white/80">{r.name}</td>
                        <td className="py-2.5" style={{ color: TIER_COLOR[r.tier] }}>{TIER_LABEL[r.tier]}</td>
                        <td className="py-2.5 text-right font-mono text-gray-400">{(r.currentLr * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right font-mono text-amber-400">×{CITIES.find(c => c.name === r.name)!.monsoonMult}</td>
                        <td className="py-2.5 text-right font-mono font-bold" style={{ color: stressColor }}>
                          {(r.stressLr * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-center">
                          {r.stressLr > 0.85 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              {r.wouldFlip ? '🆕 SUSPEND' : '🚨 CRITICAL'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              {STATUS_CFG[r.stressStatus].label}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-gray-600 mt-4">
              * Multipliers sourced from IMD historical event data (2018–2024). BCR target: 0.55–0.70. Suspension threshold: LR &gt; 0.85.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function ActuarialDashboard() {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const suspendedCities = CITIES.filter(c => c.status === 'critical');
  const watchCities     = CITIES.filter(c => c.status === 'watch');
  const selectedData    = CITIES.find(c => c.name === selectedCity) ?? null;

  const platformStatus = getStatus(PLATFORM_BCR);
  const platCfg = STATUS_CFG[platformStatus];

  const tier1 = CITIES.filter(c => c.tier === 'tier_1');
  const tier2 = CITIES.filter(c => c.tier === 'tier_2');
  const tier3 = CITIES.filter(c => c.tier === 'tier_3');

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pb-12">

        {/* ── Suspension Banner ── */}
        <AnimatePresence>
          {suspendedCities.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/40 rounded-xl px-5 py-3.5 flex items-center gap-3">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </motion.div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-red-400">
                  ⚠️ New enrolments suspended in {suspendedCities.map(c => c.name).join(', ')}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  — Loss Ratio {suspendedCities.map(c => `${(c.lr * 100).toFixed(0)}%`).join(', ')} exceeds 85% threshold
                </span>
              </div>
              <span className="text-[10px] font-mono text-red-500/80 bg-red-500/10 px-2 py-1 rounded">
                AUTO-TRIGGERED
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white/90 mb-1.5">Actuarial Command Center</h1>
            <p className="text-gray-400 text-sm">BCR · Loss Ratio · Sustainability monitoring across all 13 cities, 3 tiers</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg border text-xs font-mono font-bold"
              style={{ color: platCfg.color, background: platCfg.bg, borderColor: platCfg.border }}>
              Platform BCR: {(PLATFORM_BCR * 100).toFixed(1)}% — {platCfg.label}
            </div>
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-[#10a37f] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]" />
              </span>
              LIVE · 8-week window
            </div>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Activity className="w-4 h-4" />, label: 'Platform BCR',     val: `${(PLATFORM_BCR * 100).toFixed(1)}%`, sub: 'Target: 55–70%',            color: platCfg.color },
            { icon: <DollarSign className="w-4 h-4"/>, label: 'Total Premium Pool', val: `₹${(PLATFORM.totalPremium/100000).toFixed(1)}L`, sub: '8 weeks · 13,000 riders', color: '#10a37f' },
            { icon: <TrendingUp className="w-4 h-4"/>, label: 'Total Claims Paid',  val: `₹${(PLATFORM.totalPayout/100000).toFixed(1)}L`,  sub: `${PLATFORM.totalClaims.toLocaleString()} claims settled`, color: '#0ea5e9' },
            { icon: <AlertTriangle className="w-4 h-4"/>, label: 'Cities at Risk',  val: `${suspendedCities.length + watchCities.length}`,      sub: `${suspendedCities.length} suspended · ${watchCities.length} on watch`, color: '#f59e0b' },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2" style={{ color: k.color }}>
                {k.icon}
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tighter" style={{ color: k.color }}>{k.val}</p>
                <p className="text-xs text-gray-500 mt-1">{k.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── BCR Zone Legend ── */}
        <div className="glass-panel px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">BCR Health Zones:</span>
          {(Object.entries(STATUS_CFG) as [HealthStatus, typeof STATUS_CFG[HealthStatus]][]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
              <span style={{ color: v.color }} className="font-medium">{v.label}</span>
              <span className="text-gray-600">
                {k === 'healthy' ? '≤55%' : k === 'optimal' ? '55–70%' : k === 'watch' ? '70–85%' : '>85%'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Tier 1 Grid ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#a78bfa]" /> Tier 1 — Metro Cities
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {tier1.map(c => (
              <CityCard key={c.name} city={c} selected={selectedCity === c.name}
                onClick={() => setSelectedCity(selectedCity === c.name ? null : c.name)} />
            ))}
          </div>
        </div>

        {/* Detail panel (Tier 1 selection) */}
        <AnimatePresence>
          {selectedData && selectedData.tier === 'tier_1' && (
            <DetailPanel key={selectedData.name} city={selectedData} onClose={() => setSelectedCity(null)} />
          )}
        </AnimatePresence>

        {/* ── Tier 2 Grid ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#60a5fa]" /> Tier 2 — Major Cities
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tier2.map(c => (
              <CityCard key={c.name} city={c} selected={selectedCity === c.name}
                onClick={() => setSelectedCity(selectedCity === c.name ? null : c.name)} />
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedData && selectedData.tier === 'tier_2' && (
            <DetailPanel key={selectedData.name} city={selectedData} onClose={() => setSelectedCity(null)} />
          )}
        </AnimatePresence>

        {/* ── Tier 3 Grid ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#34d399]" /> Tier 3 — Emerging Cities
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <span className="text-gray-600 normal-case font-normal">Patna suspended due to Bihar flood risk</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tier3.map(c => (
              <CityCard key={c.name} city={c} selected={selectedCity === c.name}
                onClick={() => setSelectedCity(selectedCity === c.name ? null : c.name)} />
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedData && selectedData.tier === 'tier_3' && (
            <DetailPanel key={selectedData.name} city={selectedData} onClose={() => setSelectedCity(null)} />
          )}
        </AnimatePresence>

        {/* ── Stress Test ── */}
        <StressTestPanel />

        {/* ── Footer note ── */}
        <p className="text-[11px] text-gray-600 text-center">
          BCR target range: 0.55–0.70 · Enrolment suspension triggers at LR &gt; 0.85 · Data: 8-week rolling window · 13,000 riders across 13 cities
        </p>
      </motion.div>
    </div>
  );
}
