import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#F5F5F7] pt-24 pb-12 text-[#86868B] text-xs">
      <div className="max-w-[1024px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 border-b border-[#D2D2D7] pb-12">
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Product</h5>
            <ul className="space-y-3">
              <li><a href="/#features" className="hover:text-[#1D1D1F] hover:underline transition-colors">Features</a></li>
              <li><a href="/#pricing" className="hover:text-[#1D1D1F] hover:underline transition-colors">Pricing</a></li>
              <li><a href="/#security" className="hover:text-[#1D1D1F] hover:underline transition-colors">Security</a></li>
              <li><Link to="/learn-more" className="hover:text-[#1D1D1F] hover:underline transition-colors">Learn More</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Company</h5>
            <ul className="space-y-3">
              <li><Link to="/careers" className="hover:text-[#1D1D1F] hover:underline transition-colors">Careers</Link></li>
              <li><Link to="/press" className="hover:text-[#1D1D1F] hover:underline transition-colors">Press</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Support</h5>
            <ul className="space-y-3">
              <li><Link to="/help" className="hover:text-[#1D1D1F] hover:underline transition-colors">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-[#1D1D1F] hover:underline transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Riders</h5>
            <ul className="space-y-3">
              <li><Link to="/rider" className="hover:text-[#1D1D1F] hover:underline transition-colors">Dashboard</Link></li>
              <li><Link to="/simulate" className="hover:text-[#1D1D1F] hover:underline transition-colors">Simulate</Link></li>
              <li><Link to="/fraud" className="hover:text-[#1D1D1F] hover:underline transition-colors">Fraud Defense</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p>Copyright © 2026 FlowSecure Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-[#1D1D1F] transition-colors">Privacy Policy</Link>
            <span className="text-[#D2D2D7]">|</span>
            <Link to="/terms" className="hover:text-[#1D1D1F] transition-colors">Terms of Use</Link>
            <span className="text-[#D2D2D7]">|</span>
            <Link to="/legal" className="hover:text-[#1D1D1F] transition-colors">Legal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
