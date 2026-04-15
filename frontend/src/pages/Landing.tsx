import { Navbar } from '@/components/stitch/Navbar';
import { HeroSection } from '@/components/stitch/HeroSection';
import { ProductSection } from '@/components/stitch/ProductSection';
import { FeatureGrid } from '@/components/stitch/FeatureGrid';
import { SecuritySection } from '@/components/stitch/SecuritySection';
import { Footer } from '@/components/stitch/Footer';

export default function Landing() {
  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div
      className="min-h-screen bg-white text-[#1D1D1F] selection:bg-[#0071E3] selection:text-white"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <Navbar />
      <HeroSection />
      <ProductSection />
      <FeatureGrid />
      <SecuritySection />

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-[#F5F5F7] px-6">
        <div className="max-w-[1024px] mx-auto text-center">
          <p className="text-sm font-semibold tracking-widest text-[#86868B] uppercase mb-3">Pricing</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mb-4">
            Fair pricing. <span className="bg-gradient-to-b from-[#70B1FF] to-[#0071E3] bg-clip-text text-transparent">Zero surprises.</span>
          </h2>
          <p className="text-lg text-[#86868B] font-medium mb-14 max-w-xl mx-auto">
            Plans adapt to your shift hours and risk zone — you only pay when you're working.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              {
                name: 'Basic', price: '₹49', per: '/day', color: '#E5E5EA',
                features: ['Rain & storm triggers', 'UPI instant payout', 'Basic fraud guard', 'Email support'],
                cta: 'Get Started', highlight: false,
              },
              {
                name: 'Pro', price: '₹89', per: '/day', color: '#0071E3',
                features: ['All Basic features', 'Heat & AQI triggers', 'AI shift optimizer', 'Priority support', 'Fraud AI shield'],
                cta: 'Start Free Trial', highlight: true,
              },
              {
                name: 'Fleet', price: 'Custom', per: '', color: '#1D1D1F',
                features: ['All Pro features', 'Multi-rider management', 'Admin dashboard', 'Dedicated support', 'Custom triggers'],
                cta: 'Contact Us', highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[2rem] p-8 flex flex-col gap-5 border ${plan.highlight ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-[0_20px_60px_rgba(0,113,227,0.35)]' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'}`}
              >
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-white/60' : 'text-[#86868B]'}`}>{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={`text-sm mb-1 ${plan.highlight ? 'text-white/60' : 'text-[#86868B]'}`}>{plan.per}</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm font-medium">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${plan.highlight ? 'bg-white/20 text-white' : 'bg-[#F0F7FF] text-[#0071E3]'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/rider"
                  className={`mt-2 rounded-full py-3 text-center text-sm font-semibold transition-all hover:scale-105 ${plan.highlight ? 'bg-white text-[#0071E3]' : 'bg-[#0071E3] text-white hover:bg-[#0077ED]'}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
