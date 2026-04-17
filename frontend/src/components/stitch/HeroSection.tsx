import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

export function HeroSection() {
  return (
    <section id="home" className="relative bg-[#F5F5F7] overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center text-center gap-6 pt-10 md:pt-12 mb-4">
            <h1 className="text-5xl md:text-7xl lg:text-[90px] font-bold tracking-tighter leading-[1.05] text-[#1D1D1F] max-w-4xl">
              Protection that starts{' '}
              <br className="hidden md:block" />
              <span className="bg-gradient-to-b from-[#70B1FF] to-[#0071E3] bg-clip-text text-transparent">
                before the loss.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-[#86868B] font-medium tracking-tight max-w-2xl mx-auto leading-snug">
              Secure your daily income against extreme weather and delays. <br className="hidden md:block" /> 
              Automatic monitoring, zero claims, and instant payouts.
            </p>

            {/* Mini Feature Highlights */}
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-2 mb-2 text-sm font-semibold text-[#86868B]">
              <span className="flex items-center gap-1.5"><span className="text-[#0071E3]">✓</span> AI-Driven Triggers</span>
              <span className="flex items-center gap-1.5"><span className="text-[#0071E3]">✓</span> Instant UPI Payouts</span>
              <span className="flex items-center gap-1.5"><span className="text-[#0071E3]">✓</span> Zero Paperwork</span>
            </div>


            
            {/* CTA Reinforcement Line */}
            <p className="text-sm font-medium text-[#86868B]">
              Takes 60 seconds to join • Premiums adapt to your shift
            </p>
          </div>
        }
      >
        {/* Dashboard Card */}
        <div className="w-full h-full bg-[#0A0A0F] rounded-2xl md:rounded-[2rem] flex flex-col overflow-hidden relative border border-[#1C1C2E] shadow-2xl">
          {/* Header bar */}
          <div className="flex justify-between items-center border-b border-[#1C1C2E] px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-[#0071E3] uppercase">Live</span>
            </div>
            <div className="text-xs font-semibold text-[#555577] uppercase tracking-widest">
              FlowSecure Overview
            </div>
            <div className="text-[10px] font-mono text-[#555577]">v1.0.0</div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col items-center px-6 md:px-12 py-12 gap-12 overflow-y-auto no-scrollbar">
            
            {/* Problem -> Solution Section */}
            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 text-left">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-[#1C1C2E]/30 p-8 rounded-[24px] border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-white/10"
              >
                <h4 className="text-xs tracking-widest text-[#FF453A] font-bold uppercase mb-4 text-center md:text-left">The Pain</h4>
                <h3 className="text-xl font-bold text-white mb-3">Lost income, unsafe conditions.</h3>
                <p className="text-[#8888AA] font-medium leading-relaxed">
                  Gig riders lose crucial daily earnings during extreme heat, floods, or severe traffic. Working through it is dangerous, but staying home means no pay.
                </p>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-gradient-to-br from-[#0071E3]/20 to-[#1C1C2E]/30 p-8 rounded-[24px] border border-[#0071E3]/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(0,113,227,0.15)] hover:border-[#0071E3]/50 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0071E3] blur-[80px] opacity-30 pointer-events-none" />
                <h4 className="text-xs tracking-widest text-[#0071E3] font-bold uppercase mb-4 text-center md:text-left">The Solution</h4>
                <h3 className="text-xl font-bold text-white mb-3">Automated financial safety net.</h3>
                <p className="text-[#8888AA] font-medium leading-relaxed">
                  FlowSecure continuously monitors live weather APIs. If unsafe thresholds are crossed during your shift, smart contracts instantly drop a payout into your UPI.
                </p>
              </motion.div>
            </div>

            {/* How It Works (3 simple steps) */}
            <div className="w-full max-w-4xl">
              <h3 className="text-2xl font-bold text-white mb-6 text-center md:text-left">How It Works</h3>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                {[
                  { step: '1', title: 'Connect Your Shift', desc: 'Log in, set your work zone, and lock in a micro-premium for the shift.' },
                  { step: '2', title: 'We Monitor Data', desc: 'Our AI tracks IMD weather, AQI, and traffic APIs in real-time.' },
                  { step: '3', title: 'Instant Payout', desc: 'If thresholds are hit, smart contracts trigger immediate UPI transfers.' },
                ].map((s, idx) => (
                  <motion.div 
                    key={s.step} 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: 0.5 + (idx * 0.15) }}
                    className="bg-[#0A0A0F] border border-[#1C1C2E] p-6 rounded-2xl relative transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,113,227,0.1)] hover:border-[#0071E3]/50 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0071E3]/20 text-[#0071E3] font-bold flex items-center justify-center mb-4 text-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-[#0071E3] group-hover:text-white">
                      {s.step}
                    </div>
                    <h4 className="text-base text-white font-semibold mb-2">{s.title}</h4>
                    <p className="text-[#555577] text-sm leading-relaxed">{s.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Trust Indicators / Stats Line */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 pt-10 mt-6 border-t border-[#1C1C2E]/50"
            >
              {[
                { label: 'Riders Protected', value: '12,400+' },
                { label: 'Avg Payout Time',  value: '< 2 min' },
                { label: 'Fraud Blocked',    value: '99.1%'   },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-2 px-6 group">
                  <span className="text-4xl font-bold text-white transition-transform duration-300 group-hover:scale-110">{stat.value}</span>
                  <span className="text-[11px] text-[#555577] uppercase tracking-widest">{stat.label}</span>
                </div>
              ))}
            </motion.div>

          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
