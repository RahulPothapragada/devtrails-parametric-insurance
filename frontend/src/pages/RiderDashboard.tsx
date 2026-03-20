import { motion } from 'framer-motion';
import { IndianRupee, CloudRain, Clock, ShieldCheck, ChevronRight } from 'lucide-react';
import AnimatedCounter from '../components/ui/AnimatedCounter';

export default function RiderDashboard() {
  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 w-full max-w-md mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 pt-4 pb-12"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white/90">Hello, Ravi</h1>
          <p className="text-gray-400 font-medium text-sm flex items-center justify-between">
            Dark Store #47, Delhi NCR
            <span className="flex items-center gap-1 text-[#10a37f] text-xs px-2 py-0.5 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/20">
              <ShieldCheck className="w-3 h-3" /> Protected
            </span>
          </p>
        </div>
        
        {/* Earnings Card */}
        <motion.div 
          className="glass-panel p-6 relative overflow-hidden group"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <IndianRupee className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 font-medium text-sm mb-1">Weekly Earnings & Claims</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-white/50">₹</span>
              <AnimatedCounter value={5060} className="text-5xl font-bold tracking-tighter" />
            </div>
            
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Delivery Earnings</span>
                <span className="font-medium">₹3,200</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">AI Shift Optimization</span>
                <span className="font-medium text-[#10a37f]">+ ₹1,480</span>
              </div>
              <div className="h-px w-full bg-white/10" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Parametric Claim Payout</span>
                <span className="font-medium text-[#0ea5e9]">+ ₹380</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* AI Optimize Recommendation */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest pl-1">Actions</h2>
          <motion.div 
            className="p-5 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex flex-col gap-4 relative overflow-hidden"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex gap-4 items-start relative z-10">
              <div className="w-10 h-10 rounded-full bg-[#ef4444]/20 flex items-center justify-center shrink-0">
                <CloudRain className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Heavy Rain Forecast</h3>
                <p className="text-xs text-gray-300 leading-relaxed text-balance">
                  Wednesday 2PM-8PM. Dark store dispatch likely to be paused. Expected loss: ₹620.
                </p>
              </div>
            </div>
            
            <div className="h-px bg-white/10 w-full relative z-10" />

            <div className="flex justify-between items-center relative z-10">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Recommended Shift</span>
                <div className="flex gap-2 items-center mt-1 text-sm text-[#10a37f] font-medium">
                  <Clock className="w-4 h-4" /> Wed, 7:00 AM - 1:00 PM
                </div>
              </div>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors border border-white/10 rounded-xl text-sm font-medium flex items-center gap-1">
                Accept <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>

      </motion.div>
    </div>
  );
}
