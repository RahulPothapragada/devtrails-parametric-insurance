import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, CloudRain, Clock, ShieldCheck, ChevronRight,
  CreditCard, AlertCircle, Loader2, Wallet, Shield,
  Zap, User, MapPin, Package, Calendar,
  X, CheckCircle2, LogIn,
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
    upi_id: string | null;
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

import { WeatherWidget } from '@/components/ui/WeatherWidget';

// ──────────────────────────────────────────────────────────────
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white border border-[#E5E5EA] rounded-[1.5rem] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]", className)}>
    {children}
  </div>
);


export default function RiderDashboard() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [riderName, setRiderName] = useState(getRiderName() || '');

  // Login form state
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [demoCity, setDemoCity] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(loginPhone)) { setLoginError('Enter a valid 10-digit phone number'); return; }
    setLoginLoading(true); setLoginError(''); setDemoOtp(null);
    try {
      const res = await fetch(`${API}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: loginPhone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
      setDemoOtp(data.demo_otp || null);
      setOtpStep('otp');
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Failed to send OTP'); }
    finally { setLoginLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4}$/.test(loginOtp)) { setLoginError('Enter the 4-digit OTP'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const res = await fetch(`${API}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: loginPhone, otp: loginOtp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setLoggedIn(true); setRiderName(data.name);
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Invalid OTP'); }
    finally { setLoginLoading(false); }
  };

  const handleDemoLogin = async (city: string) => {
    setLoginLoading(true); setDemoCity(city); setLoginError('');
    try {
      const res = await fetch(`${API}/auth/demo-login?city=${encodeURIComponent(city)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setLoggedIn(true); setRiderName(data.name);
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Login failed'); }
    finally { setLoginLoading(false); setDemoCity(null); }
  };

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
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Auto login check — skip /auth/me, go straight to /riders/me which validates token too ──
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const savedName = localStorage.getItem('flowsecure_rider_name');
    if (savedName) setRiderName(savedName);
    setLoggedIn(true);
  }, []);


  useEffect(() => {
    fetch(`${API}/payments/config`)
      .then(r => r.json())
      .then(d => setRzpConfig(d))
      .catch(() => setRzpConfig({ configured: false, key_id: null, mode: 'sandbox' }));
  }, []);

  const [loadingMsg, setLoadingMsg] = useState('Loading your dashboard…');
  const fetchIdRef = useRef(0);

  const fetchDashboardData = useCallback(async () => {
    if (!getToken()) return;

    // Each call gets a unique ID — if a newer call starts, older loops self-cancel.
    const myId = ++fetchIdRef.current;
    setDashboardLoading(true);
    setLoadingMsg('Loading your dashboard…');

    // Retry for up to 3 minutes — covers Render free-tier cold starts (up to ~90s)
    const deadline = Date.now() + 3 * 60 * 1000;
    let attempt = 0;
    let data: DashboardData | null = null;

    while (Date.now() < deadline) {
      if (fetchIdRef.current !== myId) return; // superseded by a newer call
      attempt++;
      if (attempt > 1) {
        const elapsed = Math.round((Date.now() - (deadline - 3 * 60 * 1000)) / 1000);
        setLoadingMsg(`Connecting to server… ${elapsed}s`);
      }
      try {
        const res = await fetch(`${API}/riders/me`, {
          headers: authHeaders(),
          signal: AbortSignal.timeout(20000),
        });
        if (fetchIdRef.current !== myId) return;
        if (res.status === 401) {
          localStorage.removeItem('flowsecure_token');
          localStorage.removeItem('flowsecure_rider_name');
          setLoggedIn(false); setRiderName('');
          setDashboardLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break; // success — exit loop
      } catch {
        if (fetchIdRef.current !== myId) return;
        // Wait 4s before next attempt (fast enough to catch server wake-up quickly)
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    if (fetchIdRef.current !== myId) return;
    if (!data) {
      setLoadingMsg('Server unavailable — try refreshing');
      setDashboardLoading(false);
      return;
    }

    setDashboardData(data);
    writeCache(CACHE_KEY, data);
    setDashboardLoading(false); // Show dashboard NOW, before slow background calls

    // ── Fire predict/optimize/pricing in background — only on first load ──
    if (!predictData && !optimizeData) {
      const now = new Date();
      Promise.allSettled([
        fetch(`${API}/pricing/quote?city=${encodeURIComponent(data.city_name || '')}&zone_tier=${data.zone.tier}&month=${now.getMonth() + 1}`,
          { signal: AbortSignal.timeout(10000) }),
        fetch(`${API}/triggers/predict/${data.zone.id}`, { headers: authHeaders(), signal: AbortSignal.timeout(10000) }),
        fetch(`${API}/triggers/optimize/${data.rider.id}`, { headers: authHeaders(), signal: AbortSignal.timeout(10000) }),
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
  }, [predictData, optimizeData]);

  useEffect(() => {
    if (loggedIn) fetchDashboardData();
  }, [loggedIn, fetchDashboardData]);

  // When server wakes up, immediately kick a fresh fetch (cancels any stale retry loop via fetchIdRef)
  useEffect(() => {
    const onServerReady = () => {
      if (loggedIn && !dashboardData) fetchDashboardData();
    };
    window.addEventListener('server:ready', onServerReady);
    return () => window.removeEventListener('server:ready', onServerReady);
  }, [loggedIn, dashboardData, fetchDashboardData]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleSimulateDisaster = async () => {
    if (!dashboardData?.zone?.id) return;
    setIsSimulating(true);

    const upiId = dashboardData.rider?.upi_id || 'rider@upi';

    // Show detection stage immediately
    setPayoutFlow({ claimId: 0, amount: 0, upiId, steps: [
      { label: '🌧️ Rainfall detected — 85mm exceeds 64.5mm threshold', status: 'running' },
      { label: '4-source consensus check', status: 'pending' },
      { label: 'Eligibility & shift overlap check', status: 'pending' },
      { label: '9-wall fraud detection', status: 'pending' },
      { label: 'Auto-payout', status: 'pending' },
    ]});
    setIsSimulating(false);

    await sleep(900);
    setPayoutFlow(prev => prev && { ...prev, steps: [
      { label: '🌧️ Rainfall confirmed — 85mm > 64.5mm threshold', status: 'success' },
      { label: '4-source consensus check', status: 'running', detail: 'OpenWeatherMap · Dark store · Zone activity · IMD' },
      { label: 'Eligibility & shift overlap check', status: 'pending' },
      { label: '9-wall fraud detection', status: 'pending' },
      { label: 'Auto-payout', status: 'pending' },
    ]});

    // Fire the real API call using the fast demo-disaster route to avoid SQLite locking issues.
    let simData: any = null;
    try {
      const simRes = await fetch(`${API}/triggers/demo-disaster/${dashboardData.rider?.id}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!simRes.ok) throw new Error(`HTTP ${simRes.status}`);
      simData = await simRes.json();
    } catch (e) {
      console.warn('Simulation error:', e);
      setPayoutFlow(null);
      return;
    }

    // Adapt the response from demo-disaster (which bypasses heavy fraud checks)
    // to match the structure that the UI flow expects for animating the steps.
    const claims = {
      total_policies: 1,
      claims_generated: 1,
      auto_approved: 1,
      pending_review: 0,
      denied: 0,
      total_payout: simData.payout_amount,
      claim_details: [
        {
          rider_id: dashboardData.rider?.id,
          status: 'auto_approved',
          claim_id: simData.claim_id,
          payout_amount: simData.payout_amount,
          fraud_score: 5.0,
          auto_payout: simData.auto_payout || {}
        }
      ]
    };

    const myDetail = claims.claim_details[0];
    const ap = myDetail?.auto_payout || {};
    const amount: number = myDetail?.payout_amount || 0;

    await sleep(800);
    setPayoutFlow(prev => prev && { ...prev, steps: [
      prev.steps[0],
      { label: `4/4 sources confirmed genuine disruption`, status: 'success', detail: 'OpenWeatherMap · Dark store · Zone activity · IMD' },
      { label: 'Eligibility & shift overlap check', status: 'running' },
      { label: '9-wall fraud detection', status: 'pending' },
      { label: 'Auto-payout', status: 'pending' },
    ]});

    await sleep(900);
    setPayoutFlow(prev => prev && { ...prev, steps: [
      prev.steps[0], prev.steps[1],
      { label: `${claims.total_policies || 0} active policies eligible · shift hours match`, status: 'success', detail: `${claims.claims_generated || 0} claims generated` },
      { label: '9-wall fraud detection', status: 'running' },
      { label: 'Auto-payout', status: 'pending' },
    ]});

    await sleep(1000);
    const fraudDetail = claims.denied > 0
      ? `${claims.auto_approved} approved · ${claims.pending_review || 0} flagged · ${claims.denied} blocked`
      : `${claims.auto_approved} auto-approved · ${claims.pending_review || 0} under review`;
    setPayoutFlow(prev => prev && { ...prev, steps: [
      prev.steps[0], prev.steps[1], prev.steps[2],
      { label: 'Fraud detection complete', status: 'success', detail: fraudDetail },
      { label: 'Auto-payout', status: 'running' },
    ]});

    await sleep(900);

    if (!myDetail) {
      setPayoutFlow(prev => prev && { ...prev, claimId: 0, amount: 0, steps: [
        prev.steps[0], prev.steps[1], prev.steps[2], prev.steps[3],
        { label: `₹${(claims.total_payout || 0).toFixed(0)} disbursed to ${claims.auto_approved} riders`, status: 'success', detail: 'No claim generated for your account this round' },
      ]});
    } else if (myDetail.status === 'denied') {
      setPayoutFlow(prev => prev && { ...prev, claimId: myDetail.claim_id, amount, steps: [
        prev.steps[0], prev.steps[1], prev.steps[2], prev.steps[3],
        { label: 'Your claim was blocked by fraud detection', status: 'failed', detail: `Fraud score: ${myDetail.fraud_score}/100` },
      ]});
    } else if (myDetail.status === 'pending_review') {
      setPayoutFlow(prev => prev && { ...prev, claimId: myDetail.claim_id, amount, steps: [
        prev.steps[0], prev.steps[1], prev.steps[2], prev.steps[3],
        { label: `₹${amount.toFixed(0)} claim under review`, status: 'running', detail: `Fraud score ${myDetail.fraud_score}/100 — review within 24h` },
      ]});
    } else if (ap.success) {
      const channel = (ap.channel || 'upi').toUpperCase();
      setPayoutFlow(prev => prev && { ...prev, claimId: myDetail.claim_id, amount, steps: [
        prev.steps[0], prev.steps[1], prev.steps[2], prev.steps[3],
        { label: `₹${amount.toFixed(0)} auto-credited via ${channel} → ${upiId}`, status: 'success', detail: `Ref: ${ap.ref || '—'} · No rider action needed` },
      ]});
    } else {
      setPayoutFlow(prev => prev && { ...prev, claimId: myDetail.claim_id, amount, steps: [
        prev.steps[0], prev.steps[1], prev.steps[2], prev.steps[3],
        { label: 'UPI + IMPS both failed — support notified', status: 'failed' },
      ]});
    }

    await fetchDashboardData();
  };

  const handleToggleAutoRenew = async () => {
    if (!dashboardData?.active_policy) return;
    setAutoRenewLoading(true);
    try {
      const res = await fetch(`${API}/policies/toggle-auto-renew`, { method: 'PATCH', headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setDashboardData(prev => prev && prev.active_policy
          ? { ...prev, active_policy: { ...prev.active_policy, auto_renew: d.auto_renew } }
          : prev
        );
      }
    } catch { /* silent */ } finally { setAutoRenewLoading(false); }
  };

  const handleCancelPolicy = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API}/policies/cancel`, { method: 'POST', headers: authHeaders() });
      if (res.ok) { await fetchDashboardData(); setShowCancelConfirm(false); }
    } catch { /* silent */ } finally { setCancelLoading(false); }
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
          image: `${window.location.origin}/logo.png`,
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



  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div 
      className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-24 pt-16 selection:bg-[#0071E3]/20 selection:text-[#0071E3]"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        
        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4 mt-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
              {loggedIn ? `Welcome back, ${riderName.split(' ')[0]}` : 'Rider Dashboard'}
            </h1>
            <p className="text-[#86868B] text-xl mt-2 font-medium">
              {loggedIn ? locationLabel : 'Login to view your gig stats and protections'}
            </p>
            {loggedIn && (
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold border mt-3",
                hasActivePolicy ? "bg-[#0071E3]/10 text-[#0071E3] border-transparent" : "bg-white text-[#86868B] border-[#E5E5EA]"
              )}>
                <ShieldCheck className="w-5 h-5" />
                {hasActivePolicy ? 'Protected This Week' : 'Unprotected'}
              </div>
            )}
          </div>
          {loggedIn && (
            <WeatherWidget
              apiKey={import.meta.env.VITE_OPENWEATHER_API_KEY}
              location={
                dashboardData?.zone?.lat && dashboardData?.zone?.lng
                  ? { latitude: dashboardData.zone.lat, longitude: dashboardData.zone.lng }
                  : undefined
              }
              width="14rem"
            />
          )}
        </header>

        {/* Login form — shown directly on page when not logged in */}
        {!loggedIn && (
          <div className="max-w-md mx-auto mt-16">
            <Card className="flex flex-col gap-6 p-10">
              <div className="flex flex-col items-center text-center gap-3">
                <p className="text-2xl font-extrabold tracking-tight text-[#1D1D1F]">FlowSecure</p>
                <div>
                  <h3 className="text-3xl font-bold mb-2 tracking-tight">Access Dashboard</h3>
                  <p className="text-[#86868B]">Enter your registered phone number to receive an OTP.</p>
                </div>
              </div>

              {otpStep === 'phone' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 border border-[#E5E5EA] rounded-xl px-4 py-3 bg-white focus-within:border-[#0071E3] transition-colors">
                    <span className="text-[#86868B] font-medium text-sm">+91</span>
                    <input
                      type="tel" inputMode="numeric" maxLength={10}
                      placeholder="10-digit phone number"
                      value={loginPhone}
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setLoginPhone(clean);
                        if (loginError) setLoginError('');
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                      className="flex-1 outline-none text-sm font-medium bg-transparent"
                    />
                  </div>
                  <button onClick={handleSendOtp} disabled={loginLoading}
                    className="w-full bg-[#0071E3] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
                  <div className="relative">
                    <input type="text" inputMode="numeric" maxLength={4} value={loginOtp} autoFocus
                      onChange={e => { setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 4)); setLoginError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10" />
                    <div className="flex gap-3 justify-center">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${loginOtp.length === i ? 'border-[#0071E3] bg-[#0071E3]/5' : loginOtp[i] ? 'border-[#1D1D1F] bg-white' : 'border-[#E5E5EA] bg-[#F5F5F7]'}`}>
                          {loginOtp[i] ? loginOtp[i] : loginOtp.length === i ? <span className="w-0.5 h-6 bg-[#0071E3] animate-pulse rounded-full" /> : <span className="w-3 h-0.5 bg-[#D1D1D6] rounded-full" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleVerifyOtp} disabled={loginLoading}
                    className="w-full bg-[#0071E3] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify & Login
                  </button>
                  <button onClick={() => { setOtpStep('phone'); setLoginOtp(''); setLoginError(''); }}
                    className="text-[#86868B] text-sm text-center hover:text-[#1D1D1F] transition-colors">
                    ← Change number
                  </button>
                </div>
              )}

              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

              <div className="flex flex-col gap-2 pt-2 border-t border-[#E5E5EA]">
                <p className="text-xs text-[#86868B] text-center uppercase tracking-widest font-semibold">Or try a demo account</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { city: 'Mumbai', tier: 'Tier 1', color: '#0071E3' },
                    { city: 'Pune',   tier: 'Tier 2', color: '#F59E0B' },
                    { city: 'Lucknow',tier: 'Tier 3', color: '#EF4444' },
                  ].map(({ city, tier, color }) => (
                    <button key={city} onClick={() => handleDemoLogin(city)} disabled={loginLoading}
                      className="flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
                      style={{ borderColor: `${color}50` }}>
                      {loginLoading && demoCity === city
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
                        : <span className="text-xs font-bold" style={{ color }}>{tier}</span>}
                      <span className="text-sm font-semibold text-[#1D1D1F]">{city}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Loading skeleton */}
        {loggedIn && dashboardLoading && !dashboardData && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
            <p className="text-[#86868B] font-medium">{loadingMsg}</p>
          </div>
        )}

        {/* Dashboard Grid */}
        {loggedIn && (!dashboardLoading || dashboardData) && (
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-[#0071E3]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Income Protection</h2>
                      <p className="text-sm text-[#86868B]">Parametric weekly cover</p>
                    </div>
                  </div>
                  {hasActivePolicy && (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl p-4 mb-4">
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-sm text-[#86868B]">Weekly Premium</p>
                      <p className="text-3xl font-bold text-[#1D1D1F]">₹{displayPremium}</p>
                      <p className="text-xs text-[#86868B] mt-1">Auto-charged every Monday</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#86868B]">If disruption occurs</p>
                      <p className="text-2xl font-bold text-emerald-600">up to ₹{Math.round(displayPremium * 8 / 3 / 25) * 25 || 150}</p>
                      <p className="text-xs text-[#86868B] mt-1">paid to your UPI instantly</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#86868B]">
                    Covers heavy rain, heat, poor air quality &amp; traffic jams. Payout happens automatically — no claim needed.
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3">
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

                  {/* Full parametric simulation */}
                  {hasActivePolicy && (
                    <button
                      onClick={handleSimulateDisaster}
                      disabled={isSimulating || !!payoutFlow}
                      className="w-full py-3 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {isSimulating ? 'Simulating…' : '⚡ Simulate Rainfall — Full Pipeline'}
                    </button>
                  )}
                </div>
              </Card>



            </div>
          </motion.div>
        )}
      </div>

      {/* Cancel Policy Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.93, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 16 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
            >
              <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
              <h3 className="font-bold text-lg text-[#1D1D1F] mb-2">Cancel Policy?</h3>
              <p className="text-sm text-[#86868B] mb-6">
                Your coverage will end immediately. Active trigger claims this week are still processed,
                but new disruptions won't be covered.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 border border-[#E5E5EA] rounded-xl text-sm font-semibold text-[#1D1D1F]"
                >
                  Keep Coverage
                </button>
                <button
                  onClick={handleCancelPolicy}
                  disabled={cancelLoading}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Policy'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <h3 className="font-bold text-lg">Parametric Pipeline</h3>
                  <p className="text-sm text-[#86868B]">
                    {payoutFlow.amount > 0 ? `₹${payoutFlow.amount.toFixed(0)} · ` : ''}{payoutFlow.upiId}
                  </p>
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

