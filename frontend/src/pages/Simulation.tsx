import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Zap, ChevronRight } from 'lucide-react';
import { SCENARIOS } from '../data/simulationData';
import { cn } from '@/lib/utils';

const weatherHints: Record<string, string> = {
  rain:     'Animated rainfall overlay · dark store dispatch suspended',
  heatwave: 'Heat shimmer overlay · IMD red alert active',
  bandh:    'City lockdown overlay · all 12 dark stores halted',
  attack:   'Threat pulse overlay · coordinated GPS spoofing ring',
};

const weatherGlow: Record<string, string> = {
  rain:     'hover:shadow-blue-500/20',
  heatwave: 'hover:shadow-orange-500/20',
  bandh:    'hover:shadow-red-500/20',
  attack:   'hover:shadow-red-800/30',
};

export default function Simulation() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-10 pb-16">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-8 md:pt-14"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground font-mono mb-6"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          LIVE SIMULATION ENGINE · 4 SCENARIOS LOADED
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 text-foreground">
          Trigger a{' '}
          <span className="text-primary underline underline-offset-8 decoration-primary/40">
            disruption.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Pick a real-world scenario. Watch FlowSecure's AI pipeline respond — from
          weather detection through 9-wall fraud analysis to instant UPI payout.
        </p>
      </motion.div>

      {/* ── How it works strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex items-center justify-center gap-2 flex-wrap text-xs text-muted-foreground font-mono"
      >
        {['Select scenario', 'Map flies to city', 'Weather overlay activates', '9-wall analysis runs', 'Payouts execute'].map((step, i, arr) => (
          <span key={step} className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-muted border border-border">{step}</span>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3 opacity-40" />}
          </span>
        ))}
      </motion.div>

      {/* ── Scenario Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {SCENARIOS.map((scenario, i) => (
          <motion.button
            key={scenario.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            onClick={() => navigate('/graph', { state: { scenario } })}
            className={cn(
              'group relative p-8 rounded-2xl border text-left transition-all duration-300 cursor-pointer overflow-hidden',
              'bg-card hover:bg-accent/20 shadow-sm hover:shadow-2xl',
              'hover:scale-[1.025] active:scale-[0.98]',
              'hover:border-primary/40',
              weatherGlow[scenario.weatherType],
            )}
          >
            {/* Background gradient blob */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br',
                scenario.gradient,
              )}
            />

            {/* Weather particle hint (CSS class applied to a thin top bar) */}
            <div
              className={cn(
                'absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                scenario.weatherType === 'rain'     && 'bg-blue-400',
                scenario.weatherType === 'heatwave' && 'bg-orange-400',
                scenario.weatherType === 'bandh'    && 'bg-red-400',
                scenario.weatherType === 'attack'   && 'bg-red-700',
              )}
            />

            <div className="relative z-10">
              {/* Icon + arrow */}
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-3xl shadow-inner border group-hover:scale-110 transition-transform duration-300">
                  {scenario.icon}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Launch</span>
                  <Play className="w-5 h-5 text-primary fill-primary" />
                </div>
              </div>

              {/* Title + subtitle */}
              <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-200">
                {scenario.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-2">
                {scenario.subtitle}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/70 border border-border px-3 py-1.5 rounded-lg">
                  <Zap className="w-3 h-3" />
                  {scenario.totalClaims} Claims
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/70 border border-border px-3 py-1.5 rounded-lg">
                  {scenario.location}
                </span>
              </div>

              {/* Weather overlay hint */}
              <p className="mt-4 text-[10px] text-muted-foreground/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {weatherHints[scenario.weatherType]}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
