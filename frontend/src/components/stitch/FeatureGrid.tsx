import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Lock, BarChart3, Umbrella, Clock } from 'lucide-react';

export function FeatureGrid() {
  const features = [
    { icon: ShieldCheck, title: "Guaranteed Cover", desc: "Transparent, pre-agreed payouts based on explicit conditions." },
    { icon: Zap, title: "Instant Transfer", desc: "Direct to your UPI securely the moment data triggers." },
    { icon: Lock, title: "Bank-Grade Security", desc: "Your financial data and tracking is fully encrypted." },
    { icon: BarChart3, title: "Smart Adjustments", desc: "Premiums dynamically adjust to your distinct risk profiles." },
    { icon: Umbrella, title: "6 Weather Triggers", desc: "Covering heat, rain, AQI, and systemic disruptions." },
    { icon: Clock, title: "24/7 Monitoring", desc: "Algorithms working round the clock to protect you." }
  ];

  return (
    <section className="py-24 bg-[#F5F5F7]">
      <div className="max-w-[1024px] mx-auto px-6">
        <motion.h2 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold text-center tracking-tight mb-20 text-[#1D1D1F]"
        >
          Designed to protect. <br /> In every sense.
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#E5E5EA]"
            >
              <f.icon className="w-8 h-8 text-[#0071E3] mb-5" />
              <h4 className="text-xl font-semibold tracking-tight mb-2 text-[#1D1D1F]">{f.title}</h4>
              <p className="text-[#86868B] leading-relaxed text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
