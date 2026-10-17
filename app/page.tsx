import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const capabilities = [
  {
    number: '01',
    title: 'Keep health records together',
    description: 'Store reports, prescriptions, visit summaries, imaging, and vaccination documents in a private account. Organize them by your profile or a family member’s.',
    href: '/health',
    action: 'Open your health vault',
  },
  {
    number: '02',
    title: 'Keep track of medicines',
    description: 'Save medication details and reminder times, then log doses as taken. Follow the directions provided by your prescriber.',
    href: '/health',
    action: 'Manage medication reminders',
  },
  {
    number: '03',
    title: 'Find participating doctors',
    description: 'Browse real clinician profiles and specialties published by participating clinics. Listings appear when clinic teams add them.',
    href: '/doctors',
    action: 'Browse the directory',
  },
]

export default function Home() {
  return (
    <main className="home-page">
      <div className="shell">
        <SiteHeader />
        <section className="vault-hero" aria-labelledby="home-heading">
          <div className="vault-hero-copy">
            <p className="eyebrow">A personal health organizer</p>
            <h1 id="home-heading">Your health information, in one place.</h1>
            <p className="vault-hero-description">Bring your records, family health profiles, and medication reminders together. Find participating doctors and read clear, source-based health information when you need it.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/register">Create a patient account</Link>
              <Link className="button button-secondary" href="/library">Browse health topics</Link>
            </div>
            <p className="hero-caption">Your vault is private to your account. Records are not shared with clinics.</p>
          </div>

          <div className="vault-overview" aria-label="Types of information you can organize in MedVault">
            <div className="vault-overview-top">
              <span className="vault-overview-mark" aria-hidden="true"><span /></span>
              <div><p className="eyebrow">Your health toolkit</p><h2>Care, organized around you.</h2></div>
            </div>
            <div className="vault-overview-row"><span className="vault-row-number">01</span><div><h3>Personal records</h3><p>Reports, prescriptions, visits, and vaccinations</p></div><span className="vault-row-label">Private vault</span></div>
            <div className="vault-overview-row"><span className="vault-row-number">02</span><div><h3>Family profiles</h3><p>Keep each person’s health information organized</p></div><span className="vault-row-label">By profile</span></div>
            <div className="vault-overview-row"><span className="vault-row-number">03</span><div><h3>Medication routine</h3><p>Reminder times and a daily dose log</p></div><span className="vault-row-label">Your schedule</span></div>
            <div className="vault-overview-foot">Records stay in your account and are not shared with a clinic.</div>
          </div>
        </section>

        <section className="home-capabilities" aria-labelledby="capabilities-heading">
          <div className="home-section-intro">
            <div><p className="eyebrow">One place for everyday health admin</p><h2 id="capabilities-heading">Useful tools for you and your family.</h2></div>
            <p>MedVault helps you keep information organized and find the next useful step. It does not diagnose or replace a clinician.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((item) => (
              <article className="capability-card" key={item.number}>
                <span className="capability-number">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <Link href={item.href}>{item.action}<span aria-hidden="true"> ↗</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-guidance" aria-labelledby="guidance-heading">
          <div className="guidance-copy">
            <p className="eyebrow">Information and care navigation</p>
            <h2 id="guidance-heading">Know what to ask. Find where to start.</h2>
            <p>Search health topics for short summaries from MedlinePlus, with an optional link to the original source for more detail. The care guide can suggest a possible specialty match from a few words you enter.</p>
            <p className="guidance-boundary">These tools provide general information and basic keyword matching. They do not identify a disease, give a diagnosis, or assess urgency reliably.</p>
          </div>
          <div className="guidance-links">
            <Link className="guidance-link" href="/library"><span><small>HEALTH LIBRARY</small><strong>Read a short, sourced summary</strong><em>Search by health topic</em></span><b aria-hidden="true">↗</b></Link>
            <Link className="guidance-link" href="/care-guide"><span><small>CARE GUIDE</small><strong>Explore a possible specialty</strong><em>Match keywords to clinic specialties</em></span><b aria-hidden="true">↗</b></Link>
            <Link className="guidance-link" href="/doctors"><span><small>DOCTOR DIRECTORY</small><strong>Browse participating clinicians</strong><em>See clinic-published profiles</em></span><b aria-hidden="true">↗</b></Link>
          </div>
        </section>

        <section className="clinic-support" aria-labelledby="clinic-heading">
          <div><p className="eyebrow">When you need an in-person visit</p><h2 id="clinic-heading">Clinic services, connected to your care.</h2><p>Participating clinics can publish doctors and manage appointments. Patients can book a token, follow the queue estimate, and see updates while waiting.</p></div>
          <div className="clinic-steps" aria-label="Clinic queue steps">
            <div><span>01</span><strong>Choose a clinic doctor</strong></div>
            <div><span>02</span><strong>Book or check in</strong></div>
            <div><span>03</span><strong>Follow your queue</strong></div>
            <Link className="button button-secondary" href="/doctors">Find participating doctors</Link>
          </div>
        </section>

        <section className="home-privacy" aria-labelledby="privacy-heading">
          <div><p className="eyebrow">Built around clear boundaries</p><h2 id="privacy-heading">Your records remain yours.</h2></div>
          <ul>
            <li>Health documents are stored in a private account and can be opened only by the signed-in account that uploaded them.</li>
            <li>MedVault does not share vault records with doctors or clinics. The clinic queue is a separate service.</li>
            <li>Health library summaries are general education. For personal advice, speak with a qualified healthcare professional.</li>
          </ul>
        </section>
        <SiteFooter />
      </div>
    </main>
  )
}
