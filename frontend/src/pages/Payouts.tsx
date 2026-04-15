import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, CheckCircle2, AlertCircle, Loader2, Zap, ArrowRight, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE as API } from '@/lib/api';

const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

interface Claim {
  id: number;
  trigger_type: string;
  payout_amount: number;
  status: string;
  payout_status?: string;
  payout_channel?: string;
  payout_ref?: string;
  event_time: string;
}

interface RiderData {
  rider: { id: number; name: string; upi_id: string };
  recent_claims: Claim[];
}

type StepStatus = 'pending' | 'running' | 'success' | 'failed';
interface FlowStep { label: string; status: StepStatus; detail?: string }

function authHeaders() {
  const t = localStorage.getItem('flowsecure_token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const PAYOUT_CACHE_KEY = 'fs_payout_v1';
function readPayoutCache(): RiderData | null {
  try {
    const raw = sessionStorage.getItem(PAYOUT_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 60_000) return null; // 1 min TTL — payout state changes fast
    return data;
  } catch { return null; }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Payouts() {
  const [data, setData] = useState<RiderData | null>(() => readPayoutCache());
  const [loading, setLoading] = useState(!readPayoutCache());
  const [runningId, setRunningId] = useState<number | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [flowAmount, setFlowAmount] = useState(0);
  const [showFlow, setShowFlow] = useState(false);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('flowsecure_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/riders/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        try { sessionStorage.setItem(PAYOUT_CACHE_KEY, JSON.stringify({ data: json, ts: Date.now() })); } catch {}
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runPayoutFlow = async (claim: Claim, upiId: string) => {
    setRunningId(claim.id);
    setFlowAmount(claim.payout_amount);
    setFlowSteps([
      { label: `Claim #${claim.id} — ₹${claim.payout_amount.toFixed(0)} auto-approved`, status: 'success' },
      { label: `Initiating UPI transfer → ${upiId}`, status: 'running' },
      { label: 'Bank processing…', status: 'pending' },
      { label: 'Payout result', status: 'pending' },
    ]);
    setShowFlow(true);
    await sleep(900);

    // Single call — backend handles UPI attempt + IMPS fallback atomically
    const res = await fetch(`${API}/payouts/${claim.id}/auto-disburse-single`, {
      method: 'POST', headers: authHeaders(),
    });
    const ap = await res.json();

    if (ap.attempts === 1 && ap.success) {
      setFlowSteps([
        { label: `Claim #${claim.id} — ₹${claim.payout_amount.toFixed(0)} auto-approved`, status: 'success' },
        { label: `UPI transfer → ${upiId}`, status: 'success', detail: `Ref: ${ap.ref}` },
        { label: 'Bank confirmed ✓', status: 'success' },
        { label: `₹${claim.payout_amount.toFixed(0)} credited via UPI`, status: 'success', detail: 'Parametric payout — no rider action needed.' },
      ]);
    } else if (ap.attempts === 2 && ap.success) {
      setFlowSteps([
        { label: `Claim #${claim.id} — ₹${claim.payout_amount.toFixed(0)} auto-approved`, status: 'success' },
        { label: `UPI failed — ${ap.upi_failure_reason}`, status: 'failed', detail: 'Auto-switched to IMPS' },
        { label: `IMPS transfer → ${ap.bank}`, status: 'success', detail: `Ref: ${ap.ref}` },
        { label: `₹${claim.payout_amount.toFixed(0)} credited via IMPS ✓`, status: 'success', detail: 'Auto-recovered. No rider action needed.' },
      ]);
    } else {
      setFlowSteps([
        { label: `Claim #${claim.id} — ₹${claim.payout_amount.toFixed(0)} auto-approved`, status: 'success' },
        { label: `UPI failed — ${ap.upi_failure_reason}`, status: 'failed' },
        { label: `IMPS failed — ${ap.imps_failure_reason}`, status: 'failed' },
        { label: 'Support notified for manual transfer', status: 'failed' },
      ]);
    }

    setRunningId(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: appleFontFamily }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#0071E3]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: appleFontFamily }}>
        <div className="text-center">
          <p className="text-[#86868B] mb-3">Please log in on the Rider Dashboard first.</p>
          <a href="/rider" className="text-[#0071E3] font-semibold underline">Go to Rider Dashboard →</a>
        </div>
      </div>
    );
  }

  const pendingClaims = data.recent_claims.filter(c =>
    (c.status === 'auto_approved' || c.status === 'approved') &&
    (c.payout_status === 'not_initiated' || c.payout_status === 'rolled_back' || !c.payout_status) &&
    c.payout_amount > 0
  );
  const paidClaims = data.recent_claims.filter(c => c.status === 'paid' || c.payout_status === 'confirmed');
  const total = paidClaims.reduce((s, c) => s + c.payout_amount, 0);

  return (
    <div
      className="min-h-screen bg-[#F5F5F7] pb-24 pt-20 px-4"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 mt-6">
          <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Payouts</h1>
          <p className="text-[#86868B] mt-1">Parametric claim disbursements for {data.rider.name}</p>
        </div>

        {/* UPI ID card */}
        <div className="bg-[#1D1D1F] text-white rounded-3xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-1">Linked UPI</p>
            <p className="font-mono text-lg font-bold">{data.rider.upi_id || 'Not linked'}</p>
            <p className="text-[#94A3B8] text-xs mt-1">Primary channel · IMPS fallback enabled</p>
          </div>
          <Wallet className="w-10 h-10 text-[#94A3B8]" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Paid', value: `₹${total.toFixed(0)}`, color: '#10a37f' },
            { label: 'Claims Paid', value: String(paidClaims.length), color: '#0071E3' },
            { label: 'Pending', value: String(pendingClaims.length), color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-[#E5E5EA]">
              <p className="text-xs text-[#86868B] mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Pending Payouts */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#1D1D1F] mb-3 flex items-center gap-2">
            Ready for Disbursal
            {pendingClaims.length > 0 && (
              <span className="bg-[#0071E3]/10 text-[#0071E3] text-xs px-2 py-0.5 rounded-full font-semibold">
                {pendingClaims.length}
              </span>
            )}
          </h2>
          {pendingClaims.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-[#E5E5EA] text-[#86868B] text-sm">
              No pending payouts. Simulate a rainfall claim from the Rider Dashboard.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {pendingClaims.map(claim => (
                  <motion.div
                    key={claim.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl p-5 border border-[#0071E3]/20 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-[#1D1D1F] capitalize">
                        {claim.trigger_type.replace('_', ' ')} Claim
                      </p>
                      <p className="text-sm text-[#86868B] mt-0.5">
                        Auto-approved · {new Date(claim.event_time).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#1D1D1F]">₹{claim.payout_amount.toFixed(0)}</span>
                      <button
                        onClick={() => runPayoutFlow(claim, data.rider.upi_id)}
                        disabled={runningId !== null}
                        className="flex items-center gap-2 bg-[#0071E3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0077ED] transition-colors disabled:opacity-50"
                      >
                        {runningId === claim.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Zap className="w-4 h-4" /> Pay via UPI</>
                        }
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Completed Transfers */}
        <section>
          <h2 className="text-lg font-bold text-[#1D1D1F] mb-3">Completed Transfers</h2>
          {paidClaims.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-[#E5E5EA] text-[#86868B] text-sm">
              No completed transfers yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {paidClaims.map(claim => (
                <div key={claim.id} className="bg-white rounded-2xl px-5 py-4 border border-[#E5E5EA] flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#1D1D1F] capitalize text-sm">
                      {claim.trigger_type.replace('_', ' ')} · {(claim.payout_channel || 'UPI').toUpperCase()}
                    </p>
                    <p className="text-xs text-[#86868B] font-mono mt-0.5">{claim.payout_ref || 'PAID'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">+₹{claim.payout_amount.toFixed(0)}</p>
                    <p className="text-xs text-[#86868B]">{new Date(claim.event_time).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Payout Flow Modal */}
      <AnimatePresence>
        {showFlow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
              style={{ fontFamily: appleFontFamily }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-[#0071E3]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Auto-Disbursement</h3>
                  <p className="text-sm text-[#86868B]">₹{flowAmount.toFixed(0)} · {data.rider.upi_id}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {flowSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {step.status === 'failed'  && <AlertCircle className="w-5 h-5 text-red-500" />}
                      {step.status === 'running' && <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />}
                      {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-[#E5E5EA]" />}
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium leading-snug',
                        step.status === 'success' ? 'text-[#1D1D1F]' :
                        step.status === 'failed'  ? 'text-red-500' :
                        step.status === 'running' ? 'text-[#0071E3]' : 'text-[#86868B]'
                      )}>{step.label}</p>
                      {step.detail && (
                        <p className="text-xs text-[#86868B] font-mono mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Connector lines between steps */}
              {flowSteps.every(s => s.status !== 'running' && s.status !== 'pending') && (
                <button
                  onClick={() => setShowFlow(false)}
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
