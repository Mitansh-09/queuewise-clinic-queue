import { AuthForm } from '@/components/auth-form'
import { SiteHeader } from '@/components/site-header'

export default function RegisterPage() {
  return <main className="shell"><SiteHeader /><section className="auth-page"><p className="eyebrow">Patient account</p><h1>Keep your clinic visit on track.</h1><p>Create an account to book one token at a time and follow its live status.</p><AuthForm mode="register" /></section></main>
}
