import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, ArrowLeft, X, Activity, Shield, MapPin, FileText,
  LayoutDashboard, ShieldCheck, BarChart2, LineChart, FileText as FileTextIcon,
  Settings, HelpCircle, User, Download, Filter, ChevronLeft, ChevronRight,
  TrendingUp, Zap, Search, LogIn, FlameKindling
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

import { API_BASE as API } from '@/lib/api';

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

const TIER_BADGE: Record<string, { text: string; cls: string }> = {
  tier_1: { text: 'Tier 1', cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
  tier_2: { text: 'Tier 2', cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
  tier_3: { text: 'Tier 3', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
};

const STATUS_BADGE: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  optimal: 'bg-sky-50 text-sky-700 border border-sky-100',
  watch: 'bg-amber-50 text-amber-700 border border-amber-100',
  critical: 'bg-red-50 text-red-700 border border-red-100',
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

// ── Sidebar ──
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/admin', active: false },
  { icon: ShieldCheck,     label: 'Policies',    to: '#',     active: true  },
  { icon: BarChart2,       label: 'Underwriting',to: '#',     active: false },
  { icon: LineChart,       label: 'Analytics',   to: '/actuarial', active: false },
  { icon: FileTextIcon,    label: 'Documents',   to: '#',     active: false },
  { icon: Settings,        label: 'Settings',    to: '#',     active: false },
];

function Sidebar() {
  return (
    <nav className="fixed left-0 top-0 h-full flex flex-col z-50 bg-[#faf8ff] border-r border-[#e8ecf8] w-64">
      {/* Logo */}
      <div className="mb-8 px-4 pt-5 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#00488d] rounded-lg flex items-center justify-center text-white shadow-sm">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="text-base font-black text-[#131b2e] tracking-tight font-['Manrope',sans-serif]">FlowSecure</div>
          <div className="text-[10px] uppercase tracking-widest text-[#727783] font-bold">Admin Panel</div>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ icon: Icon, label, to, active }) => (
          <Link
            key={label}
            to={to}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
              active
                ? "bg-white text-[#00488d] shadow-[0_1px_4px_rgba(0,72,141,0.10)]"
                : "text-[#727783] hover:bg-white/70 hover:text-[#131b2e] hover:translate-x-0.5"
            )}
          >
            <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#00488d]" : "text-[#b0b5c3] group-hover:text-[#00488d]")} />
            {label}
          </Link>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-[#e8ecf8] pt-4 px-3 pb-5 space-y-1">
        <Link to="/" className="w-full mb-3 block">
          <button className="w-full py-2.5 px-4 bg-gradient-to-br from-[#00488d] to-[#005fb8] text-white rounded-xl font-semibold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
            ← Back to Home
          </button>
        </Link>
        <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#727783] hover:bg-white/70 rounded-xl transition-all text-sm">
          <HelpCircle className="w-4 h-4" />Support
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#727783] hover:bg-white/70 rounded-xl transition-all text-sm">
          <User className="w-4 h-4" />Account
        </a>
      </div>
    </nav>
  );
}

// ── Rider Detail Modal ──
function RiderModal({ rider, onClose }: { rider: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#131b2e]/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-7 py-5 bg-[#f2f3ff] border-b border-[#e8ecf8]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#727783] font-bold mb-1">Rider Profile</div>
            <h2 className="text-xl font-extrabold text-[#131b2e] font-['Manrope',sans-serif]">{rider.name}</h2>
            <span className="text-xs font-mono text-[#727783]">ID: {rider.id}</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full border border-[#e8ecf8] hover:bg-[#f2f3ff] transition-colors shadow-sm">
            <X className="w-4 h-4 text-[#727783]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-7 grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Monthly Earnings</span>
            <span className="text-2xl font-bold text-[#131b2e]">₹{Math.round(rider.earnings_monthly).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Policy Status</span>
            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg w-fit">{rider.policy_status || 'Active'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Risk Verdict</span>
            <span className={cn("text-sm font-bold capitalize px-3 py-1.5 rounded-lg w-fit border",
              rider.status === 'normal' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
              rider.status === 'spoofing' ? 'text-amber-700 bg-amber-50 border-amber-100' :
              'text-red-700 bg-red-50 border-red-100'
            )}>
              {rider.verdict || 'Nominal Signal'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />Payout History</span>
            <span className="text-sm font-medium text-[#424752] pt-1">{rider.payout_history || '—'}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-2 pt-4 border-t border-[#e8ecf8]">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Last Known Location</span>
            <div className="flex justify-between items-center bg-[#f2f3ff] p-3.5 rounded-xl font-mono text-sm border border-[#e8ecf8]">
              <span className="text-[#727783]">LAT: <span className="text-[#131b2e] font-semibold">{rider.lat?.toFixed(5) || 'Unknown'}</span></span>
              <span className="text-[#727783]">LNG: <span className="text-[#131b2e] font-semibold">{rider.lng?.toFixed(5) || 'Unknown'}</span></span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ──
export default function AdminDashboard() {
  const [stats, setStats]         = useState<StatsData | null>(null);
  const [actuarial, setActuarial] = useState<CityActuarial[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [selectedCity, setSelectedCity]   = useState<string | null>(null);
  const [riders, setRiders]               = useState<any[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [liveFeed, setLiveFeed]           = useState<any[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, actuarialRes] = await Promise.all([
        fetch(`${API}/admin/stats`),
        fetch(`${API}/admin/actuarial`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (actuarialRes.ok) {
        const data = await actuarialRes.json();
        const all: CityActuarial[] = data.all_cities || [
          ...(data.tier_breakdown?.tier_1 || []),
          ...(data.tier_breakdown?.tier_2 || []),
          ...(data.tier_breakdown?.tier_3 || []),
        ];
        const explicitTiers: Record<string, string> = {
          'Mumbai':'tier_1','Delhi':'tier_1','Bangalore':'tier_1','Chennai':'tier_1','Kolkata':'tier_1',
          'Pune':'tier_2','Hyderabad':'tier_2','Ahmedabad':'tier_2','Jaipur':'tier_2',
          'Lucknow':'tier_3','Indore':'tier_3','Patna':'tier_3','Bhopal':'tier_3'
        };
        const mapped = all.map(c => ({ ...c, city_tier: explicitTiers[c.city] || c.city_tier }));
        setActuarial(mapped.sort((a, b) => b.avg_loss_ratio - a.avg_loss_ratio));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to the backend API.');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchFeed = () => {
      fetch(`${API}/admin/live-feed`)
        .then(r => r.json())
        .then(d => setLiveFeed(Array.isArray(d) ? d : []))
        .catch(() => {});
    };
    fetchFeed();
    const iv = setInterval(fetchFeed, 10000);
    return () => clearInterval(iv);
  }, []);

  const loadCityRiders = async (cityName: string) => {
    setSelectedCity(cityName); setLoadingRiders(true);
    try {
      const res = await fetch(`${API}/admin/maps/network?city_name=${cityName}`);
      if (res.ok) {
        const payload = await res.json();
        setRiders(payload.nodes.filter((n: any) => n.type === 'rider'));
      }
    } catch(e) { console.error(e); }
    finally { setLoadingRiders(false); }
  };

  const totalPremium = actuarial.reduce((s, c) => s + c.premium_collected, 0);
  const alertCities  = actuarial.filter(c => c.sustainability === 'watch' || c.sustainability === 'critical');
  const stpRate      = stats ? Math.min(99, 80 + Math.round((stats.active_policies / Math.max(stats.total_riders, 1)) * 15)) : 0;

  const filteredActuarial = actuarial.filter(c =>
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRiders = riders.filter(r =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#faf8ff] text-[#131b2e]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      {/* Rider Detail Modal */}
      <AnimatePresence>
        {selectedRider && <RiderModal rider={selectedRider} onClose={() => setSelectedRider(null)} />}
      </AnimatePresence>

      {/* Main Canvas */}
      <main className="ml-64 flex-1 flex flex-col min-w-0">

        {/* Top App Bar */}
        <header className="sticky top-0 z-40 bg-[#faf8ff]/80 backdrop-blur-xl border-b border-[#e8ecf8]/80">
          <div className="flex justify-between items-center w-full px-8 py-3.5 max-w-7xl mx-auto">
            <div className="flex items-center gap-8">
              <h1 className="text-lg font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {selectedCity ? `${selectedCity} — Rider Network` : 'Claims Center'}
              </h1>
              <nav className="hidden md:flex items-center gap-6">
                {['Solutions','Claims','Risk Analysis'].map((t, i) => (
                  <a key={t} href="#" className={cn(
                    "text-sm py-1 transition-colors",
                    i === 0
                      ? "text-[#00488d] font-semibold border-b-2 border-[#00488d]"
                      : "text-[#727783] hover:text-[#131b2e]"
                  )}>{t}</a>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b0b5c3] w-4 h-4" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white ring-1 ring-[#c2c6d4]/30 focus:ring-2 focus:ring-[#00488d] rounded-full text-sm w-60 outline-none transition-all border-0"
                  placeholder={selectedCity ? "Search riders..." : "Search cities..."}
                />
              </div>
              {error && <span className="text-xs text-red-600 font-bold hidden md:block">{error}</span>}
              <span className="text-xs text-[#b0b5c3] hidden md:block">Updated {lastRefresh.toLocaleTimeString()}</span>
              <button
                onClick={fetchAll} disabled={loading}
                className="p-2 text-[#727783] hover:text-[#00488d] hover:bg-white rounded-lg transition-all"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 text-[#00488d] font-semibold text-sm hover:bg-[#f2f3ff] rounded-lg transition-colors">
                <LogIn className="w-4 h-4" /> Login
              </button>
              <button className="px-5 py-2 bg-gradient-to-br from-[#00488d] to-[#005fb8] text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">

          {/* ── Bento Stats ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Big Card */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(19,27,46,0.06)] border border-[#e8ecf8]/60 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest mb-1 block">Total Premium Pool</span>
                <h2 className="text-3xl font-extrabold text-[#131b2e] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {loading ? '—' : fmt(totalPremium)}
                  <span className="text-sm font-normal text-[#b0b5c3] ml-2">across all cities</span>
                </h2>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {['#dae2fd','#d5e3fc','#f2f3ff'].map((bg, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#00488d]" style={{ background: bg }}>
                      {['M', 'D', 'B'][i]}
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#f2f3ff] flex items-center justify-center text-[10px] font-bold text-[#727783]">+10</div>
                </div>
                <span className="text-xs text-[#727783] font-medium italic">13 cities · PAN India Network</span>
              </div>
            </div>

            {/* Avg Resolution */}
            <div className="bg-[#f2f3ff] p-6 rounded-2xl border border-[#e8ecf8]/60">
              <Zap className="w-5 h-5 text-[#00488d] mb-3" />
              <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest block mb-1">Active Riders</span>
              <h2 className="text-2xl font-bold text-[#131b2e]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {loading ? '—' : (stats?.total_riders || 0).toLocaleString('en-IN')}
              </h2>
              <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Live fleet data
              </div>
            </div>

            {/* STP Rate */}
            <div className="bg-[#f2f3ff] p-6 rounded-2xl border border-[#e8ecf8]/60">
              <BarChart2 className="w-5 h-5 text-[#7b3200] mb-3" />
              <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest block mb-1">Active Policies</span>
              <h2 className="text-2xl font-bold text-[#131b2e]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {loading ? '—' : (stats?.active_policies || 0).toLocaleString('en-IN')}
              </h2>
              <div className="mt-2 text-xs text-[#727783] font-medium">Parametric coverage</div>
            </div>
          </div>

          {/* ── Table Controls ── */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div className="space-y-0.5">
              {selectedCity ? (
                <>
                  <button onClick={() => { setSelectedCity(null); setSearchQuery(''); }} className="flex items-center gap-1.5 text-xs font-bold text-[#727783] hover:text-[#00488d] transition-colors uppercase tracking-widest mb-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Cities
                  </button>
                  <h3 className="text-lg font-bold text-[#131b2e]" style={{ fontFamily: "'Manrope', sans-serif" }}>{selectedCity} Riders</h3>
                  <p className="text-sm text-[#727783]">Active fleet management and risk inspection.</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-[#131b2e]" style={{ fontFamily: "'Manrope', sans-serif" }}>Operations Ledger</h3>
                  <p className="text-sm text-[#727783]">Real-time management of PAN India parametric insurance coverage.</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {alertCities.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" /> {alertCities.length} alert{alertCities.length > 1 ? 's' : ''}
                </span>
              )}
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c2c6d4]/40 text-[#424752] rounded-xl text-sm font-semibold hover:bg-[#f2f3ff] transition-all shadow-sm">
                <Filter className="w-4 h-4 text-[#b0b5c3]" /> Filter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#dae2fd] text-[#00468b] rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-95">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>

          {/* ── Data Table ── */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(19,27,46,0.06)] overflow-hidden border border-[#e8ecf8]/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">

                {/* City Table */}
                {!selectedCity && (
                  <>
                    <thead className="bg-[#faf8ff] text-[11px] font-bold text-[#b0b5c3] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">City</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Tier</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Policies</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Premium</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Payout</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Claims</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">BCR</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8] text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loading ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-[#b0b5c3]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                        </td></tr>
                      ) : filteredActuarial.length === 0 ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-[#b0b5c3]">No cities found.</td></tr>
                      ) : filteredActuarial.map((city, i) => (
                        <tr
                          key={i}
                          onClick={() => loadCityRiders(city.city)}
                          className={cn(
                            "hover:bg-[#f2f3ff] transition-colors cursor-pointer group",
                            i % 2 === 1 && "bg-[#faf8ff]/50"
                          )}
                        >
                          <td className="px-6 py-4 font-semibold text-[#131b2e] group-hover:text-[#00488d] transition-colors">{city.city}</td>
                          <td className="px-6 py-4">
                            <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold", TIER_BADGE[city.city_tier]?.cls)}>
                              {TIER_BADGE[city.city_tier]?.text || city.city_tier}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#424752]">{city.total_policies.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-[#424752] font-mono text-xs">{fmt(city.premium_collected)}</td>
                          <td className="px-6 py-4 text-[#424752] font-mono text-xs">{fmt(city.total_payout)}</td>
                          <td className="px-6 py-4 text-[#424752]">{city.total_claims.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 font-bold text-xs" style={{
                            color: city.avg_loss_ratio > 0.85 ? '#ba1a1a' : city.avg_loss_ratio > 0.70 ? '#b45f00' : '#2e7d32'
                          }}>
                            {(city.avg_loss_ratio * 100).toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold", STATUS_BADGE[city.sustainability])}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {city.sustainability}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* Riders Table */}
                {selectedCity && (
                  <>
                    <thead className="bg-[#faf8ff] text-[11px] font-bold text-[#b0b5c3] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Rider</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Rider ID</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Risk Status</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8]">Policy</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8] text-right">M. Earnings</th>
                        <th className="px-6 py-4 border-b border-[#e8ecf8] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingRiders ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-[#b0b5c3]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                        </td></tr>
                      ) : filteredRiders.length === 0 && !loadingRiders ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-[#b0b5c3]">No riders found.</td></tr>
                      ) : filteredRiders.map((r: any, idx: number) => (
                        <tr
                          key={r.id}
                          className={cn(
                            "hover:bg-[#f2f3ff] transition-colors cursor-pointer group",
                            idx % 2 === 1 && "bg-[#faf8ff]/50"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm",
                                r.status === 'attack' ? "bg-red-100 text-red-700" :
                                r.status === 'spoofing' ? "bg-amber-100 text-amber-700" :
                                "bg-blue-100 text-blue-700"
                              )}>
                                {r.name?.charAt(0) || 'R'}
                              </div>
                              <span className="font-semibold text-[#131b2e] group-hover:text-[#00488d] transition-colors">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[#727783]">#{r.id?.split('-').pop()}</td>
                          <td className="px-6 py-4">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                              r.status === 'attack'   ? "bg-red-50 text-red-700 border border-red-100" :
                              r.status === 'spoofing' ? "bg-amber-50 text-amber-700 border border-amber-100" :
                              "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            )}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {r.status === 'normal' ? 'Clean' : r.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Active</span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-[#424752]">₹{Math.round(r.earnings_monthly).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedRider(r)}
                              className="text-[#00488d] font-bold text-xs hover:underline decoration-2 underline-offset-4"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 bg-[#faf8ff]/50 border-t border-[#e8ecf8] flex items-center justify-between">
              <span className="text-xs text-[#727783]">
                Showing {selectedCity ? filteredRiders.length : filteredActuarial.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button className="p-1 text-[#b0b5c3] hover:text-[#00488d] transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <button className="w-8 h-8 flex items-center justify-center bg-[#00488d] text-white text-xs font-bold rounded-lg">1</button>
                <button className="p-1 text-[#b0b5c3] hover:text-[#00488d] transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          {/* ── Bottom Bento ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Regional Risk CTA */}
            <div className="lg:col-span-2 relative h-44 rounded-2xl overflow-hidden shadow-sm group cursor-pointer" onClick={() => window.location.href='/graph'}>
              <div className="absolute inset-0 bg-gradient-to-br from-[#00488d] via-[#005fb8] to-[#0071E3]" />
              <div className="absolute inset-0 opacity-10">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="absolute rounded-full bg-white/20"
                    style={{ width: `${60 + i * 40}px`, height: `${60 + i * 40}px`, top: `${10 + i * 8}%`, left: `${5 + i * 12}%`, opacity: 0.15 - i * 0.02 }}
                  />
                ))}
              </div>
              <div className="relative flex flex-col justify-center p-8 text-white h-full">
                <h4 className="text-xl font-bold mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>Regional Risk Profile</h4>
                <p className="text-sm text-blue-100 max-w-xs">View localized exposure metrics and adjust parametric triggers based on real-time weather patterns.</p>
                <button className="mt-4 w-fit px-5 py-2 bg-white text-[#00488d] font-bold text-xs rounded-xl hover:bg-blue-50 active:scale-95 transition-all">
                  Launch Risk Map →
                </button>
              </div>
            </div>

            {/* Live Claims Feed */}
            <div className="bg-white border border-[#e8ecf8] p-6 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#727783]">Live Claims Feed</span>
              </div>
              {liveFeed.length === 0 ? (
                <p className="text-xs text-[#b0b5c3] text-center py-4">No recent claims</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {liveFeed.slice(0, 5).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-[#f2f3ff] pb-1.5 last:border-0">
                      <div>
                        <span className="font-semibold text-[#131b2e]">{item.rider_name}</span>
                        <span className="text-[#727783] ml-1">· {item.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#727783] capitalize">{item.trigger}</span>
                        <span className={cn("font-bold", item.status === 'paid' ? 'text-[#10a37f]' : 'text-[#f59e0b]')}>
                          ₹{item.payout.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/fraud" className="text-xs font-bold underline decoration-2 underline-offset-4 mt-auto text-[#00488d] hover:text-[#341100]">
                Open Fraud Defense →
              </Link>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="bg-[#faf8ff] py-10 border-t border-[#e8ecf8] mt-auto">
          <div className="w-full px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm font-bold text-[#424752]" style={{ fontFamily: "'Manrope', sans-serif" }}>FlowSecure</div>
            <div className="flex flex-wrap justify-center gap-6">
              {['Privacy Policy','Terms of Service','Security','Compliance'].map(link => (
                <a key={link} href="#" className="text-[#727783] hover:text-[#131b2e] text-sm transition-colors">{link}</a>
              ))}
            </div>
            <div className="text-xs text-[#b0b5c3]">© 2025 FlowSecure Insurtech Solutions.</div>
          </div>
        </footer>
      </main>
    </div>
  );
}
