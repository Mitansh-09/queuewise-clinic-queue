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
            <p className="eyebrow">For small clinics</p>
            <h1>Clinic queues, visible as they move.</h1>
            <p className="hero-copy">Patients can take a token, see a realistic wait estimate, and arrive with context. Your front desk controls the day&apos;s queue from one focused screen.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/register">Create patient account</Link>
              <Link className="button button-secondary" href="/staff">Open staff console</Link>
            </div>
          </div>
          <div className="queue-card" aria-label="Queue example">
            <div className="queue-card-head"><span>Today&apos;s queue</span><span className="status-serving">Now serving 12</span></div>
            <div className="queue-row current"><strong>12</strong><span>In consultation</span><time>Started 10:40</time></div>
            <div className="queue-row"><strong>13</strong><span>Next</span><time>About 10 min</time></div>
            <div className="queue-row"><strong>14</strong><span>Waiting</span><time>About 20 min</time></div>
            <p className="queue-note">The real queue updates for everyone when staff takes the next patient.</p>
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
