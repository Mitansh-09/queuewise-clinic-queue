import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Queuewise is designed for clinics that need a calmer, clearer waiting room.</p>
      <div>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  )
}
