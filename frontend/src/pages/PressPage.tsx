import { Download, Mail, Newspaper } from 'lucide-react';
import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

const announcements = [
  'FlowSecure expands API integrations for major delivery apps',
  'FlowSecure pilots automated heatwave payouts across new city clusters',
  'FlowSecure launches fraud defense layer for parametric rider protection',
];

export default function PressPage() {
  return (
    <FooterPageLayout
      eyebrow="Press"
      title="FlowSecure in the News."
      description="Coverage, announcements, and media resources for FlowSecure’s parametric protection platform."
    >
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="inline-flex rounded-full bg-[#F0F7FF] p-3 text-[#0071E3]">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#1D1D1F]">Media Inquiries</h2>
          <p className="mt-4 text-base leading-8 text-[#6E6E73]">
            Journalists, analysts, and event organizers can reach our communications team directly for interviews, product information, and official statements.
          </p>
          <a href="mailto:press@flowsecure.com" className="mt-6 inline-block text-lg font-semibold text-[#0071E3] hover:text-[#005EC2]">
            press@flowsecure.com
          </a>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#86868B]">Recent Announcements</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1D1D1F]">Latest updates</h2>
              </div>
              <div className="rounded-full bg-[#F5F5F7] p-3 text-[#0071E3]">
                <Newspaper className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {announcements.map((item, index) => (
                <article key={item} className="rounded-[1.5rem] border border-[#E5E5EA] bg-[#FBFBFD] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">Press Release {index + 1}</p>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-[#1D1D1F]">{item}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6E6E73]">
                    Placeholder summary text describing the announcement, launch milestone, or platform update for media use.
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#E5E5EA] bg-[#F5F5F7] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Media Kit</h2>
            <p className="mt-3 text-base leading-7 text-[#6E6E73]">
              Download placeholder brand assets, logos, product screenshots, and company boilerplate for editorial use.
            </p>
            <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0071E3] px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#0077ED]">
              <Download className="h-4 w-4" />
              Brand Assets & Logos
            </button>
          </div>
        </section>
      </div>
    </FooterPageLayout>
  );
}
