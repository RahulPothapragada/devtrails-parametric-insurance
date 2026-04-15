import { motion } from 'framer-motion';

export function SecuritySection() {
  return (
    <section id="security" className="py-48 px-6 bg-white flex items-center justify-center overflow-hidden">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "circOut" }}
        viewport={{ once: true, margin: "-10%" }}
        className="text-center"
      >
        <h2 className="text-[50px] md:text-[100px] font-bold tracking-tighter leading-none text-[#1D1D1F] mb-6">
          Zero claims.<br />
          <span className="bg-gradient-to-b from-[#70B1FF] to-[#0071E3] bg-clip-text text-transparent">
            Instant payouts.
          </span>
        </h2>
        <p className="text-2xl md:text-4xl font-semibold tracking-tight text-[#86868B] max-w-3xl mx-auto leading-snug">
          When rain stops your ride, FlowSecure pays you — <br /> automatically, before you even get home.
        </p>
      </motion.div>
    </section>
  );
}
