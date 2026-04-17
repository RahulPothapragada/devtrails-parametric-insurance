import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

export default function LegalPage() {
  return (
    <FooterPageLayout
      eyebrow="Legal"
      title="Legal"
      description="Placeholder legal and regulatory disclosures for FlowSecure’s rider protection platform."
    >
      <div className="max-w-4xl space-y-8">
        {[
          {
            title: 'Regulatory Disclosures',
            text: 'Placeholder text describing how FlowSecure positions its platform, the nature of any insurance or protection partner relationships, product disclosure requirements, and applicable jurisdictional notices.',
          },
          {
            title: 'Financial Compliance Notices',
            text: 'Placeholder text for payments compliance, KYC obligations, anti-money laundering controls, sanctions screening, transaction monitoring, and recordkeeping requirements associated with premium collection and payouts.',
          },
          {
            title: 'State / Regional Specific Riders',
            text: 'Placeholder text for territory-specific legal riders, consumer rights language, required regional notices, and product limitations that may differ based on location, insurer partner, or operating model.',
          },
        ].map((section) => (
          <section key={section.title} className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">{section.title}</h2>
            <p className="mt-5 text-base leading-8 text-[#4A4A4F]">{section.text}</p>
          </section>
        ))}
      </div>
    </FooterPageLayout>
  );
}
