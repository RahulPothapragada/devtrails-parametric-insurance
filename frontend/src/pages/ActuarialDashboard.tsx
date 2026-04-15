import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Activity, Zap, X, ChevronRight, RefreshCw } from 'lucide-react';
import { API_BASE } from '@/lib/api';

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

// Static lookups not in backend
const STATE_MAP: Record<string, string> = {
  Mumbai: 'Maharashtra', Delhi: 'Delhi', Bangalore: 'Karnataka',
  Chennai: 'Tamil Nadu', Kolkata: 'West Bengal',
  Pune: 'Maharashtra', Hyderabad: 'Telangana', Ahmedabad: 'Gujarat', Jaipur: 'Rajasthan',
  Lucknow: 'Uttar Pradesh', Indore: 'Madhya Pradesh', Patna: 'Bihar', Bhopal: 'Madhya Pradesh',
};

function getStatus(lr: number): HealthStatus {
  if (lr > 0.85) return 'critical';
  if (lr > 0.70) return 'watch';
  if (lr > 0.55) return 'optimal';
  return 'healthy';
}

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
      {[55, 70, 85].map(p => (
        <div key={p} className="absolute top-0 bottom-0 w-px"
          style={{ left: `${p}%`, background: p === 85 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)' }} />
      ))}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(to right, #10a37f44, ${cfg.color})` }}
      />
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
      {city.status === 'critical' && (
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.12), transparent 70%)' }}
        />
      )}
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
      <div className="flex justify-between items-center text-xs mt-3">
        <span className="text-gray-500">Loss Ratio</span>
        <span className="font-mono font-bold" style={{ color: cfg.color }}>
          {(city.lr * 100).toFixed(1)}%
        </span>
      </div>
      <LRBar lr={city.lr} status={city.status} />
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

function DetailPanel({ city, trendLoading, onClose }: { city: CityData; trendLoading: boolean; onClose: () => void }) {
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

        {trendLoading || city.trend.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
            {trendLoading ? 'Loading trend data…' : 'No trend data available'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    <YAxis domain={[0, 1.1]} stroke="#52525b" fontSize={11} tickLine={false} axisLine={false}
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
                      <span className="font-mono" style={{ color: a.color }}>{a.pct.toFixed(0)}%</span>
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
                  { label: 'Avg Claim Size',      val: city.totalClaims > 0 ? `₹${Math.round(city.totalPayout / city.totalClaims).toLocaleString()}` : '—' },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{s.label}</span>
                    <span className="text-xs font-mono font-bold text-white/80">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Stress Test ───────────────────────────────────────────────────
interface StressRow {
  city: string; city_tier: string;
  current_lr: number; stress_lr: number;
  current_status: string; stress_status: string;
  monsoon_multiplier: number; would_flip_to_suspended: boolean;
}

function StressTestPanel() {
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StressRow[]>([]);
  const [scenario, setScenario] = useState('');

  const suspendCount = useMemo(() => results.filter(r => r.stress_lr > 0.85).length, [results]);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/actuarial/stress-test`);
      const data = await res.json();
      setResults(data.cities || []);
      setScenario(data.scenario || '14-Day Extreme Monsoon');
      setRan(true);
    } catch {
      setRan(true);
    } finally {
      setLoading(false);
    }
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
          <button onClick={() => { setRan(false); setResults([]); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Reset
          </button>
        )}
      </div>

      <AnimatePresence>
        {ran && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}>

            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  {suspendCount} of {results.length} cities would trigger enrolment suspension
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {scenario}
                </p>
              </div>
            </div>

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
                    const stressColor = r.stress_lr > 0.85 ? '#ef4444' : r.stress_lr > 0.70 ? '#f59e0b' : '#0ea5e9';
                    const tierColor = TIER_COLOR[(r.city_tier as Tier)] || '#94a3b8';
                    const tierLabel = TIER_LABEL[(r.city_tier as Tier)] || r.city_tier;
                    return (
                      <motion.tr key={r.city}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={r.stress_lr > 0.85 ? 'bg-red-500/5' : ''}>
                        <td className="py-2.5 font-medium text-white/80">{r.city}</td>
                        <td className="py-2.5" style={{ color: tierColor }}>{tierLabel}</td>
                        <td className="py-2.5 text-right font-mono text-gray-400">{(r.current_lr * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right font-mono text-amber-400">×{r.monsoon_multiplier}</td>
                        <td className="py-2.5 text-right font-mono font-bold" style={{ color: stressColor }}>
                          {(r.stress_lr * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-center">
                          {r.stress_lr > 0.85 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              {r.would_flip_to_suspended ? '🆕 SUSPEND' : '🚨 CRITICAL'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              {STATUS_CFG[getStatus(r.stress_lr)].label}
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
  const [cities, setCities] = useState<CityData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchCities = async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/actuarial`);
      const data = await res.json();
      const all: any[] = [
        ...(data.tier_breakdown?.tier_1 || []),
        ...(data.tier_breakdown?.tier_2 || []),
        ...(data.tier_breakdown?.tier_3 || []),
      ];
      const mapped: CityData[] = all.map(c => ({
        name: c.city,
        state: STATE_MAP[c.city] || c.city,
        tier: (c.city_tier as Tier),
        lr: c.avg_loss_ratio,
        bcr: c.avg_bcr,
        status: getStatus(c.avg_loss_ratio),
        totalPremium: c.premium_collected,
        totalPayout: c.total_payout,
        totalClaims: c.total_claims,
        monsoonMult: 1.5,
        urbanPct: 70, semiUrbanPct: 20, ruralPct: 10,
        trend: [],
      }));
      setCities(mapped.sort((a, b) => b.lr - a.lr));
      setLastRefresh(new Date());
    } catch {
      // keep existing data on error
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchCities(); }, []);

  const handleCityClick = async (cityName: string) => {
    if (selectedCity === cityName) {
      setSelectedCity(null);
      return;
    }
    setSelectedCity(cityName);
    setTrendLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/actuarial/${encodeURIComponent(cityName)}`);
      const data = await res.json();
      const trend: WeekPoint[] = (data.weekly_trend || []).map((w: any, i: number) => ({
        week: `W${i + 1}`,
        lr: w.loss_ratio,
        premium: Math.round(w.premium_collected),
        payout: Math.round(w.total_payout),
        claims: w.claims,
      }));
      const uv = data.urban_vs_rural || {};
      setCities(prev => prev.map(c =>
        c.name === cityName
          ? { ...c, trend, urbanPct: uv.urban_pct ?? 70, semiUrbanPct: uv.semi_urban_pct ?? 20, ruralPct: uv.rural_pct ?? 10 }
          : c
      ));
    } catch {
      // keep empty trend
    } finally {
      setTrendLoading(false);
    }
  };

  const selectedData = cities.find(c => c.name === selectedCity) ?? null;
  const suspendedCities = cities.filter(c => c.status === 'critical');
  const watchCities     = cities.filter(c => c.status === 'watch');

  const platform = useMemo(() => ({
    totalPremium: cities.reduce((s, c) => s + c.totalPremium, 0),
    totalPayout:  cities.reduce((s, c) => s + c.totalPayout,  0),
    totalClaims:  cities.reduce((s, c) => s + c.totalClaims,  0),
  }), [cities]);
  const platformBcr = platform.totalPremium > 0 ? platform.totalPayout / platform.totalPremium : 0;
  const platformStatus = getStatus(platformBcr);
  const platCfg = STATUS_CFG[platformStatus];

  const tier1 = cities.filter(c => c.tier === 'tier_1');
  const tier2 = cities.filter(c => c.tier === 'tier_2');
  const tier3 = cities.filter(c => c.tier === 'tier_3');

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
            <p className="text-gray-400 text-sm">BCR · Loss Ratio · Sustainability monitoring across all {cities.length} cities, 3 tiers</p>
          </div>
          <div className="flex items-center gap-3">
            {dataLoading ? (
              <div className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-gray-400">Loading…</div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg border text-xs font-mono font-bold"
                style={{ color: platCfg.color, background: platCfg.bg, borderColor: platCfg.border }}>
                Platform BCR: {(platformBcr * 100).toFixed(1)}% — {platCfg.label}
              </div>
            )}
            <button
              onClick={fetchCities}
              disabled={dataLoading}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-[#10a37f] flex items-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${dataLoading ? 'animate-spin' : ''}`} />
              {dataLoading ? 'Loading…' : `LIVE · ${lastRefresh.toLocaleTimeString()}`}
            </button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Activity className="w-4 h-4" />, label: 'Platform BCR',        val: `${(platformBcr * 100).toFixed(1)}%`,               sub: 'Target: 55–70%',                             color: platCfg.color },
            { icon: <DollarSign className="w-4 h-4"/>, label: 'Total Premium Pool', val: `₹${(platform.totalPremium/100000).toFixed(1)}L`,    sub: `8 weeks · ${cities.length * 1000} riders`,  color: '#10a37f' },
            { icon: <TrendingUp className="w-4 h-4"/>, label: 'Total Claims Paid',  val: `₹${(platform.totalPayout/100000).toFixed(1)}L`,     sub: `${platform.totalClaims.toLocaleString()} claims settled`, color: '#0ea5e9' },
            { icon: <AlertTriangle className="w-4 h-4"/>, label: 'Cities at Risk',  val: `${suspendedCities.length + watchCities.length}`,     sub: `${suspendedCities.length} suspended · ${watchCities.length} on watch`, color: '#f59e0b' },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2" style={{ color: k.color }}>
                {k.icon}
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k.label}</span>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>
                  {dataLoading ? '—' : k.val}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">{k.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── City Grids ── */}
        {dataLoading ? (
          <div className="text-center py-20 text-gray-500">Loading actuarial data from backend…</div>
        ) : (
          [
            { label: 'Tier 1 — Metro Cities', cities: tier1, color: TIER_COLOR['tier_1'] },
            { label: 'Tier 2 — Major Cities', cities: tier2, color: TIER_COLOR['tier_2'] },
            { label: 'Tier 3 — Emerging Cities', cities: tier3, color: TIER_COLOR['tier_3'] },
          ].map(group => group.cities.length > 0 && (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: group.color }}>
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.cities.map(city => (
                  <div key={city.name}>
                    <CityCard
                      city={city}
                      selected={selectedCity === city.name}
                      onClick={() => handleCityClick(city.name)}
                    />
                    <AnimatePresence>
                      {selectedCity === city.name && selectedData && (
                        <DetailPanel
                          city={selectedData}
                          trendLoading={trendLoading}
                          onClose={() => setSelectedCity(null)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* ── Stress Test ── */}
        <div className="flex items-center gap-3 mt-4">
          <ChevronRight className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Stress Testing</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>
        <StressTestPanel />

      </motion.div>
    </div>
  );
}
