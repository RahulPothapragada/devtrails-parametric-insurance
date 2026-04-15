import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Home',     id: 'home' },
  { label: 'Features', id: 'features' },
  { label: 'Security', id: 'security' },
  { label: 'Pricing',  id: 'pricing' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Track which section is in view
      for (const link of [...NAV_LINKS].reverse()) {
        const el = document.getElementById(link.id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(link.id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 transition-all duration-300 flex justify-center',
        isScrolled ? 'bg-white/80 backdrop-blur-md border-b border-[#E5E5EA]' : 'bg-transparent'
      )}
    >
      <div className="w-full max-w-[1024px] px-4 h-16 flex items-center justify-between tracking-wide">
        {/* Logo */}
        <button
          onClick={() => scrollTo('home')}
          className="text-[#1D1D1F] hover:text-[#0071E3] transition-colors text-lg font-extrabold tracking-tight"
        >
          FlowSecure
        </button>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={cn(
                'transition-all duration-200 hover:text-[#0071E3] text-sm font-bold',
                activeSection === id
                  ? 'text-[#0071E3] opacity-100'
                  : 'text-[#1D1D1F] opacity-70 hover:opacity-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sign In CTA */}
        <Link
          to="/rider"
          className="text-white bg-[#0071E3] hover:bg-[#0077ED] shadow-md transition-all hover:scale-105 px-6 py-2.5 rounded-full text-sm font-bold"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
