import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function Home() {
  return (
    <main>
      <div className="shell">
        <SiteHeader />
        <section className="hero">
          <div>
            <p className="eyebrow">A personal health organizer</p>
            <h1>Your health information, in one place.</h1>
            <p className="hero-copy">Keep medical documents organized, track medication reminders for your family, and find clinicians at participating clinics. Your private vault stays under your account.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/register">Create a patient account</Link>
              <Link className="button button-secondary" href="/doctors">Find a doctor</Link>
            </div>
            <p className="hero-caption">Health organizer and clinic directory. Not an emergency service or medical advice.</p>
          </div>
          <div className="flow-panel" aria-label="MedVault health tools">
            <div className="flow-panel-head"><span className="flow-mark" aria-hidden="true" /><div><p className="eyebrow">Your health toolkit</p><h2>Care, organized around you</h2></div></div>
            <div className="flow-step"><span className="flow-index">01</span><div><h3>Personal records</h3><p>Store reports and visit documents in your private account.</p></div><span className="flow-state">Private vault</span></div>
            <div className="flow-step"><span className="flow-index">02</span><div><h3>Family profiles</h3><p>Keep care notes and records organized by family member.</p></div><span className="flow-state">Your account</span></div>
            <div className="flow-step"><span className="flow-index">03</span><div><h3>Find clinic care</h3><p>Browse real clinician listings and view available queue sessions.</p></div><span className="flow-state">Clinic listed</span></div>
            <div className="flow-panel-foot"><span>Health data is not shared with clinics</span></div>
          </div>
        </section>

        <section className="workflow-section" aria-labelledby="workflow-heading">
          <p className="eyebrow">For patients and clinic teams</p>
          <h2 id="workflow-heading">The practical details of everyday care.</h2>
          <div className="workflow-grid">
            <article><span>01</span><h3>Keep records together</h3><p>Upload reports, prescriptions, visit summaries, and vaccination documents for each profile.</p></article>
            <article><span>02</span><h3>Track a medication schedule</h3><p>Save a reminder time, log a dose, and follow the directions from your prescriber.</p></article>
            <article><span>03</span><h3>Find participating clinicians</h3><p>Search clinic-published specialties and condition tags, then view the clinic queue.</p></article>
          </div>
        </section>

        <section className="principles">
          <div><p className="eyebrow">Privacy and care boundaries</p><h2>Organized, with clear limits.</h2></div>
          <ul>
            <li>Health files are stored in a private bucket and are accessible only to the signed-in account that uploaded them.</li>
            <li>The care guide uses simple keyword matching. It does not diagnose, assess urgency, or send the text to a model.</li>
            <li>Records are not shared with doctors. You can still book a clinic queue token separately through a participating clinic.</li>
          </ul>
        </section>
        <SiteFooter />
      </div>
    </main>
  )
}
