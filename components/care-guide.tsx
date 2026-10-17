'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Listing = { id: string; clinic_id: string; display_name: string; specialty: string; clinics: { name: string; address: string } }
type Recommendation = { specialty: string; note: string }

const routes: Array<{ specialty: string; words: string[]; note: string }> = [
  { specialty: 'Dermatology', words: ['skin', 'rash', 'acne', 'itch', 'hair', 'nail'], note: 'Your words match a skin and hair specialty.' },
  { specialty: 'Pediatrics', words: ['child', 'baby', 'infant', 'kid', 'vaccin'], note: 'Your words match child health care.' },
  { specialty: 'Cardiology', words: ['heart', 'blood pressure', 'palpitation'], note: 'Your words match heart and circulation care.' },
  { specialty: 'Gastroenterology', words: ['stomach', 'digest', 'bowel', 'acidity', 'liver'], note: 'Your words match digestive health care.' },
  { specialty: 'Orthopedics', words: ['bone', 'joint', 'back', 'knee', 'fracture'], note: 'Your words match bone and joint care.' },
  { specialty: 'Ophthalmology', words: ['eye', 'vision', 'sight'], note: 'Your words match eye care.' },
  { specialty: 'Obstetrics and Gynecology', words: ['pregnan', 'period', 'menstrual', 'women'], note: 'Your words match women’s health care.' },
  { specialty: 'Endocrinology', words: ['diabetes', 'thyroid', 'hormone'], note: 'Your words match hormone and metabolic care.' },
  { specialty: 'Pulmonology', words: ['asthma', 'lung', 'breath', 'cough'], note: 'Your words match respiratory care.' },
  { specialty: 'Oncology', words: ['cancer', 'tumour', 'tumor'], note: 'Your words match cancer care.' },
]

export function CareGuide() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [text, setText] = useState('')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: identity } = await supabase.auth.getUser()
        if (!identity.user) { router.push('/login?next=/care-guide'); return }
        const { data, error: fetchError } = await supabase.from('clinic_doctors')
          .select('id,clinic_id,display_name,specialty,clinics!inner(name,address)')
          .eq('listed', true).order('display_name').limit(250)
        if (fetchError) throw fetchError
        if (!cancelled) setListings((data || []) as unknown as Listing[])
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Clinic listings could not be loaded.')
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = text.trim().toLocaleLowerCase()
    if (normalized.length < 3) return setError('Add a few words about the type of care you are looking for.')
    setError('')
    const match = routes.find((route) => route.words.some((word) => normalized.includes(word)))
    setRecommendation(match ? { specialty: match.specialty, note: match.note } : {
      specialty: 'General Medicine',
      note: 'The basic keyword guide could not find a specialty match. General Medicine is a broad starting point, if available.',
    })
  }

  const matchedListings = recommendation ? listings.filter((doctor) => doctor.specialty.toLocaleLowerCase() === recommendation.specialty.toLocaleLowerCase()) : []

  return <main className="care-guide-page"><header className="health-topbar"><Link className="wordmark" href="/"><span className="wordmark-mark" aria-hidden="true" />MedVault</Link><nav aria-label="Health navigation"><Link href="/doctors">Find doctors</Link><Link href="/health">My health</Link><Link href="/patient">Clinic queue</Link></nav></header><div className="guide-content"><p className="eyebrow">Care navigation</p><h1>Find a place to start.</h1><p className="guide-intro">Describe the kind of care you are looking for. This simple keyword guide can show matching specialties from participating clinics.</p><div className="guide-chat"><div className="guide-message guide-message-system"><span>MedVault care guide</span><p>What would you like help finding?</p></div><form onSubmit={submit} className="guide-form"><label htmlFor="care-description">A few words about the concern</label><textarea id="care-description" value={text} onChange={(event) => { setText(event.target.value); setRecommendation(null) }} maxLength={500} rows={4} placeholder="For example: I am looking for help with a skin rash" /><p className="guide-privacy">This text is checked in your browser only. It is not saved to your account or sent to a clinic.</p><button className="button button-primary">Find a specialty</button></form>{error && <p className="form-message error" role="alert">{error}</p>}{recommendation && <div className="guide-result" role="status"><p className="eyebrow">Possible specialty match</p><h2>{recommendation.specialty}</h2><p>{recommendation.note}</p><p className="guide-boundary">This is a basic keyword match. It cannot assess symptoms, urgency, or diagnose a condition. A clinician can help decide what care is right for you.</p>{loading ? <p>Checking participating clinics…</p> : matchedListings.length > 0 ? <div className="guide-clinicians"><h3>Clinics listing this specialty</h3>{matchedListings.map((doctor) => <article key={doctor.id}><div><strong>{doctor.display_name}</strong><p>{doctor.clinics.name} · {doctor.clinics.address}</p></div><Link className="text-action" href={`/patient?clinic=${encodeURIComponent(doctor.clinic_id)}&doctor=${encodeURIComponent(doctor.display_name)}`}>View queue</Link></article>)}</div> : <p>No participating clinic currently lists this specialty. <Link href="/doctors">Browse all doctors</Link>.</p>}</div>}</div><aside className="emergency-note"><strong>Need urgent help?</strong><p>If this may be an emergency, do not wait for a directory result. Call <a href="tel:112">112 in India</a> or go to the nearest emergency department.</p></aside><p className="guide-disclosure">This is not an AI medical chatbot. It uses a small set of specialty keywords and does not provide health advice.</p></div></main>
}
