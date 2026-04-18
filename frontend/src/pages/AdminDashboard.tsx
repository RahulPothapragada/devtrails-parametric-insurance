import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, ArrowLeft, X, Activity, Shield, MapPin, FileText,
  LayoutDashboard, ShieldCheck, BarChart2, LineChart, FileText as FileTextIcon,
  Settings, HelpCircle, User, Download, Filter, ChevronLeft, ChevronRight,
  TrendingUp, Zap, Search, LogIn, FlameKindling, LogOut, Database, GitFork
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import ActuarialDashboard from './ActuarialDashboard';
import DataTimeline from './DataTimeline';
import FraudGraphPage from './FraudGraphPage';

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

const APPLE_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// ── Sidebar ──
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',  to: '/admin' },
  { icon: FileTextIcon,    label: 'Claims',     to: '/admin/claims' },
  { icon: LineChart,       label: 'Analytics',  to: '/admin/analytics' },
  { icon: GitFork,         label: 'Fraud Graph',to: '/admin/graph' },
  { icon: Database,        label: 'Data',       to: '/admin/data' },
];

function Sidebar() {
  const location = useLocation();

  return (
    <nav className="fixed left-0 top-0 h-full flex flex-col z-50 bg-white border-r border-[#E5E5EA] w-64">
      {/* Logo */}
      <div className="mb-8 px-4 pt-5 flex items-center gap-3">
        <div>
          <div className="text-lg font-extrabold tracking-tight text-[#1D1D1F]">FlowSecure</div>
          <div className="text-[10px] uppercase tracking-widest text-[#727783] font-bold">Admin Panel</div>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ icon: Icon, label, to }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={label}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-[#F5F5F7] text-[#0071E3] shadow-[0_1px_4px_rgba(0,113,227,0.10)]"
                  : "text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] hover:translate-x-0.5"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#0071E3]" : "text-[#8E8E93] group-hover:text-[#0071E3]")} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-[#E5E5EA] pt-4 px-3 pb-5 space-y-2">
        <a
          href="/rider"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-all duration-150 group"
        >
          <User className="w-4 h-4 shrink-0 text-[#8E8E93] group-hover:text-[#0071E3]" />
          <span>Rider Portal</span>
          <span className="ml-auto text-[10px] text-[#b0b5c3] group-hover:text-[#727783]">↗</span>
        </a>
        <Link to="/" className="w-full block">
          <button className="w-full py-2.5 px-4 bg-[#0071E3] text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-[#0077ED] active:scale-[0.98] transition-all">
            ← Back to Home
          </button>
        </Link>
      </div>
    </nav>
  );
}

// ── Rider Detail Modal ──
function RiderModal({ rider, onClose }: { rider: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-7 py-5 bg-[#F5F5F7] border-b border-[#E5E5EA]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#727783] font-bold mb-1">Rider Profile</div>
            <h2 className="text-xl font-extrabold text-[#1D1D1F]">{rider.name}</h2>
            <span className="text-xs font-mono text-[#727783]">ID: {rider.id}</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full border border-[#E5E5EA] hover:bg-[#F5F5F7] transition-colors shadow-sm">
            <X className="w-4 h-4 text-[#727783]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-7 grid grid-cols-2 gap-6">
          {/* Row 1 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Monthly Earnings</span>
            <span className="text-2xl font-bold text-[#1D1D1F]">₹{(rider.earnings_monthly || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Policy Status</span>
            <span className={cn("text-sm font-bold px-3 py-1.5 rounded-lg w-fit border",
              rider.policy_status === 'Flagged'
                ? 'text-red-700 bg-red-50 border-red-100'
                : 'text-emerald-700 bg-emerald-50 border-emerald-100'
            )}>{rider.policy_status || 'Active'}</span>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Risk Verdict</span>
            <span className={cn("text-sm font-bold capitalize px-3 py-1.5 rounded-lg w-fit border",
              rider.status === 'normal'   ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
              rider.status === 'spoofing' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                                           'text-red-700 bg-red-50 border-red-100'
            )}>
              {rider.verdict || 'Nominal Signal'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />Fraud Score</span>
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 h-2 bg-[#F5F5F7] rounded-full overflow-hidden border border-[#E5E5EA]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${rider.fraud_score || 0}%`,
                    background: (rider.fraud_score || 0) > 70 ? '#ef4444' : (rider.fraud_score || 0) > 40 ? '#f59e0b' : '#10a37f',
                  }}
                />
              </div>
              <span className="text-sm font-bold font-mono text-[#1D1D1F] w-8 text-right">{rider.fraud_score ?? '—'}</span>
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Shield Level</span>
            <div className="flex items-center gap-1 pt-0.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border",
                  i <= (rider.shield_level || 0)
                    ? 'bg-[#0071E3] text-white border-[#0071E3]'
                    : 'bg-[#F5F5F7] text-[#8E8E93] border-[#E5E5EA]'
                )}>{i}</div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />KYC / Aadhaar</span>
            <span className={cn("text-sm font-bold px-3 py-1.5 rounded-lg w-fit border",
              rider.aadhaar_verified
                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                : 'text-amber-700 bg-amber-50 border-amber-100'
            )}>{rider.aadhaar_verified ? 'Verified ✓' : 'Pending'}</span>
          </div>

          {/* Location */}
          <div className="col-span-2 flex flex-col gap-2 pt-4 border-t border-[#E5E5EA]">
            <span className="text-[10px] uppercase font-bold text-[#727783] tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Last Known Location</span>
            <div className="flex justify-between items-center bg-[#F5F5F7] p-3.5 rounded-xl font-mono text-sm border border-[#E5E5EA]">
              <span className="text-[#727783]">LAT: <span className="text-[#1D1D1F] font-semibold">{rider.lat?.toFixed(5) || 'Unknown'}</span></span>
              <span className="text-[#727783]">Zone: <span className="text-[#1D1D1F] font-semibold">{rider.location || 'Unknown'}</span></span>
              <span className="text-[#727783]">LNG: <span className="text-[#1D1D1F] font-semibold">{rider.lng?.toFixed(5) || 'Unknown'}</span></span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Admin Login Gate — Apple design language ──
const GOOGLE_CLIENT_ID = '262110215243-qh532bmm4eeqdqjl30se0comeledcpit.apps.googleusercontent.com';

function AdminLoginGate({ initialError = '', onDemoAccess }: { initialError?: string; onDemoAccess: () => void }) {
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]                 = useState(initialError);
  const [gisReady, setGisReady]           = useState(false);
  const gisRef                            = useRef<HTMLDivElement>(null);
  const [demoCode, setDemoCode]           = useState('');
  const [demoError, setDemoError]         = useState('');

  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  // Called by Google GIS with an ID token — no redirect needed
  const onGoogleCredential = useCallback(async ({ credential }: { credential: string }) => {
    setGoogleLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // On success: onAuthStateChange in the wrapper fires and opens the dashboard
  }, []);

  // Step 1 — wait for GIS script to load, then initialize
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const tryInit = () => {
      // Access window.google INSIDE this function — not captured early
      const g = (window as any).google;
      if (!g?.accounts?.id) return;
      clearInterval(timer);
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      setGisReady(true);
    };
    tryInit();
    timer = setInterval(tryInit, 150);
    return () => clearInterval(timer);
  }, [onGoogleCredential]);

  // Step 2 — render the button once GIS is ready and the container div is in the DOM
  useEffect(() => {
    if (!gisReady || !gisRef.current) return;
    const g = (window as any).google;
    gisRef.current.innerHTML = ''; // clear any previous render
    g.accounts.id.renderButton(gisRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 304,
    });
  }, [gisReady]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      {/* Logo lockup */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center mb-10"
      >
        <p className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] mb-2">FlowSecure</p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay: 0.05 }}
        className="w-full max-w-[360px] bg-white rounded-[20px] shadow-[0_2px_24px_rgba(0,0,0,0.08)] overflow-hidden"
      >
        <div className="px-8 pt-8 pb-7">
          <h1 className="text-[22px] font-bold tracking-tight text-[#1D1D1F] mb-1">Sign in</h1>
          <p className="text-[13px] text-[#86868B] font-medium mb-6">to FlowSecure Admin</p>

          {/* Google GIS button — always mounted so renderButton stays alive */}
          <div className="flex justify-center items-center min-h-[44px] mb-1 relative">
            {/* Skeleton while GIS script loads */}
            {!gisReady && !googleLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[304px] h-[44px] rounded-full bg-[#F5F5F7] border border-[#E5E5EA] animate-pulse" />
              </div>
            )}
            {/* Loading overlay */}
            {googleLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-[#86868B]">
                <RefreshCw className="w-4 h-4 animate-spin" /> Signing in with Google…
              </div>
            )}
            {/* GIS renders its button here — never unmounted */}
            <div ref={gisRef} style={{ visibility: googleLoading ? 'hidden' : 'visible' }} />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#E5E5EA]" />
            <span className="text-[11px] text-[#AEAEB2] font-semibold uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[#E5E5EA]" />
          </div>

          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider pl-0.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="admin@flowsecure.in"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D1D6] bg-white text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none transition-all focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 font-medium"
                style={{ fontFamily: appleFontFamily }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider pl-0.5">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D1D6] bg-white text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none transition-all focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 font-medium"
                style={{ fontFamily: appleFontFamily }}
              />
            </div>

            {/* Error */}
            {error && <p className="text-[#FF3B30] text-[12px] font-medium text-center">{error}</p>}

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-1 py-3 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#006ACF] text-white rounded-full font-semibold text-[15px] tracking-tight transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,113,227,0.28)]"
            >
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo access code — for judges/evaluators */}
        <div className="px-8 py-5 bg-[#F5F5F7] border-t border-[#E5E5EA]">
          <p className="text-[11px] text-[#AEAEB2] font-semibold uppercase tracking-widest text-center mb-3">
            Judge / Evaluator Access
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter access code"
              value={demoCode}
              onChange={e => { setDemoCode(e.target.value.toUpperCase()); setDemoError(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (demoCode === DEMO_ACCESS_CODE) onDemoAccess();
                  else setDemoError('Invalid code');
                }
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-[#D1D1D6] bg-white text-[13px] font-mono text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#0071E3] transition-all tracking-widest"
            />
            <button
              onClick={() => {
                if (demoCode === DEMO_ACCESS_CODE) onDemoAccess();
                else setDemoError('Invalid code');
              }}
              className="px-4 py-2 bg-[#1D1D1F] text-white rounded-xl text-[13px] font-semibold hover:bg-[#3D3D3F] transition-all active:scale-[0.97]"
            >
              Enter
            </button>
          </div>
          {demoError && <p className="text-[#FF3B30] text-[11px] font-medium text-center mt-2">{demoError}</p>}
        </div>
      </motion.div>

      {/* Bottom branding */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-[11px] text-[#AEAEB2] font-medium"
      >
        © 2025 FlowSecure Insurtech Solutions
      </motion.p>
    </div>
  );
}

// ── Dashboard Content (only rendered when authenticated) ──
function AdminContent({ session }: { session: Session }) {
  const location    = useLocation();
  const isAnalytics = location.pathname === '/admin/analytics';
  const isData      = location.pathname === '/admin/data';
  const isGraph     = location.pathname === '/admin/graph';
  const isClaims    = location.pathname === '/admin/claims';
  const isSubPage   = isAnalytics || isData || isGraph || isClaims;

  const userName   = session.user.user_metadata?.full_name
                  ?? session.user.user_metadata?.name
                  ?? session.user.email?.split('@')[0]
                  ?? 'Admin';
  const userAvatar = session.user.user_metadata?.avatar_url as string | undefined;
  const userEmail  = session.user.email ?? '';
  const initials   = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
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
  const [allClaims, setAllClaims]         = useState<any[]>([]);
  const [claimsFilter, setClaimsFilter]   = useState<string>('all');
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [reviewingId, setReviewingId]     = useState<number | null>(null);
  const [showFilters, setShowFilters]     = useState(false);
  const [cityTierFilter, setCityTierFilter] = useState<string>('all');
  const [riderRiskFilter, setRiderRiskFilter] = useState<string>('all');
  const [riderKycFilter, setRiderKycFilter] = useState<string>('all');

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
    // Poll every 30s — each live-feed call takes ~2s against Supabase, so 10s
    // polling caused the dashboard to be in a near-constant loading state.
    const iv = setInterval(fetchFeed, 30000);
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

  const fetchClaims = async (status = claimsFilter) => {
    setClaimsLoading(true);
    try {
      const url = status === 'all'
        ? `${API}/admin/claims?limit=200`
        : `${API}/admin/claims?status=${status}&limit=200`;
      const res = await fetch(url);
      if (res.ok) setAllClaims(await res.json());
    } catch (e) { console.error(e); }
    finally { setClaimsLoading(false); }
  };

  useEffect(() => {
    if (isClaims) fetchClaims(claimsFilter);
  }, [isClaims, claimsFilter]);

  const reviewClaim = async (id: number, verdict: 'approved' | 'denied') => {
    setReviewingId(id);
    try {
      await fetch(`${API}/admin/claims/${id}/review?verdict=${verdict}`, { method: 'PUT' });
      setAllClaims(prev => prev.map(c =>
        c.id === id ? { ...c, status: verdict } : c
      ));
    } catch (e) { console.error(e); }
    finally { setReviewingId(null); }
  };

  const totalPremium = actuarial.reduce((s, c) => s + c.premium_collected, 0);
  const alertCities  = actuarial.filter(c => c.sustainability === 'watch' || c.sustainability === 'critical');
  const stpRate      = stats ? Math.min(99, 80 + Math.round((stats.active_policies / Math.max(stats.total_riders, 1)) * 15)) : 0;

  const filteredActuarial = actuarial.filter(c => {
    const matchesSearch = c.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = cityTierFilter === 'all' || c.city_tier === cityTierFilter;
    return matchesSearch && matchesTier;
  });

  const filteredRiders = riders.filter(r => {
    const normalizedId = String(r.id ?? '').toLowerCase();
    const normalizedName = String(r.name ?? '').toLowerCase();
    const matchesSearch =
      normalizedName.includes(searchQuery.toLowerCase()) ||
      normalizedId.includes(searchQuery.toLowerCase());
    const matchesRisk = riderRiskFilter === 'all' || r.status === riderRiskFilter;
    const matchesKyc =
      riderKycFilter === 'all' ||
      (riderKycFilter === 'verified' && !!r.aadhaar_verified) ||
      (riderKycFilter === 'pending' && !r.aadhaar_verified);
    return matchesSearch && matchesRisk && matchesKyc;
  });

  const activeFilterCount = selectedCity
    ? [riderRiskFilter, riderKycFilter].filter(v => v !== 'all').length
    : [cityTierFilter].filter(v => v !== 'all').length;

  const resetFilters = () => {
    setCityTierFilter('all');
    setRiderRiskFilter('all');
    setRiderKycFilter('all');
  };

  const exportVisibleRows = () => {
    const columns = selectedCity
      ? [
          ['Rider', 'Rider ID', 'Risk Status', 'Fraud Score', 'Shield', 'KYC', 'Policy', 'Monthly Earnings'],
          ...filteredRiders.map((r: any) => [
            r.name ?? 'Unknown',
            String(r.id ?? ''),
            r.status === 'normal' ? 'Clean' : (r.status ?? 'Unknown'),
            String(r.fraud_score ?? ''),
            String(r.shield_level ?? ''),
            r.aadhaar_verified ? 'Verified' : 'Pending',
            r.policy_status || 'Active',
            String(Math.round(r.earnings_monthly || 0)),
          ]),
        ]
      : [
          ['City', 'Tier', 'Policies', 'Premium', 'Payout', 'Claims', 'BCR', 'Status'],
          ...filteredActuarial.map(city => [
            city.city,
            TIER_BADGE[city.city_tier]?.text || city.city_tier,
            String(city.total_policies),
            String(city.premium_collected),
            String(city.total_payout),
            String(city.total_claims),
            `${(city.avg_loss_ratio * 100).toFixed(1)}%`,
            city.sustainability,
          ]),
        ];

    const csv = columns
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scope = selectedCity ? `${selectedCity.toLowerCase().replace(/\s+/g, '-')}-riders` : 'dashboard-cities';
    link.href = url;
    link.download = `flowsecure-${scope}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F5F7] text-[#1D1D1F]" style={{ fontFamily: APPLE_FONT_FAMILY, WebkitFontSmoothing: 'antialiased' }}>
      <Sidebar />

      {/* Rider Detail Modal */}
      <AnimatePresence>
        {selectedRider && <RiderModal rider={selectedRider} onClose={() => setSelectedRider(null)} />}
      </AnimatePresence>

      {/* Main Canvas */}
      <main className="ml-64 flex-1 flex flex-col min-w-0">

        {/* Top App Bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA]">
          <div className="flex justify-between items-center w-full px-8 py-3.5 max-w-7xl mx-auto">
            <div className="flex items-center gap-8">
              <h1 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
                {isAnalytics ? 'Analytics' : isData ? 'Data Timeline' : isGraph ? 'Fraud Graph' : isClaims ? 'All Claims' : selectedCity ? `${selectedCity} — Rider Network` : 'Claims Center'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search — only on Dashboard */}
              {!isSubPage && (
                <>
                  <div className="relative hidden lg:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b0b5c3] w-4 h-4" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-white ring-1 ring-[#D2D2D7] focus:ring-2 focus:ring-[#0071E3] rounded-full text-sm w-60 outline-none transition-all border-0"
                      placeholder={selectedCity ? "Search riders..." : "Search cities..."}
                    />
                  </div>
                  {error && <span className="text-xs text-red-600 font-bold hidden md:block">{error}</span>}
                  <span className="text-xs text-[#b0b5c3] hidden md:block">Updated {lastRefresh.toLocaleTimeString()}</span>
                  <button
                    onClick={fetchAll} disabled={loading}
                    className="p-2 text-[#727783] hover:text-[#0071E3] hover:bg-[#F5F5F7] rounded-lg transition-all"
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  </button>
                </>
              )}
              {/* User pill */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#E5E5EA]">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover ring-2 ring-[#E5E5EA]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-[#E5E5EA]">
                    {initials}
                  </div>
                )}
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-[#1D1D1F] max-w-[120px] truncate">{userName}</span>
                  <span className="text-[10px] text-[#727783] max-w-[120px] truncate">{userEmail}</span>
                </div>
                <button
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                  title="Sign out"
                  className="ml-1 p-1.5 text-[#727783] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {isAnalytics && (
          <div className="flex-1 bg-[#F5F5F7] min-h-0">
            <ActuarialDashboard />
          </div>
        )}
        {isData && (
          <div className="flex-1 min-h-0">
            <DataTimeline />
          </div>
        )}
        {isGraph && (
          <div className="flex-1 min-h-0">
            <FraudGraphPage />
          </div>
        )}

        {/* ── Claims Tab ── */}
        {isClaims && (
          <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all',            label: 'All' },
                { key: 'auto_approved',  label: 'Auto Approved' },
                { key: 'approved',       label: 'Approved' },
                { key: 'pending_review', label: 'Pending Review' },
                { key: 'flagged',        label: 'Flagged' },
                { key: 'denied',         label: 'Denied' },
                { key: 'paid',           label: 'Paid' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setClaimsFilter(key)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold border transition-all",
                    claimsFilter === key
                      ? "bg-[#0071E3] text-white border-[#0071E3]"
                      : "bg-white text-[#424752] border-[#E5E5EA] hover:border-[#0071E3]"
                  )}
                >{label}</button>
              ))}
              <span className="ml-auto text-xs text-[#b0b5c3] font-medium">{allClaims.length} claims</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#E5E5EA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#F5F5F7] text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">ID</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Rider</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Zone</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Trigger</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Payout</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Fraud Score</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Time</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Status</th>
                      <th className="px-5 py-4 border-b border-[#E5E5EA]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimsLoading ? (
                      <tr><td colSpan={9} className="px-5 py-12 text-center text-[#b0b5c3]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                      </td></tr>
                    ) : allClaims.length === 0 ? (
                      <tr><td colSpan={9} className="px-5 py-12 text-center text-[#b0b5c3]">No claims found.</td></tr>
                    ) : allClaims.map((claim, i) => {
                      const statusStyles: Record<string, string> = {
                        auto_approved:  'bg-green-50 text-green-700 border-green-200',
                        approved:       'bg-green-50 text-green-700 border-green-200',
                        paid:           'bg-blue-50 text-blue-700 border-blue-200',
                        pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
                        flagged:        'bg-orange-50 text-orange-700 border-orange-200',
                        denied:         'bg-red-50 text-red-700 border-red-200',
                      };
                      const canReview = claim.status === 'pending_review' || claim.status === 'flagged';
                      return (
                        <tr key={claim.id} className={cn("hover:bg-[#F5F5F7] transition-colors", i % 2 === 1 && "bg-[#FBFBFD]")}>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#727783]">#{claim.id}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-[#1D1D1F]">{claim.rider_name}</div>
                            <div className="text-[11px] text-[#727783]">
                              Rider #{claim.rider_id}
                              {claim.rider_phone ? ` · ${claim.rider_phone}` : ''}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[#424752] text-xs">{claim.zone}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 bg-[#F0F7FF] text-[#0071E3] rounded text-xs font-bold capitalize">{claim.trigger}</span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#1D1D1F]">{fmt(claim.payout_amount || 0)}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "font-bold text-xs",
                              (claim.fraud_score || 0) >= 60 ? "text-red-600" :
                              (claim.fraud_score || 0) >= 30 ? "text-amber-600" : "text-green-600"
                            )}>{claim.fraud_score ?? '—'}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-[#727783]">
                            {new Date(claim.event_time).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize", statusStyles[claim.status] || "bg-gray-50 text-gray-500 border-gray-200")}>
                              {claim.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {canReview ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  disabled={reviewingId === claim.id}
                                  onClick={() => reviewClaim(claim.id, 'approved')}
                                  className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                >Approve</button>
                                <button
                                  disabled={reviewingId === claim.id}
                                  onClick={() => reviewClaim(claim.id, 'denied')}
                                  className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                                >Deny</button>
                              </div>
                            ) : (
                              <span className="text-xs text-[#b0b5c3]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className={cn("p-8 max-w-7xl mx-auto w-full space-y-8", isSubPage && "hidden")}>

          {/* ── Bento Stats ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Big Card */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#E5E5EA] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest mb-1 block">Total Premium Pool</span>
                <h2 className="text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  {loading ? '—' : fmt(totalPremium)}
                  <span className="text-sm font-normal text-[#b0b5c3] ml-2">across all cities</span>
                </h2>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {actuarial.slice(0, 3).map((c, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#0071E3]"
                      style={{ background: ['#EAF4FF','#F0F7FF','#F5F5F7'][i] }}>
                      {c.city.charAt(0)}
                    </div>
                  ))}
                  {actuarial.length > 3 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-[#F5F5F7] flex items-center justify-center text-[10px] font-bold text-[#727783]">+{actuarial.length - 3}</div>
                  )}
                </div>
                <span className="text-xs text-[#727783] font-medium italic">{actuarial.length} cities · PAN India Network</span>
              </div>
            </div>

            {/* Avg Resolution */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5EA] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
              <Zap className="w-5 h-5 text-[#0071E3] mb-3" />
              <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest block mb-1">Active Riders</span>
              <h2 className="text-2xl font-bold text-[#1D1D1F]">
                {loading ? '—' : (stats?.total_riders || 0).toLocaleString('en-IN')}
              </h2>
              <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Live fleet data
              </div>
            </div>

            {/* STP Rate */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5EA] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
              <BarChart2 className="w-5 h-5 text-[#7b3200] mb-3" />
              <span className="text-[10px] font-bold text-[#b0b5c3] uppercase tracking-widest block mb-1">Active Policies</span>
              <h2 className="text-2xl font-bold text-[#1D1D1F]">
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
                  <button onClick={() => { setSelectedCity(null); setSearchQuery(''); }} className="flex items-center gap-1.5 text-xs font-bold text-[#727783] hover:text-[#0071E3] transition-colors uppercase tracking-widest mb-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Cities
                  </button>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">{selectedCity} Riders</h3>
                  <p className="text-sm text-[#727783]">Active fleet management and risk inspection.</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">Operations Ledger</h3>
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
              <div className="relative">
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D2D2D7] text-[#424752] rounded-xl text-sm font-semibold hover:bg-[#F5F5F7] transition-all shadow-sm"
                >
                  <Filter className="w-4 h-4 text-[#b0b5c3]" /> Filter
                  {activeFilterCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0071E3] text-white text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilters && (
                  <div className="absolute right-0 mt-2 w-[300px] rounded-2xl border border-[#E5E5EA] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.10)] p-4 z-20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1D1D1F]">Filter Table</p>
                        <p className="text-xs text-[#727783]">
                          {selectedCity ? `Refine riders in ${selectedCity}` : 'Refine the city operations table'}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="text-xs font-semibold text-[#727783] hover:text-[#0071E3]"
                      >
                        Close
                      </button>
                    </div>

                    {!selectedCity ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#b0b5c3]">City Tier</span>
                          <select
                            value={cityTierFilter}
                            onChange={e => setCityTierFilter(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-2 text-sm outline-none focus:border-[#0071E3]"
                          >
                            <option value="all">All tiers</option>
                            <option value="tier_1">Tier 1</option>
                            <option value="tier_2">Tier 2</option>
                            <option value="tier_3">Tier 3</option>
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#b0b5c3]">Risk Status</span>
                          <select
                            value={riderRiskFilter}
                            onChange={e => setRiderRiskFilter(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-2 text-sm outline-none focus:border-[#0071E3]"
                          >
                            <option value="all">All riders</option>
                            <option value="normal">Clean</option>
                            <option value="spoofing">Spoofing</option>
                            <option value="attack">Attack</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#b0b5c3]">KYC</span>
                          <select
                            value={riderKycFilter}
                            onChange={e => setRiderKycFilter(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-2 text-sm outline-none focus:border-[#0071E3]"
                          >
                            <option value="all">All KYC states</option>
                            <option value="verified">Verified</option>
                            <option value="pending">Pending</option>
                          </select>
                        </label>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={resetFilters}
                        className="text-sm font-semibold text-[#727783] hover:text-[#131b2e]"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-sm font-semibold hover:bg-[#0077ED] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={exportVisibleRows}
                className="flex items-center gap-2 px-4 py-2 bg-[#dae2fd] text-[#00468b] rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>

          {/* ── Data Table ── */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden border border-[#E5E5EA]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">

                {/* City Table */}
                {!selectedCity && (
                  <>
                    <thead className="bg-[#F5F5F7] text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">City</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Tier</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Policies</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Premium</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Payout</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Claims</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">BCR</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA] text-right">Status</th>
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
                            "hover:bg-[#F5F5F7] transition-colors cursor-pointer group",
                            i % 2 === 1 && "bg-[#FBFBFD]"
                          )}
                        >
                          <td className="px-6 py-4 font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">{city.city}</td>
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
                    <thead className="bg-[#F5F5F7] text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Rider</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Rider ID</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Risk Status</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Fraud Score</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Shield</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">KYC</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA]">Policy</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA] text-right">M. Earnings</th>
                        <th className="px-6 py-4 border-b border-[#E5E5EA] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingRiders ? (
                        <tr><td colSpan={9} className="px-6 py-12 text-center text-[#b0b5c3]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                        </td></tr>
                      ) : filteredRiders.length === 0 && !loadingRiders ? (
                        <tr><td colSpan={9} className="px-6 py-12 text-center text-[#b0b5c3]">No riders found.</td></tr>
                      ) : filteredRiders.map((r: any, idx: number) => (
                        <tr
                          key={r.id}
                          className={cn(
                            "hover:bg-[#F5F5F7] transition-colors cursor-pointer group",
                            idx % 2 === 1 && "bg-[#FBFBFD]"
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
                              <div className="flex flex-col">
                                <span className="font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">{r.name}</span>
                                {r.verdict && r.verdict !== 'Nominal Signal Pattern' && (
                                  <span className="text-[10px] text-red-500 font-medium truncate max-w-[140px]">{r.verdict}</span>
                                )}
                              </div>
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
                          {/* Fraud Score — colored bar */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden border border-[#E5E5EA] w-16">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${r.fraud_score || 0}%`,
                                    background: (r.fraud_score || 0) > 70 ? '#ef4444' : (r.fraud_score || 0) > 40 ? '#f59e0b' : '#10a37f',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold font-mono text-[#1D1D1F] w-7 text-right">{r.fraud_score ?? '—'}</span>
                            </div>
                          </td>
                          {/* Shield Level — tier dots */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <div key={i} className={cn("w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold",
                                  i <= (r.shield_level || 0)
                                    ? 'bg-[#0071E3] text-white'
                                    : 'bg-[#F5F5F7] text-[#8E8E93] border border-[#E5E5EA]'
                                )}>{i}</div>
                              ))}
                            </div>
                          </td>
                          {/* KYC / Aadhaar */}
                          <td className="px-6 py-4">
                            <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
                              r.aadhaar_verified
                                ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                                : "text-amber-700 bg-amber-50 border-amber-100"
                            )}>{r.aadhaar_verified ? '✓ Verified' : 'Pending'}</span>
                          </td>
                          {/* Policy Status */}
                          <td className="px-6 py-4">
                            <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
                              r.policy_status === 'Flagged'
                                ? "text-red-700 bg-red-50 border-red-100"
                                : "text-emerald-700 bg-emerald-50 border-emerald-100"
                            )}>{r.policy_status || 'Active'}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-[#424752]">₹{Math.round(r.earnings_monthly || 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedRider(r)}
                              className="text-[#0071E3] font-bold text-xs hover:underline decoration-2 underline-offset-4"
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
            <div className="px-6 py-4 bg-[#F5F5F7] border-t border-[#E5E5EA] flex items-center justify-between">
              <span className="text-xs text-[#727783]">
                Showing {selectedCity ? filteredRiders.length : filteredActuarial.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button className="p-1 text-[#8E8E93] hover:text-[#0071E3] transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <button className="w-8 h-8 flex items-center justify-center bg-[#0071E3] text-white text-xs font-bold rounded-lg">1</button>
                <button className="p-1 text-[#8E8E93] hover:text-[#0071E3] transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          {/* ── Bottom Bento ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Regional Risk CTA */}
            <div className="lg:col-span-2 relative h-44 rounded-2xl overflow-hidden shadow-sm group cursor-pointer" onClick={() => window.location.href='/admin/graph'}>
              <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3] via-[#0A84FF] to-[#5AC8FA]" />
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
                <button className="mt-4 w-fit px-5 py-2 bg-white text-[#0071E3] font-bold text-xs rounded-xl hover:bg-blue-50 active:scale-95 transition-all">
                  Launch Risk Map →
                </button>
              </div>
            </div>

            {/* Compliance Alert */}
            <div className="bg-[#ffdbcb] p-6 rounded-2xl border border-[#ffb691]/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FlameKindling className="w-4 h-4 text-[#7b3200]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#341100]">Alert</span>
                </div>
                <h4 className="text-lg font-extrabold leading-tight text-[#341100]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {alertCities.length > 0
                    ? `${alertCities.map(c => c.city).slice(0, 2).join(', ')} ${alertCities.length > 2 ? `+${alertCities.length - 2} more` : ''} — Risk Elevated`
                    : 'All Zones Nominal'}
                </h4>
                <p className="text-xs text-[#783100] mt-2 leading-relaxed">
                  {alertCities.length > 0
                    ? 'Parametric triggers are approaching threshold. Review loss ratios immediately.'
                    : 'All parametric triggers are within safe operating band. System healthy.'}
                </p>
              </div>
              <Link to="/admin/fraud-defense" className="text-xs font-bold underline decoration-2 underline-offset-4 mt-4 block text-[#783100] hover:text-[#341100]">
                Open Fraud Defense →
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// ── Admin email allowlist — add your team's emails here ──
const ADMIN_EMAILS = new Set([
  'rahulpothapragada@gmail.com',
  // add more team emails here
]);

// ── Demo access code — share this in your pitch deck for judges ──
const DEMO_ACCESS_CODE = 'GUIDEWIRE2026';

const DEMO_SESSION = {
  user: {
    email: 'demo@guidewire-judge.com',
    user_metadata: { full_name: 'Demo Admin' },
  },
} as unknown as Session;

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

// ── Auth Wrapper ──
export default function AdminDashboard() {
  const [session,   setSession]   = useState<Session | null | undefined>(undefined);
  const [authError, setAuthError] = useState('');
  const [demoMode,  setDemoMode]  = useState(false);

  const applySession = (s: Session | null) => {
    if (s && !isAdminEmail(s.user.email)) {
      supabase.auth.signOut();
      setAuthError(`Access denied. ${s.user.email} is not an authorised admin account.`);
      setSession(null);
    } else {
      setSession(s);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const oauthError = params.get('error_description') || params.get('error');

    // ── Case 1: Supabase returned an error (e.g. user denied permission) ──
    if (oauthError) {
      setAuthError(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
      setSession(null);
      window.history.replaceState({}, '', '/admin');
      return;
    }

    // ── Case 2: Returning from Google OAuth with a PKCE code ──
    if (code) {
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .then(({ data, error }) => {
          if (error) {
            setAuthError(
              error.message.includes('code_verifier')
                ? 'Google sign-in failed: redirect URL may not be in Supabase allowlist. Add "http://localhost:5173/admin" under Authentication → URL Configuration in your Supabase dashboard.'
                : error.message
            );
            setSession(null);
          } else {
            applySession(data.session);
          }
          window.history.replaceState({}, '', '/admin');
        });
      return;
    }

    // ── Case 3: Normal page load — check for existing stored session ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
    });

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  const isOAuthCallback = new URLSearchParams(window.location.search).has('code');

  if (session === undefined) {
    return (
      <div
        className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-3"
        style={{ fontFamily: appleFontFamily }}
      >
        <div className="w-10 h-10 rounded-[12px] bg-[#0071E3] flex items-center justify-center shadow-[0_4px_16px_rgba(0,113,227,0.30)]">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <RefreshCw className="w-4 h-4 animate-spin text-[#86868B]" />
        <p className="text-[13px] text-[#86868B] font-medium">
          {isOAuthCallback ? 'Completing Google sign‑in…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (demoMode) return <AdminContent session={DEMO_SESSION} />;

  if (!session) return <AdminLoginGate initialError={authError} onDemoAccess={() => setDemoMode(true)} />;

  return <AdminContent session={session} />;
}
