import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

export function HeroSection() {
  return (
    <section id="home" className="relative bg-[#F5F5F7] overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center text-center gap-6 pt-10 md:pt-12 mb-4">
            <p className="text-sm font-semibold tracking-widest text-[#86868B] uppercase">
              FlowSecure
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-[90px] font-bold tracking-tighter leading-[1.05] text-[#1D1D1F] max-w-4xl">
              Protection that starts{' '}
              <br className="hidden md:block" />
              <span className="bg-gradient-to-b from-[#70B1FF] to-[#0071E3] bg-clip-text text-transparent">
                before the loss.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-[#86868B] font-medium tracking-tight max-w-2xl mx-auto leading-snug">
              Automatic risk management for gig workers. <br /> Zero claims. Instant payouts.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mt-2">
              <Link
                to="/rider"
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-full px-8 py-3.5 font-semibold text-lg transition-transform hover:scale-105"
              >
                Get Started
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="group flex items-center gap-1 text-[#0071E3] text-lg font-semibold hover:underline"
              >
                Learn more{' '}
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        }
      >
        {/* Dashboard Card */}
        <div className="w-full h-full bg-[#0A0A0F] rounded-2xl md:rounded-[2rem] flex flex-col overflow-hidden relative border border-[#1C1C2E]">
          {/* Header bar */}
          <div className="flex justify-between items-center border-b border-[#1C1C2E] px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-[#0071E3] uppercase">Live</span>
            </div>
            <div className="text-xs font-semibold text-[#555577] uppercase tracking-widest">
              FlowSecure Platform
            </div>
            <div className="text-[10px] font-mono text-[#555577]">v1.0.0</div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center items-center text-center px-6 md:px-16 gap-8">
            <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-snug">
              AI-Powered Insurance{' '}
              <br />
              <span className="bg-gradient-to-r from-[#70B1FF] to-[#0071E3] bg-clip-text text-transparent">
                for Every Gig Rider.
              </span>
            </h3>
            <p className="text-lg md:text-xl text-[#8888AA] max-w-xl leading-relaxed font-medium">
              Real-time weather triggers. Instant UPI payouts. Zero paperwork. Zero waiting.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-6">
              {[
                { label: 'Riders Protected', value: '12,400+' },
                { label: 'Avg Payout Time',  value: '< 2 min' },
                { label: 'Fraud Blocked',    value: '99.1%'   },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-2">
                  <span className="text-3xl md:text-4xl font-bold text-white">{stat.value}</span>
                  <span className="text-[11px] md:text-xs text-[#555577] uppercase tracking-widest">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
