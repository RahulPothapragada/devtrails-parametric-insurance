import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, Banknote, BrainCircuit, ArrowRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const FLOW_STEPS = [
  {
    id: '01',
    title: 'Dynamic Risk Engine',
    description: 'Our AI analyzes millions of data points across cities, including historical weather patterns, traffic density, and accident hotspots to calculate a baseline risk score for every zone.',
    icon: BrainCircuit,
    color: '#0071E3',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    id: '02',
    title: 'Personalized Premium',
    description: 'Based on the gig worker\'s primary zone and the season, a personalized, ultra-low weekly premium is generated. No hidden fees or complex underwriting—just clear, upfront pricing.',
    icon: ShieldCheck,
    color: '#10a37f',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    id: '03',
    title: 'Parametric Triggers',
    description: 'Coverage relies on objective data. Real-time API feeds (IMD, OpenWeather, Traffic sensors) continuously monitor for extreme events matching the policy threshold.',
    icon: Zap,
    color: '#f59e0b',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    id: '04',
    title: 'Instant Payout Execution',
    description: 'The moment a trigger condition is met during a rider\'s shift, our smart contracts instantly process the claim and disburse funds directly via UPI. Zero claims filed.',
    icon: Banknote,
    color: '#8b5cf6',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  }
];

export function PricingModelFlow() {
  const [shiftHours, setShiftHours] = React.useState(8);
  const [zoneTier, setZoneTier] = React.useState('Medium');

  const baseRate = 15;
  const shiftMult = shiftHours === 4 ? 1 : shiftHours === 8 ? 1.5 : 2;
  const zoneMult = zoneTier === 'Low' ? 1.2 : zoneTier === 'Medium' ? 1.8 : 2.5;
  const totalPremium = Math.round(baseRate * shiftMult * zoneMult);
  const maxPayout = totalPremium * 15;

  return (
    <section id="pricing-model-flow" className="bg-[#F5F5F7] pb-24 px-6 pt-10">
      <div className="max-w-[1024px] mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/50 text-[#0071E3] text-sm font-semibold tracking-wide mb-6">
          <Activity className="w-4 h-4" />
          <span>Transparent Pricing Model</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mb-6 leading-tight">
          Fairness built into <br className="hidden md:block" />
          <span className="bg-gradient-to-r from-[#0071E3] to-[#70B1FF] bg-clip-text text-transparent">
            every micro-policy.
          </span>
        </h2>
        <p className="text-xl text-[#86868B] font-medium max-w-2xl mx-auto leading-relaxed">
          We've completely re-engineered insurance pricing. No opaque risk pools. Just hyper-localized, data-driven premiums that make sense for gig workers.
        </p>
      </div>

      <div className="px-3 max-w-6xl mx-auto pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FLOW_STEPS.map((step, idx) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={cn(
                "relative flex flex-col p-8 bg-white rounded-3xl shadow-sm border border-[#E5E5EA] overflow-hidden group hover:shadow-md transition-shadow",
                "h-full"
              )}
            >
              <div className="text-[100px] font-bold text-gray-50 absolute -right-4 -top-8 select-none z-0 transition-transform group-hover:scale-105">
                {step.id}
              </div>
              
              <div className="relative z-10 flex-1">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border", step.bg, step.border)}>
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
                </div>
                
                <h3 className="text-xl font-bold text-[#1D1D1F] mb-3 tracking-tight">
                  {step.title}
                </h3>
                
                <p className="text-[#86868B] leading-relaxed font-medium text-sm">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="max-w-[1024px] mx-auto bg-[#1D1D1F] rounded-[2.5rem] overflow-hidden p-10 md:p-14 text-white relative shadow-2xl flex flex-col md:flex-row gap-10 items-center"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 bg-[#0071E3] blur-[120px] rounded-[100%] opacity-20 pointer-events-none" />
        
        <div className="flex-1 relative z-10 text-left">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            See the math in action.
          </h2>
          <p className="text-[#94A3B8] text-lg mb-8 leading-relaxed font-medium">
            Adjust the parameters below to see how our dynamic engine calculates a fair, transparent premium based on actual risk factors.
          </p>
          
          {/* Calculator Controls */}
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-3 text-white/80 uppercase tracking-wider">Shift Duration</p>
              <div className="flex gap-2">
                {[4, 8, 12].map(hrs => (
                  <button 
                    key={hrs}
                    onClick={() => setShiftHours(hrs)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-1",
                      shiftHours === hrs ? "bg-[#0071E3] text-white" : "bg-white/10 hover:bg-white/20 text-[#94A3B8]"
                    )}
                  >
                    {hrs} Hours
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3 text-white/80 uppercase tracking-wider">Zone Risk Tier</p>
              <div className="flex gap-2">
                {['Low', 'Medium', 'High'].map(tier => (
                  <button 
                    key={tier}
                    onClick={() => setZoneTier(tier)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-1",
                      zoneTier === tier ? "bg-[#0071E3] text-white" : "bg-white/10 hover:bg-white/20 text-[#94A3B8]"
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Output */}
        <div className="flex-[0.8] relative z-10 bg-white/5 border border-white/10 rounded-3xl p-8 w-full">
          <div className="flex justify-between items-end mb-6 pb-6 border-b border-white/10">
            <div>
              <p className="text-sm text-[#94A3B8] mb-1">Calculated Premium</p>
              <div className="flex items-end gap-1">
                <span className="text-5xl font-bold text-white">₹{totalPremium}</span>
                <span className="text-[#94A3B8] text-sm mb-1.5">/ week</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Base Rate</span>
              <span className="font-semibold">₹15</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Shift Multiplier ({shiftHours}h)</span>
              <span className="font-semibold">x {shiftMult}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Zone Risk ({zoneTier})</span>
              <span className="font-semibold">x {zoneMult}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">Max Coverage Payout</span>
              <span className="font-bold text-emerald-400 text-xl">₹{maxPayout}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
