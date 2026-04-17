import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/stitch/Footer';

const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function FooterPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-white text-[#1D1D1F] selection:bg-[#0071E3] selection:text-white"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <nav className="sticky top-0 z-50 flex justify-center border-b border-[#E5E5EA] bg-white/80 backdrop-blur-md">
        <div className="flex h-16 w-full max-w-[1024px] items-center justify-between px-4 tracking-wide">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-[#1D1D1F] transition-colors hover:text-[#0071E3]">
            FlowSecure
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            <a href="/#features" className="text-sm font-bold text-[#1D1D1F] opacity-70 transition-all hover:text-[#0071E3] hover:opacity-100">Features</a>
            <a href="/#security" className="text-sm font-bold text-[#1D1D1F] opacity-70 transition-all hover:text-[#0071E3] hover:opacity-100">Security</a>
            <a href="/#pricing" className="text-sm font-bold text-[#1D1D1F] opacity-70 transition-all hover:text-[#0071E3] hover:opacity-100">Pricing</a>
          </div>

          <Link
            to="/rider"
            className="rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-[#0077ED]"
          >
            Sign In
          </Link>
        </div>
      </nav>

      <header className="border-b border-[#E5E5EA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8F8FA_100%)] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-[1024px]">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#86868B]">{eyebrow}</p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-[#1D1D1F] md:text-6xl md:leading-[1.02]">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#6E6E73]">
            {description}
          </p>
        </div>
      </header>

      <main className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-[1024px]">{children}</div>
      </main>

      <Footer />
    </div>
  );
}
