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

// ─── Rider dashboard palette ──────────────────────────────────────
const BLUE   = '#0071E3';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

const STATUS_CFG: Record<HealthStatus, { color: string; label: string; bg: string; border: string }> = {
  healthy:  { color: BLUE,  label: 'HEALTHY',    bg: 'rgba(0,113,227,0.08)',    border: 'rgba(0,113,227,0.20)'   },
  optimal:  { color: BLUE,  label: 'OPTIMAL',    bg: 'rgba(0,113,227,0.08)',    border: 'rgba(0,113,227,0.20)'   },
  watch:    { color: AMBER, label: 'WATCH',      bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.30)'  },
  critical: { color: RED,   label: 'SUSPENDED',  bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.30)'   },
};

// Tier labels — grayscale, no distinct accent colors
const TIER_LABEL: Record<Tier, string> = { tier_1: 'Metro', tier_2: 'Major City', tier_3: 'Emerging' };
const TIER_TEXT:  Record<Tier, string> = { tier_1: '#1D1D1F', tier_2: '#6E6E73', tier_3: '#86868B' };

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

const CARD = 'bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] border border-[#E5E5EA]';

// ─── Sub-components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
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
    <div className="relative w-full h-1.5 bg-[#F5F5F7] rounded-full overflow-visible mt-1 mb-3">
      {[55, 70, 85].map(p => (
        <div key={p} className="absolute top-0 bottom-0 w-px"
          style={{ left: `${p}%`, background: p === 85 ? 'rgba(239,68,68,0.4)' : 'rgba(0,0,0,0.08)' }} />
      ))}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: cfg.color }}
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
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
      className={`${CARD} p-5 cursor-pointer transition-all`}
      style={{
        borderColor: selected ? cfg.color : '#E5E5EA',
        background: selected ? cfg.bg : 'white',
        borderWidth: selected ? '1.5px' : '1px',
      }}
    >
      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="font-semibold text-[#1D1D1F] text-sm leading-tight">{city.name}</h3>
          <p className="text-[11px] text-[#86868B] mt-0.5">{city.state}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-medium" style={{ color: TIER_TEXT[city.tier] }}>
            {TIER_LABEL[city.tier]}
          </span>
          <StatusBadge status={city.status} />
        </div>
      </div>
      <div className="flex justify-between items-center text-xs mt-3">
        <span className="text-[#86868B]">Loss Ratio</span>
        <span className="font-mono font-semibold" style={{ color: cfg.color }}>
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
            <p className="text-[9px] text-[#86868B] uppercase tracking-widest">{m.label}</p>
            <p className="text-xs font-mono font-semibold text-[#1D1D1F] mt-0.5">{m.val}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function DetailPanel({ city, trendLoading, onClose }: { city: CityData; trendLoading: boolean; onClose: () => void }) {
  const cfg = STATUS_CFG[city.status];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={`${CARD} p-3 text-xs space-y-1`}>
        <p className="font-semibold text-[#1D1D1F]">{label}</p>
        <p className="text-[#86868B]">Premium: ₹{payload[0]?.payload?.premium?.toLocaleString()}</p>
        <p style={{ color: cfg.color }}>Payout: ₹{payload[0]?.payload?.payout?.toLocaleString()}</p>
        <p className="text-[#86868B]">Loss Ratio: {(payload[0]?.payload?.lr * 100).toFixed(1)}%</p>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`${CARD} p-6 mt-3 border-t-2`} style={{ borderTopColor: cfg.color }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F]">
              {city.name} — 8-Week Trend
            </h3>
            <p className="text-xs text-[#86868B] mt-0.5">
              {city.state} · {TIER_LABEL[city.tier]} · Avg BCR:{' '}
              <span style={{ color: cfg.color }}>{(city.bcr * 100).toFixed(1)}%</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5EA] transition-colors"
          >
            <X className="w-4 h-4 text-[#86868B]" />
          </button>
        </div>

        {trendLoading || city.trend.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-[#86868B] text-sm">
            {trendLoading ? 'Loading…' : 'No trend data available'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <p className="text-[11px] text-[#86868B] mb-3">Loss ratio over 8 weeks · dashed line = 85% suspension threshold</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={city.trend} margin={{ top: 10, right: 60, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" vertical={false} />
                    <XAxis dataKey="week" stroke="#D2D2D7" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 1.1]} stroke="#D2D2D7" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0.85} stroke={RED} strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: '85%', position: 'right', fill: RED, fontSize: 10 }} />
                    <ReferenceLine y={0.55} stroke="#D2D2D7" strokeDasharray="4 4" strokeWidth={1}
                      label={{ value: 'Target', position: 'right', fill: '#86868B', fontSize: 10 }} />
                    <Area type="monotone" dataKey="lr" stroke={cfg.color} strokeWidth={2}
                      fill="url(#lrGrad)" dot={{ fill: cfg.color, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: cfg.color }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className={`${CARD} p-4`}>
                <p className="text-[10px] font-semibold text-[#86868B] mb-3 uppercase tracking-wider">Payout Split</p>
                {[
                  { label: 'Urban',      pct: city.urbanPct },
                  { label: 'Semi-Urban', pct: city.semiUrbanPct },
                  { label: 'Rural',      pct: city.ruralPct },
                ].map(a => (
                  <div key={a.label} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#86868B]">{a.label}</span>
                      <span className="font-mono text-[#1D1D1F]">{a.pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${a.pct}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full rounded-full"
                        style={{ background: BLUE, opacity: a.label === 'Urban' ? 1 : a.label === 'Semi-Urban' ? 0.55 : 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={`${CARD} p-4 space-y-3`}>
                {[
                  { label: '8-Wk Premium Pool', val: `₹${(city.totalPremium / 100000).toFixed(2)}L` },
                  { label: '8-Wk Claims Paid',  val: `₹${(city.totalPayout  / 100000).toFixed(2)}L` },
                  { label: 'Total Claims',       val: city.totalClaims.toLocaleString() },
                  { label: 'Avg Claim Size',     val: city.totalClaims > 0 ? `₹${Math.round(city.totalPayout / city.totalClaims).toLocaleString()}` : '—' },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-xs text-[#86868B]">{s.label}</span>
                    <span className="text-xs font-mono font-semibold text-[#1D1D1F]">{s.val}</span>
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
    <div className={`${CARD} p-6`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#86868B]" />
            Monsoon Stress Test
          </h2>
          <p className="text-xs text-[#86868B] mt-1">
            Projects Loss Ratios under a 14-day extreme monsoon scenario (IMD worst-case)
          </p>
        </div>
        {!ran ? (
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><span className="animate-spin w-3.5 h-3.5 border-2 border-[#86868B] border-t-transparent rounded-full" />Running…</>
            ) : (
              <>Run Stress Test</>
            )}
          </button>
        ) : (
          <button onClick={() => { setRan(false); setResults([]); }}
            className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors">
            Reset
          </button>
        )}
      </div>

      <AnimatePresence>
        {ran && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}>

            <div className="mb-4 p-3.5 rounded-xl bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)] flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: RED }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: RED }}>
                  {suspendCount} of {results.length} cities would trigger enrolment suspension
                </p>
                <p className="text-xs text-[#86868B] mt-0.5">{scenario}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#86868B] uppercase tracking-wider border-b border-[#E5E5EA]">
                    <th className="py-2 text-left font-semibold">City</th>
                    <th className="py-2 text-left font-semibold">Tier</th>
                    <th className="py-2 text-right font-semibold">Current LR</th>
                    <th className="py-2 text-right font-semibold">Multiplier</th>
                    <th className="py-2 text-right font-semibold">Projected LR</th>
                    <th className="py-2 text-center font-semibold">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7]">
                  {results.map((r, i) => {
                    const isCritical = r.stress_lr > 0.85;
                    const stressColor = isCritical ? RED : r.stress_lr > 0.70 ? AMBER : BLUE;
                    return (
                      <motion.tr key={r.city}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={isCritical ? 'bg-[rgba(239,68,68,0.05)]' : ''}>
                        <td className="py-2.5 font-medium text-[#1D1D1F]">{r.city}</td>
                        <td className="py-2.5 text-[#86868B]">{TIER_LABEL[(r.city_tier as Tier)] || r.city_tier}</td>
                        <td className="py-2.5 text-right font-mono text-[#86868B]">{(r.current_lr * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right font-mono text-[#1D1D1F]">×{r.monsoon_multiplier}</td>
                        <td className="py-2.5 text-right font-mono font-semibold" style={{ color: stressColor }}>
                          {(r.stress_lr * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-center">
                          {isCritical ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.25)]" style={{ color: RED }}>
                              SUSPEND
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F5F7] text-[#86868B]">
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

            <p className="text-[10px] text-[#86868B] mt-4">
              * Multipliers sourced from IMD historical data (2018–2024). BCR target: 0.55–0.70. Suspension threshold: LR &gt; 0.85.
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
  const [totalRiders, setTotalRiders] = useState<number>(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchCities = async () => {
    setDataLoading(true);
    try {
      const [actuarialRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/actuarial`),
        fetch(`${API_BASE}/admin/stats`),
      ]);
      const data = await actuarialRes.json();
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTotalRiders(stats.total_riders || 0);
      }
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
      const trend: WeekPoint[] = (data.weekly_trend || []).map((w: any) => ({
        week: w.week_start
          ? new Date(w.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          : '—',
        lr: w.loss_ratio ?? 0,
        premium: Math.round(w.premium_collected ?? 0),
        payout: Math.round(w.total_payout ?? 0),
        claims: w.claims ?? 0,
      })).filter((w: WeekPoint) => w.lr > 0 || w.premium > 0);
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
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pb-12">

        {/* ── Suspension Banner ── */}
        <AnimatePresence>
          {suspendedCities.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl px-5 py-3.5 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.25)` }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: RED }} />
              <p className="text-sm font-medium" style={{ color: RED }}>
                New enrolments suspended in {suspendedCities.map(c => c.name).join(', ')} — Loss Ratio exceeds 85% threshold
              </p>
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ color: RED, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.2)' }}>
                AUTO
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] mb-1">Analytics</h1>
            <p className="text-sm text-[#86868B]">
              BCR · Loss Ratio · Sustainability across {cities.length} cities, 3 tiers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!dataLoading && (
              <div className="px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold"
                style={{ color: platCfg.color, background: platCfg.bg, borderColor: platCfg.border }}>
                Platform BCR {(platformBcr * 100).toFixed(1)}% · {platCfg.label}
              </div>
            )}
            <button
              onClick={fetchCities}
              disabled={dataLoading}
              className="px-3 py-1.5 bg-white border border-[#E5E5EA] rounded-xl text-xs text-[#86868B] flex items-center gap-1.5 hover:bg-[#F5F5F7] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${dataLoading ? 'animate-spin' : ''}`} />
              {dataLoading ? 'Loading…' : lastRefresh.toLocaleTimeString()}
            </button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Activity className="w-4 h-4" />,     label: 'Platform BCR',      val: `${(platformBcr * 100).toFixed(1)}%`,             sub: 'Target: 55–70%',                                           color: platCfg.color },
            { icon: <DollarSign className="w-4 h-4" />,   label: 'Premium Pool',       val: `₹${(platform.totalPremium / 100000).toFixed(1)}L`, sub: `8 weeks · ${totalRiders.toLocaleString('en-IN')} riders`,  color: '#1D1D1F' },
            { icon: <TrendingUp className="w-4 h-4" />,   label: 'Claims Paid',         val: `₹${(platform.totalPayout / 100000).toFixed(1)}L`,  sub: `${platform.totalClaims.toLocaleString()} claims settled`,  color: '#1D1D1F' },
            { icon: <AlertTriangle className="w-4 h-4" />, label: 'Cities at Risk',     val: `${suspendedCities.length + watchCities.length}`,   sub: `${suspendedCities.length} suspended · ${watchCities.length} watch`, color: suspendedCities.length > 0 ? RED : AMBER },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${CARD} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#86868B]">{k.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{k.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>
                {dataLoading ? '—' : k.val}
              </p>
              <p className="text-[11px] text-[#86868B] mt-1">{k.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── City Grids ── */}
        {dataLoading ? (
          <div className="text-center py-20 text-[#86868B] text-sm">Loading data…</div>
        ) : (
          [
            { label: 'Tier 1 — Metro Cities',    cities: tier1 },
            { label: 'Tier 2 — Major Cities',    cities: tier2 },
            { label: 'Tier 3 — Emerging Cities', cities: tier3 },
          ].map(group => group.cities.length > 0 && (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-[#E5E5EA]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-[#E5E5EA]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.cities.map(city => (
                  <CityCard
                    key={city.name}
                    city={city}
                    selected={selectedCity === city.name}
                    onClick={() => handleCityClick(city.name)}
                  />
                ))}
              </div>
              <AnimatePresence>
                {selectedCity && group.cities.some(c => c.name === selectedCity) && selectedData && (
                  <DetailPanel
                    city={selectedData}
                    trendLoading={trendLoading}
                    onClose={() => setSelectedCity(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          ))
        )}

        {/* ── Stress Test ── */}
        <div className="flex items-center gap-3 mt-2">
          <ChevronRight className="w-3.5 h-3.5 text-[#86868B]" />
          <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest">Stress Testing</span>
          <div className="h-px flex-1 bg-[#E5E5EA]" />
        </div>
        <StressTestPanel />

      </motion.div>
    </div>
  );
}
