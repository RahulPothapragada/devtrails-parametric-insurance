import { Instagram, Linkedin, Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

export default function ContactPage() {
  return (
    <FooterPageLayout
      eyebrow="Contact"
      title="Get in touch."
      description="Whether you’re a rider looking for support or a business exploring integrations, we’ll route you to the right team."
    >
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-[2rem] border border-[#E5E5EA] bg-[#F5F5F7] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Reach us directly</h2>
          <div className="mt-8 space-y-5 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-[#0071E3]" />
              <div>
                <p className="font-semibold text-[#1D1D1F]">Support</p>
                <a href="mailto:support@flowsecure.com" className="text-[#6E6E73] hover:text-[#0071E3]">support@flowsecure.com</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-[#0071E3]" />
              <div>
                <p className="font-semibold text-[#1D1D1F]">Office</p>
                <p className="text-[#6E6E73]">FlowSecure HQ, 12 Parametric Plaza, Bengaluru 560001</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-[#0071E3]" />
              <div>
                <p className="font-semibold text-[#1D1D1F]">Escalations</p>
                <p className="text-[#6E6E73]">+91 00000 00000</p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-[#D2D2D7] pt-6">
            <p className="text-sm font-semibold text-[#1D1D1F]">Social</p>
            <div className="mt-4 flex gap-3">
              {[Linkedin, Instagram, MessageSquare].map((Icon, idx) => (
                <button key={idx} className="rounded-full border border-[#D2D2D7] bg-white p-3 text-[#0071E3] transition-all hover:scale-105 hover:border-[#0071E3]">
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Send a message</h2>
          <form className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#1D1D1F]">Name</span>
                <input className="mt-2 w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-3 text-sm outline-none focus:border-[#0071E3] focus:bg-white" placeholder="Your name" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#1D1D1F]">Email</span>
                <input className="mt-2 w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-3 text-sm outline-none focus:border-[#0071E3] focus:bg-white" placeholder="you@example.com" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-[#1D1D1F]">Topic</span>
              <select className="mt-2 w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-3 text-sm outline-none focus:border-[#0071E3] focus:bg-white">
                <option>I am a Rider seeking support</option>
                <option>I am a Business seeking API integration</option>
                <option>I am a Press or media contact</option>
                <option>I have a general question</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#1D1D1F]">Message</span>
              <textarea rows={6} className="mt-2 w-full rounded-[1.5rem] border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-3 text-sm outline-none focus:border-[#0071E3] focus:bg-white" placeholder="Tell us what you need help with..." />
            </label>

            <button className="inline-flex rounded-full bg-[#0071E3] px-7 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#0077ED]">
              Send Message
            </button>
          </form>
        </section>
      </div>
    </FooterPageLayout>
  );
}
