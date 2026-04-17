import { Navbar } from '@/components/stitch/Navbar';
import { Footer } from '@/components/stitch/Footer';
import { PricingModelFlow } from '@/components/stitch/PricingModelFlow';

export default function LearnMore() {
  const appleFontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div
      className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] selection:bg-[#0071E3] selection:text-white flex flex-col"
      style={{ fontFamily: appleFontFamily, WebkitFontSmoothing: 'antialiased' }}
    >
      <Navbar />
      <div className="flex-1 pt-12">
        <PricingModelFlow />
      </div>
      <Footer />
    </div>
  );
}
