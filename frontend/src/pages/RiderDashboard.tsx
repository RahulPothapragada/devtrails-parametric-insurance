import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  IndianRupee, CloudRain, Clock, ShieldCheck, ChevronRight,
  CreditCard, CheckCircle2, AlertCircle, Loader2, Wallet, Shield,
  Zap, ArrowRight, LogIn, User, Thermometer, Wind, Sun
} from 'lucide-react';
import AnimatedCounter from '../components/ui/AnimatedCounter';

const API = 'http://localhost:8000/api';

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
  premium_breakdown: Record<string, number>;
  mode: 'live' | 'sandbox';
}

interface PaymentRecord {
  policy_id: number;
  week_start: string;
  week_end: string;
  premium_amount: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_method: string | null;
  verified: boolean;
  mode: string;
}

interface DashboardData {
  rider: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    zone_id: number;
    dark_store_id: number | null;
    shift_type: string;
    avg_weekly_earnings: number;
    avg_hourly_rate: number;
    shield_level: number;
    shield_xp: number;
    active_days_last_30: number;
    activity_tier: string;
    is_active: boolean;
    [key: string]: unknown;
  };
  zone: {
    id: number;
    city_id: number;
    name: string;
    tier: string;
    area_type: string;
    [key: string]: unknown;
  };
  active_policy: {
    id: number;
    premium_amount: number;
    premium_breakdown: Record<string, unknown>;
    coverage_triggers: Record<string, unknown>;
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
    [key: string]: unknown;
  }>;
  shield_level: number;
  weekly_earnings: number;
  risk_summary: Record<string, number>;
}

interface OptimizeData {
  rider_id: number;
  rider_name: string;
  recommendation_active: boolean;
  current_shift: string;
  recommended_shift: string;
  reasoning: string;
  projected_earnings_saved: number;
  risk_avoided: string;
}

interface PredictData {
  zone_id: number;
  zone_name: string;
  predictions: Array<{
    day: string;
    risk: string;
    message: string;
  }>;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

// ── Auth helpers ──
function getToken(): string | null {
  return localStorage.getItem('flowsecure_token');
}

function getRiderName(): string | null {
  return localStorage.getItem('flowsecure_rider_name');
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ── Risk display helpers ──
const RISK_META: Record<string, { icon: typeof CloudRain; color: string; label: string }> = {
  rainfall: { icon: CloudRain, color: '#ef4444', label: 'Heavy Rain' },
  heat:     { icon: Thermometer, color: '#f97316', label: 'Heat Wave' },
  aqi:      { icon: Wind, color: '#a855f7', label: 'Poor AQI' },
  traffic:  { icon: AlertCircle, color: '#eab308', label: 'Traffic Jam' },
  cold_fog: { icon: Sun, color: '#38bdf8', label: 'Cold / Fog' },
  social:   { icon: AlertCircle, color: '#f43f5e', label: 'Social Disruption' },
};

// ──────────────────────────────────────────────────────────────
export default function RiderDashboard() {
  // Auth
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [riderName, setRiderName] = useState(getRiderName() || '');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Auto-redirect if redirect parameter is requested
  useEffect(() => {
    if (loggedIn && searchParams.get('redirect') === 'story') {
      navigate('/story');
    }
  }, [loggedIn, navigate, searchParams]);

  // Payment
  const [rzpConfig, setRzpConfig] = useState<RzpConfig | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    'idle' | 'creating' | 'open' | 'processing' | 'verifying' | 'success' | 'error'
  >('idle');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDisasterMode, setIsDisasterMode] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [lastPayment, setLastPayment] = useState<{
    orderId: string; paymentId: string; method: string; mode: string;
  } | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Dynamic data from backend
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [optimizeData, setOptimizeData] = useState<OptimizeData | null>(null);
  const [predictData, setPredictData] = useState<PredictData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [premiumEstimate, setPremiumEstimate] = useState<number>(0);

  // ── Validate token on mount — clear stale tokens automatically ──
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('stale');
        return r.json();
      })
      .then(data => {
        setRiderName(data.name);
        setLoggedIn(true);
      })
      .catch(() => {
        localStorage.removeItem('flowsecure_token');
        localStorage.removeItem('flowsecure_rider_name');
        setLoggedIn(false);
        setRiderName('');
      });
  }, []);

  // ── Auto-login via demo endpoint ──
  const handleDemoLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    localStorage.removeItem('flowsecure_token');
    localStorage.removeItem('flowsecure_rider_name');
    try {
      const res = await fetch(`${API}/auth/demo-login`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Backend not running on port 8000' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setLoggedIn(true);
      setRiderName(data.name);

      // Instantly push to story if from landing page
      if (searchParams.get('redirect') === 'story') {
        navigate('/story');
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Fetch Razorpay config on mount ──
  useEffect(() => {
    fetch(`${API}/payments/config`)
      .then(r => r.json())
      .then(d => setRzpConfig(d))
      .catch(() => setRzpConfig({ configured: false, key_id: null, mode: 'sandbox' }));
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API}/payments/history`, { headers: authHeaders() });
      if (res.ok) setPaymentHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (loggedIn) fetchHistory();
  }, [loggedIn, fetchHistory]);

  // ── Fetch dashboard data from backend ──
  const fetchDashboardData = useCallback(async () => {
    if (!getToken()) return;
    setDashboardLoading(true);
    try {
      const res = await fetch(`${API}/riders/me`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Dashboard fetch failed');
      const data: DashboardData = await res.json();
      setDashboardData(data);

      // Fetch optimize + predict + pricing in parallel
      const now = new Date();
      const [optRes, predRes, priceRes] = await Promise.allSettled([
        fetch(`${API}/triggers/optimize/${data.rider.id}`, { headers: authHeaders() }),
        fetch(`${API}/triggers/predict/${data.zone.id}`, { headers: authHeaders() }),
        fetch(`${API}/pricing/quote?zone_tier=${data.zone.tier}&month=${now.getMonth() + 1}`),
      ]);

      if (optRes.status === 'fulfilled' && optRes.value.ok) {
        setOptimizeData(await optRes.value.json());
      }
      if (predRes.status === 'fulfilled' && predRes.value.ok) {
        setPredictData(await predRes.value.json());
      }
      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const priceData = await priceRes.value.json();
        setPremiumEstimate(priceData.total_weekly_premium || 0);
      }
    } catch (e) {
      console.warn('Dashboard data fetch error:', e);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) fetchDashboardData();
  }, [loggedIn, fetchDashboardData]);

  // ── SANDBOX simulated popup ──
  const runSandboxFlow = async (order: OrderData) => {
    setPaymentStatus('processing');
    await new Promise(r => setTimeout(r, 2000));
    const sandboxPaymentId = `pay_sandbox_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const sandboxSignature = 'sandbox_signature_valid';
    setPaymentStatus('verifying');
    const verifyRes = await fetch(`${API}/payments/verify`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: sandboxPaymentId,
        razorpay_signature: sandboxSignature,
        zone_id: dashboardData?.zone?.id || 1,
        auto_renew: true,
      }),
    });
    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({ detail: 'Verification failed' }));
      throw new Error(err.detail || 'Verify failed');
    }
    return { orderId: order.order_id, paymentId: sandboxPaymentId, method: 'sandbox_upi', mode: 'sandbox' };
  };

  // ── REAL Razorpay popup ──
  const runLiveFlow = (order: OrderData): Promise<{ orderId: string; paymentId: string; method: string; mode: string }> => {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error('Razorpay checkout.js not loaded. Check internet connection.'));
        return;
      }

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'FlowSecure',
        description: `Weekly Parametric Cover — ₹${order.premium_amount.toFixed(2)}`,
        order_id: order.order_id,
        prefill: {
          name: order.rider_name,
          email: order.rider_email || '',
          contact: order.rider_phone,
          vpa: 'success@razorpay',
        },
        theme: { color: '#10a37f' },
        modal: {
          ondismiss: () => {
            reject(new Error('dismissed'));
          },
        },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setPaymentStatus('verifying');
          try {
            const verifyRes = await fetch(`${API}/payments/verify`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                zone_id: dashboardData?.zone?.id || 1,
                auto_renew: true,
              }),
            });
            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({ detail: 'Verification failed' }));
              throw new Error(err.detail);
            }
            resolve({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              method: 'razorpay',
              mode: 'live',
            });
          } catch (e) {
            reject(e);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => reject(new Error('Payment declined by gateway.')));
      rzp.open();
    });
  };

  // ── Main buy handler ──
  const handleBuyPolicy = async () => {
    if (!getToken()) {
      setPaymentError('Please login first using the button above.');
      setPaymentStatus('error');
      return;
    }

    setPaymentStatus('creating');
    setPaymentError('');

    try {
      const orderRes = await fetch(`${API}/payments/create-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ zone_id: dashboardData?.zone?.id || 1, auto_renew: true }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({ detail: 'Order creation failed' }));
        throw new Error(err.detail || `HTTP ${orderRes.status}`);
      }

      const order: OrderData = await orderRes.json();

      let result;
      if (order.mode === 'sandbox') {
        result = await runSandboxFlow(order);
      } else {
        setPaymentStatus('open');
        result = await runLiveFlow(order);
      }

      setLastPayment(result);
      setPaymentStatus('success');
      fetchHistory();
      fetchDashboardData(); // Refresh dashboard after purchase
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      if (msg === 'dismissed') {
        setPaymentStatus('idle');
        return;
      }
      setPaymentError(msg);
      setPaymentStatus('error');
    }
  };

  const resetPayment = () => {
    setPaymentStatus('idle');
    setPaymentError('');
    setLastPayment(null);
  };

  // ── Computed values from backend data ──
  const deliveryEarnings = dashboardData?.weekly_earnings || 0;
  const optimizationSavings = optimizeData?.projected_earnings_saved || 0;
  // IMPORTANT: Only show payouts/claims in disaster mode
  const rawPayouts = dashboardData?.recent_claims?.reduce((sum, c) => sum + (c.payout_amount || 0), 0) || 0;
  const totalPayouts = isDisasterMode ? rawPayouts : 0;
  const activePremium = dashboardData?.active_policy?.premium_amount || 0;
  const displayPremium = activePremium || premiumEstimate;
  // Normal week: earnings = delivery + AI optimization only. Disaster: + insurance payout
  const totalEarnings = deliveryEarnings + optimizationSavings + totalPayouts;
  // Net insurance = payout minus premium cost (only meaningful in disaster mode)
  const incomeProtected = totalPayouts - activePremium;
  const deliveryUpliftPct = deliveryEarnings > 0 ? Math.round((optimizationSavings / deliveryEarnings) * 100) : 0;
  // In disaster mode, show the net gain percentage from insurance payout vs base earnings
  const disasterNetGainPct = deliveryEarnings > 0 ? Math.round(((totalPayouts - activePremium) / deliveryEarnings) * 100) : 0;
  const activeDays = (dashboardData?.rider?.active_days_last_30) ?? 0;
  const activityTier = (dashboardData?.rider?.activity_tier || 'low').toUpperCase();
  const hasActivePolicy = !!dashboardData?.active_policy;
  const zoneName = dashboardData?.zone?.name || '';
  const rawPaidClaims = dashboardData?.recent_claims?.filter(c => c.status === 'paid' || c.status === 'auto_approved') || [];
  const paidClaims = isDisasterMode ? rawPaidClaims : [];

  // Find the highest-risk day from predictions
  const highRiskDay = predictData?.predictions?.find(p => p.risk === 'High');
  const riskType = optimizeData?.risk_avoided || 'rainfall';
  const riskMeta = RISK_META[riskType] || RISK_META.rainfall;
  const RiskIcon = riskMeta.icon;

  // Format currency
  const fmt = (n: number) => n.toLocaleString('en-IN');

  const handleLogout = () => {
    localStorage.removeItem('flowsecure_token');
    localStorage.removeItem('flowsecure_rider_name');
    setLoggedIn(false);
    setRiderName('');
  };

  const handleSimulateDisaster = async () => {
    if (!loggedIn || !dashboardData?.rider?.id) return;
    setIsSimulating(true);
    try {
      const resp = await fetch(`${API}/triggers/demo-disaster/${dashboardData.rider.id}`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error('Simulation failed');
      await fetchDashboardData(); // Refresh to see the new claim
      await fetchHistory();
      setIsDisasterMode(true); // Switch to disaster view
    } catch (e) {
      console.error(e);
      setLoginError('Disaster simulation failed. Check backend logs.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetNormal = async () => {
    setIsDisasterMode(false); // Just toggle back to normal view
  };

  // ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pb-12"
      >
        {/* ── Header ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {loggedIn ? `Hello, ${riderName.split(' ')[0]}` : 'Rider Dashboard'}
            </h1>
            {loggedIn && (
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 border rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 shadow-sm"
              >
                Log Out
              </button>
            )}
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center justify-between">
            {loggedIn ? (zoneName || 'Loading zone...') : 'Login to get started'}
            {loggedIn && (
              <span className="flex items-center gap-1 text-[#10a37f] text-xs px-2 py-0.5 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/20">
                <ShieldCheck className="w-3 h-3" /> Protected
              </span>
            )}
          </p>
        </div>

        {/* ── Login Section ── */}
        {!loggedIn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border bg-card p-6 flex flex-col gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Get Started</h3>
                <p className="text-xs text-muted-foreground">Login or create an account to access your dashboard</p>
              </div>
            </div>
            <Link
              to="/rider/auth"
              className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Login / Sign Up
            </Link>
            <button
              onClick={handleDemoLogin}
              disabled={loginLoading}
              className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-muted-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm border"
            >
              {loginLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</>
              ) : (
                <>Demo Login (Quick Access)</>
              )}
            </button>
            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400">{loginError}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Everything below requires login ── */}
        {loggedIn && (
          <>
            {/* Loading indicator */}
            {dashboardLoading && !dashboardData && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard...
              </div>
            )}

            {/* Underwriting Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-[#10a37f]/10 border border-[#10a37f]/30 rounded-xl p-3 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#10a37f]/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#10a37f]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-wider">
                    Underwriting: {activeDays >= 7 ? 'Eligible' : 'Pending'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeDays} active days in last 30 (Min 7 req.)
                  </p>
                </div>
              </div>
              <span className="px-2 py-1 bg-[#10a37f]/20 text-[#10a37f] text-[10px] font-bold rounded-md ring-1 ring-[#10a37f]/40 text-center leading-tight">
                TIER<br />{activityTier}
              </span>
            </motion.div>

            {/* Earnings Card */}
            <motion.div
              className="rounded-xl border bg-card p-6 relative overflow-hidden group shadow-sm"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <IndianRupee className="w-24 h-24 text-foreground" />
              </div>
              <div className="relative z-10">
                <p className="text-muted-foreground font-medium text-sm mb-1">
                  {isDisasterMode ? '⚠️ Disaster Week — Earnings & Payouts' : 'Weekly Earnings'}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-muted-foreground">&#8377;</span>
                  <AnimatedCounter value={Math.round(totalEarnings)} className="text-5xl font-bold tracking-tighter text-foreground" />
                </div>

                {totalEarnings === 0 && !dashboardLoading ? (
                  <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No earnings data yet this week</p>
                    <p className="text-xs text-muted-foreground">
                      Buy a policy below to start earning AI shift optimizations
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Earnings</span>
                      <span className="font-medium text-foreground">&#8377;{fmt(deliveryEarnings)}</span>
                    </div>
                    {optimizationSavings > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">AI Shift Optimization (Earned by you)</span>
                        <span className="font-medium text-[#10a37f]">+ &#8377;{fmt(optimizationSavings)}</span>
                      </div>
                    )}

                    {/* NORMAL WEEK: Only AI optimization, no claims/payouts */}
                    {!isDisasterMode && (
                      <div className="p-3 rounded-lg bg-[#10a37f]/5 border border-[#10a37f]/20 text-center">
                        <p className="text-xs text-[#10a37f] font-semibold">✓ Normal Week — No disruptions detected</p>
                        <p className="text-[10px] text-muted-foreground mt-1">No claims needed. You're earning ₹{fmt(optimizationSavings)} extra via AI shift optimization.</p>
                      </div>
                    )}

                    {/* DISASTER WEEK: Full payout breakdown */}
                    {isDisasterMode && totalPayouts > 0 && (
                      <>
                        <div className="h-px w-full bg-border" />
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">🚨 Parametric Payout (Paid by us)</span>
                            <span className="font-medium text-[#0ea5e9]">+ &#8377;{fmt(totalPayouts)}</span>
                          </div>
                          {paidClaims.length > 0 && (
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg border">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-[#0ea5e9]">PAID OUT — {paidClaims.length} claim{paidClaims.length > 1 ? 's' : ''}</span>
                                <span className="font-mono opacity-80">Triggers: {[...new Set(paidClaims.map(c => c.trigger_type))].join(', ')}</span>
                              </div>
                              <span className="text-[#10a37f] font-semibold animate-pulse">&#x25CF; Confirmed</span>
                            </div>
                          )}
                        </div>
                        <Link to="/payouts" className="mt-2 w-full py-2 bg-muted/50 hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border transition-colors">
                          <Wallet className="w-4 h-4 text-primary" /> View Wallet & Payouts <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ACTIONABLE CLAIM ALERT — Only in disaster mode */}
            {isDisasterMode && (dashboardData?.recent_claims?.filter(c => (c.status === 'auto_approved' || c.status === 'approved') && (!c.payout_status || c.payout_status === 'not_initiated') && c.payout_amount > 0) || []).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-primary/10 border border-primary text-primary p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold">🚨 Disaster Detected — Funds Ready!</h3>
                    <p className="text-xs opacity-90 mt-0.5">Parametric trigger breached. Insurance payout auto-credited to your UPI.</p>
                  </div>
                </div>
                <Link to="/payouts" className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2 whitespace-nowrap hover:bg-primary/90 transition-colors">
                  <Wallet className="w-4 h-4" /> Claim Now <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            )}

            {/* ──────────────────────────────────────────────────── */}
            {/* INCOME PROTECTION CARD                              */}
            {/* ──────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">This Week's Protection</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  hasActivePolicy
                    ? 'bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}>
                  {hasActivePolicy ? 'ACTIVE' : 'NO POLICY'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Without FlowSecure</span>
                  <span className="text-2xl font-bold text-muted-foreground">₹{fmt(deliveryEarnings)}</span>
                  <span className="text-[10px] text-muted-foreground">Delivery earnings only</span>
                </div>
                <div className={`flex flex-col gap-1 p-3 rounded-lg border ${
                  hasActivePolicy
                    ? 'bg-[#10a37f]/10 border-[#10a37f]/20'
                    : 'bg-muted/40 border-border'
                }`}>
                  <span className={`text-[10px] uppercase tracking-wide font-semibold ${
                    hasActivePolicy ? 'text-[#10a37f]' : 'text-muted-foreground'
                  }`}>
                    With FlowSecure
                  </span>
                  <span className="text-2xl font-bold text-foreground">₹{fmt(totalEarnings)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {hasActivePolicy ? 'Earnings + payout + AI opt.' : 'Buy a policy to unlock'}
                  </span>
                </div>
              </div>

              {/* Normal week: show premium cost, no payouts */}
              {hasActivePolicy && !isDisasterMode && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-[#10a37f]/5 border-[#10a37f]/20">
                  <div>
                    <p className="text-xs text-muted-foreground">Weekly Premium Paid</p>
                    <p className="text-xl font-bold mt-0.5 text-foreground">₹{fmt(displayPremium)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#10a37f]">+{deliveryUpliftPct}%</p>
                    <p className="text-[10px] text-muted-foreground">AI shift uplift</p>
                  </div>
                </div>
              )}

              {/* Disaster week: show net gain from insurance */}
              {hasActivePolicy && isDisasterMode && (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${incomeProtected >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div>
                    <p className="text-xs text-muted-foreground">🚨 Net Insurance Gain</p>
                    <p className={`text-xl font-bold mt-0.5 ${incomeProtected >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {incomeProtected >= 0 ? '+' : '-'} ₹{fmt(Math.abs(incomeProtected))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${disasterNetGainPct >= 5 ? 'text-primary' : 'text-amber-400'}`}>
                      +{disasterNetGainPct}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">net gain on earnings</p>
                  </div>
                </div>
              )}

              {!hasActivePolicy && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-amber-400">No active policy</p>
                      <p className="text-[10px] text-muted-foreground">Buy below to start earning income protection</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {[
                  { label: 'AI Shift Optimization (Earned by you)', value: optimizationSavings > 0 ? `+ ₹${fmt(optimizationSavings)}` : '₹0', color: optimizationSavings > 0 ? '#10a37f' : '#666' },
                  ...(isDisasterMode ? [
                    { label: `Parametric Payout (Paid by us, ${paidClaims.length} claims)`, value: totalPayouts > 0 ? `+ ₹${fmt(totalPayouts)}` : '₹0', color: totalPayouts > 0 ? '#0ea5e9' : '#666' },
                  ] : []),
                  { label: 'Weekly Premium (Cost)', value: displayPremium > 0 ? `− ₹${fmt(displayPremium)}` : '₹0', color: displayPremium > 0 ? '#f59e0b' : '#666' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ──────────────────────────────────────────────────── */}
            {/* RAZORPAY PAYMENT SECTION                            */}
            {/* ──────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                <Wallet className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Weekly Cover — Razorpay {rzpConfig?.mode === 'live' ? 'Test Mode' : 'Sandbox'}
              </h2>

              <motion.div
                className="rounded-xl border bg-card p-5 flex flex-col gap-4 shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Plan info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Parametric Income Shield</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Covers rainfall, AQI, heat, traffic disruptions. Auto-payout on trigger breach.
                      Weekly billing matched to gig earnings rhythm.
                    </p>
                  </div>
                </div>

                {/* Premium display */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-xs text-muted-foreground">Weekly Premium</p>
                    <p className="text-xl font-bold text-foreground mt-0.5">
                      {displayPremium > 0 ? (
                        <>&#8377;{displayPremium.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">/ week</span></>
                      ) : (
                        <span className="text-base text-muted-foreground">Calculating...</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Coverage</p>
                    <p className="text-sm font-semibold text-[#10a37f]">6 Triggers</p>
                  </div>
                </div>

                {/* Mode indicator */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-dashed text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                  {rzpConfig?.mode === 'live' ? (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-primary">Razorpay Test Mode</span> — real checkout popup, use test card <code className="bg-muted px-1 py-0.5 rounded font-mono">4111 1111 1111 1111</code>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-amber-400">Sandbox Mode</span> — simulated payment flow (add Razorpay keys to .env for real checkout)
                    </span>
                  )}
                </div>

                {/* Payment button / states */}
                <AnimatePresence mode="wait">
                  {paymentStatus === 'idle' && (
                    <motion.button
                      key="buy"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      onClick={handleBuyPolicy}
                      className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                      <CreditCard className="w-5 h-5" />
                      {displayPremium > 0 ? `Pay ₹${displayPremium.toFixed(0)}` : 'Pay'} — Get Covered This Week
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  )}

                  {paymentStatus === 'creating' && (
                    <motion.div key="creating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-3.5 px-4 bg-muted rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating order...
                    </motion.div>
                  )}

                  {paymentStatus === 'open' && (
                    <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-3.5 px-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-primary">
                      <Zap className="w-4 h-4 animate-pulse" /> Razorpay Checkout open — complete payment in popup
                    </motion.div>
                  )}

                  {paymentStatus === 'processing' && (
                    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-4 px-4 bg-muted rounded-xl flex flex-col items-center gap-3">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <IndianRupee className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">Processing Payment</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Simulating UPI transaction...</p>
                      </div>
                    </motion.div>
                  )}

                  {paymentStatus === 'verifying' && (
                    <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-3.5 px-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying payment & activating policy...
                    </motion.div>
                  )}

                  {paymentStatus === 'success' && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="w-full flex flex-col gap-3">
                      <div className="py-4 px-4 bg-[#10a37f]/10 border border-[#10a37f]/30 rounded-xl flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-[#10a37f] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#10a37f]">Payment Successful — You're Covered!</p>
                          <p className="text-xs text-muted-foreground mt-1">Weekly parametric insurance is now active.</p>
                          {lastPayment && (
                            <div className="mt-2 p-2 rounded-lg bg-muted/50 border text-[10px] font-mono text-muted-foreground space-y-0.5">
                              <p>Order: {lastPayment.orderId}</p>
                              <p>Payment: {lastPayment.paymentId}</p>
                              <p>Method: {lastPayment.method} ({lastPayment.mode})</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={resetPayment}
                        className="w-full py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-sm font-medium transition-colors">
                        Done
                      </button>
                    </motion.div>
                  )}

                  {paymentStatus === 'error' && (
                    <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="w-full flex flex-col gap-3">
                      <div className="py-3.5 px-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-400">Payment Failed</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{paymentError}</p>
                        </div>
                      </div>
                      <button onClick={resetPayment}
                        className="w-full py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-sm font-medium transition-colors">
                        Try Again
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Razorpay badge */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground">Powered by</span>
                  <span className="text-[10px] font-bold text-[#0ea5e9] tracking-wide">RAZORPAY</span>
                  <span className="text-[10px] text-muted-foreground">&#x2022;</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {rzpConfig?.mode === 'live' ? 'Test Mode' : 'Sandbox'}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* ──────────────────────────────────────────────────── */}
            {/* PAYMENT HISTORY                                     */}
            {/* ──────────────────────────────────────────────────── */}
            {paymentHistory.length > 0 && (
              <div className="flex flex-col gap-3">
                <button onClick={() => setShowHistory(!showHistory)}
                  className="text-sm font-semibold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1 hover:text-foreground transition-colors">
                  <CreditCard className="w-4 h-4" />
                  Payment History ({paymentHistory.length})
                  <ChevronRight className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-2 overflow-hidden">
                      {paymentHistory.map((p, i) => (
                        <div key={i} className="p-3 rounded-lg bg-card border text-xs flex justify-between items-center">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">&#8377;{p.premium_amount?.toFixed(2)} — {p.status.toUpperCase()}</span>
                            {p.razorpay_payment_id && <span className="font-mono text-muted-foreground text-[10px]">{p.razorpay_payment_id}</span>}
                            {p.payment_method && <span className="text-muted-foreground">via {p.payment_method.toUpperCase()}</span>}
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            {p.verified ? (
                              <span className="text-[#10a37f] font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>
                            ) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">{p.mode}</span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ──────────────────────────────────────────────────── */}
            {/* AI OPTIMIZE RECOMMENDATION                          */}
            {/* ──────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest pl-1">Actions</h2>

              {highRiskDay ? (
                <motion.div
                  className={`p-5 rounded-xl border flex flex-col gap-4 relative overflow-hidden`}
                  style={{ backgroundColor: `${riskMeta.color}10`, borderColor: `${riskMeta.color}33` }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex gap-4 items-start relative z-10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${riskMeta.color}33` }}>
                      <RiskIcon className="w-5 h-5" style={{ color: riskMeta.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{riskMeta.label} Forecast</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed text-balance">
                        {highRiskDay.day}: {highRiskDay.message}
                        {optimizeData && ` Expected savings from shift change: ₹${fmt(optimizeData.projected_earnings_saved)}.`}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-border w-full relative z-10" />
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Recommended Shift</span>
                      <div className="flex gap-2 items-center mt-1 text-sm text-[#10a37f] font-medium">
                        <Clock className="w-4 h-4" /> {optimizeData?.recommended_shift || 'Loading...'}
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-card hover:bg-accent transition-colors border rounded-xl text-sm font-medium flex items-center gap-1 text-foreground">
                      Accept <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="p-5 rounded-xl bg-[#10a37f]/5 border border-[#10a37f]/20 flex items-center gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#10a37f]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#10a37f]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-0.5">All Clear This Week</h3>
                    <p className="text-xs text-muted-foreground">
                      No high-risk conditions forecasted. Keep riding on your normal schedule.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}
        {/* ── Demo Controls (Hackathon Mode) ── */}
        {loggedIn && hasActivePolicy && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-background/80 backdrop-blur-xl border border-border shadow-2xl rounded-full translate-x-[-50%]"
          >
            <button
              onClick={handleResetNormal}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                totalPayouts === 0 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Normal Week
            </button>
            <button
              onClick={handleSimulateDisaster}
              disabled={isSimulating}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                totalPayouts > 0 
                  ? 'bg-red-500 text-white shadow-lg' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {isSimulating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CloudRain className="w-3 h-3" />
              )}
              Disaster Week
            </button>
          </motion.div>
        )}

        <div className="h-20" /> {/* Spacer for floating button */}
      </motion.div>
    </div>
  );
}
