import { motion } from 'framer-motion';

export default function Landing() {
  return (
    <div className="min-h-screen relative w-full">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-[#10a37f]/20 blur-[120px] rounded-[100%] pointer-events-none" />

      <section className="relative w-full max-w-7xl mx-auto px-6 pt-32 pb-24 flex flex-col items-center text-center z-10">


        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl md:text-8xl font-bold tracking-tighter mb-6"
        >
          Protection that starts<br />
          <span className="text-gradient-primary">before the loss.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl md:text-2xl text-gray-400 max-w-2xl font-light mb-12"
        >
          The AI-powered parametric safety net designed to protect quick-commerce workers from external disruptions.
        </motion.p>
      </section>
    </div>
  );
}
