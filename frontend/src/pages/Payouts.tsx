import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, AlertCircle, Loader2, Zap, Clock,
  IndianRupee, ShieldCheck, RefreshCw,
} from 'lucide-react';
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

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('flowsecure_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  return headers;
}

function triggerLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusBadge(claim: Claim) {
  const ps = claim.payout_status;
  const cs = claim.status;
  if (cs === 'paid' || ps === 'confirmed')
    return { label: 'Paid', color: 'text-green-600 bg-green-50 border-green-200' };
  if (ps === 'initiated' || ps === 'processing')
    return { label: 'Processing…', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (ps === 'failed')
    return { label: 'Failed', color: 'text-red-500 bg-red-50 border-red-200' };
  if (cs === 'pending_review')
    return { label: 'Under Review', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  if (cs === 'denied')
    return { label: 'Denied', color: 'text-gray-500 bg-gray-50 border-gray-200' };
  if (cs === 'auto_approved' || cs === 'approved')
    return { label: 'Queued', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  return { label: cs, color: 'text-gray-500 bg-gray-50 border-gray-200' };
}

export default function Payouts() {
  const [data, setData] = useState<RiderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoDisburseRunning, setAutoDisburseRunning] = useState(false);
  const [lastDisburseResult, setLastDisburseResult] = useState<{
    succeeded: number; total_disbursed: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasDisbursed = useRef(false);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('flowsecure_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/riders/me`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  // Auto-disburse any not_initiated AUTO_APPROVED claims on first load
  const runAutoDisburse = useCallback(async () => {
    if (hasDisbursed.current) return;
    hasDisbursed.current = true;
    setAutoDisburseRunning(true);
    try {
      const res = await fetch(`${API}/payouts/auto-disburse`, {
        method: 'POST', headers: authHeaders(),
      });
      if (res.ok) {
        const report = await res.json();
        if (report.processed > 0) {
          setLastDisburseResult({
            succeeded: report.succeeded + report.failed_then_recovered,
            total_disbursed: report.total_disbursed,
          });
          await fetchData(); // refresh claims after disbursal
        }
      }
    } catch { /* silent */ } finally { setAutoDisburseRunning(false); }
  }, [fetchData]);

  // Poll every 5s while any claim is in-flight (initiated/processing)
  const hasInFlight = (d: RiderData | null) =>
    d?.recent_claims.some(c =>
      c.payout_status === 'initiated' || c.payout_status === 'processing'
    ) ?? false;

  useEffect(() => {
    fetchData().then(() => runAutoDisburse());
  }, [fetchData, runAutoDisburse]);

  useEffect(() => {
    if (hasInFlight(data)) {
      pollRef.current = setInterval(fetchData, 5000);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [data, fetchData]);

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

  const paidClaims = data.recent_claims.filter(
    c => c.status === 'paid' || c.payout_status === 'confirmed'
  );
  const inFlightClaims = data.recent_claims.filter(
    c => c.payout_status === 'initiated' || c.payout_status === 'processing'
  );
  const reviewClaims = data.recent_claims.filter(c => c.status === 'pending_review');
  const failedClaims = data.recent_claims.filter(c => c.payout_status === 'failed');
  const totalPaid = paidClaims.reduce((s, c) => s + c.payout_amount, 0);

  return (
    <div
      className="min-h-screen bg-[#F5F5F7] pb-24 pt-20 px-4"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 mt-6 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Payouts</h1>
            <p className="text-[#86868B] mt-1">Parametric auto-disbursements for {data.rider.name}</p>
          </div>
          <button
            onClick={() => { hasDisbursed.current = false; fetchData().then(() => runAutoDisburse()); }}
            className="mt-2 p-2 rounded-xl border border-[#E5E5EA] bg-white hover:bg-[#F5F5F7] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4 text-[#86868B]', autoDisburseRunning && 'animate-spin')} />
          </button>
        </div>

        {/* Parametric badge */}
        <div className="bg-[#0071E3]/5 border border-[#0071E3]/20 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0071E3] shrink-0" />
          <p className="text-sm text-[#0071E3] font-medium">
            Fully parametric — payouts disburse automatically when a trigger is accepted. No rider action required.
          </p>
        </div>

        {/* Auto-disburse in progress */}
        <AnimatePresence>
          {autoDisburseRunning && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            >
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
              <p className="text-sm text-blue-700 font-medium">Auto-disbursing approved claims…</p>
            </motion.div>
          )}
          {!autoDisburseRunning && lastDisburseResult && lastDisburseResult.succeeded > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-700 font-medium">
                Auto-disbursed ₹{lastDisburseResult.total_disbursed.toFixed(0)} across {lastDisburseResult.succeeded} claim{lastDisburseResult.succeeded !== 1 ? 's' : ''}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* UPI card */}
        <div className="bg-[#1D1D1F] text-white rounded-3xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-1">Linked UPI</p>
            <p className="font-mono text-lg font-bold">{data.rider.upi_id || 'Not linked'}</p>
            <p className="text-[#94A3B8] text-xs mt-1">Primary · IMPS fallback enabled</p>
          </div>
          <Wallet className="w-10 h-10 text-[#94A3B8]" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Paid', value: `₹${totalPaid.toFixed(0)}`, color: '#10a37f' },
            { label: 'Claims Paid', value: String(paidClaims.length), color: '#0071E3' },
            { label: 'Under Review', value: String(reviewClaims.length), color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-[#E5E5EA]">
              <p className="text-xs text-[#86868B] mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* In-flight */}
        {inFlightClaims.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-[#1D1D1F] mb-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              Processing
            </h2>
            <div className="flex flex-col gap-2">
              {inFlightClaims.map(claim => (
                <div
                  key={claim.id}
                  className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#1D1D1F] text-sm">{triggerLabel(claim.trigger_type)} Claim</p>
                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Transferring to {data.rider.upi_id}
                    </p>
                  </div>
                  <p className="font-bold text-[#1D1D1F]">₹{claim.payout_amount.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed Transfers */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#1D1D1F] mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Completed Transfers
          </h2>
          {paidClaims.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-[#E5E5EA] text-[#86868B] text-sm">
              No completed transfers yet. Simulate a trigger from the Rider Dashboard to see auto-payouts.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {paidClaims.map(claim => (
                  <motion.div
                    key={claim.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl px-5 py-4 border border-[#E5E5EA] flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-[#1D1D1F] text-sm">{triggerLabel(claim.trigger_type)}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-md border font-medium text-green-600 bg-green-50 border-green-200">
                          Auto-paid
                        </span>
                      </div>
                      <p className="text-xs text-[#86868B] font-mono">
                        {claim.payout_ref || 'PAID'} · {(claim.payout_channel || 'UPI').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+₹{claim.payout_amount.toFixed(0)}</p>
                      <p className="text-xs text-[#86868B]">{new Date(claim.event_time).toLocaleDateString('en-IN')}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Under Review */}
        {reviewClaims.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-[#1D1D1F] mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Under Fraud Review
            </h2>
            <div className="flex flex-col gap-2">
              {reviewClaims.map(claim => (
                <div key={claim.id} className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#1D1D1F] text-sm">{triggerLabel(claim.trigger_type)} Claim</p>
                    <p className="text-xs text-amber-700 mt-0.5">Fraud score above auto-approve threshold — pending review</p>
                  </div>
                  <p className="font-bold text-[#1D1D1F]">₹{claim.payout_amount.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Failed */}
        {failedClaims.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-[#1D1D1F] mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Failed Transfers
            </h2>
            <div className="flex flex-col gap-2">
              {failedClaims.map(claim => (
                <div key={claim.id} className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#1D1D1F] text-sm">{triggerLabel(claim.trigger_type)}</p>
                    <p className="text-xs text-red-600 mt-0.5">UPI + IMPS both failed — support notified</p>
                  </div>
                  <p className="font-bold text-red-500">₹{claim.payout_amount.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
