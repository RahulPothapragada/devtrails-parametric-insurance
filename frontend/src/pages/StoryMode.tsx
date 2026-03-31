import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Clock, CloudRain, 
  ShieldCheck, Zap, TrendingUp, IndianRupee,
  Play, Sun, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import { STORY_DAYS, type StoryDay } from '../data/simulationData';
import AnimatedCounter from '../components/ui/AnimatedCounter';

const dayColors: Record<string, string> = {
  normal:   '#10a37f',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  recovery: '#0ea5e9',
  summary:  '#a855f7',
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
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pt-6 md:pt-10 min-h-[calc(100vh-4rem)]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-6 pb-12 h-full"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-white/90">
              Ravi's Week
            </h1>
            <p className="text-gray-400 text-sm font-medium">
              Follow a Zepto rider through 7 days of Predict → Optimize → Protect
            </p>
          </div>
          <button
            onClick={startAutoPlay}
            disabled={isAutoPlaying}
            className={clsx(
              "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all",
              isAutoPlaying
                ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                : "bg-[#10a37f] hover:bg-[#0d8b6b] text-white active:scale-95"
            )}
          >
            <Play className="w-4 h-4" /> {isAutoPlaying ? 'Playing...' : 'Auto-Play Demo'}
          </button>
        </div>

        {/* Day Selector Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
          {STORY_DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => goToDay(i)}
              className={clsx(
                "shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all border",
                i === currentDay
                  ? "text-white shadow-lg"
                  : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10"
              )}
              style={i === currentDay ? {
                backgroundColor: `${dayColors[d.type]}20`,
                borderColor: `${dayColors[d.type]}40`,
                color: dayColors[d.type],
              } : undefined}
            >
              <span className="mr-1.5">{d.icon}</span> {d.day}
            </button>
          ))}
        </div>

        {/* Main Day Card */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentDay}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1"
          >
            <div className="glass-panel p-0 overflow-hidden">
              {/* Day Header Bar */}
              <div 
                className="px-6 py-4 border-b border-white/5 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{day.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">{day.day} — {day.title}</h2>
                    <p className="text-sm text-gray-400">{day.subtitle}</p>
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Day Earnings</span>
                  <span className="text-2xl font-bold tracking-tighter" style={{ color }}>
                    ₹{day.earnings.withFlowSecure.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Left: Narrative */}
                  <div className="flex flex-col gap-5">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {day.narrative}
                    </p>

                    {/* Details */}
                    <div className="space-y-3">
                      <DetailRow icon={<Clock className="w-4 h-4" />} label="Shift" value={day.details.shifts} />
                      <DetailRow
                        icon={day.type === 'danger' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        label="Weather" value={day.details.weather}
                      />
                      {day.details.aiAction && (
                        <DetailRow
                          icon={<Zap className="w-4 h-4" />}
                          label="AI Action"
                          value={day.details.aiAction}
                          highlight
                        />
                      )}
                      {day.details.triggerFired && (
                        <DetailRow
                          icon={<AlertTriangle className="w-4 h-4" />}
                          label="Trigger"
                          value={`Parametric trigger fired. Auto-payout: ₹${day.details.payoutAmount}`}
                          danger
                        />
                      )}
                    </div>
                  </div>

                  {/* Right: Comparison + Cumulative */}
                  <div className="flex flex-col gap-5">
                    {/* Daily comparison */}
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3 block">
                        Daily Comparison
                      </span>
                      <div className="flex gap-4">
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-gray-500 mb-1 uppercase">With FlowSecure</p>
                          <p className="text-2xl font-bold text-[#10a37f]">
                            ₹{day.earnings.withFlowSecure.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="w-px bg-white/10" />
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-gray-500 mb-1 uppercase">Without</p>
                          <p className="text-2xl font-bold text-gray-500">
                            ₹{day.earnings.withoutFlowSecure.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      {day.earnings.withFlowSecure !== day.earnings.withoutFlowSecure && (
                        <div className="mt-3 pt-3 border-t border-white/5 text-center">
                          <span className="text-xs text-[#10a37f] font-semibold">
                            FlowSecure saved ₹{(day.earnings.withFlowSecure - day.earnings.withoutFlowSecure).toLocaleString('en-IN')} today
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Cumulative tracker */}
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3 block">
                        Running Total (Mon → {day.day})
                      </span>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#10a37f] font-medium">With FlowSecure</span>
                            <span className="text-[#10a37f] font-bold font-mono">₹{cumulativeWith.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-[#27272a] rounded-full h-2 overflow-hidden">
                            <motion.div
                              animate={{ width: `${(cumulativeWith / totalWith) * 100}%` }}
                              className="bg-[#10a37f] h-full rounded-full"
                              transition={{ type: 'spring', damping: 20 }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 font-medium">Without</span>
                            <span className="text-gray-500 font-bold font-mono">₹{cumulativeWithout.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-[#27272a] rounded-full h-2 overflow-hidden">
                            <motion.div
                              animate={{ width: `${(cumulativeWithout / totalWith) * 100}%` }}
                              className="bg-gray-600 h-full rounded-full"
                              transition={{ type: 'spring', damping: 20 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Week Summary (only on Sunday) */}
                    {day.type === 'summary' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-[#10a37f]/10 to-[#0ea5e9]/5 rounded-xl p-5 border border-[#10a37f]/20"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <ShieldCheck className="w-5 h-5 text-[#10a37f]" />
                          <span className="font-bold text-white text-sm">Week Summary</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase block mb-1">With FlowSecure</span>
                            <AnimatedCounter value={totalWith} className="text-3xl font-bold text-[#10a37f] tracking-tighter" prefix="₹" />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase block mb-1">Without</span>
                            <AnimatedCounter value={totalWithout} className="text-3xl font-bold text-gray-500 tracking-tighter" prefix="₹" />
                          </div>
                        </div>
                        <div className="pt-3 border-t border-[#10a37f]/20 flex items-center justify-between">
                          <span className="text-xs text-gray-400">Total protected earnings</span>
                          <span className="text-lg font-bold text-[#10a37f]">
                            + ₹{(totalWith - totalWithout).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-[#10a37f]">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="font-semibold">
                              {Math.round(((totalWith - totalWithout) / totalWithout) * 100)}% more income
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>Premium paid: ₹86/week</span>
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

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={currentDay === 0}
            className={clsx(
              "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all",
              currentDay === 0
                ? "text-gray-600 cursor-not-allowed"
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95"
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Previous Day
          </button>

          {/* Progress dots */}
          <div className="flex gap-2">
            {STORY_DAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => goToDay(i)}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  i === currentDay ? "scale-125" : "opacity-40 hover:opacity-70"
                )}
                style={{ backgroundColor: dayColors[d.type] }}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={currentDay === STORY_DAYS.length - 1}
            className={clsx(
              "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all",
              currentDay === STORY_DAYS.length - 1
                ? "text-gray-600 cursor-not-allowed"
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95"
            )}
          >
            Next Day <ChevronRight className="w-4 h-4" />
          </button>
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
    <div className={clsx(
      "flex items-start gap-3 p-3 rounded-lg border",
      highlight && "bg-[#10a37f]/5 border-[#10a37f]/20",
      danger && "bg-[#ef4444]/5 border-[#ef4444]/20",
      !highlight && !danger && "bg-white/[0.02] border-white/5",
    )}>
      <div className={clsx(
        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
        highlight ? "bg-[#10a37f]/10 text-[#10a37f]" : danger ? "bg-[#ef4444]/10 text-[#ef4444]" : "bg-white/5 text-gray-400",
      )}>
        {icon}
      </div>
      <div>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">{label}</span>
        <span className={clsx(
          "text-xs leading-relaxed",
          highlight ? "text-[#10a37f]" : danger ? "text-[#ef4444]" : "text-gray-300"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}
