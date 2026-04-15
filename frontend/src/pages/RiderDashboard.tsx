import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, CloudRain, Clock, ShieldCheck, ChevronRight,
  CreditCard, AlertCircle, Loader2, Wallet, Shield,
  Zap, LogIn, User, MapPin, Package, Calendar
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function RiskCircles({ center, zone }: {
  center: { lat: number; lng: number };
  zone: { flood_risk_score?: number; heat_risk_score?: number } | undefined;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !zone) return;
    const circles: google.maps.Circle[] = [];
    if ((zone.flood_risk_score ?? 0) > 0.5) {
      circles.push(new google.maps.Circle({
        map, center, radius: 600,
        strokeColor: '#3b82f6', strokeOpacity: 0.4, strokeWeight: 1,
        fillColor: '#3b82f6', fillOpacity: 0.07,
      }));
    }
    if ((zone.heat_risk_score ?? 0) > 0.5) {
      circles.push(new google.maps.Circle({
        map, center, radius: 400,
        strokeColor: '#f97316', strokeOpacity: 0.4, strokeWeight: 1,
        fillColor: '#f97316', fillOpacity: 0.07,
      }));
    }
    return () => circles.forEach(c => c.setMap(null));
  }, [map, center, zone]);
  return null;
}
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

import { API_BASE as API } from '@/lib/api';

// ── Session cache — survives tab switches, cleared on browser close ──
const CACHE_KEY = 'fs_dashboard_v1';
const PREDICT_KEY = 'fs_predict_v1';
const OPTIMIZE_KEY = 'fs_optimize_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as T;
  } catch { return null; }
}
function writeCache(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
}

// ── Types ──
interface RzpConfig {
  configured: boolean;
  key_id: string | null;
  mode: 'live' | 'sandbox';
}

interface OrderData {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  rider_name: string;
  rider_email: string | null;
  rider_phone: string;
  premium_amount: number;
  mode: 'live' | 'sandbox';
}

interface DashboardData {
  rider: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    zone_id: number;
    avg_weekly_earnings: number;
    avg_hourly_rate: number;
    shield_level: number;
    active_days_last_30: number;
    activity_tier: string;
    is_active: boolean;
  };
  zone: {
    id: number;
    city_id: number;
    name: string;
    tier: string;
    lat: number;
    lng: number;
    flood_risk_score: number;
    heat_risk_score: number;
    aqi_risk_score: number;
    traffic_risk_score: number;
  };
  active_policy: {
    id: number;
    premium_amount: number;
    status: string;
    week_start: string;
    week_end: string;
  } | null;
  recent_claims: Array<{
    id: number;
    payout_amount: number;
    trigger_type: string;
    status: string;
    event_time: string;
  }>;
  weekly_earnings: number;
  total_deliveries: number;
  active_hours: number;
  city_name: string;
  city_tier: string;
  shield_level: number;
  risk_summary: Record<string, number>;
  daily_earnings: Array<{
    date: string;
    day: string;
    earnings: number;
    deliveries: number;
    hours: number;
  }>;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// ── Auth helpers ──
function getToken(): string | null { return localStorage.getItem('flowsecure_token'); }
function getRiderName(): string | null { return localStorage.getItem('flowsecure_rider_name'); }
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function buildEarningsHistory(
  dailyEarnings: Array<{ date: string; day: string; earnings: number; deliveries: number; hours: number }>,
  claims: Array<{ payout_amount: number; event_time: string; status: string }>
) {
  const history = dailyEarnings.map(d => ({
    day: d.day,
    earnings: Math.round(d.earnings),
    payout: 0,
    date: d.date,
  }));
  claims.forEach(c => {
    if (c.status !== 'paid' && c.status !== 'auto_approved') return;
    const cd = new Date(c.event_time).toISOString().slice(0, 10);
    const slot = history.find(h => h.date === cd);
    if (slot) slot.payout += Math.round(c.payout_amount);
  });
  return history;
}

// ──────────────────────────────────────────────────────────────
export default function RiderDashboard() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [riderName, setRiderName] = useState(getRiderName() || '');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // OTP login state
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const [rzpConfig, setRzpConfig] = useState<RzpConfig | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'creating' | 'open' | 'verifying' | 'success' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState('');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => readCache<DashboardData>(CACHE_KEY));
  const [dashboardLoading, setDashboardLoading] = useState(!readCache(CACHE_KEY)); // only show spinner if no cache
  const [premiumEstimate, setPremiumEstimate] = useState<number>(0);
  const [premiumBreakdown, setPremiumBreakdown] = useState<Record<string, number> | null>(null);
  const [predictData, setPredictData] = useState<any>(() => readCache(PREDICT_KEY));
  const [optimizeData, setOptimizeData] = useState<any>(() => readCache(OPTIMIZE_KEY));
  const [isSimulating, setIsSimulating] = useState(false);
  const [payoutFlow, setPayoutFlow] = useState<null | {
    claimId: number;
    amount: number;
    upiId: string;
    steps: { label: string; status: 'pending' | 'running' | 'success' | 'failed'; detail?: string }[];
  }>(null);

  // ── Auto login check ──
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('stale'); return r.json(); })
      .then(data => { setRiderName(data.name); setLoggedIn(true); })
      .catch(() => {
        localStorage.removeItem('flowsecure_token');
        localStorage.removeItem('flowsecure_rider_name');
        setLoggedIn(false); setRiderName('');
      });
  }, []);

  const [demoCity, setDemoCity] = useState<string | null>(null);

  const handleDemoLogin = async (city?: string) => {
    setLoginLoading(true); setLoginError('');
    setDemoCity(city || null);
    localStorage.removeItem('flowsecure_token'); localStorage.removeItem('flowsecure_rider_name');
    try {
      const url = city ? `${API}/auth/demo-login?city=${encodeURIComponent(city)}` : `${API}/auth/demo-login`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setLoggedIn(true); setRiderName(data.name);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoginLoading(false);
      setDemoCity(null);
    }
  };

  const handleSendOtp = async () => {
    const phone = phoneInputRef.current?.value.replace(/\D/g, '') || otpPhone;
    setOtpPhone(phone);
    if (!/^\d{10}$/.test(phone)) { setLoginError('Enter a valid 10-digit phone number'); return; }
    setLoginLoading(true); setLoginError(''); setDemoOtp(null);
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setDemoOtp(data.demo_otp || null);
      setOtpStep('otp');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4}$/.test(otpCode)) { setLoginError('Enter the 4-digit OTP'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setLoggedIn(true); setRiderName(data.name);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/payments/config`)
      .then(r => r.json())
      .then(d => setRzpConfig(d))
      .catch(() => setRzpConfig({ configured: false, key_id: null, mode: 'sandbox' }));
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!getToken()) return;
    setDashboardLoading(true);
    try {
      // ── Step 1: Fetch core dashboard immediately ──
      const res = await fetch(`${API}/riders/me`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Fetch failed');
      const data: DashboardData = await res.json();
      setDashboardData(data);
      writeCache(CACHE_KEY, data);
      setDashboardLoading(false); // Show dashboard NOW, before slow external calls

      // ── Step 2: Fire predict/optimize/pricing in background — only on first load ──
      if (!predictData && !optimizeData) {
        const now = new Date();
        Promise.allSettled([
          fetch(`${API}/pricing/quote?city=${encodeURIComponent(data.city_name || '')}&zone_tier=${data.zone.tier}&month=${now.getMonth() + 1}`),
          fetch(`${API}/triggers/predict/${data.zone.id}`, { headers: authHeaders() }),
          fetch(`${API}/triggers/optimize/${data.rider.id}`, { headers: authHeaders() }),
        ]).then(async ([priceRes, predRes, optRes]) => {
          if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
            const pd = await priceRes.value.json();
            setPremiumEstimate(pd.total_weekly_premium || 0);
            if (pd.breakdown) setPremiumBreakdown(pd.breakdown);
          }
          if (predRes.status === 'fulfilled' && predRes.value.ok) {
            const pd = await predRes.value.json(); setPredictData(pd); writeCache(PREDICT_KEY, pd);
          }
          if (optRes.status === 'fulfilled' && optRes.value.ok) {
            const od = await optRes.value.json(); setOptimizeData(od); writeCache(OPTIMIZE_KEY, od);
          }
        });
      }
    } catch (e) {
      console.warn('Dashboard data fetch error:', e);
      setDashboardLoading(false);
    }
  }, [predictData, optimizeData]);

  useEffect(() => {
    if (loggedIn) fetchDashboardData();
  }, [loggedIn, fetchDashboardData]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleSimulateDisaster = async () => {
    if (!dashboardData?.rider?.id) return;
    setIsSimulating(true);
    try {
      // Step 1: Create the claim
      const simRes = await fetch(`${API}/triggers/demo-disaster/${dashboardData.rider.id}`, { method: 'POST' });
      if (!simRes.ok) throw new Error(`HTTP ${simRes.status}`);
      const simData = await simRes.json();
      const claimId: number = simData.claim_id;
      const amount: number = simData.payout_amount;
      const upiId: string = simData.upi_id || 'rider@upi';

      const ap = simData.auto_payout || {};
      const upiFailReason: string = ap.upi_failure_reason || '';
      const ref: string = ap.ref || '';
      const channel: string = ap.channel || 'upi';
      const bankName: string = ap.bank || '';

      // Build animated steps from the real payout result
      setPayoutFlow({ claimId, amount, upiId, steps: [
        { label: '🌧️ Rainfall trigger verified (85mm > 65mm threshold)', status: 'success' },
        { label: 'Fraud engine cleared — claim auto-approved', status: 'success' },
        { label: `Initiating UPI transfer → ${upiId}`, status: 'running' },
        { label: 'Bank processing…', status: 'pending' },
        { label: 'Payout result', status: 'pending' },
      ]});
      setIsSimulating(false);

      await sleep(900);

      if (ap.attempts === 1 && ap.success) {
        // UPI succeeded first try — animate steps
        setPayoutFlow(prev => prev && { ...prev, steps: [
          prev.steps[0], prev.steps[1],
          { label: `UPI transfer sent → ${upiId}`, status: 'success', detail: `Ref: ${ref}` },
          { label: 'Bank confirmed ✓', status: 'running' },
          prev.steps[4],
        ]});
        await sleep(1000);
        setPayoutFlow(prev => prev && { ...prev, steps: [
          prev.steps[0], prev.steps[1], prev.steps[2],
          { label: 'Bank confirmed ✓', status: 'success' },
          { label: `₹${amount.toFixed(0)} auto-credited via UPI`, status: 'success', detail: `Rider receives money instantly. No action needed.` },
        ]});
      } else if (ap.attempts === 2 && ap.success) {
        // UPI failed → IMPS succeeded
        setPayoutFlow(prev => prev && { ...prev, steps: [
          prev.steps[0], prev.steps[1],
          { label: `UPI failed — ${upiFailReason}`, status: 'failed', detail: 'Switching to IMPS automatically…' },
          { label: `IMPS transfer → ${bankName}`, status: 'running' },
          prev.steps[4],
        ]});
        await sleep(1200);
        setPayoutFlow(prev => prev && { ...prev, steps: [
          prev.steps[0], prev.steps[1], prev.steps[2],
          { label: `IMPS transfer → ${bankName}`, status: 'success', detail: `Ref: ${ref}` },
          { label: `₹${amount.toFixed(0)} credited via IMPS ✓`, status: 'success', detail: 'Auto-recovered. No rider action needed.' },
        ]});
      } else {
        // Both failed
        setPayoutFlow(prev => prev && { ...prev, steps: [
          prev.steps[0], prev.steps[1],
          { label: `UPI failed — ${upiFailReason}`, status: 'failed' },
          { label: `IMPS also failed`, status: 'failed', detail: ap.imps_failure_reason },
          { label: 'Support notified for manual transfer', status: 'failed' },
        ]});
      }

      await fetchDashboardData();
    } catch (e) {
      console.warn('Simulation error:', e);
      setIsSimulating(false);
    }
  };

  const handleBuyPolicy = async () => {
    if (!getToken()) {
      setPaymentError('Please login first.'); setPaymentStatus('error'); return;
    }
    setPaymentStatus('creating'); setPaymentError('');

    try {
      const orderRes = await fetch(`${API}/payments/create-order`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ zone_id: dashboardData?.zone?.id || 1, auto_renew: true }),
      });
      if (!orderRes.ok) throw new Error('Order creation failed');
      const order: OrderData = await orderRes.json();

      if (order.mode === 'sandbox') {
        setPaymentStatus('verifying');
        await new Promise(r => setTimeout(r, 1000));
        await fetch(`${API}/payments/verify`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            razorpay_order_id: order.order_id, razorpay_payment_id: 'pay_sandbox',
            razorpay_signature: 'sandbox_valid', zone_id: dashboardData?.zone?.id || 1, auto_renew: true,
          }),
        });
        setPaymentStatus('success');
        fetchDashboardData();
      } else {
        // Load Razorpay checkout script if not already loaded
        await new Promise<void>((resolve, reject) => {
          if (window.Razorpay) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay script'));
          document.body.appendChild(script);
        });

        setPaymentStatus('open');

        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: 'FlowSecure',
          description: 'Weekly Parametric Income Protection',
          prefill: {
            name: order.rider_name,
            email: order.rider_email || '',
            contact: order.rider_phone,
          },
          theme: { color: '#0071E3' },
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            setPaymentStatus('verifying');
            try {
              await fetch(`${API}/payments/verify`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  zone_id: dashboardData?.zone?.id || 1,
                  auto_renew: true,
                }),
              });
              setPaymentStatus('success');
              fetchDashboardData();
            } catch {
              setPaymentError('Payment verification failed. Contact support.');
              setPaymentStatus('error');
            }
          },
        });

        rzp.on('payment.failed', () => {
          setPaymentError('Payment failed or was cancelled.');
          setPaymentStatus('error');
        });

        rzp.open();
      }
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Error');
      setPaymentStatus('error');
    }
  };

  // ── Computed Values ──
  const recentClaims = dashboardData?.recent_claims || [];
  const paidClaims = recentClaims.filter(c => c.status === 'paid' || c.status === 'auto_approved');
  const totalPayouts = paidClaims.reduce((sum, c) => sum + (c.payout_amount || 0), 0);

  // Use actual last-7-day sum from activity data instead of stored avg
  const last7DayEarnings = dashboardData?.daily_earnings?.reduce((s, d) => s + d.earnings, 0) ?? 0;
  const deliveryEarnings = last7DayEarnings || dashboardData?.weekly_earnings || 0;

  const activePremium = dashboardData?.active_policy?.premium_amount || 0;
  const displayPremium = activePremium || premiumEstimate || 45;
  const totalEarnings = deliveryEarnings + totalPayouts + (optimizeData?.projected_earnings_saved || 0);
  const hasActivePolicy = !!dashboardData?.active_policy;

  const activeDays = dashboardData?.rider?.active_days_last_30 ?? 0;
  const totalDeliveries = dashboardData?.total_deliveries ?? 0;
  const activeHours = Math.round(dashboardData?.active_hours ?? 0);

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Build earnings chart from real daily activity data
  const earningsHistory = dashboardData?.daily_earnings?.length
    ? buildEarningsHistory(dashboardData.daily_earnings, recentClaims)
    : Array.from({ length: 7 }, (_, i) => ({ day: DAYS[i], earnings: 0, payout: 0, date: '' }));

  // Map center from zone lat/lng
  const mapCenter: [number, number] = dashboardData?.zone?.lat && dashboardData?.zone?.lng
    ? [dashboardData.zone.lat, dashboardData.zone.lng]
    : [19.076, 72.8777]; // Mumbai default

  // Location label
  const locationLabel = dashboardData
    ? [dashboardData.city_name, dashboardData.zone?.name].filter(Boolean).join(' · ')
    : 'Loading…';

  // High-risk day from predictions
  const highRiskDay = predictData?.predictions?.find((p: any) => p.risk === 'High');
  const aiSavings = optimizeData?.projected_earnings_saved || 0;

  const fmt = (n: number) => n.toLocaleString('en-IN');

  const weatherEmoji = (condition: string): string => {
    const c = (condition || '').toLowerCase();
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return '🌫️';
    if (c.includes('cloud')) return '☁️';
    if (c.includes('clear')) return '☀️';
    return '🌤️';
  };

  const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("bg-white border border-[#E5E5EA] rounded-[1.5rem] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]", className)}>
      {children}
    </div>
  );

  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div 
      className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-24 pt-16 selection:bg-[#0071E3]/20 selection:text-[#0071E3]"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        
        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 mt-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
              {loggedIn ? `Welcome back, ${riderName.split(' ')[0]}` : 'Rider Dashboard'}
            </h1>
            <p className="text-[#86868B] text-xl mt-2 font-medium">
              {loggedIn ? locationLabel : 'Login to view your gig stats and protections'}
            </p>
          </div>
          {loggedIn && (
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold border",
              hasActivePolicy ? "bg-[#0071E3]/10 text-[#0071E3] border-transparent" : "bg-white text-[#86868B] border-[#E5E5EA]"
            )}>
              <ShieldCheck className="w-5 h-5" />
              {hasActivePolicy ? 'Protected This Week' : 'Unprotected'}
            </div>
          )}
        </header>

        {/* Login State */}
        {!loggedIn && (
          <div className="max-w-md mx-auto mt-24">
            <Card className="flex flex-col gap-6 p-10">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-[#0071E3]" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold mb-2 tracking-tight">Access Dashboard</h3>
                  <p className="text-[#86868B]">Enter your registered phone number to receive an OTP.</p>
                </div>
              </div>

              {/* OTP Login Form */}
              {otpStep === 'phone' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 border border-[#E5E5EA] rounded-xl px-4 py-3 bg-white focus-within:border-[#0071E3] transition-colors">
                    <span className="text-[#86868B] font-medium text-sm">+91</span>
                    <input
                      ref={phoneInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="10-digit phone number"
                      defaultValue=""
                      onKeyDown={e => { if (e.key === 'Enter') handleSendOtp(); }}
                      onInput={e => {
                        const el = e.currentTarget;
                        const clean = el.value.replace(/\D/g, '').slice(0, 10);
                        if (el.value !== clean) el.value = clean;
                        if (loginError) setLoginError('');
                      }}
                      className="flex-1 outline-none text-sm font-medium bg-transparent"
                    />
                  </div>
                  <button
                    onClick={handleSendOtp}
                    disabled={loginLoading}
                    className="w-full bg-[#0071E3] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Send OTP
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {demoOtp && (
                    <div className="bg-[#0071E3]/10 text-[#0071E3] rounded-xl px-4 py-2 text-center text-sm font-semibold">
                      Demo OTP: <span className="font-bold tracking-widest">{demoOtp}</span>
                    </div>
                  )}
                  {/* 4-slot OTP display */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={otpCode}
                      onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setLoginError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                      autoFocus
                    />
                    <div className="flex gap-3 justify-center">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                            otpCode.length === i
                              ? 'border-[#0071E3] bg-[#0071E3]/5 shadow-sm'
                              : otpCode[i]
                              ? 'border-[#1D1D1F] bg-white'
                              : 'border-[#E5E5EA] bg-[#F5F5F7]'
                          }`}
                        >
                          {otpCode[i] ? (
                            <span className="text-[#1D1D1F]">{otpCode[i]}</span>
                          ) : otpCode.length === i ? (
                            <span className="w-0.5 h-6 bg-[#0071E3] animate-pulse rounded-full" />
                          ) : (
                            <span className="w-3 h-0.5 bg-[#D1D1D6] rounded-full" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loginLoading}
                    className="w-full bg-[#0071E3] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify & Login
                  </button>
                  <button
                    onClick={() => { setOtpStep('phone'); setOtpCode(''); setOtpPhone(''); setLoginError(''); setDemoOtp(null); if (phoneInputRef.current) phoneInputRef.current.value = ''; }}
                    className="text-[#86868B] text-sm text-center hover:text-[#1D1D1F] transition-colors"
                  >
                    ← Change number
                  </button>
                </div>
              )}

              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

              {/* Demo shortcuts */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#E5E5EA]">
                <p className="text-xs text-[#86868B] text-center uppercase tracking-widest font-semibold">Or try a demo account</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { city: 'Mumbai', label: 'Mumbai', tier: 'Tier 1', sub: '₹75/wk cap', color: '#0071E3' },
                    { city: 'Pune', label: 'Pune', tier: 'Tier 2', sub: '₹56/wk cap', color: '#F59E0B' },
                    { city: 'Lucknow', label: 'Lucknow', tier: 'Tier 3', sub: '₹38/wk cap', color: '#EF4444' },
                  ].map(({ city, label, tier, sub, color }) => (
                    <button
                      key={city}
                      onClick={() => handleDemoLogin(city)}
                      disabled={loginLoading}
                      className="flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
                      style={{ borderColor: `${color}50` }}
                    >
                      {loginLoading && demoCity === city
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
                        : <span className="text-xs font-bold" style={{ color }}>{tier}</span>
                      }
                      <span className="text-sm font-semibold text-[#1D1D1F]">{label}</span>
                      <span className="text-[10px] text-[#86868B]">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Dashboard Grid */}
        {loggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* LEFT COLUMN: Stats & Map */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* TOP STATS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="flex flex-col">
                  <div className="flex items-center gap-2 text-[#86868B] font-medium mb-2">
                    <IndianRupee className="w-5 h-5" /> 7-Day Earnings
                  </div>
                  <div className="text-4xl font-bold mb-1">
                    <span className="text-2xl text-[#94A3B8] font-normal mr-1">₹</span>
                    <span>{Intl.NumberFormat('en-IN').format(Math.floor(deliveryEarnings))}</span>
                  </div>
                  <p className="text-sm text-[#0071E3] font-semibold mt-auto flex items-center gap-1">
                    {totalPayouts > 0 && <span className="bg-[#0071E3]/10 px-1.5 py-0.5 rounded">+₹{fmt(Math.round(totalPayouts))} Payout</span>}
                  </p>
                </Card>

                <Card className="flex flex-col">
                  <div className="flex items-center gap-2 text-[#86868B] font-medium mb-2">
                    <Package className="w-5 h-5" /> Deliveries
                  </div>
                  <div className="text-4xl font-bold mb-1">
                    <span>{Intl.NumberFormat('en-IN').format(totalDeliveries)}</span>
                  </div>
                  <p className="text-sm text-[#86868B] mt-auto">Last 30 days</p>
                </Card>

                <Card className="flex flex-col">
                  <div className="flex items-center gap-2 text-[#86868B] font-medium mb-2">
                    <Clock className="w-5 h-5" /> Hours Active
                  </div>
                  <div className="text-4xl font-bold mb-1">
                    <span>{activeHours}</span> <span className="text-2xl text-[#94A3B8] font-normal">h</span>
                  </div>
                  <p className="text-sm text-[#86868B] mt-auto">Last 30 days</p>
                </Card>
              </div>

              {/* EARNINGS GRAPH */}
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#0071E3]" /> Earnings (Last 7 Days)
                  </h3>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#1D1D1F]">₹{fmt(Math.round(deliveryEarnings))}</p>
                    <p className="text-[10px] text-[#86868B]">Net after ₹{displayPremium} premium: <span className={deliveryEarnings - displayPremium > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>₹{fmt(Math.round(deliveryEarnings - displayPremium))}</span></p>
                  </div>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={earningsHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} tickFormatter={(v) => `₹${v}`} />
                      <RechartsTooltip
                        cursor={{ fill: '#F1F5F9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value, name) => {
                          const v = Number(value);
                          if (v === 0 && name === 'Gig Earnings') return ['Day off', name];
                          return [`₹${v.toLocaleString('en-IN')}`, name as string];
                        }}
                      />
                      <Bar dataKey="earnings" name="Gig Earnings" fill="#1D1D1F" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="payout" name="Trust Payout" fill="#0071E3" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-[#86868B] mt-1">₹0 bars = day off · Blue = parametric payout</p>
              </Card>

              {/* LIVE MAP */}
              <Card className="p-0 overflow-hidden relative group">
                <div className="absolute top-4 left-4 z-[400] bg-white p-3 rounded-xl shadow-lg border border-[#E5E5EA]">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0284C7]" /> {dashboardData?.zone?.name || 'Active Zone'}
                  </h3>
                  <p className="text-xs text-[#86868B] mt-1">Live coverage map based on your location.</p>
                </div>
                <div className="h-[300px] w-full bg-[#F5F5F7] z-0">
                  <APIProvider apiKey={GMAPS_KEY}>
                    <Map
                      defaultCenter={{ lat: mapCenter[0], lng: mapCenter[1] }}
                      defaultZoom={13}
                      mapId="rider-zone-map"
                      disableDefaultUI={true}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <AdvancedMarker position={{ lat: mapCenter[0], lng: mapCenter[1] }} title={dashboardData?.zone?.name}>
                        <div style={{
                          background: '#0071E3', borderRadius: '50%', width: 18, height: 18,
                          border: '3px solid white', boxShadow: '0 0 12px #0071E360'
                        }} />
                      </AdvancedMarker>
                      <RiskCircles
                        center={{ lat: mapCenter[0], lng: mapCenter[1] }}
                        zone={dashboardData?.zone}
                      />
                    </Map>
                  </APIProvider>
                </div>
              </Card>

            </div>

            {/* RIGHT COLUMN: Profile & Insurance */}
            <div className="flex flex-col gap-6">
              
              {/* Profile Overview */}
              <Card className="bg-[#1D1D1F] text-white border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <User className="w-32 h-32" />
                </div>
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-bold">
                      {riderName ? riderName.charAt(0).toUpperCase() : 'R'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{riderName || 'Rider Profile'}</h2>
                      <p className="text-[#94A3B8] text-sm">{dashboardData?.city_name || 'Loading…'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-[#94A3B8] text-xs uppercase tracking-wider mb-1">Shield Level</p>
                      <p className="font-bold text-lg">Lv. {dashboardData?.rider?.shield_level || 1}</p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-xs uppercase tracking-wider mb-1">Active Days</p>
                      <p className="font-bold text-lg">{activeDays} / 30</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Protection / Checkout Card */}
              <Card className="flex flex-col h-full border-t-[6px] border-t-[#0071E3]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-[#0071E3]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Income Protection</h2>
                    <p className="text-sm text-[#86868B]">Auto-renewing weekly cover</p>
                  </div>
                </div>

                <div className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl p-4 mb-6">
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-sm text-[#86868B]">Weekly Premium</p>
                      <p className="text-3xl font-bold text-[#1D1D1F]">₹{displayPremium}</p>
                    </div>
                    <p className="text-xs font-semibold text-[#0071E3] bg-[#0071E3]/10 px-2 py-1 rounded">6 Triggers Covered</p>
                  </div>
                  <p className="text-xs text-[#86868B] leading-relaxed">
                    Protects against heavy rain, excessive heat, AQI, and severe delays. Triggers auto-payout instantly if conditions are met.
                  </p>
                </div>

                <div className="mt-auto pt-4 flex flex-col gap-3">
                  {hasActivePolicy && (
                    <div className="w-full py-2 text-center rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-semibold text-sm flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Covered this week
                    </div>
                  )}
                  <button
                    onClick={handleBuyPolicy}
                    disabled={paymentStatus === 'creating' || paymentStatus === 'open'}
                    className="w-full py-4 bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-[#CBD5E1] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#0071E3]/20 flex justify-center items-center gap-2"
                  >
                    {paymentStatus === 'creating' && <Loader2 className="w-5 h-5 animate-spin" />}
                    {paymentStatus === 'idle' && <CreditCard className="w-5 h-5" />}
                    {paymentStatus === 'open' && <Zap className="w-5 h-5 animate-pulse" />}
                    {paymentStatus === 'creating' ? 'Processing...' : paymentStatus === 'open' ? 'Await Popup...' : hasActivePolicy ? 'Renew / Pay Premium' : 'Activate Protection'}
                  </button>
                  {paymentError && <p className="text-xs text-red-500 font-medium text-center flex items-center gap-1 justify-center"><AlertCircle className="w-4 h-4" />{paymentError}</p>}

                  {/* Disaster Simulation */}
                  {hasActivePolicy && (
                    <button
                      onClick={handleSimulateDisaster}
                      disabled={isSimulating || !!payoutFlow}
                      className="w-full py-3 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {isSimulating ? 'Triggering…' : '⚡ Simulate Rainfall Claim'}
                    </button>
                  )}
                </div>
              </Card>

              {/* AI Risk Intelligence */}
              {(predictData || optimizeData) && (
                <Card className="border-t-[4px] border-t-[#10a37f]">
                  <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                    <span className="text-[#10a37f]">🧠</span> AI Risk Intelligence
                  </h2>

                  {optimizeData && (
                    <div className="mb-4 p-3 bg-[#F5F5F7] rounded-xl">
                      <p className="text-xs text-[#86868B] uppercase tracking-wider mb-1">Shift Optimization</p>
                      <p className="text-sm font-semibold text-[#1D1D1F]">{optimizeData.reasoning || 'AI recommendations available'}</p>
                      {aiSavings > 0 && (
                        <p className="text-xs text-[#10a37f] font-bold mt-1">+₹{fmt(aiSavings)} projected savings</p>
                      )}
                    </div>
                  )}

                  {predictData?.predictions && (
                    <div>
                      <p className="text-xs text-[#86868B] uppercase tracking-wider mb-2">7-Day Forecast</p>
                      <div className="grid grid-cols-7 gap-1">
                        {predictData.predictions.slice(0, 7).map((p: any, i: number) => {
                          const color = p.risk === 'High' ? '#ef4444' : p.risk === 'Medium' ? '#f59e0b' : '#10a37f';
                          return (
                            <div key={i} className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg border"
                              style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                              <span className="text-[9px] text-[#86868B]">{p.day?.slice(0,3) || DAYS[i]}</span>
                              <span className="text-base leading-none">{weatherEmoji(p.conditions)}</span>
                              <span className="text-[8px] font-bold" style={{ color }}>{p.risk?.slice(0,3) || '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                      {highRiskDay && (
                        <p className="text-xs text-red-500 mt-2 font-medium">⚠️ High risk on {highRiskDay.day} — {highRiskDay.message || 'conditions expected'}</p>
                      )}
                      <p className="text-[10px] text-[#86868B] mt-2">Source: {predictData.forecast_source || 'ML model'}</p>
                    </div>
                  )}
                </Card>
              )}


            </div>
          </motion.div>
        )}
      </div>

      {/* Payout Flow Modal */}
      <AnimatePresence>
        {payoutFlow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => {
              const allDone = payoutFlow.steps.every(s => s.status !== 'running' && s.status !== 'pending');
              if (allDone) setPayoutFlow(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#0071E3]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Auto-Payout in Progress</h3>
                  <p className="text-sm text-[#86868B]">₹{payoutFlow.amount.toFixed(0)} · {payoutFlow.upiId}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {payoutFlow.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {step.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500" />}
                      {step.status === 'running' && <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />}
                      {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-[#E5E5EA]" />}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        step.status === 'success' ? 'text-[#1D1D1F]' :
                        step.status === 'failed' ? 'text-red-500' :
                        step.status === 'running' ? 'text-[#0071E3]' : 'text-[#86868B]'
                      )}>{step.label}</p>
                      {step.detail && <p className="text-xs text-[#86868B] mt-0.5 font-mono">{step.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {payoutFlow.steps.every(s => s.status !== 'running' && s.status !== 'pending') && (
                <button
                  onClick={() => setPayoutFlow(null)}
                  className="mt-6 w-full py-3 bg-[#1D1D1F] text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors"
                >
                  Done
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
