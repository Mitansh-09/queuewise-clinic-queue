import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Queuewise home">
        <span className="wordmark-mark" aria-hidden="true" />
        Queuewise
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/patient">Patient portal</Link>
        <Link href="/staff">Clinic staff</Link>
        <Link className="nav-action" href="/login">Sign in</Link>
      </nav>
    </header>
  )
}
