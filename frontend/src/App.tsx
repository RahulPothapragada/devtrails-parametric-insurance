import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, GitBranch, BookOpen, ShieldAlert, ServerCrash } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';
import Landing from './pages/Landing';
import RiderDashboard from './pages/RiderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import FraudDefense from './pages/FraudDefense';
import Simulation from './pages/Simulation';
import FraudGraphPage from './pages/FraudGraphPage';
import StoryMode from './pages/StoryMode';
import HeroDemo from './pages/HeroDemo';
import ActuarialDashboard from './pages/ActuarialDashboard'; // [CORE PRESERVED]
import DataTimeline from './pages/DataTimeline';
import RiderAuth from './pages/RiderAuth';
import Payouts from './pages/Payouts';
import WeatherEffects, { type WeatherType } from './components/ui/WeatherEffects';

function Navbar({ currentEffect }: { currentEffect: WeatherType }) {
  const location = useLocation();

  return (
    <nav className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 border-b",
      "bg-background/80 backdrop-blur-xl border-border/50 shadow-sm"
    )}>
      <div className="max-w-[1400px] mx-auto px-3 lg:px-6 min-h-[4rem] py-2 flex flex-wrap items-center gap-y-2 gap-x-6">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">
            <span className="text-primary-foreground font-bold text-xl leading-none pt-0.5">F</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground hidden md:block">FLOWSECURE</span>
        </Link>
        
        {/* Unified Top Navigation Tabs */}
        <div className="flex gap-1 items-center flex-wrap flex-1">
          {[
            { to: '/simulate', icon: <Zap className="w-4 h-4" />, label: 'Simulate' },
            { to: '/story', icon: <BookOpen className="w-4 h-4" />, label: 'Story' },
            { to: '/graph', icon: <GitBranch className="w-4 h-4" />, label: 'Graph' },
            { to: '/fraud', icon: <ShieldAlert className="w-4 h-4" />, label: 'Defense' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-transparent",
                location.pathname === link.to
                  ? "text-primary bg-primary/10 border-primary/20 shadow-inner"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {link.icon}
              <span className="uppercase tracking-wider">{link.label}</span>
            </Link>
          ))}
          
          <div className="w-px h-4 bg-border mx-1 sm:mx-2" />
          
          <Link 
            to="/rider" 
            className={cn(
              "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-2 rounded-xl transition-all",
              location.pathname === '/rider' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Rider
          </Link>
          <Link 
            to="/payouts" 
            className={cn(
              "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-2 rounded-xl transition-all",
              location.pathname === '/payouts' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Payouts
          </Link>
          <Link 
            to="/admin" 
            className={cn(
              "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-2 rounded-xl transition-all",
              location.pathname === '/admin' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Admin
          </Link>
          <Link
            to="/actuarial"
            className={cn(
              "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-2 rounded-xl transition-all",
              location.pathname === '/actuarial' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Actuarial
          </Link>
          <Link
            to="/data"
            className={cn(
              "text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-2 rounded-xl transition-all",
              location.pathname === '/data' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Data
          </Link>
        </div>

        {/* Live Weather Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted/60 border border-border/50 rounded-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]"></span>
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Live Condition: <span className="text-foreground">{currentEffect}</span>
          </span>
        </div>
      </div>
    </nav>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/rider" element={<RiderDashboard />} />
        <Route path="/rider/auth" element={<RiderAuth />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/fraud" element={<FraudDefense />} />
        <Route path="/simulate" element={<Simulation />} />
        <Route path="/graph" element={<FraudGraphPage />} />
        <Route path="/story" element={<StoryMode />} />
        <Route path="/hero-demo" element={<HeroDemo />} />
        <Route path="/actuarial" element={<ActuarialDashboard />} />
        <Route path="/data" element={<DataTimeline />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const location = useLocation();
  const [weatherEffect, setWeatherEffect] = useState<WeatherType>('NORMAL');
  const [serverWaking, setServerWaking] = useState(false);
  const isLanding = location.pathname === '/' || location.pathname === '/hero-demo';
  const warmupDone = useRef(false);

  // Warm-up ping — fires immediately on app load so Render wakes before user clicks anything
  useEffect(() => {
    if (warmupDone.current) return;
    warmupDone.current = true;
    const t = setTimeout(() => setServerWaking(true), 2000); // show banner after 2s if still waiting
    fetch(`${API_BASE.replace('/api', '')}/health`, { method: 'GET' })
      .then(() => { clearTimeout(t); setServerWaking(false); })
      .catch(() => { clearTimeout(t); setServerWaking(false); });
  }, []);

  // Live OpenWeatherMap API Integration
  useEffect(() => {
    let active = true;
    async function fetchLiveWeather() {
      try {
        const owmKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Delhi,IN&appid=${owmKey}`);
        if (!res.ok) throw new Error(`Live API Offline or Unauthorized code ${res.status}`);

        const data = await res.json();
        if (!active) return;

        let detectedType: WeatherType = 'NORMAL';
        const main = (data.weather?.[0]?.main || '').toLowerCase();
        const tempC = (data.main?.temp || 290) - 273.15;

        if (main.includes('rain') || main.includes('drizzle') || main.includes('thunder')) {
          detectedType = 'RAIN';
        } else if (tempC > 40) {
          detectedType = 'HEAT';
        } else if (tempC < 10) {
          detectedType = 'COLD';
        }

        setWeatherEffect(detectedType);
      } catch (e) {
        console.warn('Weather Feed Disconnected. Running on internal NORMAL conditions.', e);
        if (active) setWeatherEffect('NORMAL');
      }
    }

    fetchLiveWeather();
    
    // Poll every 5 minutes to stay highly responsive to shifts
    const timer = setInterval(fetchLiveWeather, 300000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col relative selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Server cold-start banner */}
      <AnimatePresence>
        {serverWaking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 inset-x-0 z-[9999] bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center gap-2.5 py-2 text-xs font-bold text-amber-400">
              <ServerCrash className="w-3.5 h-3.5 animate-pulse" />
              <span>Backend waking up on Render free tier — data loads in ~20s on first visit</span>
              <span className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        {!isLanding && <Navbar currentEffect={weatherEffect} />}
        <main className={cn("flex-1 w-full h-full relative", !isLanding && "pt-16")}>
          <AnimatedRoutes />
        </main>
      </div>
      {!isLanding && <WeatherEffects type={weatherEffect} />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
