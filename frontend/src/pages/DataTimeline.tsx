import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  Activity, CloudRain, Thermometer, Wind,
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API = 'http://localhost:8000/api';
const POLL_MS = 15_000;
const SUSPEND = 0.85;
const TARGET_HI = 0.70;
const TARGET_LO = 0.55;

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoricalPoint {
  week_label: string;
  week_start: string;
  bcr: number;
  loss_ratio: number;
  premium_collected: number;
  total_payout: number;
  total_claims: number;
  status: string;
}

interface CurrentWeek {
  week_label: string;
  progress_pct: number;
  bcr: number;
  premium_so_far: number;
  payout_so_far: number;
  season_mult: number;
  shock_mult: number;
  status: string;
  suspension_risk: boolean;
}

interface ProjectionPoint {
  week_label: string;
  week_offset: number;
  bcr_mean: number;
  bcr_p10: number;
  bcr_p90: number;
  premium_mean: number;
  payout_mean: number;
  status: string;
  suspension_risk: boolean;
}

interface SimMeta {
  suspend_threshold: number;
  bcr_target_low: number;
  bcr_target_high: number;
  historical_avg_lr: number;
  historical_avg_premium: number;
  monte_carlo_paths: number;
  tick_interval_s: number;
  scenario_label: string;
  scenario_description: string;
}

interface TimelineData {
  city: string;
  city_tier: string;
  scenario: string;
  historical: HistoricalPoint[];
  current_week: CurrentWeek;
  projection: ProjectionPoint[];
  simulation_meta: SimMeta;
}

interface CityItem { name: string; tier: string; }

// ── Unified chart point (three zones share one axis) ──────────────────────────

interface ChartPoint {
  label: string;
  zone: 'historical' | 'current' | 'projection';
  // historical + current
  bcr?: number;
  // projection
  bcr_mean?: number;
  bcr_p10?: number;
  // band trick: stacked area needs base + width
  band_base?: number;
  band_width?: number;
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    key: 'normal',
    label: 'Normal',
    icon: <Activity className="w-3.5 h-3.5" />,
    color: '#10a37f',
    desc: 'Baseline — no adverse events',
  },
  {
    key: 'monsoon',
    label: 'Monsoon',
    icon: <CloudRain className="w-3.5 h-3.5" />,
    color: '#3b82f6',
    desc: 'LR ×1.65 — suspension likely',
  },
  {
    key: 'heat_wave',
    label: 'Heat Wave',
    icon: <Thermometer className="w-3.5 h-3.5" />,
    color: '#f59e0b',
    desc: 'LR ×1.18 — moderate stress',
  },
  {
    key: 'aqi_crisis',
    label: 'AQI Crisis',
    icon: <Wind className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    desc: 'LR ×1.30 — elevated risk',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function bcrColor(v: number) {
  if (v > SUSPEND)    return '#ef4444';
  if (v > TARGET_HI)  return '#f59e0b';
  if (v > TARGET_LO)  return '#0ea5e9';
  return '#10a37f';
}

function bcrLabel(v: number) {
  if (v > SUSPEND)    return 'SUSPENDED';
  if (v > TARGET_HI)  return 'WATCH';
  if (v > TARGET_LO)  return 'OPTIMAL';
  return 'HEALTHY';
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

const TIER_LABEL: Record<string, string> = {
  tier_1: 'Tier 1 · Metro',
  tier_2: 'Tier 2 · Major',
  tier_3: 'Tier 3 · Emerging',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color, pulse = false,
}: {
  label: string; value: string; sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex-1 min-w-[130px] relative overflow-hidden shadow-sm">
      {pulse && (
        <motion.div
          animate={{ opacity: [0.08, 0.22, 0.08] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top right, ${color}33, transparent 70%)` }}
        />
      )}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-xl min-w-[150px]">
      <p className="font-bold text-foreground uppercase tracking-wider mb-2">{label}</p>
      {d.zone === 'historical' && d.bcr !== undefined && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">BCR</span>
            <span className="font-mono font-bold" style={{ color: bcrColor(d.bcr) }}>{(d.bcr * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <span className="font-bold" style={{ color: bcrColor(d.bcr) }}>{bcrLabel(d.bcr)}</span>
          </div>
        </>
      )}
      {d.zone === 'current' && d.bcr !== undefined && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-yellow-400">Live BCR</span>
            <span className="font-mono font-bold text-yellow-400">{(d.bcr * 100).toFixed(1)}%</span>
          </div>
        </>
      )}
      {d.zone === 'projection' && d.bcr_mean !== undefined && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-purple-400">P50 (mean)</span>
            <span className="font-mono font-bold text-purple-400">{(d.bcr_mean * 100).toFixed(1)}%</span>
          </div>
          {d.bcr_p10 !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">P10 (best)</span>
              <span className="font-mono text-[#10a37f]">{(d.bcr_p10 * 100).toFixed(1)}%</span>
            </div>
          )}
          {d.band_base !== undefined && d.band_width !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">P90 (worst)</span>
              <span className="font-mono text-[#ef4444]">{((d.band_base + d.band_width) * 100).toFixed(1)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Historical detail table ────────────────────────────────────────────────────

function HistoryTable({ data }: { data: HistoricalPoint[] }) {
  const STATUS_COLOR: Record<string, string> = {
    healthy: '#10a37f', optimal: '#0ea5e9', watch: '#f59e0b', critical: '#ef4444',
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="border-b border-border text-muted-foreground font-semibold uppercase tracking-widest">
          <tr>
            <th className="py-2 px-3">Week</th>
            <th className="py-2 px-3 text-right">Premium</th>
            <th className="py-2 px-3 text-right">Payout</th>
            <th className="py-2 px-3 text-right">Claims</th>
            <th className="py-2 px-3 text-right">BCR</th>
            <th className="py-2 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {[...data].reverse().map((h, i) => (
            <tr key={i} className="hover:bg-accent/20 transition-colors">
              <td className="py-2 px-3 font-mono text-muted-foreground">{h.week_label}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(h.premium_collected)}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(h.total_payout)}</td>
              <td className="py-2 px-3 text-right">{h.total_claims}</td>
              <td className="py-2 px-3 text-right font-bold font-mono" style={{ color: bcrColor(h.bcr) }}>
                {(h.bcr * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                  style={{ color: STATUS_COLOR[h.status] || '#94a3b8', background: `${STATUS_COLOR[h.status]}18` }}
                >
                  {h.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Projection detail table ────────────────────────────────────────────────────

function ProjectionTable({ data }: { data: ProjectionPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="border-b border-border text-muted-foreground font-semibold uppercase tracking-widest">
          <tr>
            <th className="py-2 px-3">Week</th>
            <th className="py-2 px-3 text-right">Premium est.</th>
            <th className="py-2 px-3 text-right">BCR P10</th>
            <th className="py-2 px-3 text-right">BCR Mean</th>
            <th className="py-2 px-3 text-right">BCR P90</th>
            <th className="py-2 px-3 text-center">Suspend Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {data.map((p, i) => (
            <tr key={i} className={cn("hover:bg-accent/20 transition-colors", p.suspension_risk && "bg-destructive/5")}>
              <td className="py-2 px-3 font-mono text-muted-foreground">{p.week_label}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(p.premium_mean)}</td>
              <td className="py-2 px-3 text-right font-mono text-[#10a37f]">{(p.bcr_p10 * 100).toFixed(1)}%</td>
              <td className="py-2 px-3 text-right font-bold font-mono" style={{ color: bcrColor(p.bcr_mean) }}>
                {(p.bcr_mean * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right font-mono text-[#ef4444]">{(p.bcr_p90 * 100).toFixed(1)}%</td>
              <td className="py-2 px-3 text-center">
                {p.suspension_risk
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive uppercase">Yes</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase">No</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DataTimeline() {
  const [cities, setCities]       = useState<CityItem[]>([]);
  const [city, setCity]           = useState('Mumbai');
  const [scenario, setScenario]   = useState('normal');
  const [tl, setTl]               = useState<TimelineData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastTick, setLastTick]   = useState(0);
  const [activeTab, setActiveTab] = useState<'chart' | 'history' | 'projection'>('chart');

  // Load city list once
  useEffect(() => {
    fetch(`${API}/data/cities`)
      .then(r => r.json())
      .then((cs: CityItem[]) => { setCities(cs); })
      .catch(console.error);
  }, []);

  // Poll timeline
  const fetchTL = useCallback(() => {
    fetch(`${API}/data/timeline/${encodeURIComponent(city)}?scenario=${scenario}`)
      .then(r => r.json())
      .then((d: TimelineData) => {
        setTl(d);
        setLoading(false);
        setLastTick(Date.now());
      })
      .catch(e => { console.error(e); setLoading(false); });
  }, [city, scenario]);

  useEffect(() => {
    setLoading(true);
    fetchTL();
    const t = setInterval(fetchTL, POLL_MS);
    return () => clearInterval(t);
  }, [fetchTL]);

  // ── Build unified chart data ──────────────────────────────────────────────
  const chartPoints: ChartPoint[] = [];
  if (tl) {
    tl.historical.forEach(h => {
      chartPoints.push({ label: h.week_label, zone: 'historical', bcr: h.bcr });
    });
    chartPoints.push({ label: 'NOW', zone: 'current', bcr: tl.current_week.bcr });
    tl.projection.forEach(p => {
      chartPoints.push({
        label:      p.week_label,
        zone:       'projection',
        bcr_mean:   p.bcr_mean,
        bcr_p10:    p.bcr_p10,
        band_base:  p.bcr_p10,
        band_width: Math.max(0, p.bcr_p90 - p.bcr_p10),
      });
    });
  }

  // KPIs
  const curBCR   = tl?.current_week.bcr   ?? 0;
  const prevBCR  = tl?.historical.slice(-1)[0]?.bcr ?? 0;
  const delta    = curBCR - prevBCR;
  const projMean = tl?.projection[0]?.bcr_mean ?? 0;
  const worstP90 = Math.max(...(tl?.projection.map(p => p.bcr_p90) ?? [0]));
  const scenCfg  = SCENARIOS.find(s => s.key === scenario) ?? SCENARIOS[0];
  const suspAny  = tl?.projection.some(p => p.suspension_risk) || tl?.current_week.suspension_risk;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pb-12"
      >

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Data Timeline</h1>
            <p className="text-sm text-muted-foreground">
              8-week historical · live simulation (15s tick) · 4-week Monte Carlo projection
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* City selector */}
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="bg-card border border-border text-sm rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {cities.length === 0
                ? <option>Mumbai</option>
                : cities.map(c => <option key={c.name} value={c.name}>{c.name} ({c.tier.replace('_', ' ')})</option>)
              }
            </select>
            {tl && (
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {TIER_LABEL[tl.city_tier] ?? tl.city_tier}
              </span>
            )}
            <button
              onClick={fetchTL}
              className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
            </button>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]" />
              </span>
              Live · 15s tick
            </div>
          </div>
        </div>

        {/* ── Scenario Buttons ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-1">Inject Event:</span>
          {SCENARIOS.map(sc => (
            <button
              key={sc.key}
              onClick={() => setScenario(sc.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                scenario === sc.key
                  ? "shadow-inner"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              style={scenario === sc.key
                ? { color: sc.color, background: `${sc.color}18`, borderColor: `${sc.color}40` }
                : {}}
            >
              {sc.icon}
              {sc.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">{scenCfg.desc}</span>
        </div>

        {/* ── Suspension Alert ── */}
        <AnimatePresence>
          {suspAny && (
            <motion.div
              key="alert"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="rounded-xl border border-destructive/40 bg-destructive/8 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive uppercase tracking-wider">
                  Suspension Threshold Breached — {city}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tl?.current_week.suspension_risk
                    ? `Current BCR ${(curBCR * 100).toFixed(1)}% exceeds 85% — new policy enrolments suspended immediately.`
                    : `Projected BCR exceeds 85% within 4 weeks under "${scenCfg.label}" scenario. Recommendation: raise premiums or suspend enrolments.`
                  }
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KPI Cards ── */}
        <div className="flex flex-wrap gap-3">
          <KPICard
            label="Current BCR"
            value={`${(curBCR * 100).toFixed(1)}%`}
            sub={bcrLabel(curBCR)}
            color={bcrColor(curBCR)}
            pulse={curBCR > SUSPEND}
          />
          <KPICard
            label="vs Last Week"
            value={`${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
            sub="week-over-week Δ"
            color={delta > 0.02 ? '#ef4444' : delta < -0.02 ? '#10a37f' : '#94a3b8'}
          />
          <KPICard
            label="Next Week (P50)"
            value={`${(projMean * 100).toFixed(1)}%`}
            sub="Monte Carlo mean"
            color={bcrColor(projMean)}
          />
          <KPICard
            label="Worst Case (P90)"
            value={`${(worstP90 * 100).toFixed(1)}%`}
            sub={worstP90 > SUSPEND ? '⚠ suspension risk' : '4-week horizon'}
            color={worstP90 > SUSPEND ? '#ef4444' : '#f59e0b'}
            pulse={worstP90 > SUSPEND}
          />
          <KPICard
            label="Week Progress"
            value={`${tl?.current_week.progress_pct ?? 0}%`}
            sub={`Season ×${tl?.current_week.season_mult ?? 1.0} · Shock ×${tl?.current_week.shock_mult ?? 1.0}`}
            color="#8c5cff"
          />
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 border-b border-border">
          {[
            { key: 'chart',      label: 'Timeline Chart' },
            { key: 'history',    label: 'Historical Data' },
            { key: 'projection', label: 'Projection Detail' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'chart' && (
            <motion.div
              key="chart"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm"
            >
              {/* Chart legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">BCR / Loss Ratio — {city}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scenario: <span className="text-foreground font-medium">{tl?.simulation_meta.scenario_label ?? 'Normal'}</span>
                    {' · '}last tick {lastTick ? new Date(lastTick).toLocaleTimeString() : '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-[#10a37f] inline-block rounded" /> Historical
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" /> Live (NOW)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-purple-400 inline-block" /> Projection P50
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-3 bg-purple-500/20 inline-block rounded" /> P10–P90 band
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t border-dashed border-red-500 inline-block" /> Suspend 85%
                  </span>
                </div>
              </div>

              {/* Target range explanation */}
              <div className="flex gap-4 mb-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#10a37f] inline-block" />
                  Target BCR: 55–70%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />
                  Watch: 70–85%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />
                  Suspend: &gt;85%
                </span>
              </div>

              {loading && !tl ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                  Loading timeline data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10a37f" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10a37f" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.25, 1.15]}
                      tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Target BCR zone (55–70%) — subtle green band */}
                    <ReferenceArea y1={TARGET_LO} y2={TARGET_HI} fill="rgba(16,163,127,0.06)" />

                    {/* Suspension threshold */}
                    <ReferenceLine
                      y={SUSPEND}
                      stroke="rgba(239,68,68,0.6)"
                      strokeDasharray="6 3"
                      label={{ value: 'Suspend 85%', fill: '#ef4444', fontSize: 9, fontFamily: 'monospace', position: 'insideTopRight' }}
                    />

                    {/* NOW marker */}
                    <ReferenceLine
                      x="NOW"
                      stroke="rgba(250,204,21,0.6)"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      label={{ value: 'NOW', fill: '#fbbf24', fontSize: 9, fontFamily: 'monospace', position: 'insideTopLeft' }}
                    />

                    {/* Historical solid area */}
                    <Area
                      type="monotone"
                      dataKey="bcr"
                      stroke="#10a37f"
                      strokeWidth={2}
                      fill="url(#histGradient)"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />

                    {/* Confidence band — stacked area (base = P10, width = P90-P10) */}
                    <Area
                      type="monotone"
                      dataKey="band_base"
                      stroke="none"
                      fill="transparent"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                      legendType="none"
                      stackId="confband"
                    />
                    <Area
                      type="monotone"
                      dataKey="band_width"
                      stroke="none"
                      fill="rgba(139,92,246,0.20)"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                      legendType="none"
                      stackId="confband"
                    />

                    {/* Projection mean dashed */}
                    <Line
                      type="monotone"
                      dataKey="bcr_mean"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ fill: '#a78bfa', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#a78bfa' }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* Meta footer */}
              {tl && (
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-4 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                  <span>Hist avg BCR: {(tl.simulation_meta.historical_avg_lr * 100).toFixed(1)}%</span>
                  <span>·</span>
                  <span>MC paths: {tl.simulation_meta.monte_carlo_paths}</span>
                  <span>·</span>
                  <span>Season ×{tl.current_week.season_mult}</span>
                  <span>·</span>
                  <span>Shock ×{tl.current_week.shock_mult}</span>
                  <span>·</span>
                  <span>Tick: {tl.simulation_meta.tick_interval_s}s</span>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && tl && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm"
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">Historical Ledger — {city}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Real data from DB · {tl.historical.length} weeks · most recent first</p>
              </div>
              <HistoryTable data={tl.historical} />
              <div className="mt-4 pt-3 border-t border-border flex gap-6 text-xs text-muted-foreground">
                <div>
                  <span className="text-[10px] uppercase tracking-wider block">Avg BCR</span>
                  <span className="font-bold font-mono" style={{ color: bcrColor(tl.simulation_meta.historical_avg_lr) }}>
                    {(tl.simulation_meta.historical_avg_lr * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block">Avg Premium / Week</span>
                  <span className="font-bold font-mono text-foreground">{fmt(tl.simulation_meta.historical_avg_premium)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block">Data Source</span>
                  <span className="font-bold text-foreground">Real DB · weekly_ledgers</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'projection' && tl && (
            <motion.div
              key="projection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm"
            >
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-base font-semibold text-foreground">Monte Carlo Projection — {city}</h2>
                  {suspAny && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive uppercase">Suspension Risk</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tl.simulation_meta.monte_carlo_paths} paths · 4 weeks · scenario: <span className="text-foreground">{tl.simulation_meta.scenario_label}</span>
                  {' — '}{tl.simulation_meta.scenario_description}
                </p>
              </div>

              {/* How to read */}
              <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                <span className="font-bold text-foreground">How to read: </span>
                P10 = best 10% of scenarios · P50 (mean) = most likely · P90 = worst 10% of scenarios.
                When P90 exceeds 85%, the platform should suspend new enrolments for {city}.
              </div>

              <ProjectionTable data={tl.projection} />

              {/* Scenario comparison hint */}
              <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                <span className="font-bold text-primary">Tip: </span>
                Switch scenarios above to see how monsoon or heat wave events push BCR past the 85% suspension threshold.
                Normal baseline BCR for {city} is {(tl.simulation_meta.historical_avg_lr * 100).toFixed(0)}%.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Current Week Live Card ── */}
        {tl && (
          <motion.div
            key={`cw-${lastTick}`}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Current Week · Live Simulation
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono" style={{ color: bcrColor(curBCR) }}>
                    {(curBCR * 100).toFixed(1)}%
                  </span>
                  <span className="text-sm font-bold uppercase" style={{ color: bcrColor(curBCR) }}>
                    {bcrLabel(curBCR)}
                  </span>
                  {delta > 0
                    ? <TrendingUp className="w-4 h-4 text-destructive" />
                    : <TrendingDown className="w-4 h-4 text-[#10a37f]" />
                  }
                  {tl.current_week.suspension_risk && (
                    <ShieldAlert className="w-4 h-4 text-destructive animate-pulse" />
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Premium so far</p>
                  <p className="font-bold font-mono">{fmt(tl.current_week.premium_so_far)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Payout so far</p>
                  <p className="font-bold font-mono">{fmt(tl.current_week.payout_so_far)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Week progress</p>
                  <p className="font-bold font-mono">{tl.current_week.progress_pct}%</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full md:w-48">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: bcrColor(curBCR) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(curBCR / 1.1 * 100, 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ticks every {tl.simulation_meta.tick_interval_s}s · {new Date(lastTick).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
