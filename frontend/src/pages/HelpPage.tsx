import { Search, Shield, Wallet, Settings, ArrowRight } from 'lucide-react';
import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

const helpCategories = [
  {
    icon: Shield,
    title: 'Understanding Parametric Triggers',
    text: 'Learn how rainfall, AQI, and environmental thresholds trigger protection automatically.',
  },
  {
    icon: Wallet,
    title: 'Wallet & Payouts',
    text: 'Understand payout timing, bank/UPI linking, and how funds move once a trigger is verified.',
  },
  {
    icon: Settings,
    title: 'Account & Security',
    text: 'Update delivery zones, reset credentials, and manage rider account safeguards.',
  },
];

export default function HelpPage() {
  return (
    <FooterPageLayout
      eyebrow="Help Center"
      title="How can we help you ride safer?"
      description="Find quick answers about triggers, payouts, account setup, and rider protection workflows."
    >
      <div className="space-y-10">
        <section className="rounded-[2rem] border border-[#E5E5EA] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] md:p-8">
          <div className="mx-auto max-w-2xl">
            <label className="relative block">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8E8E93]" />
              <input
                type="text"
                placeholder="Search trigger rules, payout timing, account setup..."
                className="w-full rounded-full border border-[#D2D2D7] bg-[#F5F5F7] py-4 pl-14 pr-5 text-base text-[#1D1D1F] outline-none transition-all placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:bg-white"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {helpCategories.map((item) => (
            <article key={item.title} className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
              <div className="inline-flex rounded-full bg-[#F0F7FF] p-3 text-[#0071E3]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight text-[#1D1D1F]">{item.title}</h2>
              <p className="mt-4 text-base leading-8 text-[#6E6E73]">{item.text}</p>
              <button className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0071E3] hover:text-[#005EC2]">
                Explore articles
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </section>

        <section className="rounded-[2rem] border border-[#0071E3]/20 bg-[linear-gradient(135deg,#EAF4FF_0%,#F8FBFF_100%)] p-8 shadow-[0_4px_24px_rgba(0,113,227,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0071E3]">Support</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1D1D1F]">Can’t find what you need? Contact our team.</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[#6E6E73]">
            If your rider question is urgent or payout-related, our support team can help you faster through direct channels.
          </p>
          <a href="/contact" className="mt-6 inline-flex rounded-full bg-[#0071E3] px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#0077ED]">
            Contact Support
          </a>
        </section>
      </div>
    </FooterPageLayout>
  );
}
