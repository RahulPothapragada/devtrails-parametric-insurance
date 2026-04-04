import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  Activity, CloudRain, Thermometer, Wind,
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ShieldAlert, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API = 'http://localhost:8000/api';
const POLL_MS = 15_000;
const SUSPEND = 0.85;
const TARGET_HI = 0.70;
const TARGET_LO = 0.55;

// ── Types ──────────────────────────────────────────────────────────────────────

interface DataPoint {
  week_label: string;
  week_start_date: string;
  data_type: 'simulated' | 'real' | 'live' | 'projection';
  bcr?: number;
  loss_ratio?: number;
  premium?: number;
  payout?: number;
  claims?: number | null;
  policies?: number | null;
  status?: string;
  // projection only
  bcr_mean?: number;
  bcr_p10?: number;
  bcr_p90?: number;
  band_base?: number;
  band_width?: number;
  premium_mean?: number;
  suspension_risk?: boolean;
  // live only
  progress_pct?: number;
  season_mult?: number;
  shock_mult?: number;
}

interface Meta {
  real_weeks: number;
  simulated_weeks: number;
  projection_weeks: number;
  real_date_from: string;
  real_date_to: string;
  avg_real_bcr: number;
  avg_real_premium: number;
  suspend_threshold: number;
  bcr_target: string;
  monte_carlo_paths: number;
  tick_interval_s: number;
  scenario_label: string;
  scenario_desc: string;
  note: string;
}

interface TimelineResponse {
  city: string;
  city_tier: string;
  scenario: string;
  simulated_history: DataPoint[];
  real_history: DataPoint[];
  current_week: DataPoint;
  projection: DataPoint[];
  meta: Meta;
}

interface CityItem { name: string; tier: string; }

// ── Chart point — all zones on single axis ────────────────────────────────────

interface ChartPoint {
  label: string;
  zone: 'simulated' | 'real' | 'live' | 'projection';
  bcr?: number;
  bcr_mean?: number;
  bcr_p10?: number;
  band_base?: number;
  band_width?: number;
  raw?: DataPoint;
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  { key: 'normal',     label: 'Normal',     icon: <Activity className="w-3.5 h-3.5" />,    color: '#10a37f', desc: 'Baseline — no adverse events' },
  { key: 'monsoon',    label: 'Monsoon',    icon: <CloudRain className="w-3.5 h-3.5" />,   color: '#3b82f6', desc: 'LR ×1.65 — suspension likely' },
  { key: 'heat_wave',  label: 'Heat Wave',  icon: <Thermometer className="w-3.5 h-3.5" />, color: '#f59e0b', desc: 'LR ×1.18 — moderate stress' },
  { key: 'aqi_crisis', label: 'AQI Crisis', icon: <Wind className="w-3.5 h-3.5" />,        color: '#a78bfa', desc: 'LR ×1.30 — elevated risk' },
];

const TIER_LABEL: Record<string, string> = {
  tier_1: 'Tier 1 Metro',
  tier_2: 'Tier 2 Major',
  tier_3: 'Tier 3 Emerging',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function bcrColor(v: number) {
  if (v > SUSPEND)    return '#ef4444';
  if (v > TARGET_HI)  return '#f59e0b';
  if (v > TARGET_LO)  return '#0ea5e9';
  return '#10a37f';
}

function bcrBadge(v: number) {
  if (v > SUSPEND)    return { label: 'SUSPENDED', bg: '#ef444420', color: '#ef4444' };
  if (v > TARGET_HI)  return { label: 'WATCH',     bg: '#f59e0b20', color: '#f59e0b' };
  if (v > TARGET_LO)  return { label: 'OPTIMAL',   bg: '#0ea5e920', color: '#0ea5e9' };
  return                     { label: 'HEALTHY',   bg: '#10a37f20', color: '#10a37f' };
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  if (!d) return null;

  const ZONE_NAMES: Record<string, string> = {
    simulated: 'Estimated Historical',
    real: 'DB Actual',
    live: 'Live (this week)',
    projection: 'Projection',
  };

  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-xl px-3 py-2.5 text-xs shadow-xl min-w-[170px] max-w-[220px]">
      <p className="font-mono text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-[10px] font-bold mb-2" style={{
        color: d.zone === 'simulated' ? '#64748b' : d.zone === 'real' ? '#10a37f'
          : d.zone === 'live' ? '#fbbf24' : '#a78bfa'
      }}>{ZONE_NAMES[d.zone] ?? d.zone}</p>

      {(d.zone === 'simulated' || d.zone === 'real' || d.zone === 'live') && d.bcr !== undefined && (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">BCR</span>
            <span className="font-mono font-bold" style={{ color: bcrColor(d.bcr) }}>{(d.bcr * 100).toFixed(1)}%</span>
          </div>
          {d.raw?.premium && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Premium</span>
              <span className="font-mono">{fmt(d.raw.premium)}</span>
            </div>
          )}
          {d.raw?.claims != null && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Claims</span>
              <span className="font-mono">{d.raw.claims}</span>
            </div>
          )}
        </>
      )}
      {d.zone === 'projection' && d.bcr_mean !== undefined && (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">P50 (mean)</span>
            <span className="font-mono font-bold text-purple-400">{(d.bcr_mean * 100).toFixed(1)}%</span>
          </div>
          {d.bcr_p10 !== undefined && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">P10 (best)</span>
              <span className="font-mono text-[#10a37f]">{(d.bcr_p10 * 100).toFixed(1)}%</span>
            </div>
          )}
          {d.band_base !== undefined && d.band_width !== undefined && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">P90 (worst)</span>
              <span className="font-mono text-[#ef4444]">{((d.band_base + d.band_width) * 100).toFixed(1)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color, pulse = false }: {
  label: string; value: string; sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex-1 min-w-[130px] relative overflow-hidden shadow-sm">
      {pulse && (
        <motion.div
          animate={{ opacity: [0.07, 0.2, 0.07] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 80% 20%, ${color}30, transparent 65%)` }}
        />
      )}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
      <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>}
    </div>
  );
}

// ── Table components ──────────────────────────────────────────────────────────

function DataTable({ rows, title, subtitle }: {
  rows: DataPoint[]; title: string; subtitle: string;
}) {
  const STATUS_COLOR: Record<string, string> = {
    healthy: '#10a37f', optimal: '#0ea5e9', watch: '#f59e0b', critical: '#ef4444',
  };
  const display = [...rows].reverse();
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="border-b border-border text-muted-foreground font-semibold uppercase tracking-widest text-[10px]">
            <tr>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3 text-right">Premium</th>
              <th className="py-2 px-3 text-right">Payout</th>
              {rows[0]?.claims !== undefined && <th className="py-2 px-3 text-right">Claims</th>}
              <th className="py-2 px-3 text-right">BCR</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {display.map((r, i) => (
              <tr key={i} className="hover:bg-accent/20 transition-colors">
                <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{r.week_label}</td>
                <td className="py-2 px-3 text-right font-mono">{r.premium ? fmt(r.premium) : '—'}</td>
                <td className="py-2 px-3 text-right font-mono">{r.payout ? fmt(r.payout) : '—'}</td>
                {r.claims !== undefined && (
                  <td className="py-2 px-3 text-right">{r.claims ?? '—'}</td>
                )}
                <td className="py-2 px-3 text-right font-bold font-mono" style={{ color: bcrColor(r.bcr ?? 0) }}>
                  {r.bcr !== undefined ? `${(r.bcr * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                    style={{ color: STATUS_COLOR[r.status ?? ''] ?? '#94a3b8', background: `${STATUS_COLOR[r.status ?? ''] ?? '#94a3b8'}18` }}
                  >
                    {r.status ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectionTable({ rows }: { rows: DataPoint[] }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="border-b border-border text-muted-foreground font-semibold uppercase tracking-widest text-[10px]">
            <tr>
              <th className="py-2 px-3">Week</th>
              <th className="py-2 px-3 text-right">Est. Premium</th>
              <th className="py-2 px-3 text-right">P10 (best)</th>
              <th className="py-2 px-3 text-right">P50 (mean)</th>
              <th className="py-2 px-3 text-right">P90 (worst)</th>
              <th className="py-2 px-3 text-center">Suspend?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((p, i) => (
              <tr key={i} className={cn('hover:bg-accent/20 transition-colors', p.suspension_risk && 'bg-destructive/5')}>
                <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{p.week_label}</td>
                <td className="py-2 px-3 text-right font-mono">{p.premium_mean ? fmt(p.premium_mean) : '—'}</td>
                <td className="py-2 px-3 text-right font-mono text-[#10a37f]">{p.bcr_p10 !== undefined ? `${(p.bcr_p10 * 100).toFixed(1)}%` : '—'}</td>
                <td className="py-2 px-3 text-right font-bold font-mono" style={{ color: bcrColor(p.bcr_mean ?? 0) }}>
                  {p.bcr_mean !== undefined ? `${(p.bcr_mean * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[#ef4444]">
                  {p.band_base !== undefined && p.band_width !== undefined
                    ? `${((p.band_base + p.band_width) * 100).toFixed(1)}%`
                    : p.bcr_p90 !== undefined ? `${(p.bcr_p90 * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 px-3 text-center">
                  {p.suspension_risk
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive uppercase">Yes</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase">No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DataTimeline() {
  const [cities, setCities]       = useState<CityItem[]>([]);
  const [city, setCity]           = useState('Mumbai');
  const [scenario, setScenario]   = useState('normal');
  const [tl, setTl]               = useState<TimelineResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastTick, setLastTick]   = useState(0);
  const [tab, setTab]             = useState<'chart' | 'real' | 'simulated' | 'projection'>('chart');

  useEffect(() => {
    fetch(`${API}/data/cities`).then(r => r.json()).then(setCities).catch(console.error);
  }, []);

  const fetchTL = useCallback(() => {
    fetch(`${API}/data/timeline/${encodeURIComponent(city)}?scenario=${scenario}`)
      .then(r => r.json())
      .then((d: TimelineResponse) => { setTl(d); setLoading(false); setLastTick(Date.now()); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [city, scenario]);

  useEffect(() => { setLoading(true); fetchTL(); const t = setInterval(fetchTL, POLL_MS); return () => clearInterval(t); }, [fetchTL]);

  // ── Build chart points ────────────────────────────────────────────────────
  const chartPoints: ChartPoint[] = [];
  if (tl) {
    // Only show every 4th simulated week for readability (still shows full year span)
    tl.simulated_history.forEach((p, i) => {
      chartPoints.push({ label: i % 4 === 0 ? p.week_label : '', zone: 'simulated', bcr: p.bcr, raw: p });
    });
    tl.real_history.forEach(p => {
      chartPoints.push({ label: p.week_label, zone: 'real', bcr: p.bcr, raw: p });
    });
    const cw = tl.current_week;
    chartPoints.push({ label: cw.week_label, zone: 'live', bcr: cw.bcr, raw: cw });
    tl.projection.forEach((p, i) => {
      chartPoints.push({
        label: i % 2 === 0 ? p.week_label : '',
        zone: 'projection',
        bcr_mean:   p.bcr_mean,
        bcr_p10:    p.bcr_p10,
        band_base:  p.band_base,
        band_width: p.band_width,
        raw: p,
      });
    });
  }

  // KPIs
  const curBCR   = tl?.current_week.bcr   ?? 0;
  const prevBCR  = tl?.real_history.slice(-1)[0]?.bcr ?? 0;
  const delta    = curBCR - prevBCR;
  const projMean = tl?.projection[0]?.bcr_mean ?? 0;
  const worstP90 = Math.max(...(tl?.projection.map(p => (p.band_base ?? 0) + (p.band_width ?? 0)) ?? [0]));
  const suspAny  = tl?.projection.some(p => p.suspension_risk) || tl?.current_week.suspension_risk;
  const scenCfg  = SCENARIOS.find(s => s.key === scenario) ?? SCENARIOS[0];
  const badge    = bcrBadge(curBCR);

  // X-axis: show only labeled ticks
  const ticks = chartPoints.filter(p => p.label).map(p => p.label);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 pb-12">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Data Timeline</h1>
            <p className="text-sm text-muted-foreground">
              1-year estimated history · {tl?.meta.real_weeks ?? 8} weeks real DB data · live simulation · 12-week Monte Carlo projection
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="bg-card border border-border text-sm rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {cities.length === 0
                ? <option>Mumbai</option>
                : cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {tl && (
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {TIER_LABEL[tl.city_tier] ?? tl.city_tier}
              </span>
            )}
            <button onClick={fetchTL} className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors">
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]" />
              </span>
              Live · 15s
            </div>
          </div>
        </div>

        {/* ── Scenario Buttons ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Simulate event:</span>
          {SCENARIOS.map(sc => (
            <button
              key={sc.key}
              onClick={() => setScenario(sc.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                scenario === sc.key ? "shadow-inner" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              style={scenario === sc.key ? { color: sc.color, background: `${sc.color}18`, borderColor: `${sc.color}40` } : {}}
            >
              {sc.icon}{sc.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground italic">{scenCfg.desc}</span>
        </div>

        {/* ── Suspension Alert ── */}
        <AnimatePresence>
          {suspAny && (
            <motion.div
              key="susp"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive uppercase tracking-wider">Suspension Threshold Breached</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tl?.current_week.suspension_risk
                    ? `Current BCR ${(curBCR * 100).toFixed(1)}% > 85% — new enrolments suspended for ${city} immediately.`
                    : `Projected BCR exceeds 85% within 12 weeks under "${scenCfg.label}". Recommend premium adjustment or enrolment pause.`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KPIs ── */}
        <div className="flex flex-wrap gap-3">
          <KPICard label="Current BCR" value={`${(curBCR * 100).toFixed(1)}%`}
            sub={badge.label} color={badge.color} pulse={curBCR > SUSPEND} />
          <KPICard label="vs Last Real Week" value={`${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
            sub="week-over-week Δ" color={delta > 0.03 ? '#ef4444' : delta < -0.03 ? '#10a37f' : '#94a3b8'} />
          <KPICard label="Next Week (P50)" value={`${(projMean * 100).toFixed(1)}%`}
            sub="Monte Carlo mean" color={bcrColor(projMean)} />
          <KPICard label="12-Week Worst (P90)" value={`${(worstP90 * 100).toFixed(1)}%`}
            sub={worstP90 > SUSPEND ? '⚠ suspension risk' : '12-week horizon'} color={worstP90 > SUSPEND ? '#ef4444' : '#f59e0b'} pulse={worstP90 > SUSPEND} />
          <KPICard label="Real Data Avg BCR" value={`${((tl?.meta.avg_real_bcr ?? 0) * 100).toFixed(1)}%`}
            sub={tl ? `${tl.meta.real_date_from} → ${tl.meta.real_date_to}` : ''} color="#8c5cff" />
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 border-b border-border">
          {([
            { key: 'chart',      label: '📈 Timeline Chart' },
            { key: 'real',       label: '🗄 Real DB Data' },
            { key: 'simulated',  label: '🔮 Est. History (1yr)' },
            { key: 'projection', label: '📊 Projection Detail' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap",
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {tab === 'chart' && (
            <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm">

              {/* Legend */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{city} — BCR over time</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scenario: <span className="font-medium text-foreground">{tl?.meta.scenario_label}</span>
                    {' · '}ticks every {tl?.meta.tick_interval_s ?? 15}s
                    {' · '}last update {lastTick ? new Date(lastTick).toLocaleTimeString() : '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t border-dashed border-slate-500 inline-block" />Est. History</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#10a37f] inline-block" />Real DB</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" />Live NOW</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed border-purple-400 inline-block" />Projection P50</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-purple-500/20 inline-block rounded" />P10–P90 band</span>
                </div>
              </div>

              {/* Zone guide */}
              <div className="flex flex-wrap gap-3 mb-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10a37f] inline-block" />Target 55–70%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />Watch 70–85%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />Suspend &gt;85%</span>
                <span className="flex items-center gap-1 text-slate-500"><Info className="w-3 h-3" />Grey dashes = algorithm-generated estimate, not real data</span>
              </div>

              {loading && !tl ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">Loading timeline...</div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10a37f" stopOpacity={0.30} />
                        <stop offset="95%" stopColor="#10a37f" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />

                    <XAxis
                      dataKey="label"
                      ticks={ticks}
                      tick={{ fill: '#475569', fontSize: 9, fontFamily: 'monospace' }}
                      axisLine={false} tickLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      domain={[0.20, 1.20]}
                      tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                      tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                      axisLine={false} tickLine={false} width={42}
                    />
                    <Tooltip content={<ChartTooltip />} />

                    {/* Target band (55–70%) */}
                    <ReferenceArea y1={TARGET_LO} y2={TARGET_HI} fill="rgba(16,163,127,0.05)" />
                    {/* Watch band (70–85%) */}
                    <ReferenceArea y1={TARGET_HI} y2={SUSPEND} fill="rgba(245,158,11,0.04)" />

                    {/* Suspend line */}
                    <ReferenceLine y={SUSPEND} stroke="rgba(239,68,68,0.55)" strokeDasharray="6 3"
                      label={{ value: 'Suspend 85%', fill: '#ef4444', fontSize: 9, fontFamily: 'monospace', position: 'insideTopRight' }} />

                    {/* NOW marker */}
                    <ReferenceLine x={tl?.current_week.week_label ?? ''}
                      stroke="rgba(251,191,36,0.55)" strokeWidth={1.5} strokeDasharray="4 2"
                      label={{ value: 'NOW', fill: '#fbbf24', fontSize: 9, fontFamily: 'monospace', position: 'insideTopLeft' }} />

                    {/* Simulated history — thin dashed grey, no fill */}
                    <Line
                      type="monotone" dataKey="bcr"
                      stroke="#475569" strokeWidth={1} strokeDasharray="4 3"
                      dot={false} connectNulls={false} isAnimationActive={false}
                      // Only render for simulated zone — handled by data structure
                    />

                    {/* Real history — solid green area (renders over simulated because of data ordering) */}
                    <Area
                      type="monotone" dataKey="bcr"
                      stroke="#10a37f" strokeWidth={2.5}
                      fill="url(#realGrad)"
                      dot={false} connectNulls={false} isAnimationActive={false}
                    />

                    {/* Confidence band — stacked area */}
                    <Area type="monotone" dataKey="band_base" stroke="none" fill="transparent"
                      dot={false} connectNulls={false} isAnimationActive={false} legendType="none" stackId="band" />
                    <Area type="monotone" dataKey="band_width" stroke="none" fill="rgba(139,92,246,0.18)"
                      dot={false} connectNulls={false} isAnimationActive={false} legendType="none" stackId="band" />

                    {/* Projection mean dashed */}
                    <Line type="monotone" dataKey="bcr_mean"
                      stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3"
                      dot={{ fill: '#a78bfa', r: 3, strokeWidth: 0 }}
                      connectNulls={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* Meta footer */}
              {tl && (
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                  <span>Real avg BCR: {(tl.meta.avg_real_bcr * 100).toFixed(1)}%</span>
                  <span>·</span>
                  <span>Est. history: {tl.meta.simulated_weeks} wks (algorithm)</span>
                  <span>·</span>
                  <span>MC paths: {tl.meta.monte_carlo_paths}</span>
                  <span>·</span>
                  <span>Season ×{tl.current_week.season_mult}</span>
                  <span>·</span>
                  <span>Shock ×{tl.current_week.shock_mult}</span>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'real' && tl && (
            <motion.div key="real" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm">
              <DataTable
                rows={tl.real_history}
                title={`Real DB Data — ${city}`}
                subtitle={`${tl.meta.real_weeks} weeks from DB · ${tl.meta.real_date_from} to ${tl.meta.real_date_to} · source: weekly_ledgers table`}
              />
              <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Avg BCR</p>
                  <p className="font-bold font-mono" style={{ color: bcrColor(tl.meta.avg_real_bcr) }}>{(tl.meta.avg_real_bcr * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Avg Premium / Week</p>
                  <p className="font-bold font-mono text-foreground">{fmt(tl.meta.avg_real_premium)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">BCR Target</p>
                  <p className="font-bold text-foreground">{tl.meta.bcr_target}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Source</p>
                  <p className="font-bold text-foreground">weekly_ledgers (DB)</p>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'simulated' && tl && (
            <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm">

              {/* Methodology note */}
              <div className="mb-5 p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="font-bold text-foreground">Algorithm: </span>
                  Each week uses <code className="text-foreground">avg_real_BCR × IMD_seasonal_multiplier + deterministic_noise(city, week)</code>.
                  Seasonal peaks: July ×1.60 (monsoon), May ×1.15 (heat), Feb ×0.85 (winter).
                  Seed is stable per (city, week) — not random per request. Not hardcoded — purely computed.
                </div>
              </div>

              <DataTable
                rows={tl.simulated_history}
                title={`Estimated Historical Data — ${city}`}
                subtitle={`${tl.meta.simulated_weeks} weeks of algorithmically generated data before the DB period`}
              />
            </motion.div>
          )}

          {tab === 'projection' && tl && (
            <motion.div key="proj" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl border bg-card p-6 shadow-sm">

              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-base font-semibold text-foreground">Monte Carlo Projection — {city}</h2>
                  {suspAny && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive uppercase">Suspension Risk</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tl.meta.monte_carlo_paths} paths · 12 weeks forward · scenario: <span className="text-foreground font-medium">{tl.meta.scenario_label}</span> — {tl.meta.scenario_desc}
                </p>
              </div>

              <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                <span className="font-bold text-foreground">How to read: </span>
                P10 = best 10% of 500 Monte Carlo paths · P50 = most likely · P90 = worst 10%.
                Suspension at P50 means the most likely outcome requires pausing new enrolments.
              </div>

              <ProjectionTable rows={tl.projection} />

              <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                <span className="font-bold text-primary">Try: </span>
                Switch to Monsoon above — watch how P50 crosses 85% in Apr–May (heat + monsoon overlap).
                Normal baseline for {city}: {(tl.meta.avg_real_bcr * 100).toFixed(0)}% avg BCR.
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── Live Current Week ── */}
        {tl && (
          <motion.div key={`cw-${lastTick}`} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
            className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Current Week · Live Simulation · ticks every {tl.meta.tick_interval_s}s
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono" style={{ color: badge.color }}>{(curBCR * 100).toFixed(1)}%</span>
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
                  {delta > 0 ? <TrendingUp className="w-4 h-4 text-destructive" /> : <TrendingDown className="w-4 h-4 text-[#10a37f]" />}
                  {tl.current_week.suspension_risk && <ShieldAlert className="w-4 h-4 text-destructive animate-pulse" />}
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div><p className="text-muted-foreground text-xs">Week start</p><p className="font-mono font-bold text-foreground">{tl.current_week.week_label.replace(' ▶', '')}</p></div>
                <div><p className="text-muted-foreground text-xs">Premium so far</p><p className="font-mono font-bold">{fmt(tl.current_week.premium ?? 0)}</p></div>
                <div><p className="text-muted-foreground text-xs">Payout so far</p><p className="font-mono font-bold">{fmt(tl.current_week.payout ?? 0)}</p></div>
                <div><p className="text-muted-foreground text-xs">Week progress</p><p className="font-mono font-bold">{tl.current_week.progress_pct}%</p></div>
              </div>
              <div className="w-full md:w-48">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: badge.color }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(curBCR / 1.1 * 100, 100)}%` }}
                    transition={{ duration: 0.8 }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(lastTick).toLocaleTimeString()}</p>
              </div>
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
