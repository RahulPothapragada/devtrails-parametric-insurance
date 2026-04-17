import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Home',     id: 'home' },
  { label: 'Features', id: 'features' },
  { label: 'Pricing',  id: 'pricing-model-flow' },
  { label: 'Security', id: 'security' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    // 1. Handle navbar background on scroll
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // 2. Track which sections are currently visible
    const visibleSections = new Set<string>();

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleSections.add(entry.target.id);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });

      // Always pick the FIRST (topmost) visible section by NAV_LINKS order
      for (const link of NAV_LINKS) {
        if (visibleSections.has(link.id)) {
          setActiveSection(link.id);
          return;
        }
      }
    }, {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    });

    NAV_LINKS.forEach(link => {
      const el = document.getElementById(link.id);
      if (el) sectionObserver.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      sectionObserver.disconnect();
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Calculate top position and subtract navbar height (approx 80px)
      const topPos = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({
        top: topPos,
        behavior: 'smooth'
      });
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
                'transition-all duration-200 hover:text-[#0071E3] text-base font-extrabold',
                activeSection === id
                  ? 'text-[#0071E3]'
                  : 'text-[#1D1D1F]'
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
