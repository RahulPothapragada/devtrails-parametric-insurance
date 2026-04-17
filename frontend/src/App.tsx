import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { User, LogOut, Settings, ChevronDown, Wallet, Phone, MapPin, LogIn, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE as API, SERVER_ROOT, waitForServer } from '@/lib/api';
import Landing from './pages/Landing';
import RiderDashboard from './pages/RiderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import FraudDefense from './pages/FraudDefense';
import Simulation from './pages/Simulation';
import FraudGraphPage from './pages/FraudGraphPage';
import StoryMode from './pages/StoryMode';
import HeroDemo from './pages/HeroDemo';
import ActuarialDashboard from './pages/ActuarialDashboard'; // [CORE PRESERVED]
import Payouts from './pages/Payouts';
import ParametricFlow from './pages/ParametricFlow';
import WeatherEffects, { type WeatherType } from './components/ui/WeatherEffects';

function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [riderInfo, setRiderInfo] = useState<{ upi_id?: string; phone?: string; zone?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Login state
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [demoCity, setDemoCity] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');

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
    setOtpStep('phone');
    setPhone('');
    setOtp('');
    window.location.reload();
  };

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) { setLoginError('Enter a valid 10-digit number'); return; }
    setLoginLoading(true); setLoginError(''); setDemoOtp(null);
    try {
      const res = await fetch(`${API}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      setDemoOtp(data.demo_otp || null);
      setOtpStep('otp');
    } catch { setLoginError('Failed to send OTP'); }
    finally { setLoginLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4}$/.test(otp)) { setLoginError('Enter the 4-digit OTP'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const res = await fetch(`${API}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setRiderName(data.name);
      setOpen(false);
      window.location.reload();
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Login failed'); }
    finally { setLoginLoading(false); }
  };

  const handleDemoLogin = async (city: string) => {
    setLoginLoading(true); setDemoCity(city); setLoginError('');
    try {
      const res = await fetch(`${API}/auth/demo-login?city=${encodeURIComponent(city)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setRiderName(data.name);
      setOpen(false);
      window.location.reload();
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Login failed'); }
    finally { setLoginLoading(false); setDemoCity(null); }
  };

  const initials = riderName ? riderName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#F5F5F7] transition-colors"
      >
        {riderName ? (
          <>
            <div className="w-7 h-7 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{initials}</div>
            <span className="text-xs font-semibold text-[#1D1D1F] hidden sm:block max-w-[100px] truncate">{riderName}</span>
          </>
        ) : (
          <>
            <User className="w-4 h-4 text-[#86868B]" />
            <span className="text-xs font-semibold text-[#1D1D1F] hidden sm:block">Login</span>
          </>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-[#86868B] transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#E5E5EA] overflow-hidden z-50"
          >
            {riderName ? (
              <>
                <div className="bg-[#F5F5F7] px-4 py-3 border-b border-[#E5E5EA]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center text-white font-bold text-sm shrink-0">{initials}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1D1D1F] text-sm truncate">{riderName}</p>
                      <p className="text-[10px] text-[#86868B] font-medium">Rider Account</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2.5 border-b border-[#E5E5EA]">
                  <p className="text-[10px] text-[#86868B] uppercase tracking-widest font-semibold flex items-center gap-1.5"><Settings className="w-3 h-3" /> Account</p>
                  {riderInfo?.phone && <div className="flex items-center gap-2 text-xs text-[#1D1D1F]"><Phone className="w-3.5 h-3.5 text-[#86868B] shrink-0" /><span className="font-mono">+91 {riderInfo.phone}</span></div>}
                  {riderInfo?.upi_id && <div className="flex items-center gap-2 text-xs text-[#1D1D1F]"><Wallet className="w-3.5 h-3.5 text-[#86868B] shrink-0" /><span className="font-mono truncate">{riderInfo.upi_id}</span></div>}
                  {riderInfo?.zone && <div className="flex items-center gap-2 text-xs text-[#1D1D1F]"><MapPin className="w-3.5 h-3.5 text-[#86868B] shrink-0" /><span>{riderInfo.zone}</span></div>}
                </div>
                <div className="p-2">
                  <Link to="/rider" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors text-xs font-medium text-[#1D1D1F] w-full"><User className="w-3.5 h-3.5 text-[#86868B]" />My Dashboard</Link>
                  <Link to="/payouts" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors text-xs font-medium text-[#1D1D1F] w-full"><Wallet className="w-3.5 h-3.5 text-[#86868B]" />My Payouts</Link>
                  <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors text-xs font-medium text-red-500 w-full mt-1"><LogOut className="w-3.5 h-3.5" />Log Out</button>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2">
                  <p className="font-semibold text-[#1D1D1F] text-sm">Rider Login</p>
                  <p className="text-[11px] text-[#86868B] mt-0.5">Enter your phone to receive an OTP</p>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-3">
                  {otpStep === 'phone' ? (
                    <>
                      <div className="flex items-center gap-2 border border-[#E5E5EA] rounded-xl px-3 py-2.5 bg-white focus-within:border-[#0071E3] transition-colors">
                        <span className="text-[#86868B] font-medium text-xs">+91</span>
                        <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number"
                          value={phone}
                          onChange={e => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(clean);
                            if (loginError) setLoginError('');
                          }}
                          onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                          className="flex-1 outline-none text-xs font-medium bg-transparent" />
                      </div>
                      <button onClick={handleSendOtp} disabled={loginLoading}
                        className="w-full bg-[#0071E3] text-white rounded-xl py-2.5 font-semibold text-xs hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loginLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />} Send OTP
                      </button>
                    </>
                  ) : (
                    <>
                      {demoOtp && <div className="bg-[#0071E3]/10 text-[#0071E3] rounded-xl px-3 py-2 text-center text-xs font-semibold">Demo OTP: <span className="font-bold tracking-widest">{demoOtp}</span></div>}
                      <input type="text" inputMode="numeric" maxLength={4} value={otp} placeholder="4-digit OTP" autoFocus
                        onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 4)); setLoginError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                        className="border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-center text-sm font-bold tracking-widest outline-none focus:border-[#0071E3] transition-colors w-full" />
                      <button onClick={handleVerifyOtp} disabled={loginLoading}
                        className="w-full bg-[#0071E3] text-white rounded-xl py-2.5 font-semibold text-xs hover:bg-[#0077ED] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loginLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verify & Login
                      </button>
                      <button onClick={() => { setOtpStep('phone'); setOtp(''); setLoginError(''); }} className="text-[#86868B] text-xs text-center hover:text-[#1D1D1F]">← Change number</button>
                    </>
                  )}
                  {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
                  <div className="border-t border-[#E5E5EA] pt-3">
                    <p className="text-[10px] text-[#86868B] text-center uppercase tracking-widest font-semibold mb-2">Try a demo account</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { city: 'Mumbai', tier: 'T1', color: '#0071E3' },
                        { city: 'Pune', tier: 'T2', color: '#F59E0B' },
                        { city: 'Lucknow', tier: 'T3', color: '#EF4444' },
                      ] as const).map(({ city, tier, color }) => (
                        <button key={city} onClick={() => handleDemoLogin(city)} disabled={loginLoading}
                          className="flex flex-col items-center gap-0.5 py-2 rounded-xl border bg-white hover:bg-gray-50 transition-all disabled:opacity-50 text-xs"
                          style={{ borderColor: `${color}40` }}>
                          {loginLoading && demoCity === city ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color }} /> : <span className="font-bold" style={{ color }}>{tier}</span>}
                          <span className="font-medium text-[#1D1D1F]">{city}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
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
            { to: '/flow', label: 'Parametric Flow' },
          ].map((link) => (
            <Link key={link.to} to={link.to} className={cn("opacity-70 hover:opacity-100 transition-opacity", location.pathname === link.to && "text-[#0071E3] opacity-100")}>
              {link.label}
            </Link>
          ))}

          <div className="w-px h-4 bg-[#E5E5EA] mx-1" />

          {[
            { to: '/rider', label: 'Rider' },
            { to: '/payouts', label: 'Payouts' },
            { to: '/actuarial', label: 'Analytics' },
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
  // Use a stable key for /admin/* so sub-route changes don't remount the component
  const routeKey = location.pathname.startsWith('/admin') ? '/admin' : location.pathname;
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={routeKey}>
        <Route path="/" element={<Landing />} />
        <Route path="/rider" element={<RiderDashboard />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/fraud" element={<FraudDefense />} />
        <Route path="/simulate" element={<Simulation />} />
        <Route path="/graph" element={<FraudGraphPage />} />
        <Route path="/story" element={<StoryMode />} />
        <Route path="/hero-demo" element={<HeroDemo />} />
        <Route path="/actuarial" element={<ActuarialDashboard />} />
        <Route path="/data" element={<Navigate to="/admin/data" replace />} />
        <Route path="/flow" element={<ParametricFlow />} />
      </Routes>
    </AnimatePresence>
  );
}

// ── Server wake-up banner (shown only during Render cold starts) ──
function ServerWakeup() {
  const [status, setStatus] = useState<'checking' | 'waking' | 'ready' | 'hidden'>('checking');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Quick check first — if already up, hide immediately
      try {
        const res = await fetch(`${SERVER_ROOT}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) { setStatus('hidden'); return; }
      } catch { /* not up yet */ }

      if (cancelled) return;
      setStatus('waking');
      const ok = await waitForServer(90_000, (ms) => { if (!cancelled) setElapsed(Math.floor(ms / 1000)); });
      if (!cancelled) setStatus(ok ? 'ready' : 'hidden');
      if (ok && !cancelled) {
        // Signal all pages that the server just woke up so they can retry data fetches
        window.dispatchEvent(new Event('server:ready'));
        setTimeout(() => setStatus('hidden'), 2500);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'hidden') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 px-4 py-2.5 text-xs font-medium"
      style={{ background: status === 'ready' ? '#34C759' : '#0071E3', color: '#fff' }}
    >
      {status === 'ready' ? (
        <><ShieldCheck className="w-3.5 h-3.5" /> Server ready — loading data</>
      ) : (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" />
          {status === 'checking' ? 'Connecting to server…' : `Waking up server… ${elapsed}s`}
          <span className="opacity-70">(Render free tier cold start — up to 60s)</span>
        </>
      )}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const [weatherEffect, setWeatherEffect] = useState<WeatherType>('NORMAL');
  const isStandaloneLayout = location.pathname === '/' || location.pathname === '/hero-demo' || location.pathname.startsWith('/admin');

  // Live OpenWeatherMap API Integration
  useEffect(() => {
    let active = true;
    async function fetchLiveWeather() {
      try {
        const owKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Delhi,IN&appid=${owKey}`);
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
      <ServerWakeup />
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
