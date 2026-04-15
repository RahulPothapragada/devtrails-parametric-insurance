export function Footer() {
  return (
    <footer className="bg-[#F5F5F7] pt-24 pb-12 text-[#86868B] text-xs">
      <div className="max-w-[1024px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 border-b border-[#D2D2D7] pb-12">
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Product</h5>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Security</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Company</h5>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">About</a></li>
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Press</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-[#1D1D1F] mb-4">Support</h5>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p>Copyright © 2026 FlowSecure Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#1D1D1F] transition-colors">Privacy Policy</a>
            <span className="text-[#D2D2D7]">|</span>
            <a href="#" className="hover:text-[#1D1D1F] transition-colors">Terms of Use</a>
            <span className="text-[#D2D2D7]">|</span>
            <a href="#" className="hover:text-[#1D1D1F] transition-colors">Legal</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
