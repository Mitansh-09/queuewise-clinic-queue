'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Doctor = {
  id: string
  clinic_id: string
  display_name: string
  specialty: string
  qualifications: string | null
  experience_years: number | null
  languages: string[]
  search_terms: string[]
  listed?: boolean
  clinics: { name: string; address: string }
}

export function DoctorDirectory() {
  const router = useRouter()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: identity } = await supabase.auth.getUser()
        if (!identity.user) { router.push('/login?next=/doctors'); return }
        const { data, error: fetchError } = await supabase.from('clinic_doctors')
          .select('id,clinic_id,display_name,specialty,qualifications,experience_years,languages,search_terms,clinics!inner(name,address)')
          .eq('listed', true).order('display_name').limit(250)
        if (fetchError) throw fetchError
        if (!cancelled) setDoctors((data || []) as unknown as Doctor[])
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Doctor listings could not be loaded.')
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return doctors
    return doctors.filter((doctor) => [doctor.display_name, doctor.specialty, doctor.qualifications || '', doctor.clinics.name, doctor.clinics.address, ...doctor.search_terms, ...doctor.languages].join(' ').toLocaleLowerCase().includes(term))
  }, [doctors, query])

  return <main className="directory-page"><header className="health-topbar"><Link className="wordmark" href="/"><span className="wordmark-mark" aria-hidden="true" />MedVault</Link><nav aria-label="Health navigation"><Link href="/health">My health</Link><Link href="/care-guide">Care guide</Link><Link href="/patient">Clinic queue</Link></nav></header><div className="directory-content"><p className="eyebrow">Clinic directory</p><h1>Find a doctor by specialty or condition.</h1><p className="directory-intro">Search clinician profiles published by participating clinics. Condition tags are supplied by each clinic and do not establish a diagnosis.</p><label className="directory-search">Search name, specialty, or condition<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example, skin, asthma, or cardiology" /></label>{error && <p role="alert" className="form-message error">{error}</p>}{loading ? <p className="page-state">Loading clinic listings…</p> : filtered.length ? <div className="doctor-grid">{filtered.map((doctor) => <article className="doctor-card" key={doctor.id}><p className="eyebrow">{doctor.specialty}</p><h2>{doctor.display_name}</h2><p className="doctor-clinic">{doctor.clinics.name}</p><p>{doctor.clinics.address}</p>{doctor.qualifications && <p>{doctor.qualifications}</p>}{doctor.experience_years !== null && <p>{doctor.experience_years} years of experience</p>}{doctor.languages.length > 0 && <p>Languages: {doctor.languages.join(', ')}</p>}{doctor.search_terms.length > 0 && <div className="doctor-tags">{doctor.search_terms.map((tag) => <span key={tag}>{tag}</span>)}</div>}<Link className="button button-secondary" href={`/patient?clinic=${encodeURIComponent(doctor.clinic_id)}&doctor=${encodeURIComponent(doctor.display_name)}`}>View clinic queue</Link></article>)}</div> : <section className="directory-empty surface"><h2>{doctors.length ? 'No clinicians match that search.' : 'No clinic listings yet.'}</h2><p>{doctors.length ? 'Try another specialty, clinic, or condition tag.' : 'Clinic teams can add real doctor profiles from the staff console. This directory does not use sample listings.'}</p><Link className="button button-secondary" href="/staff">Clinic staff sign in</Link></section>}</div></main>
}

export function ClinicDoctorManager({ clinicId }: { clinicId: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error: fetchError } = await createClient().from('clinic_doctors')
          .select('id,clinic_id,display_name,specialty,qualifications,experience_years,languages,search_terms,listed,clinics!inner(name,address)')
          .eq('clinic_id', clinicId).order('display_name')
        if (fetchError) throw fetchError
        if (!cancelled) setDoctors((data || []) as unknown as Doctor[])
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Clinic listings could not be loaded.')
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [clinicId])

  async function addDoctor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const { data, error: insertError } = await createClient().from('clinic_doctors').insert({
        clinic_id: clinicId,
        display_name: String(values.get('name') || '').trim(),
        specialty: String(values.get('specialty') || '').trim(),
        qualifications: String(values.get('qualifications') || '').trim() || null,
        experience_years: String(values.get('experience') || '') ? Number(values.get('experience')) : null,
        languages: String(values.get('languages') || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10),
        search_terms: String(values.get('searchTerms') || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 24),
      }).select('id,clinic_id,display_name,specialty,qualifications,experience_years,languages,search_terms,listed,clinics!inner(name,address)').single()
      if (insertError) throw insertError
      setDoctors((items) => [...items, data as unknown as Doctor]); setMessage('Doctor profile is now listed.'); form.reset()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Doctor profile could not be saved.') }
    finally { setBusy(false) }
  }

  async function toggleListing(doctor: Doctor) {
    const listed = !doctor.listed
    const { error: updateError } = await createClient().from('clinic_doctors').update({ listed }).eq('id', doctor.id)
    if (updateError) return setError(updateError.message)
    setDoctors((items) => items.map((item) => item.id === doctor.id ? { ...item, listed } : item))
  }

  return <section className="surface doctor-manager"><div className="health-panel-heading"><div><p className="eyebrow">Clinic directory</p><h2>Doctor listings</h2></div></div>{error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<form className="doctor-manager-form" onSubmit={addDoctor}><label>Doctor name<input name="name" required minLength={2} maxLength={100} /></label><label>Specialty<input name="specialty" required minLength={2} maxLength={100} placeholder="For example, pediatrics" /></label><label>Qualifications<input name="qualifications" maxLength={200} /></label><label>Years of experience<input name="experience" type="number" min="0" max="70" /></label><label>Languages, separated by commas<input name="languages" placeholder="Hindi, English" /></label><label>Conditions or search terms<input name="searchTerms" placeholder="For example, asthma, allergies" /></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Add doctor profile'}</button></form><div className="health-list">{loading ? <p className="page-state">Loading clinic listings…</p> : doctors.map((doctor) => <article className="health-list-item" key={doctor.id}><div><h3>{doctor.display_name}</h3><p>{doctor.specialty} · {doctor.listed === false ? 'Hidden from directory' : 'Listed'}</p></div><button className="text-action" onClick={() => toggleListing(doctor)}>{doctor.listed === false ? 'Publish' : 'Hide listing'}</button></article>)}{!loading && doctors.length === 0 && <p className="empty-state">No doctor profiles have been added for this clinic.</p>}</div></section>
}
