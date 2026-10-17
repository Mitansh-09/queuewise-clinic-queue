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
            <p className="eyebrow">A clearer clinic visit</p>
            <h1>Know your place. Plan your visit.</h1>
            <p className="hero-copy">Queuewise gives patients a token and an estimated wait, while clinic staff manage the day&apos;s queue and doctor sessions from one place.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/register">Book a clinic token</Link>
              <Link className="button button-secondary" href="/staff">Staff sign in</Link>
            </div>
            <p className="hero-caption">For everyday clinic visits. Queuewise is not an emergency service.</p>
          </div>
          <div className="flow-panel" aria-label="How Queuewise works">
            <div className="flow-panel-head"><span className="flow-mark" aria-hidden="true" /><div><p className="eyebrow">How it works</p><h2>One shared queue</h2></div></div>
            <div className="flow-step"><span className="flow-index">01</span><div><h3>Patient books</h3><p>A token is assigned to an available doctor session.</p></div><span className="flow-state">Token issued</span></div>
            <div className="flow-connector" aria-hidden="true" />
            <div className="flow-step"><span className="flow-index">02</span><div><h3>Staff advances</h3><p>The front desk calls the next patient and records no-shows.</p></div><span className="flow-state">Staff controlled</span></div>
            <div className="flow-connector" aria-hidden="true" />
            <div className="flow-step"><span className="flow-index">03</span><div><h3>Patient follows</h3><p>Queue position and wait estimate update as the queue moves.</p></div><span className="flow-state">Live updates</span></div>
            <div className="flow-panel-foot"><span>Wait times are estimates</span><span>·</span><span>Clinic data stays private</span></div>
          </div>
        </section>

        <section className="workflow-section" aria-labelledby="workflow-heading">
          <p className="eyebrow">The daily workflow</p>
          <h2 id="workflow-heading">A queue built around the people using it.</h2>
          <div className="workflow-grid">
            <article><span>01</span><h3>Book a token</h3><p>Patients choose an available clinic session and receive one token for that queue.</p></article>
            <article><span>02</span><h3>Follow the queue</h3><p>Queue position and the estimated wait change as appointments are served or closed.</p></article>
            <article><span>03</span><h3>Run the desk</h3><p>Staff call the next patient, record a no-show, and close tokens when the day is full.</p></article>
          </div>
        </section>

        <section className="principles">
          <div><p className="eyebrow">Built for real clinics</p><h2>Useful details, contained data.</h2></div>
          <ul>
            <li>Every token is assigned atomically, so two patients cannot receive the same number.</li>
            <li>Patients see only their own booking. Clinic staff see the queue for their clinic.</li>
            <li>Wait time is an estimate based on people ahead and the clinic&apos;s configured average consultation time.</li>
          </ul>
        </section>
        <SiteFooter />
      </div>
    </main>
  )
}
