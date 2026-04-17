import { ArrowRight, Briefcase, Database, LineChart, Users } from 'lucide-react';
import { FooterPageLayout } from '@/components/stitch/FooterPageLayout';

const roles = [
  {
    title: 'Senior Backend Engineer (Data Infrastructure)',
    location: 'Bengaluru / Hybrid',
    team: 'Platform Engineering',
    description: 'Build resilient pipelines for trigger ingestion, payout orchestration, and rider-facing reliability at scale.',
  },
  {
    title: 'Actuarial Data Scientist',
    location: 'Mumbai / Remote',
    team: 'Risk & Pricing',
    description: 'Model payout thresholds, climate exposure, and portfolio sustainability across rider cohorts and delivery zones.',
  },
  {
    title: 'Operations Manager',
    location: 'Delhi NCR / Field + HQ',
    team: 'Rider Success',
    description: 'Design the on-ground processes that keep support, payouts, and escalation handling rider-first and fast.',
  },
];

export default function CareersPage() {
  return (
    <FooterPageLayout
      eyebrow="Careers"
      title="Build the safety net for the gig economy."
      description="FlowSecure protects riders from weather shocks and sudden income loss. We’re building the systems, data models, and operating playbooks that make that protection real."
    >
      <div className="space-y-16">
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-[#E5E5EA] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Mission</h2>
            <p className="mt-4 text-base leading-8 text-[#6E6E73]">
              Riders should not lose a day’s income because a storm, flood alert, or AQI spike makes work unsafe. We turn real-time environmental data into instant, automated protection.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[#E5E5EA] bg-[#F5F5F7] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Culture</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Database, title: 'Data-Driven', text: 'We make decisions with live signal quality, risk metrics, and rider outcomes.' },
                { icon: LineChart, title: 'Fast-Paced', text: 'We ship quickly, learn quickly, and keep systems dependable under pressure.' },
                { icon: Users, title: 'Empathetic', text: 'We build for riders first, with clarity, dignity, and practical support.' },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.5rem] bg-white p-5">
                  <item.icon className="h-5 w-5 text-[#0071E3]" />
                  <h3 className="mt-4 text-sm font-bold text-[#1D1D1F]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6E6E73]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#86868B]">Open Roles</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#1D1D1F]">Join the team building rider resilience.</h2>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {roles.map((role) => (
              <div key={role.title} className="rounded-[1.75rem] border border-[#E5E5EA] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">
                      <Briefcase className="h-3.5 w-3.5 text-[#0071E3]" />
                      {role.team}
                    </div>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight text-[#1D1D1F]">{role.title}</h3>
                    <p className="mt-2 text-sm font-medium text-[#86868B]">{role.location}</p>
                    <p className="mt-4 text-base leading-7 text-[#6E6E73]">{role.description}</p>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-full bg-[#0071E3] px-5 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#0077ED]">
                    Apply Interest
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </FooterPageLayout>
  );
}
