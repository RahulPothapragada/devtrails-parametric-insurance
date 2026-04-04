import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Claim {
  id: number;
  trigger_type: string;
  payout_amount: number;
  status: string;
  payout_status?: string;
  payout_ref?: string;
  event_time: string;
}

interface RiderData {
  rider: {
    id: number;
    name: string;
    upi_id: string;
  };
  recent_claims: Claim[];
}

export default function Payouts() {
  const [data, setData] = useState<RiderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingClaim, setProcessingClaim] = useState<number | null>(null);
  const [payoutResult, setPayoutResult] = useState<{ claimId: number, success: boolean, message: string, ref?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('flowsecure_token');
      const res = await fetch('http://localhost:8000/api/riders/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiatePayout = async (claimId: number) => {
    setProcessingClaim(claimId);
    setPayoutResult(null);
    const token = localStorage.getItem('flowsecure_token');

    try {
      // Step 1: Initiate
      const initRes = await fetch(`http://localhost:8000/api/payouts/${claimId}/initiate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const initJson = await initRes.json();

      if (!initJson.success) {
        setPayoutResult({ claimId, success: false, message: initJson.error || "Initiation failed." });
        setProcessingClaim(null);
        return;
      }

      // Simulate network delay for demo
      await new Promise(r => setTimeout(r, 1500));

      // Step 2: Confirm
      const confRes = await fetch(`http://localhost:8000/api/payouts/${claimId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const confJson = await confRes.json();

      if (confJson.success) {
        setPayoutResult({ claimId, success: true, message: "Funds credited automatically.", ref: confJson.payout_ref });
        fetchData(); // Refresh list to get updated statuses
      } else {
        setPayoutResult({ claimId, success: false, message: confJson.failure_reason || "Confirmation failed." });
      }

    } catch (e) {
      setPayoutResult({ claimId, success: false, message: "Network error occurred." });
    } finally {
      setProcessingClaim(null);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-5xl mx-auto flex items-center justify-center">
        <div className="text-center space-y-3">
          {loading
            ? <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            : <Wallet className="w-10 h-10 text-muted-foreground mx-auto" />}
          <p className="text-muted-foreground">{loading ? 'Loading your payouts…' : 'Please log in to view your payouts.'}</p>
        </div>
      </div>
    );
  }

  const unpaidReadyClaims = data.recent_claims.filter(c => 
    (c.status === 'auto_approved' || c.status === 'approved') && 
    (c.payout_status === 'not_initiated' || !c.payout_status) &&
    c.payout_amount > 0
  );

  const pendingReviewClaims = data.recent_claims.filter(c => c.status === 'pending_review');
  const paidClaims = data.recent_claims.filter(c => c.status === 'paid' || c.payout_status === 'confirmed');

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-6 rounded-3xl border border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wallet & Payouts</h1>
            <p className="text-muted-foreground mt-1">Manage parametric claims and instant UPI deposits.</p>
          </div>
          <div className="flex items-center gap-3 bg-background p-3 px-5 rounded-2xl border border-primary/20 shadow-inner">
            <Wallet className="w-6 h-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Linked UPI</p>
              <p className="font-mono text-sm">{data.rider.upi_id}</p>
            </div>
          </div>
        </div>

        {/* Actionable Claims */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Ready for Disbursal <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{unpaidReadyClaims.length}</span>
          </h2>
          <div className="grid gap-4">
            {unpaidReadyClaims.length === 0 && (
              <div className="p-8 text-center text-muted-foreground border border-dashed rounded-2xl bg-muted/10">
                No pending payouts right now.
              </div>
            )}
            <AnimatePresence>
              {unpaidReadyClaims.map((claim) => (
                <motion.div key={claim.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5 rounded-2xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-bold text-lg capitalize">{claim.trigger_type.replace('_', ' ')} Disruption</h3>
                    <p className="text-sm text-muted-foreground mt-1">Approved — ₹{claim.payout_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    {processingClaim === claim.id ? (
                      <Button disabled className="w-full sm:w-auto bg-primary text-primary-foreground min-w-[140px]">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                      </Button>
                    ) : (
                      <Button onClick={() => handleInitiatePayout(claim.id)} className="w-full sm:w-auto min-w-[140px]">
                        Initiate UPI Payout <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Action Result Message */}
            {payoutResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                <div className={cn(
                  "p-4 rounded-xl border flex items-start gap-3",
                  payoutResult.success ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                  {payoutResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <div>
                    <p className="font-medium">{payoutResult.message}</p>
                    {payoutResult.ref && <p className="text-xs opacity-80 mt-0.5 font-mono">Ref: {payoutResult.ref}</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* In Review */}
        {pendingReviewClaims.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Under Review</h2>
            <div className="grid gap-4">
              {pendingReviewClaims.map(claim => (
                <div key={claim.id} className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium capitalize">{claim.trigger_type.replace('_', ' ')} Claim</h3>
                    <p className="text-sm text-muted-foreground">Pending manual verification</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-500">₹{claim.payout_amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="text-xl font-bold mb-4">Completed Transfers</h2>
          <div className="grid gap-3">
            {paidClaims.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground border rounded-2xl bg-muted/10">
                No past transfers.
              </div>
            )}
            {paidClaims.map(claim => (
              <div key={claim.id} className="p-4 rounded-xl border bg-card flex justify-between items-center opacity-80">
                <div>
                  <h3 className="font-medium capitalize">{claim.trigger_type.replace('_', ' ')}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{claim.payout_ref || 'PAID'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-400">+ ₹{claim.payout_amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(claim.event_time).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
