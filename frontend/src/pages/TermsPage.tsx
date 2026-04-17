import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

const termsSections = [
  {
    id: 'service-definition',
    title: 'Service Definition',
    body: 'FlowSecure provides parametric protection services that rely on predefined environmental and platform signals. Unlike traditional claims-based insurance, eligibility for a payout is determined by trigger conditions and platform rules rather than manual claim adjustment.',
  },
  {
    id: 'user-eligibility',
    title: 'User Eligibility',
    body: 'Users must be legally eligible to contract, provide truthful registration information, and use the service only in supported regions and roles. Rider coverage may depend on verified account details, linked payout channels, and supported operating zones.',
  },
  {
    id: 'anti-fraud',
    title: 'Anti-Fraud & Acceptable Use',
    body: 'Users may not manipulate location, spoof GPS, fabricate activity, interfere with device integrity checks, or misuse the platform to trigger payouts improperly. FlowSecure reserves the right to deny or reverse benefits, suspend access, and retain evidence for audit and enforcement purposes.',
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: 'FlowSecure provides the platform on an as-available basis subject to operational, technical, legal, and third-party dependencies. To the maximum extent permitted by law, FlowSecure’s liability is limited as described in applicable agreements and may exclude indirect or consequential damages.',
  },
];

export default function TermsPage() {
  return (
    <FooterPageLayout
      eyebrow="Terms of Use"
      title="Terms of Use"
      description="These terms describe how FlowSecure’s parametric rider protection platform may be accessed and used."
    >
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] border border-[#E5E5EA] bg-[#F5F5F7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">Sections</p>
            <div className="mt-4 space-y-3">
              {termsSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="block text-sm font-medium text-[#6E6E73] hover:text-[#0071E3]">
                  {section.title}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="max-w-3xl space-y-10 text-[#3A3A3C]">
          {termsSections.map((section) => (
            <section key={section.id} id={section.id} className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
              <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">{section.title}</h2>
              <p className="mt-5 text-base leading-8 text-[#4A4A4F]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </FooterPageLayout>
  );
}
