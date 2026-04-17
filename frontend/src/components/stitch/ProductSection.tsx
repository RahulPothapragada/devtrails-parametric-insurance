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
          <div className="flex-1 w-full bg-[#FAFAFC] h-[550px] rounded-[3rem] flex items-center justify-center relative shadow-[inset_0_2px_20px_rgba(0,0,0,0.01)] overflow-hidden">
              <Umbrella className="w-96 h-96 text-[#1D1D1F]/[0.03] absolute -bottom-16 opacity-50 pointer-events-none" />
              
              <div className="relative flex items-center justify-center translate-x-16 lg:translate-x-24 scale-90 md:scale-100">
                {/* Staggered Vertical Cards (Spilling left from phone) */}
                <div className="absolute top-[48%] -translate-y-1/2 right-[190px] flex flex-col items-end gap-3 w-[350px] z-20 pointer-events-none">
                     
                     {/* Back Card (Top) */}
                     <motion.div 
                       initial={{ opacity: 0, x: -20, scale: 0.9 }}
                       whileInView={{ opacity: 1, x: 0, scale: 0.9 }}
                       transition={{ duration: 0.5, delay: 0.5 }}
                       className="w-64 bg-white/80 backdrop-blur-xl border border-white/60 p-4 rounded-[18px] shadow-sm z-10 -mr-12"
                     >
                       <p className="text-[9px] text-[#86868B] font-bold uppercase tracking-widest mb-1 leading-none">Trigger Detected</p>
                       <p className="text-[17px] font-extrabold text-[#1D1D1F] flex items-center gap-1.5 leading-tight mb-2">
                         Extreme Heatwave ☀️
                       </p>
                       <div className="text-[11px] text-[#0071E3] font-bold flex items-center gap-1">
                         <Zap className="w-3.5 h-3.5" /> Initiating Payout
                       </div>
                     </motion.div>

                     {/* Middle Card */}
                     <motion.div 
                       initial={{ opacity: 0, x: -20, scale: 0.95 }}
                       whileInView={{ opacity: 1, x: 0, scale: 0.95 }}
                       transition={{ duration: 0.5, delay: 0.3 }}
                       className="w-64 bg-white/90 backdrop-blur-2xl border border-white/80 p-4 rounded-[18px] shadow-[0_10px_20px_rgba(0,0,0,0.05)] z-20 -mr-6 -mt-2"
                     >
                       <p className="text-[9px] text-[#86868B] font-bold uppercase tracking-widest mb-1 leading-none">Trigger Detected</p>
                       <p className="text-[17px] font-extrabold text-[#1D1D1F] flex items-center gap-1.5 leading-tight mb-2">
                         Severe AQI Drop 😷
                       </p>
                       <div className="text-[11px] text-[#0071E3] font-bold flex items-center gap-1">
                         <Zap className="w-3.5 h-3.5" /> Initiating Payout
                       </div>
                     </motion.div>

                     {/* Front Card (Bottom) */}
                     <motion.div 
                       initial={{ opacity: 0, x: -20, scale: 1 }}
                       whileInView={{ opacity: 1, x: 0, scale: 1 }}
                       transition={{ duration: 0.5, delay: 0.1 }}
                       className="w-64 bg-white backdrop-blur-3xl border border-white p-4 rounded-[18px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] z-30 -mt-2"
                     >
                       <p className="text-[9px] text-[#86868B] font-bold uppercase tracking-widest mb-1 leading-none">Trigger Detected</p>
                       <p className="text-[17px] font-extrabold text-[#1D1D1F] flex items-center gap-1.5 leading-tight mb-2">
                         Heavy Rainfall 🌧️
                       </p>
                       <div className="text-[11px] text-[#0071E3] font-bold flex items-center gap-1">
                         <Zap className="w-3.5 h-3.5" /> Initiating Payout
                       </div>
                     </motion.div>
                </div>

                {/* iPhone 17 Pro Max Mockup */}
                <div className="relative translate-x-12 z-10 scale-[0.95]" style={{ width: 282, height: 578 }}>
                  {/* Titanium outer frame */}
                  <div className="absolute inset-0 rounded-[3.6rem] shadow-[inset_0_4px_10px_rgba(255,255,255,0.5),0_30px_60px_-10px_rgba(0,0,0,0.3)]"
                    style={{ background: 'linear-gradient(145deg,#EFEFF1 0%,#D5D5D7 40%,#B8B8BA 60%,#ECECEC 100%)' }} />
                  {/* Inner dark edge */}
                  <div className="absolute rounded-[3.4rem] bg-[#111]" style={{ inset: 3 }} />
                  {/* Screen glass */}
                  <div className="absolute rounded-[3.1rem] overflow-hidden bg-black" style={{ inset: 5 }}>
                    {/* Dynamic Island */}
                    <div className="absolute top-[14px] left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
                      style={{ width: 108, height: 32, background: '#000', borderRadius: 20 }}>
                      {/* Selfie camera dot */}
                      <div className="w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#333] ml-6 shadow-inner" />
                    </div>
                    {/* Live Wallpaper representation */}
                    <div className="w-full h-full relative">
                      <div className="absolute inset-0" style={{
                         background: `radial-gradient(100% 120% at 85% 10%, rgba(160,175,195,0.95) 0%, rgba(100,115,135,0.7) 30%, rgba(40,45,55,1) 100%)`
                      }} />
                      <div className="absolute w-[300px] h-[300px] bg-white opacity-[0.03] blur-[50px] top-[10%] left-[20%] rounded-full mix-blend-overlay" />
                      
                      {/* Lock Screen UI indicators */}
                      <div className="absolute bottom-6 flex w-full justify-between px-10 items-end">
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/5 backdrop-blur-md">
                              <Zap className="w-5 h-5 text-white/90" />
                          </div>
                          <div className="w-[30%] h-1.5 bg-white/30 rounded-full mx-auto" style={{ marginBottom: -10 }} />
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/5 backdrop-blur-md">
                              <Umbrella className="w-5 h-5 text-white/90" />
                          </div>
                      </div>
                    </div>
                  </div>
                  {/* Side buttons */}
                  <div className="absolute rounded-r bg-gradient-to-b from-[#C8C8CA] to-[#A8A8AA]" style={{ left: -3, top: 128, width: 3, height: 32 }} />
                  <div className="absolute rounded-r bg-gradient-to-b from-[#C8C8CA] to-[#A8A8AA]" style={{ left: -3, top: 172, width: 3, height: 32 }} />
                  <div className="absolute rounded-l bg-gradient-to-b from-[#C8C8CA] to-[#A8A8AA]" style={{ right: -3, top: 155, width: 3, height: 56 }} />
                  
                  {/* Notification Card Crossing over the phone */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="absolute top-[45%] left-1/2 -translate-y-1/2 -translate-x-[65%] w-[330px] z-[60]"
                  >
                    <div className="bg-[#EFEFF4]/95 backdrop-blur-3xl border border-white/80 p-[15px] rounded-[22px] shadow-[0_25px_50px_rgba(0,0,0,0.15),0_5px_15px_rgba(0,0,0,0.05)]">
                      <div className="flex gap-[14px]">
                        <div className="w-9 h-9 rounded-[10px] bg-black text-white flex items-center justify-center text-lg font-black shrink-0 shadow-md">
                           <span style={{ fontFamily: 'monospace' }}>F</span>
                        </div>
                        <div className="pt-0.5">
                          <div className="flex justify-between items-center mb-0.5 w-full pr-1">
                             <p className="text-[14px] font-[800] text-[#1D1D1F] tracking-tight">Funds added to your wallet.</p>
                             <span className="text-[10px] uppercase font-bold text-[#8E8E93] ml-auto pb-0.5">Now</span>
                          </div>
                          <p className="text-[13px] text-[#3A3A3C] leading-[1.3] font-medium pr-1">It's too dangerous to ride right now—stay safe, your earnings are covered.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
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
            <div className="w-full h-full rounded-[2rem] border-2 border-dashed border-[#D2D2D7] relative flex flex-col items-center justify-center bg-[#FAFAFC] shadow-sm overflow-hidden">
                
                {/* Pure CSS Working 3D Folder Element */}
                <div className="relative w-40 h-32 mb-10 flex justify-center z-10">
                  {/* Back folder flap */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#cce0ff] to-[#7aaaff] rounded-[8px] opacity-90 shadow-md" 
                       style={{ clipPath: 'polygon(0 15%, 35% 15%, 45% 0, 100% 0, 100% 100%, 0 100%)', border: '1px solid rgba(255,255,255,0.8)' }} />
                  
                  {/* Papers inside */}
                  <div className="absolute left-[8%] right-[8%] top-[10%] bottom-[20%] bg-white/95 backdrop-blur-md rounded shadow-sm border border-white rotate-2 origin-bottom-left" />
                  <div className="absolute left-[12%] right-[12%] top-[15%] bottom-[15%] bg-white backdrop-blur-md rounded shadow-sm border border-white -rotate-3 origin-bottom-right" />
                  
                  {/* Front frosted glass flap */}
                  <div className="absolute bottom-0 left-[-4%] right-[-8%] h-[78%] bg-gradient-to-tr from-[#ffffff95] to-[#ffffff60] backdrop-blur-[12px] rounded-[6px] border border-white/80 shadow-[0_-2px_12px_rgba(0,113,227,0.1),0_15px_30px_rgba(0,0,0,0.08)] origin-bottom"
                       style={{ transform: 'perspective(400px) rotateX(12deg) rotateY(-8deg)' }}>
                     {/* Diagonal glass glare */}
                     <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent w-[150%] -translate-x-[20%]" />
                  </div>
                </div>

                <h4 className="text-[2rem] font-bold text-[#1D1D1F] tracking-tight z-10 mix-blend-color-burn">Claims Queue: 0</h4>
                
                {/* Soft blue glow backdrop */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-64 h-64 bg-[#0071E3]/20 blur-[70px] rounded-full pointer-events-none" />
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
