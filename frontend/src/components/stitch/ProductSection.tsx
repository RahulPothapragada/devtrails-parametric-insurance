import { motion } from 'framer-motion';
import { Umbrella, Clock, Zap } from 'lucide-react';

export function ProductSection() {
  return (
    <section id="features" className="py-32 px-6 bg-white overflow-hidden">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-32">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col md:flex-row items-center gap-16 md:gap-24"
        >
          <div className="flex-1 space-y-6">
            <h3 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">Weather the storm. <br/> Literally.</h3>
            <p className="text-xl text-[#86868B] font-medium leading-relaxed max-w-md">
              We monitor rainfall, AQI, and extreme heat in real-time. If conditions make delivering unsafe or impossible, your trusted payout arrives automatically.
            </p>
          </div>
          <div className="flex-1 w-full bg-[#F5F5F7] h-[400px] rounded-3xl flex items-center justify-center relative overflow-hidden">
              <Umbrella className="w-48 h-48 text-[#1D1D1F]/5 absolute -right-10 -bottom-10" />
              <div className="bg-white p-8 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
                <p className="text-sm text-[#86868B] font-semibold mb-2 uppercase">Trigger Detected</p>
                <p className="text-3xl font-bold text-[#1D1D1F]">Heavy Rainfall</p>
                <div className="mt-4 text-[#0071E3] font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Initiating Payout
                </div>
              </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-24"
        >
          <div className="flex-1 space-y-6">
            <h3 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">No paperwork. <br/> Just peace of mind.</h3>
            <p className="text-xl text-[#86868B] font-medium leading-relaxed max-w-md">
              Parametric models mean no claims adjusters and no waiting. The truth is in the data. You get paid the moment the threshold is breached.
            </p>
          </div>
          <div className="flex-1 w-full bg-[#FAFAFA] h-[400px] rounded-3xl border border-[#E5E5EA] flex flex-col items-center justify-center relative p-8">
              <div className="w-full h-full border border-dashed rounded-2xl border-[#D2D2D7] relative flex items-center justify-center bg-white shadow-sm">
                  <div className="bg-white px-6 py-4 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.08)] text-[#1D1D1F] font-semibold text-lg flex items-center gap-3">
                     <Clock className="w-6 h-6 text-[#0071E3]" /> Time to payout: 0 min
                  </div>
              </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
