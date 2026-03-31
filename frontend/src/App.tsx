import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { CloudRain, Sun, Snowflake, AlertTriangle, CloudOff, Zap, GitBranch, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import Landing from './pages/Landing';
import RiderDashboard from './pages/RiderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import FraudDefense from './pages/FraudDefense';
import Simulation from './pages/Simulation';
import FraudGraphPage from './pages/FraudGraphPage';
import StoryMode from './pages/StoryMode';
import WeatherEffects, { type WeatherType } from './components/ui/WeatherEffects';

function Navbar({ currentEffect, setEffect }: { currentEffect: WeatherType, setEffect: (e: WeatherType) => void }) {
  const location = useLocation();
  const isDarkNav = location.pathname === '/';
  
  const effects: { type: WeatherType, icon: React.ReactNode, label: string }[] = [
    { type: 'NORMAL', icon: <CloudOff className="w-4 h-4" />, label: 'Normal' },
    { type: 'RAIN', icon: <CloudRain className="w-4 h-4" />, label: 'Storm' },
    { type: 'HEAT', icon: <Sun className="w-4 h-4" />, label: 'Heatwave' },
    { type: 'COLD', icon: <Snowflake className="w-4 h-4" />, label: 'Freeze' },
    { type: 'BANDH', icon: <AlertTriangle className="w-4 h-4" />, label: 'Bandh' },
  ];

  return (
    <nav className={clsx(
      "fixed top-0 w-full z-50 transition-all duration-300",
      isDarkNav ? "bg-black/50 backdrop-blur-md border-b border-white/5" : "bg-[#0f0f11]/80 backdrop-blur-xl border-b border-white/10"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#10a37f] to-[#0ea5e9] flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">F</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">FLOWSECURE</span>
          </Link>
          
          {/* Demo Weather Toggle */}
          <div className="hidden lg:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
            {effects.map((ef) => (
              <button
                key={ef.type}
                onClick={() => setEffect(ef.type)}
                className={clsx(
                  "px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 transition-colors",
                  currentEffect === ef.type 
                    ? "bg-white/20 text-white shadow-sm" 
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
                )}
              >
                {ef.icon} {ef.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 md:gap-5 items-center">
          <Link
            to="/simulate"
            className={clsx(
              "text-sm font-semibold transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              location.pathname === '/simulate'
                ? "text-[#10a37f] bg-[#10a37f]/10"
                : "text-[#10a37f] hover:text-[#0ea5e9] hover:bg-white/5"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Simulate</span>
          </Link>
          <Link
            to="/story"
            className={clsx(
              "text-sm font-medium transition-colors flex items-center gap-1.5",
              location.pathname === '/story'
                ? "text-white"
                : "text-gray-300 hover:text-white"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Story</span>
          </Link>
          <Link
            to="/graph"
            className={clsx(
              "text-sm font-medium transition-colors flex items-center gap-1.5",
              location.pathname === '/graph'
                ? "text-white"
                : "text-gray-300 hover:text-white"
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Graph</span>
          </Link>
          <div className="w-px h-4 bg-white/10 hidden md:block" />
          <Link to="/rider" className={clsx("text-sm font-medium transition-colors", location.pathname === '/rider' ? "text-white" : "text-gray-400 hover:text-white")}>Rider</Link>
          <Link to="/admin" className={clsx("text-sm font-medium transition-colors", location.pathname === '/admin' ? "text-white" : "text-gray-400 hover:text-white")}>Admin</Link>
          <Link to="/fraud" className={clsx("text-sm font-medium transition-colors", location.pathname === '/fraud' ? "text-white" : "text-gray-400 hover:text-white")}>
            Defense
          </Link>
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
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/fraud" element={<FraudDefense />} />
        <Route path="/simulate" element={<Simulation />} />
        <Route path="/graph" element={<FraudGraphPage />} />
        <Route path="/story" element={<StoryMode />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [weatherEffect, setWeatherEffect] = useState<WeatherType>('NORMAL');

  return (
    <Router>
      <div className="min-h-screen bg-[#0f0f11] text-white overflow-hidden flex flex-col relative">
        <WeatherEffects type={weatherEffect} />
        
        <div className="relative z-10 flex flex-col min-h-screen w-full">
          <Navbar currentEffect={weatherEffect} setEffect={setWeatherEffect} />
          <main className="flex-1 pt-16 w-full h-full relative">
            <AnimatedRoutes />
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
