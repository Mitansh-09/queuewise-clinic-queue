import { AuthForm } from '@/components/auth-form'
import { SiteHeader } from '@/components/site-header'

export default function LoginPage() {
  return <main className="shell"><SiteHeader /><section className="auth-page"><p className="eyebrow">Welcome back</p><h1>Sign in to Queuewise</h1><p>Use your clinic or patient account to continue.</p><AuthForm mode="login" /></section></main>
}
