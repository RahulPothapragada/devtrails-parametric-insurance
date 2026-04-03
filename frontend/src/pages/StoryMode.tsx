import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Clock, CloudRain, 
  ShieldCheck, Zap, TrendingUp, IndianRupee,
  Play, Sun, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STORY_DAYS } from '../data/simulationData';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { Button } from '@/components/ui/button';

const dayColors: Record<string, string> = {
  normal:   '#10a37f',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  recovery: '#3b82f6',
  summary:  '#8b5cf6',
};

export default function StoryMode() {
  const [currentDay, setCurrentDay] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const day = STORY_DAYS[currentDay];
  const color = dayColors[day.type];

  const goToDay = (target: number) => {
    if (target < 0 || target >= STORY_DAYS.length) return;
    setDirection(target > currentDay ? 1 : -1);
    setCurrentDay(target);
  };

  const next = () => goToDay(currentDay + 1);
  const prev = () => goToDay(currentDay - 1);

  // Auto-play
  const startAutoPlay = () => {
    setIsAutoPlaying(true);
    setCurrentDay(0);
    setDirection(1);
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx >= STORY_DAYS.length) {
        clearInterval(interval);
        setIsAutoPlaying(false);
        return;
      }
      setDirection(1);
      setCurrentDay(idx);
    }, 4000);
  };

  // Calculate cumulative earnings
  const cumulativeWith = STORY_DAYS.slice(0, currentDay + 1).reduce((s, d) => s + d.earnings.withFlowSecure, 0);
  const cumulativeWithout = STORY_DAYS.slice(0, currentDay + 1).reduce((s, d) => s + d.earnings.withoutFlowSecure, 0);
  const totalWith = STORY_DAYS.reduce((s, d) => s + d.earnings.withFlowSecure, 0);
  const totalWithout = STORY_DAYS.reduce((s, d) => s + d.earnings.withoutFlowSecure, 0);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 min-h-[calc(100vh-4rem)] flex flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-8 pb-12 h-full flex-1"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card border p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-foreground leading-none">
              Ravi's Week
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Case Study: Visualizing the Predict → Optimize → Protect cycle.
            </p>
          </div>
          <Button
            onClick={startAutoPlay}
            disabled={isAutoPlaying}
            className={cn(
               "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg transition-transform h-10 px-6 rounded-xl",
               isAutoPlaying ? "opacity-50 cursor-not-allowed" : "active:scale-95"
            )}
          >
            <Play className="w-4 h-4 mr-2" /> {isAutoPlaying ? 'Auto-Running...' : 'Run Auto-Simulation'}
          </Button>
        </div>

        {/* Day Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar py-2 bg-muted/30 p-2 rounded-2xl border mb-2">
          {STORY_DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => goToDay(i)}
              className={cn(
                "shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm",
                i === currentDay
                  ? "bg-card text-foreground shadow-md ring-2 ring-primary/20"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
              style={i === currentDay ? {
                borderColor: `${dayColors[d.type]}40`,
                color: dayColors[d.type],
              } : undefined}
            >
              <span className="mr-2 text-base leading-none inline-block align-middle">{d.icon}</span> 
              <span className="align-middle">{d.day}</span>
            </button>
          ))}
        </div>

        {/* Main Day Card */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentDay}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col"
          >
            <div className="rounded-2xl border bg-card overflow-hidden shadow-xl flex-1 flex flex-col max-h-[700px]">
              {/* Day Header Bar */}
              <div 
                className="px-8 py-6 border-b flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${color}15, transparent)` }}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-card border shadow-inner flex items-center justify-center text-3xl">
                    {day.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{day.day} — {day.title}</h2>
                    <p className="text-sm text-muted-foreground font-medium">{day.subtitle}</p>
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Daily Earnings</span>
                  <span className="text-3xl font-bold tracking-tighter" style={{ color }}>
                    ₹{day.earnings.withFlowSecure.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 h-full">

                  {/* Left: Narrative */}
                  <div className="flex flex-col gap-6">
                    <p className="text-[15px] text-muted-foreground leading-relaxed font-medium bg-muted/20 p-5 rounded-2xl border border-border/50 italic">
                      "{day.narrative}"
                    </p>

                    <div className="space-y-4">
                      <DetailRow icon={<Clock className="w-4 h-4" />} label="Shift Details" value={day.details.shifts} />
                      <DetailRow
                        icon={day.type === 'danger' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        label="Environment" value={day.details.weather}
                      />
                      {day.details.aiAction && (
                        <DetailRow
                          icon={<Zap className="w-4 h-4" />}
                          label="AI Optimization"
                          value={day.details.aiAction}
                          highlight
                        />
                      )}
                      {day.details.triggerFired && (
                        <DetailRow
                          icon={<AlertTriangle className="w-4 h-4" />}
                          label="Parametric Trigger"
                          value={`Threshold breached. Automated claim payout: ₹${day.details.payoutAmount}`}
                          danger
                        />
                      )}
                    </div>
                  </div>

                  {/* Right: Data Visualization */}
                  <div className="flex flex-col gap-6 h-full justify-between">
                    {/* Comparison Card */}
                    <div className="bg-muted/30 rounded-2xl p-6 border border-border shadow-inner">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-5 block">
                         Net Earnings (Today)
                      </span>
                      <div className="flex gap-8 items-center">
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1 uppercase font-bold tracking-tight">With Protection</p>
                          <p className="text-3xl font-bold text-primary tracking-tighter">
                            ₹{day.earnings.withFlowSecure.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="w-px h-12 bg-border" />
                        <div className="flex-1 text-center text-muted-foreground/50 grayscale">
                          <p className="text-[10px] mb-1 uppercase font-bold tracking-tight">Standard Ride</p>
                          <p className="text-3xl font-bold tracking-tighter">
                            ₹{day.earnings.withoutFlowSecure.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      {day.earnings.withFlowSecure !== day.earnings.withoutFlowSecure && (
                        <div className="mt-5 pt-4 border-t text-center">
                          <span className="text-xs text-primary font-bold px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                            FlowSecure Value-Add: + ₹{(day.earnings.withFlowSecure - day.earnings.withoutFlowSecure).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-muted/10 rounded-2xl p-6 border shadow-sm">
                      <div className="flex justify-between items-center mb-5">
                         <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                           Cumulative Income (Mon → {day.day})
                         </span>
                         <span className="text-[10px] font-mono text-primary font-bold">LIVE TRACKER</span>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-primary font-bold tracking-tight">Protected Earnings</span>
                            <span className="text-foreground font-black font-mono text-sm leading-none pt-1">₹{cumulativeWith.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border shadow-inner">
                            <motion.div
                              animate={{ width: `${(cumulativeWith / totalWith) * 100}%` }}
                              className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                              transition={{ type: 'spring', damping: 20 }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-muted-foreground/60 font-medium tracking-tight whitespace-nowrap">Baseline (Unprotected)</span>
                            <span className="text-muted-foreground/60 font-bold font-mono text-sm leading-none pt-1">₹{cumulativeWithout.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border">
                            <motion.div
                              animate={{ width: `${(cumulativeWithout / totalWith) * 100}%` }}
                              className="bg-muted-foreground/20 h-full rounded-full"
                              transition={{ type: 'spring', damping: 20 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Final Sunday Summary */}
                    {day.type === 'summary' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-primary/10 to-transparent rounded-2xl p-6 border border-primary/30 shadow-lg shadow-primary/5 h-full min-h-[220px] flex flex-col justify-center"
                      >
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                          </div>
                          <span className="font-bold text-foreground text-base tracking-tight leading-none pt-1">Weekly Settlement Summary</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">FlowSecure Total</span>
                            <AnimatedCounter value={totalWith} className="text-3xl font-black text-primary tracking-tighter" prefix="₹" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">Loss (Baseline)</span>
                            <AnimatedCounter value={totalWithout} className="text-3xl font-bold text-muted-foreground/40 tracking-tighter" prefix="₹" />
                          </div>
                        </div>
                        <div className="pt-4 border-t border-primary/20 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Net Protection Benefit</span>
                          <span className="text-2xl font-black text-primary tracking-tighter">
                            + ₹{(totalWith - totalWithout).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center gap-6">
                          <div className="flex items-center gap-2 text-xs text-primary font-bold">
                            <TrendingUp className="w-4 h-4" />
                            <span>{Math.round(((totalWith - totalWithout) / totalWithout) * 100)}% ROI</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>Premium: ₹86/week</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between bg-card border px-6 h-16 rounded-2xl shadow-sm">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={currentDay === 0}
            className={cn(
              "rounded-xl font-bold text-xs h-10",
              currentDay === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-muted-foreground/10"
            )}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> PREV DAY
          </Button>

          {/* Progress dots */}
          <div className="flex gap-3 px-6 h-10 items-center bg-muted/30 rounded-xl border">
            {STORY_DAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => goToDay(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  i === currentDay ? "scale-150 ring-4 ring-primary/10" : "opacity-30 hover:opacity-60"
                )}
                style={{ backgroundColor: dayColors[d.type] }}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={next}
            disabled={currentDay === STORY_DAYS.length - 1}
            className={cn(
              "rounded-xl font-bold text-xs h-10",
              currentDay === STORY_DAYS.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-muted-foreground/10"
            )}
          >
            NEXT DAY <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DetailRow({ icon, label, value, highlight, danger }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-start gap-4 p-4 rounded-xl border group transition-all h-full",
      highlight && "bg-primary/5 border-primary/20",
      danger && "bg-destructive/5 border-destructive/20",
      !highlight && !danger && "bg-card border-border hover:bg-muted/20",
    )}>
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
        highlight ? "bg-primary/10 border-primary/30 text-primary" : danger ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted border-border text-muted-foreground",
      )}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 justify-center h-full">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold leading-none mb-1">{label}</span>
        <span className={cn(
          "text-xs leading-relaxed font-bold",
          highlight ? "text-primary" : danger ? "text-destructive" : "text-foreground"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}
