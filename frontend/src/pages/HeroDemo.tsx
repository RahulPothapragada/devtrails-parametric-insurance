import { Header } from '@/components/ui/header-3';
import { HeroSection } from '@/components/ui/hero-3';

export default function HeroDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <HeroSection />
        
        {/* Additional content to make the page scrollable and show off the sticky header */}
        <section className="py-24 px-6 max-w-5xl mx-auto border-t bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Scalable Infrastructure</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Our platform is built on top of world-class cloud infrastructure, ensuring 99.9% uptime and lightning-fast performance for users worldwide.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Neural Security</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Advanced AI-driven threat detection monitors every transaction and interaction, blocking malicious actors before they can take any action.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Global Compliance</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Stay compliant with international regulations automatically. We handle the heavy lifting of data privacy and financial reporting.
              </p>
            </div>
          </div>
        </section>

        <section className="py-32 px-6 text-center bg-card border-y">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">Ready to transform your business?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
            Join thousands of teams who use our platform to build, scale, and secure their digital future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-colors">
              Get Started Now
            </button>
            <button className="px-8 py-3 bg-background border font-bold rounded-xl hover:bg-accent transition-colors">
              Talk to Sales
            </button>
          </div>
        </section>

        <footer className="py-12 px-6 border-t bg-background">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white font-bold">F</span>
               </div>
               <span className="font-bold tracking-tight">FLOWSECURE</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground font-medium">
              <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
              <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-foreground transition-colors">Discord</a>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 FlowSecure Inc. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
