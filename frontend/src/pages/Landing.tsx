import { Navbar } from '@/components/stitch/Navbar';
import { HeroSection } from '@/components/stitch/HeroSection';
import { ProductSection } from '@/components/stitch/ProductSection';
import { FeatureGrid } from '@/components/stitch/FeatureGrid';
import { PricingModelFlow } from '@/components/stitch/PricingModelFlow';
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
      <PricingModelFlow />
      <SecuritySection />

      <Footer />
    </div>
  );
}
