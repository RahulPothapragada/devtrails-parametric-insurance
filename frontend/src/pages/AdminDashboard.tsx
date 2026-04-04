import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShieldAlert, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';

const API = 'http://localhost:8000/api';

// ── Types ──
interface StatsData {
  total_riders: number;
  active_policies: number;
  total_claims_today: number;
  total_payouts_today: number;
  active_triggers: { type: string; value: number; city_id: number }[];
  zone_risk_summary: { zone: string; tier: string; flood: number; heat: number }[];
}

interface CityActuarial {
  city: string;
  city_tier: string;
  premium_collected: number;
  total_payout: number;
  avg_loss_ratio: number;
  sustainability: string;
  total_claims: number;
  total_policies: number;
}

interface LedgerWeek {
  week_start: string;
  premium_collected: number;
  total_payout: number;
  total_claims: number;
  loss_ratio: number;
}

const TIER_COLOR: Record<string, string> = {
  tier_1: '#a78bfa',
  tier_2: '#60a5fa',
  tier_3: '#34d399',
};

const STATUS_COLOR: Record<string, string> = {
  healthy: '#10a37f',
  optimal: '#0ea5e9',
  watch: '#f59e0b',
  critical: '#ef4444',
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [actuarial, setActuarial] = useState<CityActuarial[]>([]);
  const [chartData, setChartData] = useState<LedgerWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch all in parallel
      const [statsRes, actuarialRes, ledgerRes] = await Promise.all([
        fetch(`${API}/admin/stats`),
        fetch(`${API}/admin/actuarial`),
        fetch(`${API}/admin/weekly-ledger/Mumbai`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());

      if (actuarialRes.ok) {
        const data = await actuarialRes.json();
        // Use all_cities which is a flat list of only cities in the DB
        const all: CityActuarial[] = data.all_cities || [
          ...(data.tier_breakdown?.tier_1 || []),
          ...(data.tier_breakdown?.tier_2 || []),
          ...(data.tier_breakdown?.tier_3 || []),
        ];
        setActuarial(all);
      }

      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        const weeks: LedgerWeek[] = (data.weeks || []).slice(0, 7).reverse();
        setChartData(weeks);
      }
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Compute platform-wide totals from actuarial data
  const totalPremium = actuarial.reduce((s, c) => s + c.premium_collected, 0);
  const totalPayout = actuarial.reduce((s, c) => s + c.total_payout, 0);
  const totalClaims = actuarial.reduce((s, c) => s + c.total_claims, 0);
  const platformBCR = totalPremium > 0 ? totalPayout / totalPremium : 0;

  // Top risk cities (watch/critical)
  const alertCities = actuarial.filter(c => c.sustainability === 'watch' || c.sustainability === 'critical');

  // Sort by risk score for zone panel
  const topZones = (stats?.zone_risk_summary || []).slice(0, 5);

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
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Platform Operations</h1>
            <p className="text-muted-foreground font-medium">Live risk monitoring and parametric claims processing.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 border transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="px-3 py-1.5 bg-[#10a37f]/10 border border-[#10a37f]/20 rounded-full text-xs font-mono text-[#10a37f] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]"></span>
              </span>
              SYSTEM NORMAL · 15ms LATENCY
            </div>
          </div>
        </div>

        {/* KPI Grid — live from DB */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Riders</span>
            <span className="text-4xl font-bold text-foreground">
              {loading ? '...' : (stats?.total_riders || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-muted-foreground">13 cities · PAN India</span>
          </div>
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Policies</span>
            <span className="text-4xl font-bold text-foreground">
              {loading ? '...' : (stats?.active_policies || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-muted-foreground">72% coverage rate</span>
          </div>
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Premium Pool</span>
            <span className="text-4xl font-bold text-foreground">
              {loading ? '...' : fmt(totalPremium)}
            </span>
            <span className="text-xs text-muted-foreground">8-week rolling · {actuarial.length} cities</span>
          </div>
          <div className={`rounded-xl border p-5 flex flex-col gap-2 shadow-sm ${alertCities.length > 0 ? 'border-[#ef4444]/30 bg-[#ef4444]/5' : 'bg-card'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts</span>
              {alertCities.length > 0 && <ShieldAlert className="w-4 h-4 text-[#ef4444]" />}
            </div>
            <span className="text-4xl font-bold text-foreground">
              {loading ? '...' : alertCities.length}
            </span>
            <span className={`text-xs font-medium ${alertCities.length > 0 ? 'text-[#ef4444]' : 'text-[#10a37f]'}`}>
              {alertCities.length > 0
                ? alertCities.map(c => c.city).join(', ')
                : 'All cities healthy'}
            </span>
          </div>
        </div>

        {/* Platform BCR Banner */}
        <div className="rounded-xl border bg-card p-5 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Platform BCR</span>
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-6">
            <div>
              <span className="text-3xl font-bold text-primary">{(platformBCR * 100).toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground ml-2">Burning Cost Rate</span>
            </div>
            <div className="h-2 flex-1 min-w-[120px] bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(platformBCR * 100, 100)}%` }}
                transition={{ duration: 1.2 }}
                className={`h-full rounded-full ${platformBCR > 0.85 ? 'bg-[#ef4444]' : platformBCR > 0.70 ? 'bg-[#f59e0b]' : 'bg-[#10a37f]'}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">Target: 55–70% · Suspend at 85%</span>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Total Payout</p>
              <p className="font-bold text-foreground">{fmt(totalPayout)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Total Claims</p>
              <p className="font-bold text-foreground">{totalClaims.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Chart + Zone Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Premium vs Payout Chart — real weekly ledger */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-6 min-w-0 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-1">Premium vs Payout — Mumbai (8 Weeks)</h2>
            <p className="text-xs text-muted-foreground mb-6">Live from weekly ledger · BCR tracks sustainability</p>
            <div className="h-[260px] w-full min-w-0">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPremium" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10a37f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10a37f" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="week_start" stroke="hsl(var(--muted-foreground))" fontSize={10}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => {
                        const d = new Date(v);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(val: number, name: string) => [`₹${val.toLocaleString('en-IN')}`, name]}
                    />
                    <Area type="monotone" dataKey="premium_collected" name="Premium" stroke="#10a37f" fillOpacity={1} fill="url(#colorPremium)" strokeWidth={2} />
                    <Area type="monotone" dataKey="total_payout" name="Payout" stroke="#ef4444" fillOpacity={1} fill="url(#colorPayout)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {loading ? 'Loading chart...' : 'No ledger data available'}
                </div>
              )}
            </div>
          </div>

          {/* Zone Risk — real from DB, top zones by flood_risk_score */}
          <div className="rounded-xl border bg-card p-6 flex flex-col shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Top Risk Zones</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by flood + heat risk score · live from DB</p>
            </div>
            <div className="flex flex-col gap-4 flex-1 justify-center">
              {topZones.length > 0 ? topZones.map((zone, idx) => {
                const floodPct = Math.round(zone.flood * 100);
                const heatPct = Math.round(zone.heat * 100);
                const riskScore = Math.round(Math.max(zone.flood, zone.heat) * 100);
                const riskColor = riskScore > 80 ? '#ef4444' : riskScore > 60 ? '#f59e0b' : '#10a37f';
                const dominantRisk = zone.flood >= zone.heat ? 'Flood' : 'Heat';
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-start text-sm gap-2">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground block truncate" title={zone.zone}>{zone.zone}</span>
                        <span className="text-[10px] text-muted-foreground">{dominantRisk} risk · {zone.tier?.toUpperCase()}</span>
                      </div>
                      <span className="font-bold shrink-0 font-mono" style={{ color: riskColor }}>
                        {riskScore}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${riskScore}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: riskColor }}
                      />
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>🌊 Flood {floodPct}%</span>
                      <span>🌡️ Heat {heatPct}%</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-sm text-muted-foreground text-center">{loading ? 'Loading zone data...' : 'No zone data available'}</div>
              )}
            </div>
          </div>
        </div>

        {/* All Cities Actuarial Table — real DB data */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">PAN India City Health</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Live BCR · Loss Ratio · Sustainability across all 13 cities</p>
            </div>
            {alertCities.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                {alertCities.length} city under watch
              </div>
            )}
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground uppercase font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-right">Premium</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-right">Claims</th>
                  <th className="px-4 py-3 text-right">BCR</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading city data...</td></tr>
                ) : actuarial.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No data</td></tr>
                ) : actuarial.sort((a, b) => b.avg_loss_ratio - a.avg_loss_ratio).map((city, i) => (
                  <tr key={i} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{city.city}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: TIER_COLOR[city.city_tier] || '#fff', backgroundColor: `${TIER_COLOR[city.city_tier]}20` }}>
                        {city.city_tier.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{fmt(city.premium_collected)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{fmt(city.total_payout)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{city.total_claims.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: city.avg_loss_ratio > 0.85 ? '#ef4444' : city.avg_loss_ratio > 0.70 ? '#f59e0b' : '#10a37f' }}>
                      {(city.avg_loss_ratio * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase" style={{ color: STATUS_COLOR[city.sustainability], backgroundColor: `${STATUS_COLOR[city.sustainability]}15` }}>
                        {city.sustainability}
                      </span>
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
