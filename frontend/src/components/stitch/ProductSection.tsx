import { motion } from 'framer-motion';
import { Umbrella, Zap } from 'lucide-react';

export function ProductSection() {
  return (
    <section id="features" className="py-32 px-6 bg-white overflow-hidden">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-40">
        
        {/* Section 1: Weather the storm */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24"
        >
          {/* Text Left */}
          <div className="flex-1 space-y-6 w-full lg:max-w-lg">
            <h3 className="text-5xl md:text-[3.5rem] font-extrabold tracking-tight text-[#1D1D1F] leading-[1.1]">
              Weather the storm.<br/>Literally.
            </h3>
            <p className="text-xl text-[#86868B] font-medium leading-relaxed">
              We monitor rainfall, AQI, and extreme heat in real-time. If conditions make delivering unsafe or impossible, your trusted payout arrives automatically.
            </p>
          </div>

          {/* Visual Right */}
          <div className="flex-1 w-full bg-[#FAFAFC] h-[550px] rounded-[3rem] flex items-center justify-center relative">
              <Umbrella className="w-96 h-96 text-[#1D1D1F]/[0.03] absolute -bottom-16 opacity-50 pointer-events-none" />
              
              {/* Phone Mockup */}
              <div className="w-[280px] h-[560px] bg-[#1a1a1a] rounded-[3rem] border-[10px] border-[#1D1D1F] p-4 relative shadow-2xl flex flex-col z-10 translate-x-16 lg:translate-x-24">
                {/* Dynamic Island */}
                <div className="w-24 h-7 bg-black rounded-full absolute top-1 left-1/2 -translate-x-1/2 z-20"></div>
                {/* Phone Screen */}
                <div className="w-full h-full bg-gradient-to-br from-[#1C1C1E] to-black rounded-[2.2rem] overflow-hidden relative shadow-inner">
                   <div className="absolute inset-0 bg-[#0071E3]/20 opacity-30 mix-blend-overlay"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-64 h-64 bg-white/5 blur-[80px] rounded-full"></div>
                   </div>
                </div>
              </div>

              {/* Floating Cards Overlapping Phone */}
              <div className="absolute right-1/2 translate-x-24 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-1 w-[400px]">
                 
                 {/* Back Card */}
                 <motion.div 
                   initial={{ opacity: 0, x: -30 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   transition={{ duration: 0.6, delay: 0.5 }}
                   className="bg-white/95 backdrop-blur-2xl border border-white p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] scale-90 translate-x-12 opacity-70"
                 >
                   <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest mb-1">Trigger Detected</p>
                   <p className="text-xl font-extrabold text-[#1D1D1F] flex items-center gap-2">
                     Extreme Heatwave ☀️
                   </p>
                   <div className="mt-2 text-xs text-[#0071E3] font-bold flex items-center gap-1">
                     <Zap className="w-3.5 h-3.5" /> Initiating Payout
                   </div>
                 </motion.div>

                 {/* Middle Card */}
                 <motion.div 
                   initial={{ opacity: 0, x: -30 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   transition={{ duration: 0.6, delay: 0.3 }}
                   className="bg-white/95 backdrop-blur-2xl border border-white p-5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] scale-95 origin-right translate-x-6 z-10"
                 >
                   <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest mb-1">Trigger Detected</p>
                   <p className="text-xl font-extrabold text-[#1D1D1F] flex items-center gap-2">
                     Heavy Rainfall 🌧️
                   </p>
                   <div className="mt-2 text-xs text-[#0071E3] font-bold flex items-center gap-1">
                     <Zap className="w-3.5 h-3.5" /> Initiating Payout
                   </div>
                 </motion.div>

                 {/* Front Notification Card */}
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   whileInView={{ opacity: 1, scale: 1, y: 0 }}
                   transition={{ duration: 0.6, delay: 0.7 }}
                   className="bg-[#EFEFF4]/90 backdrop-blur-2xl border border-white/50 p-4 rounded-[1.25rem] shadow-[0_20px_40px_rgba(0,0,0,0.12)] w-72 z-40 self-end -mr-16 mt-4"
                 >
                   <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">F</div>
                     <div>
                       <p className="text-[13px] font-bold text-[#1D1D1F] mb-0.5">Funds added to your wallet.</p>
                       <p className="text-[13px] text-[#555555] leading-tight font-medium">It's too dangerous to ride right now—stay safe, your earnings are covered.</p>
                     </div>
                   </div>
                 </motion.div>

              </div>
          </div>
        </motion.div>

        {/* Section 2: No paperwork */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col-reverse lg:flex-row items-center gap-16 lg:gap-24"
        >
          {/* Visual Left */}
          <div className="flex-1 w-full bg-white h-[500px] rounded-[3rem] border border-[#F0F0F2] flex items-center justify-center relative shadow-[0_20px_50px_rgba(0,0,0,0.03)] p-6 md:p-8">
            <div className="w-full h-full rounded-[2rem] border-2 border-dashed border-[#D2D2D7] relative flex flex-col items-center justify-center bg-white shadow-sm overflow-hidden">
                <motion.img 
                  src="/images/folder.png" 
                  alt="Glass Folder" 
                  className="w-56 h-56 object-contain mb-6 z-10 drop-shadow-xl mix-blend-multiply contrast-125 brightness-110"
                  initial={{ y: 0 }}
                  animate={{ y: [-8, 8, -8] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                />
                <h4 className="text-[2rem] font-bold text-[#1D1D1F] tracking-tight z-10">Claims Queue: 0</h4>
                
                {/* Soft blue glow backdrop */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#0071E3]/15 blur-[100px] rounded-full pointer-events-none" />
            </div>
          </div>

          {/* Text Right */}
          <div className="flex-1 space-y-6 w-full lg:max-w-lg">
            <h3 className="text-5xl md:text-[3.5rem] font-extrabold tracking-tight text-[#1D1D1F] leading-[1.1]">
              No paperwork.<br/>Just peace of mind.
            </h3>
            <p className="text-xl text-[#86868B] font-medium leading-relaxed">
              Parametric models mean no claims adjusters and no waiting. The truth is in the data. You get paid the moment the threshold is breached.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
