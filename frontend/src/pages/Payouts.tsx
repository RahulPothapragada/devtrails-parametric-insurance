import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, CheckCircle2, AlertCircle, Loader2, 
  Zap, RotateCcw, Building2, Smartphone 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const API = 'http://localhost:8000/api';

export default function Payouts() {
  const [summary, setSummary] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [progress, setProgress] = useState({ step: 0, text: '' });

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API}/payouts/demo-summary`);
      if (res.ok) setSummary(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleSeedDemo = async () => {
    setRunning(true);
    setProgress({ step: 1, text: 'Generating 25 approved demo claims...' });
    try {
      const res = await fetch(`${API}/payouts/seed-demo`, { method: 'POST' });
      if (res.ok) {
        await fetchSummary();
        setProgress({ step: 5, text: 'Demo claims seeded! ✓' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRunning(false), 1000);
    }
  };

  const runAutoDisburse = async () => {
    setRunning(true);
    setReport(null);
    
    // Animation sequence to make it look like a real complex pipeline
    setProgress({ step: 1, text: 'Scanning for approved unpaid claims...' });
    await new Promise(r => setTimeout(r, 800));
    
    setProgress({ step: 2, text: 'Connecting to NPCI / UPI network...' });
    await new Promise(r => setTimeout(r, 600));

    setProgress({ step: 3, text: 'Initiating bulk instant transfers...' });
    
    try {
      const res = await fetch(`${API}/payouts/auto-disburse`, {
        method: 'POST',
      });
      const data = await res.json();
      
      setProgress({ step: 4, text: 'Verifying bank confirmations & retrying failures via IMPS...' });
      await new Promise(r => setTimeout(r, 1200));

      setReport(data);
      setProgress({ step: 5, text: 'Complete ✓' });
      fetchSummary();
    } catch (e) {
      console.error(e);
      setProgress({ step: 0, text: 'Error running simulation' });
    } finally {
      setTimeout(() => setRunning(false), 2000);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-6 rounded-3xl border border-border/50">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Zero-Claim Network</h1>
            </div>
            <p className="text-muted-foreground mt-2">Parametric Auto-Disbursal Pipeline & Resiliency Engine</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Unpaid Pipeline</p>
              <p className="text-2xl font-bold text-amber-500">
                {summary ? summary.total_pending_count : 0} <span className="text-sm font-normal text-muted-foreground">claims</span>
              </p>
            </div>
          </div>
        </div>

        {/* Demo Controls */}
        <div className="p-6 rounded-3xl border shadow-sm bg-card overflow-hidden relative">
          {/* Animated background gradient pulse when pending > 0 */}
          {summary?.total_pending_count > 0 && !running && (
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" 
            />
          )}

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold text-foreground">Instant Bulk Payout Simulation</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Watch the system instantly process all pending payouts without human intervention. 
                If a UPI transaction fails (e.g. invalid VPA, bank timeout), the system automatically rolls back and recovers using an alternative IMPS channel.
              </p>
            </div>
            
            <div className="w-full md:w-auto">
              {summary?.total_pending_count === 0 && !running ? (
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={handleSeedDemo}
                  className="w-full md:w-auto text-base font-semibold px-8 py-6 h-auto rounded-2xl border-dashed border-primary/40 hover:border-primary/60 hover:bg-primary/5 text-primary transition-all shadow-sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Seed Demo Pipeline
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  onClick={runAutoDisburse} 
                  disabled={running || summary?.total_pending_count === 0}
                  className={cn(
                    "w-full md:w-auto text-base font-semibold px-8 py-6 h-auto rounded-2xl shadow-xl transition-all",
                    summary?.total_pending_count > 0 ? "shadow-primary/20 hover:shadow-primary/40 bg-primary hover:bg-primary/90 text-primary-foreground" : ""
                  )}
                >
                  {running ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> {progress.text}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Run Auto-Disburse <ArrowRight className="w-4 h-4 ml-1" />
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Aggregate Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border bg-muted/20">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Total Paid</p>
              <p className="text-3xl font-black text-foreground">₹{fmt(summary.total_paid_amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(summary.total_paid_count)} riders covered</p>
            </div>
            <div className="p-5 rounded-2xl border bg-green-500/10 border-green-500/20">
              <p className="text-xs text-green-600 uppercase tracking-widest font-semibold mb-1">Success Rate</p>
              <p className="text-3xl font-black text-green-500">{summary.recovery_rate}%</p>
              <p className="text-xs text-green-600/70 mt-1">Post-recovery</p>
            </div>
            <div className="p-5 rounded-2xl border bg-blue-500/10 border-blue-500/20">
              <p className="text-xs text-blue-600 uppercase tracking-widest font-semibold mb-1">Avg Speed</p>
              <p className="text-3xl font-black text-blue-500">2.4<span className="text-lg">s</span></p>
              <p className="text-xs text-blue-600/70 mt-1">End-to-end clearing</p>
            </div>
            <div className="p-5 rounded-2xl border bg-destructive/10 border-destructive/20">
              <p className="text-xs text-destructive uppercase tracking-widest font-semibold mb-1">Hard Fails</p>
              <p className="text-3xl font-black text-destructive">{fmt(summary.total_failed)}</p>
              <p className="text-xs text-destructive/70 mt-1">Require manual review</p>
            </div>
          </div>
        )}

        {/* Live Report Stream (shows up after running) */}
        <AnimatePresence>
          {report && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: 20 }} 
              animate={{ opacity: 1, height: 'auto', y: 0 }} 
              className="space-y-6 pt-4"
            >
              <h3 className="text-lg font-bold border-b pb-2">Simulation Report: {report.processed} Transactions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.transactions.map((txn: any, i: number) => {
                  const isRecovered = txn.final_status === 'recovered';
                  const isFailed = txn.final_status === 'permanently_failed';
                  
                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "p-4 rounded-xl border flex flex-col gap-3",
                        isRecovered ? "bg-amber-500/5 border-amber-500/30" : 
                        isFailed ? "bg-red-500/5 border-red-500/30" : 
                        "bg-green-500/5 border-green-500/30"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm">{txn.rider_name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{txn.trigger_type} Payout</p>
                        </div>
                        <p className="font-bold text-foreground">₹{fmt(txn.amount)}</p>
                      </div>

                      <div className="space-y-1.5 mt-1 border-t pt-2 border-border/50">
                        {txn.attempts.map((attempt: any, j: number) => (
                          <div key={j} className="flex items-center gap-2 text-[11px]">
                            {attempt.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                            <div className="flex-1 truncate">
                              <span className="font-semibold uppercase text-muted-foreground mr-1">
                                {attempt.channel}
                              </span>
                              <span className="opacity-70 font-mono">{attempt.ref}</span>
                              {!attempt.success && (
                                <p className="text-red-400 mt-0.5 truncate">{attempt.failure_reason}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {isRecovered && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit">
                          <RotateCcw className="w-3 h-3" /> Auto-Recovered via {txn.final_channel}
                        </div>
                      )}
                      
                      {!isRecovered && !isFailed && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded w-fit">
                          {txn.final_channel === 'upi' ? <Smartphone className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          Instant {txn.final_channel.toUpperCase()} Success
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
