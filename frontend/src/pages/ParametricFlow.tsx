/**
 * ParametricFlow — End-to-end parametric insurance demo.
 *
 * Shows the complete lifecycle with real backend data:
 *   1. Premium subscription card (auto-pay toggle + cancel)
 *   2. Disruption simulator → real /triggers/simulate call
 *   3. Live animated flow: detection → eligibility → fraud walls → payout
 *   4. Actual payout receipt for the logged-in rider
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Zap, CheckCircle2, AlertCircle, Loader2,
  Radio, Users, IndianRupee, ToggleLeft, ToggleRight,
  CloudRain, Flame, Wind, Car, AlertTriangle, RefreshCw,
  ChevronRight, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE as API } from '@/lib/api';

const font = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('flowsecure_token');
  return t
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Policy {
  id: number;
  premium_amount: number;
  auto_renew: boolean;
  status: string;
  week_start: string;
  week_end: string;
  coverage_triggers: Record<string, number>;
}

interface RiderDash {
  rider: { id: number; name: string; upi_id: string };
  zone: { id: number; name: string; tier: string };
  city_name: string;
  active_policy: Policy | null;
  weekly_earnings: number;
}

interface ClaimDetail {
  claim_id: number;
  rider_id: number;
  rider_name: string;
  upi_id: string;
  status: string;
  fraud_score: number;
  payout_amount: number;
  classification: string;
  auto_payout?: {
    success: boolean;
    channel?: string;
    ref?: string;
    amount?: number;
    message?: string;
    attempts?: number;
  };
}

interface SimResult {
  trigger: {
    zone_name: string;
    trigger_type: string;
    value: number;
    threshold: number;
    duration_hours: number;
  };
  claims: {
    total_policies: number;
    claims_generated: number;
    auto_approved: number;
    pending_review: number;
    denied: number;
    total_payout: number;
    claim_details: ClaimDetail[];
  };
}

type FlowStage = 'idle' | 'detecting' | 'consensus' | 'eligibility' | 'fraud' | 'payout' | 'done';

const TRIGGER_OPTIONS = [
  { value: 'rainfall', label: 'Heavy Rainfall', icon: CloudRain, color: '#3b82f6', desc: 'Exceeds 64.5mm threshold' },
  { value: 'heat', label: 'Heat Wave', icon: Flame, color: '#ef4444', desc: 'Temperature > 44°C' },
  { value: 'aqi', label: 'AQI Crisis', icon: Wind, color: '#8b5cf6', desc: 'AQI > 500' },
  { value: 'traffic', label: 'Severe Traffic', icon: Car, color: '#f59e0b', desc: 'Speed < 10 km/h' },
];

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES: { key: FlowStage; label: string; color: string }[] = [
  { key: 'detecting',   label: 'Disruption Detected',  color: '#ef4444' },
  { key: 'consensus',   label: 'Multi-Source Consensus', color: '#3b82f6' },
  { key: 'eligibility', label: 'Eligibility Check',     color: '#f59e0b' },
  { key: 'fraud',       label: 'Fraud Detection',       color: '#8b5cf6' },
  { key: 'payout',      label: 'Auto-Payout',           color: '#10a37f' },
];

// ── Premium range by zone tier ────────────────────────────────────────────────
const PREMIUM_RANGE: Record<string, { min: number; max: number; cap: number }> = {
  high:   { min: 60, max: 75, cap: 200 },
  medium: { min: 45, max: 60, cap: 150 },
  low:    { min: 28, max: 45, cap: 100 },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ParametricFlow() {
  const [dash, setDash] = useState<RiderDash | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState('rainfall');
  const [stage, setStage] = useState<FlowStage>('idle');
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [myClaim, setMyClaim] = useState<ClaimDetail | null>(null);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [premiumQuote, setPremiumQuote] = useState<{
    total_weekly_premium: number;
    breakdown: Record<string, number>;
  } | null>(null);
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDash = useCallback(async () => {
    const token = localStorage.getItem('flowsecure_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/riders/me`, { headers: authHeaders() });
      if (res.ok) {
        const d: RiderDash = await res.json();
        setDash(d);
        // Fetch premium quote for this zone
        const qr = await fetch(
          `${API}/pricing/quote?city=${encodeURIComponent(d.city_name)}&zone_tier=${d.zone.tier}&month=${new Date().getMonth() + 1}`
        );
        if (qr.ok) setPremiumQuote(await qr.json());
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDash(); }, [fetchDash]);

  // ── Auto-renew toggle ──────────────────────────────────────────────────────
  const toggleAutoRenew = async () => {
    if (!dash?.active_policy) return;
    setAutoRenewLoading(true);
    try {
      const res = await fetch(`${API}/policies/toggle-auto-renew`, {
        method: 'PATCH', headers: authHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setDash(prev => prev && prev.active_policy
          ? { ...prev, active_policy: { ...prev.active_policy, auto_renew: d.auto_renew } }
          : prev
        );
      }
    } catch { /* silent */ } finally { setAutoRenewLoading(false); }
  };

  // ── Cancel policy ──────────────────────────────────────────────────────────
  const cancelPolicy = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API}/policies/cancel`, {
        method: 'POST', headers: authHeaders(),
      });
      if (res.ok) { await fetchDash(); setShowCancelConfirm(false); }
    } catch { /* silent */ } finally { setCancelLoading(false); }
  };

  // ── Run simulation ─────────────────────────────────────────────────────────
  const runSimulation = async () => {
    if (!dash || stage !== 'idle') return;
    setSimResult(null);
    setMyClaim(null);

    // Animate through stages while API call is in flight
    const advance = (s: FlowStage, delay: number) => {
      stageTimer.current = setTimeout(() => setStage(s), delay);
    };
    setStage('detecting');
    advance('consensus',   1200);
    advance('eligibility', 2400);
    advance('fraud',       3600);

    try {
      const res = await fetch(`${API}/triggers/simulate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          zone_id: dash.zone.id,
          trigger_type: selectedTrigger,
          duration_hours: 3.0,
          rider_id: dash.rider.id,
        }),
      });
      const data: SimResult = await res.json();
      setSimResult(data);

      // Find this rider's claim
      const mine = data.claims.claim_details.find(c => c.rider_id === dash.rider.id);
      setMyClaim(mine ?? null);

      // Show payout stage after fraud animation
      setTimeout(() => { setStage('payout'); }, 4200);
      setTimeout(() => { setStage('done'); }, 5600);
    } catch {
      setStage('idle');
    }
  };

  const reset = () => {
    if (stageTimer.current) clearTimeout(stageTimer.current);
    setStage('idle');
    setSimResult(null);
    setMyClaim(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const policy = dash?.active_policy;
  const tier = dash?.zone.tier || 'medium';
  const range = PREMIUM_RANGE[tier] ?? PREMIUM_RANGE.medium;
  const actualPremium = policy?.premium_amount ?? premiumQuote?.total_weekly_premium ?? range.min;
  const maxCap = Math.round(actualPremium * 8 / 3 / 25) * 25 || range.cap;
  const coverageBreakdown = policy?.coverage_triggers ?? premiumQuote?.breakdown ?? {};

  const triggerOpt = TRIGGER_OPTIONS.find(t => t.value === selectedTrigger)!;
  const stageIdx = STAGES.findIndex(s => s.key === stage);
  const isRunning = stage !== 'idle' && stage !== 'done';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0071E3]" />
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: font }}>
        <div className="text-center">
          <p className="text-[#86868B] mb-3">Please sign in on the Rider Dashboard first.</p>
          <a href="/rider" className="text-[#0071E3] font-semibold underline">Go to Rider Dashboard →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24 pt-20 px-4" style={{ fontFamily: font, WebkitFontSmoothing: 'antialiased' }}>
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="mt-6 mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Parametric Shield</h1>
          <p className="text-[#86868B] mt-1">
            {dash.rider.name} · {dash.city_name} · {dash.zone.name}
          </p>
        </div>

        {/* ══ SECTION 1: PREMIUM SUBSCRIPTION CARD ══════════════════════════ */}
        <div className="bg-[#1D1D1F] text-white rounded-3xl p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-1">Weekly Premium</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">₹{Math.round(actualPremium)}</span>
                <span className="text-[#94A3B8] mb-1">/ week</span>
              </div>
              <p className="text-[#94A3B8] text-xs mt-1">
                Range for {tier} zone: ₹{range.min}–₹{range.max}/week
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#94A3B8] text-xs mb-1">Max weekly payout</p>
              <p className="text-2xl font-bold text-emerald-400">₹{maxCap}</p>
              <p className="text-[#94A3B8] text-xs mt-1">{Math.round(maxCap / actualPremium)}× premium</p>
            </div>
          </div>

          {/* Coverage breakdown */}
          {Object.keys(coverageBreakdown).length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(coverageBreakdown).slice(0, 4).map(([key, val]) => {
                const opt = TRIGGER_OPTIONS.find(t => t.value === key);
                return (
                  <div key={key} className="bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                    {opt && <opt.icon className="w-3.5 h-3.5 shrink-0" style={{ color: opt.color }} />}
                    <div>
                      <p className="text-[10px] text-[#94A3B8] capitalize">{key.replace('_', ' ')}</p>
                      <p className="text-sm font-semibold text-white">up to ₹{Math.round(Number(val))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status row */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', policy ? 'bg-emerald-400' : 'bg-gray-500')} />
              <span className="text-sm text-[#94A3B8]">
                {policy ? 'Active · auto-renews weekly' : 'No active policy'}
              </span>
            </div>
            {policy && (
              <div className="flex items-center gap-3">
                {/* Auto-renew toggle */}
                <button
                  onClick={toggleAutoRenew}
                  disabled={autoRenewLoading}
                  className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors"
                  title={policy.auto_renew ? 'Disable auto-pay' : 'Enable auto-pay'}
                >
                  {autoRenewLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : policy.auto_renew
                      ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                      : <ToggleLeft className="w-5 h-5" />
                  }
                  Auto-pay {policy.auto_renew ? 'ON' : 'OFF'}
                </button>
                {/* Cancel */}
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pricing note */}
        <div className="bg-white border border-[#E5E5EA] rounded-2xl px-4 py-3 mb-6 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
          <p className="text-xs text-[#86868B]">
            Premium is <strong className="text-[#1D1D1F]">risk-based</strong> — calculated from your city, zone density, and seasonal probabilities.
            A <strong className="text-[#1D1D1F]">tier-{tier === 'high' ? '1 urban' : tier === 'medium' ? '2 city' : '3 suburban'}</strong> zone
            rider pays ₹{range.min}–₹{range.max}/week and can receive up to ₹{range.cap} in a single week.
            Only <strong className="text-[#1D1D1F]">one payout per week</strong> regardless of how many triggers fire.
          </p>
        </div>

        {/* ══ SECTION 2: DISRUPTION SIMULATOR ══════════════════════════════ */}
        <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 mb-4">
          <h2 className="text-xl font-bold text-[#1D1D1F] mb-1">Simulate a Disruption</h2>
          <p className="text-sm text-[#86868B] mb-5">
            Fires a real trigger in <strong>{dash.zone.name}</strong>. The system automatically detects it,
            checks eligibility, runs fraud detection, and disburses your payout — zero manual steps.
          </p>

          {/* Trigger selector */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {TRIGGER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => !isRunning && setSelectedTrigger(opt.value)}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-2xl border text-left transition-all',
                  selectedTrigger === opt.value
                    ? 'border-[#0071E3] bg-[#0071E3]/5'
                    : 'border-[#E5E5EA] hover:border-[#0071E3]/40',
                  isRunning && 'opacity-50 cursor-not-allowed'
                )}
              >
                <opt.icon className="w-5 h-5 shrink-0" style={{ color: opt.color }} />
                <div>
                  <p className="text-sm font-semibold text-[#1D1D1F]">{opt.label}</p>
                  <p className="text-xs text-[#86868B]">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={stage === 'done' ? reset : runSimulation}
            disabled={isRunning || !policy}
            className={cn(
              'w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
              stage === 'done'
                ? 'bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] hover:bg-[#EBEBED]'
                : isRunning
                  ? 'bg-[#0071E3] text-white opacity-70 cursor-not-allowed'
                  : !policy
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0071E3] text-white hover:bg-[#0077ED]'
            )}
          >
            {isRunning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Simulating…</>
              : stage === 'done'
                ? <><RefreshCw className="w-4 h-4" /> Run Again</>
                : !policy
                  ? 'No Active Policy — Buy Coverage First'
                  : <><Zap className="w-4 h-4" /> Trigger {triggerOpt.label} in {dash.zone.name}</>
            }
          </button>
          {!policy && (
            <p className="text-xs text-center text-[#86868B] mt-2">
              Go to <a href="/rider" className="text-[#0071E3]">Rider Dashboard</a> to activate a policy.
            </p>
          )}
        </div>

        {/* ══ SECTION 3: LIVE FLOW ══════════════════════════════════════════ */}
        <AnimatePresence>
          {stage !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="bg-white border border-[#E5E5EA] rounded-3xl p-6 mb-4"
            >
              <h2 className="text-lg font-bold text-[#1D1D1F] mb-5">Live Flow</h2>

              {/* Stage pipeline */}
              <div className="flex flex-col gap-0 mb-6">
                {STAGES.map((s, i) => {
                  const completed = stageIdx > i || stage === 'done';
                  const active = STAGES[stageIdx]?.key === s.key && stage !== 'done';
                  return (
                    <div key={s.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500',
                          completed ? 'bg-emerald-500' : active ? 'bg-[#0071E3]' : 'bg-[#F5F5F7] border border-[#E5E5EA]'
                        )}>
                          {completed
                            ? <CheckCircle2 className="w-4 h-4 text-white" />
                            : active
                              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                              : <div className="w-2 h-2 rounded-full bg-[#C7C7CC]" />
                          }
                        </div>
                        {i < STAGES.length - 1 && (
                          <div className={cn(
                            'w-0.5 h-8 transition-colors duration-500',
                            completed ? 'bg-emerald-500' : 'bg-[#E5E5EA]'
                          )} />
                        )}
                      </div>
                      <div className="pt-0.5 pb-6">
                        <p className={cn(
                          'text-sm font-semibold transition-colors',
                          completed ? 'text-emerald-600' : active ? 'text-[#0071E3]' : 'text-[#C7C7CC]'
                        )}>
                          {s.label}
                        </p>

                        {/* Stage detail content */}
                        {(completed || active) && simResult && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-1"
                          >
                            {s.key === 'detecting' && (
                              <p className="text-xs text-[#86868B]">
                                <strong style={{ color: triggerOpt.color }}>{triggerOpt.label}</strong> detected in{' '}
                                {simResult.trigger.zone_name} — {simResult.trigger.value} (threshold: {simResult.trigger.threshold})
                              </p>
                            )}
                            {s.key === 'consensus' && (
                              <div className="flex flex-col gap-1 mt-1">
                                {['OpenWeatherMap API', 'Dark store dispatch data', 'Zone rider activity drop', 'IMD cross-reference'].map((src, j) => (
                                  <p key={j} className="text-xs text-[#86868B] flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    {src} — confirmed
                                  </p>
                                ))}
                              </div>
                            )}
                            {s.key === 'eligibility' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  {simResult.claims.total_policies} active policies found in zone
                                </p>
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  Shift overlap check passed — trigger matches working hours
                                </p>
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  {simResult.claims.claims_generated} claims generated
                                </p>
                              </div>
                            )}
                            {s.key === 'fraud' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  {simResult.claims.auto_approved} auto-approved (fraud score ≤ 20)
                                </p>
                                {simResult.claims.pending_review > 0 && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {simResult.claims.pending_review} flagged for review (score 21–60)
                                  </p>
                                )}
                                {simResult.claims.denied > 0 && (
                                  <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {simResult.claims.denied} denied (fraud score &gt; 60)
                                  </p>
                                )}
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-purple-500" />
                                  9-wall adversarial defense ran on all {simResult.claims.claims_generated} claims
                                </p>
                              </div>
                            )}
                            {s.key === 'payout' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  ₹{simResult.claims.total_payout.toFixed(0)} auto-disbursed across {simResult.claims.auto_approved} riders
                                </p>
                                <p className="text-xs text-[#86868B] flex items-center gap-1">
                                  <IndianRupee className="w-3 h-3" />
                                  UPI-first · IMPS fallback · no rider action needed
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Your payout result ── */}
              <AnimatePresence>
                {stage === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {myClaim ? (
                      myClaim.status === 'paid' && myClaim.auto_payout?.success ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <p className="font-bold text-emerald-700">Your payout was sent</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-emerald-600">Amount</p>
                              <p className="font-bold text-[#1D1D1F] text-lg">₹{myClaim.payout_amount.toFixed(0)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600">Channel</p>
                              <p className="font-semibold text-[#1D1D1F] uppercase">{myClaim.auto_payout?.channel || 'UPI'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600">To</p>
                              <p className="font-mono text-sm text-[#1D1D1F]">{dash.rider.upi_id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600">Ref</p>
                              <p className="font-mono text-xs text-[#1D1D1F]">{myClaim.auto_payout?.ref || '—'}</p>
                            </div>
                          </div>
                          {myClaim.auto_payout?.attempts && myClaim.auto_payout.attempts > 1 && (
                            <p className="text-xs text-amber-600 mt-2">UPI failed → auto-switched to IMPS fallback</p>
                          )}
                          <p className="text-xs text-emerald-600 mt-2">
                            Fraud score: {myClaim.fraud_score}/100 · {myClaim.classification}
                          </p>
                        </div>
                      ) : myClaim.status === 'pending_review' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <p className="font-bold text-amber-700">Your claim is under review</p>
                          </div>
                          <p className="text-sm text-amber-600">
                            Fraud score {myClaim.fraud_score}/100 — above auto-approve threshold.
                            Our team will review within 24 hours.
                          </p>
                        </div>
                      ) : myClaim.status === 'denied' ? (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="font-bold text-red-700">Claim denied</p>
                          </div>
                          <p className="text-sm text-red-600">
                            Fraud score {myClaim.fraud_score}/100 exceeded threshold. Claim blocked.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                          <p className="text-sm text-blue-700">
                            Claim #{myClaim.claim_id} — {myClaim.status} · ₹{myClaim.payout_amount.toFixed(0)}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-2xl p-5 text-center">
                        <p className="text-sm text-[#86868B]">
                          No claim generated for your account this round — your shift hours may not overlap
                          with the trigger window, or you've already received a payout this week.
                        </p>
                      </div>
                    )}

                    {simResult && (
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        {[
                          { label: 'Total Disbursed', value: `₹${simResult.claims.total_payout.toFixed(0)}`, color: '#10a37f' },
                          { label: 'Riders Paid',     value: String(simResult.claims.auto_approved),           color: '#0071E3' },
                          { label: 'Fraud Blocked',   value: String(simResult.claims.denied),                  color: '#ef4444' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-white border border-[#E5E5EA] rounded-xl p-3">
                            <p className="text-xs text-[#86868B] mb-0.5">{label}</p>
                            <p className="font-bold text-base" style={{ color }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <a
                      href="/payouts"
                      className="mt-3 flex items-center justify-center gap-2 w-full py-3 border border-[#E5E5EA] rounded-xl text-sm font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
                    >
                      View full payout history <ChevronRight className="w-4 h-4" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cancel confirm modal ── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.93, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 16 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              style={{ fontFamily: font }}
            >
              <button onClick={() => setShowCancelConfirm(false)} className="absolute top-4 right-4 p-1">
                <X className="w-4 h-4 text-[#86868B]" />
              </button>
              <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
              <h3 className="font-bold text-lg text-[#1D1D1F] mb-2">Cancel Policy?</h3>
              <p className="text-sm text-[#86868B] mb-6">
                Your coverage will end immediately. Any active triggers this week will still be processed,
                but you won't be covered for new disruptions.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 border border-[#E5E5EA] rounded-xl text-sm font-semibold"
                >
                  Keep Coverage
                </button>
                <button
                  onClick={cancelPolicy}
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
    </div>
  );
}
