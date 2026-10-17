import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>MedVault brings personal health records and participating clinic services together.</p>
      <div>
        <Link href="/library">Health library</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  )
}
