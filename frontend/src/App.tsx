import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, GitBranch, BookOpen, ShieldAlert, User, LogOut, Settings, ChevronDown, Wallet, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE as API } from '@/lib/api';
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

function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [riderInfo, setRiderInfo] = useState<{ upi_id?: string; phone?: string; zone?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const name = localStorage.getItem('flowsecure_rider_name');
    setRiderName(name);
    if (name) {
      const token = localStorage.getItem('flowsecure_token');
      if (token) {
        fetch(`${API}/riders/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.rider) setRiderInfo({ upi_id: d.rider.upi_id, phone: d.rider.phone, zone: d.zone?.name });
          })
          .catch(() => {});
      }
    }
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('flowsecure_token');
    localStorage.removeItem('flowsecure_rider_name');
    sessionStorage.removeItem('fs_dashboard_v1');
    sessionStorage.removeItem('fs_predict_v1');
    sessionStorage.removeItem('fs_optimize_v1');
    sessionStorage.removeItem('fs_payout_v1');
    setRiderName(null);
    setRiderInfo(null);
    setOpen(false);
    window.location.href = '/rider';
  };

  if (!riderName) {
    return (
      <Link
        to="/rider"
        className="flex items-center gap-1.5 bg-[#0071E3] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0077ED] transition-colors"
      >
        <User className="w-3.5 h-3.5" />
        Login
      </Link>
    );
  }

  const initials = riderName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#F5F5F7] transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {initials}
        </div>
        <span className="text-xs font-semibold text-[#1D1D1F] hidden sm:block max-w-[100px] truncate">{riderName}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-[#86868B] transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E5E5EA] overflow-hidden z-50"
          >
            {/* Profile header */}
            <div className="bg-[#F5F5F7] px-4 py-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#1D1D1F] text-sm truncate">{riderName}</p>
                  <p className="text-[10px] text-[#86868B] font-medium">Rider Account</p>
                </div>
              </div>
            </div>

            {/* Settings info */}
            <div className="px-4 py-3 flex flex-col gap-2.5 border-b border-[#E5E5EA]">
              <p className="text-[10px] text-[#86868B] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <Settings className="w-3 h-3" /> Settings
              </p>
              {riderInfo?.phone && (
                <div className="flex items-center gap-2 text-xs text-[#1D1D1F]">
                  <Phone className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                  <span className="font-mono">+91 {riderInfo.phone}</span>
                </div>
              )}
              {riderInfo?.upi_id && (
                <div className="flex items-center gap-2 text-xs text-[#1D1D1F]">
                  <Wallet className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                  <span className="font-mono truncate">{riderInfo.upi_id}</span>
                </div>
              )}
              {riderInfo?.zone && (
                <div className="flex items-center gap-2 text-xs text-[#1D1D1F]">
                  <MapPin className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                  <span>{riderInfo.zone}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-2">
              <Link
                to="/rider"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors text-xs font-medium text-[#1D1D1F] w-full"
              >
                <User className="w-3.5 h-3.5 text-[#86868B]" />
                My Dashboard
              </Link>
              <Link
                to="/payouts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors text-xs font-medium text-[#1D1D1F] w-full"
              >
                <Wallet className="w-3.5 h-3.5 text-[#86868B]" />
                My Payouts
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors text-xs font-medium text-red-500 w-full mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar({ currentEffect }: { currentEffect: WeatherType }) {
  const location = useLocation();
  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <nav
      className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-[#E5E5EA]"
      style={{ fontFamily: appleFontFamily }}
    >
      <div className="w-full max-w-[1400px] mx-auto px-4 min-h-[3rem] py-2 flex items-center justify-between text-xs font-semibold tracking-wide text-[#1D1D1F]">
        <Link to="/" className="flex items-center gap-2 group shrink-0 hover:text-[#0071E3] transition-colors">
          <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-white font-bold text-lg leading-none">F</span>
          </div>
          <span className="text-sm font-bold tracking-tight hidden md:block">FLOWSECURE</span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-3 items-center flex-wrap">
          {[
            { to: '/simulate', label: 'Simulate' },
            { to: '/graph', label: 'Graph' },
            { to: '/fraud', label: 'Defense' },
          ].map((link) => (
            <Link key={link.to} to={link.to} className={cn("opacity-70 hover:opacity-100 transition-opacity", location.pathname === link.to && "text-[#0071E3] opacity-100")}>
              {link.label}
            </Link>
          ))}

          <div className="w-px h-4 bg-[#E5E5EA] mx-1" />

          {[
            { to: '/rider', label: 'Rider' },
            { to: '/payouts', label: 'Payouts' },
            { to: '/admin', label: 'Admin' },
            { to: '/actuarial', label: 'Actuarial' },
            { to: '/data', label: 'Data' },
          ].map((link) => (
            <Link key={link.to} to={link.to} className={cn("opacity-70 hover:opacity-100 transition-opacity", location.pathname === link.to && "text-[#0071E3] opacity-100")}>
              {link.label}
            </Link>
          ))}

          <div className="w-px h-4 bg-[#E5E5EA] mx-1" />

          <AccountDropdown />
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
