import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


export type WeatherType = 'NORMAL' | 'RAIN' | 'HEAT' | 'COLD' | 'BANDH';

export default function WeatherEffects({ type }: { type: WeatherType }) {
  const [lightning, setLightning] = useState(false);

  useEffect(() => {
    if (type !== 'RAIN') return;
    const interval = setInterval(() => {
      // Random lightning flash 10% chance every 2s
      if (Math.random() < 0.2) {
        setLightning(true);
        setTimeout(() => setLightning(false), 150);
        setTimeout(() => setLightning(true), 250);
        setTimeout(() => setLightning(false), 400);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [type]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <AnimatePresence>
        {type === 'RAIN' && (
          <motion.div
            key="rain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {/* Dark stormy overlay */}
            <div className="absolute inset-0 bg-blue-900/10 mix-blend-multiply" />
            
            {/* Lightning Flash */}
            {lightning && (
              <div className="absolute inset-0 bg-white/30 z-[1] transition-opacity duration-75" />
            )}
            
            {/* Animated Rain Drops (CSS via mapped divs) */}
            <div className="absolute inset-0 overflow-hidden opacity-40">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-[2px] h-[40px] bg-gradient-to-b from-transparent to-blue-200"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `-50px`,
                  }}
                  animate={{
                    y: ['0vh', '110vh'],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 0.8 + Math.random() * 0.4,
                    repeat: Infinity,
                    ease: "linear",
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {type === 'HEAT' && (
          <motion.div
            key="heat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[120vw] h-[60vh] bg-orange-600/30 blur-[150px] rounded-[100%]" />
            <div className="absolute inset-0 bg-yellow-900/10 mix-blend-overlay" />
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-orange-500/10" 
            />
          </motion.div>
        )}

        {type === 'COLD' && (
          <motion.div
            key="cold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {/* Frost edges */}
            <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(255,255,255,0.15)] bg-blue-500/5 backdrop-blur-[1px]" />
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-white/40 rounded-full blur-[1px]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-20px`,
                }}
                animate={{
                  y: ['0vh', '110vh'],
                  x: [`${Math.random() * 20 - 10}px`, `${Math.random() * 40 - 20}px`],
                  opacity: [0, 0.8, 0]
                }}
                transition={{
                  duration: 3 + Math.random() * 4,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 5,
                }}
              />
            ))}
          </motion.div>
        )}

        {type === 'BANDH' && (
          <motion.div
            key="bandh"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-black/60 grayscale backdrop-blur-[2px]" />
            <motion.div 
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 shadow-[inset_0_0_200px_rgba(239,68,68,1)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
