import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

const privacySections = [
  {
    id: 'data-collection',
    title: 'Data Collection',
    body: 'FlowSecure collects account information, rider profile information, Live Location Data needed to validate delivery zone activity, and Financial Data required to support premium charges and automated payouts. We may also collect device, login, and service interaction data to help keep the platform reliable and safe.',
  },
  {
    id: 'data-usage',
    title: 'Data Usage',
    body: 'We use collected data to determine whether a parametric trigger has occurred, to assess zone-level impact, to prevent fraud, to process payouts, and to improve rider support experiences. We also use service analytics to tune trigger accuracy, reduce false positives, and strengthen platform reliability.',
  },
  {
    id: 'third-party-sharing',
    title: 'Third-Party Sharing',
    body: 'We may share limited data with payment processors, cloud infrastructure providers, weather and AQI API providers, customer support tools, and compliance vendors. We require these third parties to use data only for the specific services they provide to FlowSecure.',
  },
  {
    id: 'user-rights',
    title: 'User Rights',
    body: 'Users may request access to certain account data, request corrections, request deletion of eligible information, and ask questions about how their data is used. Some data may need to be retained to satisfy fraud prevention, audit, legal, or financial obligations.',
  },
];

export default function PrivacyPage() {
  return (
    <FooterPageLayout
      eyebrow="Privacy Policy"
      title="Privacy Policy"
      description="A summary of how FlowSecure collects, uses, and protects information related to rider coverage, payouts, and platform operations."
    >
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] border border-[#E5E5EA] bg-[#F5F5F7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">Sections</p>
            <div className="mt-4 space-y-3">
              {privacySections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="block text-sm font-medium text-[#6E6E73] hover:text-[#0071E3]">
                  {section.title}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="max-w-3xl space-y-10 text-[#3A3A3C]">
          {privacySections.map((section) => (
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
