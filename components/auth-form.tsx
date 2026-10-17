'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')

    try {
      const supabase = createClient()
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        router.push('/patient')
        return
      }

      const displayName = String(form.get('displayName') || '').trim()
      if (displayName.length < 2) throw new Error('Enter the name you would like the clinic to use.')
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/patient` },
      })
      if (signUpError) throw signUpError
      if (!data.session) {
        setMessage('Check your email to confirm the account, then return here to sign in.')
      } else {
        router.push('/patient')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const register = mode === 'register'
  return (
    <form className="auth-form" onSubmit={submit}>
      {register && <label>Full name<input name="displayName" required minLength={2} autoComplete="name" /></label>}
      <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} /></label>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Please wait' : register ? 'Create account' : 'Sign in'}</button>
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to Queuewise?'} <Link href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link></p>
    </form>
  )
}
