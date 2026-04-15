import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Zap, GitBranch, BookOpen, ShieldAlert } from 'lucide-react';
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
import Payouts from './pages/Payouts';
import WeatherEffects, { type WeatherType } from './components/ui/WeatherEffects';

function Navbar({ currentEffect }: { currentEffect: WeatherType }) {
  const location = useLocation();
  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <nav 
      className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-[#E5E5EA]"
      style={{ fontFamily: appleFontFamily }}
    >
      <div className="w-full max-w-[1400px] mx-auto px-4 min-h-[3rem] py-2 flex flex-wrap items-center justify-between text-xs font-semibold tracking-wide text-[#1D1D1F]">
        <Link to="/" className="flex items-center gap-2 group shrink-0 hover:text-[#0071E3] transition-colors">
          <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-white font-bold text-lg leading-none">F</span>
          </div>
          <span className="text-sm font-bold tracking-tight hidden md:block">FLOWSECURE</span>
        </Link>
        
        {/* Unified Top Navigation Tabs */}
        <div className="flex gap-4 items-center flex-wrap">
          {[
            { to: '/simulate', label: 'Simulate' },
            { to: '/story', label: 'Story' },
            { to: '/graph', label: 'Graph' },
            { to: '/fraud', label: 'Defense' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "opacity-70 hover:opacity-100 transition-opacity flex items-center",
                location.pathname === link.to ? "text-[#0071E3] opacity-100" : ""
              )}
            >
              {link.label}
            </Link>
          ))}
          
          <div className="w-px h-4 bg-[#E5E5EA] mx-2" />
          
          {[
            { to: '/rider', label: 'Rider Dashboard' },
            { to: '/payouts', label: 'Payouts' },
            { to: '/admin', label: 'Admin' },
            { to: '/actuarial', label: 'Actuarial' },
            { to: '/data', label: 'Data Timeline' }
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "opacity-70 hover:opacity-100 transition-opacity",
                location.pathname === link.to ? "text-[#0071E3] opacity-100" : ""
              )}
            >
              {link.label}
            </Link>
          ))}
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
  const isStandaloneLayout = location.pathname === '/' || location.pathname === '/hero-demo' || location.pathname === '/admin';

  // Live OpenWeatherMap API Integration
  useEffect(() => {
    let active = true;
    async function fetchLiveWeather() {
      try {
        const res = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Delhi,IN&appid=4f944055cf514c7d8cc9449bce5ed310');
        if (!res.ok) throw new Error(`Live API Offline or Unauthorized code ${res.status}`);
        
        const data = await res.json();
        if (!active) return;

        let detectedType: WeatherType = 'NORMAL';
        const main = (data.weather?.[0]?.main || '').toLowerCase();
        const tempC = (data.main?.temp || 290) - 273.15; // API defaults to Kelvin
        
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
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-primary/20 selection:text-primary font-sans">
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        {!isStandaloneLayout && <Navbar currentEffect={weatherEffect} />}
        <main className={cn("flex-1 w-full h-full relative", !isStandaloneLayout && "pt-16")}>
          <AnimatedRoutes />
        </main>
      </div>
      {!isStandaloneLayout && <WeatherEffects type={weatherEffect} />}
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
