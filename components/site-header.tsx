import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="MedVault home">
        <span className="wordmark-mark" aria-hidden="true" />
        MedVault
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/health">My health</Link>
        <Link href="/library">Health library</Link>
        <Link href="/doctors">Find doctors</Link>
        <Link className="nav-action" href="/login">Sign in</Link>
      </nav>
      <details className="site-menu">
        <summary aria-label="Open navigation menu"><span>Menu</span><i aria-hidden="true" /></summary>
        <nav aria-label="Mobile navigation">
          <Link href="/health">My health</Link>
          <Link href="/library">Health library</Link>
          <Link href="/care-guide">Care guide</Link>
          <Link href="/doctors">Find doctors</Link>
          <Link href="/staff">Clinic staff</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </details>
    </header>
  )
}
