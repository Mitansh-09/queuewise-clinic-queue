'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CareProfile = { id: string; display_name: string; relationship: string; date_of_birth: string | null }
type HealthRecord = { id: string; care_profile_id: string; title: string; category: string; record_date: string | null; notes: string | null; storage_path: string; mime_type: string; byte_size: number }
type Medication = { id: string; care_profile_id: string; name: string; dose: string; instructions: string | null; start_date: string; end_date: string | null; reminder_time: string | null; active: boolean }
type MedicationLog = { medication_id: string }

const todayInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const timeInIndia = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
const categories = [
  ['lab_result', 'Lab result'], ['prescription', 'Prescription'], ['visit_summary', 'Visit summary'],
  ['vaccination', 'Vaccination'], ['imaging', 'Imaging'], ['other', 'Other'],
]

export function HealthVault() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [profiles, setProfiles] = useState<CareProfile[]>([])
  const [profileId, setProfileId] = useState('')
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [taken, setTaken] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: identity } = await supabase.auth.getUser()
        if (!identity.user) { router.push('/login'); return }
        const [profileResult, recordResult, medicationResult, logResult] = await Promise.all([
          supabase.from('care_profiles').select('id,display_name,relationship,date_of_birth').order('created_at'),
          supabase.from('medical_records').select('*').order('record_date', { ascending: false }),
          supabase.from('medications').select('*').eq('active', true).order('reminder_time'),
          supabase.from('medication_logs').select('medication_id').eq('taken_on', todayInIndia()),
        ])
        if (profileResult.error) throw profileResult.error
        if (recordResult.error) throw recordResult.error
        if (medicationResult.error) throw medicationResult.error
        if (logResult.error) throw logResult.error
        if (cancelled) return
        const nextProfiles = (profileResult.data || []) as CareProfile[]
        setUserId(identity.user.id)
        setProfiles(nextProfiles)
        setProfileId(nextProfiles[0]?.id || '')
        setRecords((recordResult.data || []) as HealthRecord[])
        setMedications((medicationResult.data || []) as Medication[])
        setTaken(((logResult.data || []) as MedicationLog[]).map((item) => item.medication_id))
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The health vault could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const profile = profiles.find((item) => item.id === profileId)
  const visibleRecords = useMemo(() => records.filter((item) => item.care_profile_id === profileId), [records, profileId])
  const visibleMedications = useMemo(() => medications.filter((item) => item.care_profile_id === profileId), [medications, profileId])

  async function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(event.currentTarget)
    try {
      const { data, error: saveError } = await createClient().from('care_profiles').insert({
        account_id: userId,
        display_name: String(values.get('displayName') || '').trim(),
        relationship: String(values.get('relationship') || ''),
        date_of_birth: String(values.get('dateOfBirth') || '') || null,
        authorization_confirmed: values.get('authorized') === 'on',
      }).select('id,display_name,relationship,date_of_birth').single()
      if (saveError) throw saveError
      const added = data as CareProfile
      setProfiles((items) => [...items, added]); setProfileId(added.id); setMessage('Health profile added.')
      form.reset()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this profile.') }
    finally { setBusy(false) }
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profileId) return setError('Add a health profile first.')
    setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    const file = values.get('file')
    if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setBusy(false); return setError('Choose a PDF, JPG, or PNG file up to 10 MB.')
    }
    const recordId = crypto.randomUUID()
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${userId}/${recordId}.${extension}`
    const supabase = createClient()
    try {
      const { error: metadataError } = await supabase.from('medical_records').insert({
        id: recordId,
        care_profile_id: profileId,
        title: String(values.get('title') || '').trim(),
        category: String(values.get('category') || 'other'),
        record_date: String(values.get('recordDate') || '') || null,
        notes: String(values.get('notes') || '').trim() || null,
        storage_path: storagePath,
        mime_type: file.type,
        byte_size: file.size,
      })
      if (metadataError) throw metadataError
      const { error: uploadError } = await supabase.storage.from('health-records').upload(storagePath, file, { contentType: file.type, upsert: false })
      if (uploadError) {
        await supabase.from('medical_records').delete().eq('id', recordId)
        throw uploadError
      }
      const { data: newRecord, error: readError } = await supabase.from('medical_records').select('*').eq('id', recordId).single()
      if (readError) throw readError
      setRecords((items) => [newRecord as HealthRecord, ...items]); setMessage('Private record saved to this account.')
      form.reset()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The record could not be saved.') }
    finally { setBusy(false) }
  }

  async function openRecord(record: HealthRecord) {
    setError('')
    const { data, error: fileError } = await createClient().storage.from('health-records').createSignedUrl(record.storage_path, 60)
    if (fileError || !data) return setError(fileError?.message || 'This file is not available.')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function removeRecord(record: HealthRecord) {
    if (!window.confirm(`Delete “${record.title}” from this account?`)) return
    setBusy(true); setError(''); setMessage('')
    const supabase = createClient()
    try {
      const { error: fileError } = await supabase.storage.from('health-records').remove([record.storage_path])
      if (fileError) throw fileError
      const { error: rowError } = await supabase.from('medical_records').delete().eq('id', record.id)
      if (rowError) throw rowError
      setRecords((items) => items.filter((item) => item.id !== record.id)); setMessage('Record deleted.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The record could not be deleted.') }
    finally { setBusy(false) }
  }

  async function addMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profileId) return setError('Add a health profile first.')
    setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const { data, error: saveError } = await createClient().from('medications').insert({
        care_profile_id: profileId,
        name: String(values.get('name') || '').trim(),
        dose: String(values.get('dose') || '').trim(),
        instructions: String(values.get('instructions') || '').trim() || null,
        start_date: String(values.get('startDate') || todayInIndia()),
        end_date: String(values.get('endDate') || '') || null,
        reminder_time: String(values.get('reminderTime') || '') || null,
      }).select('*').single()
      if (saveError) throw saveError
      setMedications((items) => [...items, data as Medication]); setMessage('Medication reminder saved. Follow the prescriber’s directions.'); form.reset()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The medication could not be saved.') }
    finally { setBusy(false) }
  }

  async function markTaken(medication: Medication) {
    setError('')
    const { error: logError } = await createClient().from('medication_logs').insert({ medication_id: medication.id, taken_on: todayInIndia() })
    if (logError) return setError(logError.message)
    setTaken((items) => [...items, medication.id])
  }

  async function stopMedication(medication: Medication) {
    const { error: updateError } = await createClient().from('medications').update({ active: false }).eq('id', medication.id)
    if (updateError) return setError(updateError.message)
    setMedications((items) => items.filter((item) => item.id !== medication.id))
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  if (loading) return <p className="page-state">Opening your private health vault…</p>

  return <main className="health-page">
    <header className="health-topbar"><Link className="wordmark" href="/"><span className="wordmark-mark" aria-hidden="true" />MedVault</Link><nav aria-label="Health navigation"><Link href="/doctors">Find doctors</Link><Link href="/care-guide">Care guide</Link><Link href="/patient">Clinic queue</Link></nav><button className="health-signout" onClick={signOut}>Sign out</button></header>
    <div className="health-content">
      <div className="health-heading"><div><p className="eyebrow">Personal health</p><h1>Your records, in one place.</h1><p>Keep your family profiles, documents, and medication reminders together.</p></div><Link className="button button-secondary" href="/doctors">Browse doctors</Link></div>
      {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
      <section className="health-profile-bar surface"><label>Health profile<select value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">Choose a profile</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.relationship}</option>)}</select></label><span>{profile ? `Managing ${profile.display_name}’s health information` : 'Add a profile to begin'}</span></section>
      {!profiles.length && <section className="surface health-onboarding"><p className="eyebrow">Start your vault</p><h2>Add yourself or a family member</h2><p>Family profiles are private to this account. Only add people whose information you are authorized to manage.</p><form onSubmit={addProfile} className="health-form"><label>Name<input name="displayName" required minLength={2} maxLength={100} /></label><label>Relationship<select name="relationship" required defaultValue="self"><option value="self">Self</option><option value="child">Child</option><option value="parent">Parent</option><option value="spouse">Spouse</option><option value="dependent">Other dependent</option></select></label><label>Date of birth <span className="optional">Optional</span><input name="dateOfBirth" type="date" max={todayInIndia()} /></label><label className="consent-check"><input name="authorized" type="checkbox" required />I confirm I am the person named or am authorized to manage this person&apos;s health information.</label><button className="button button-primary" disabled={busy}>Add profile</button></form></section>}
      {profiles.length > 0 && <>
        <div className="health-columns">
          <section className="surface health-panel"><div className="health-panel-heading"><div><p className="eyebrow">Health documents</p><h2>Medical records</h2></div><span>{visibleRecords.length} saved</span></div>
            <form onSubmit={addRecord} className="health-form"><label>Record name<input name="title" required minLength={2} maxLength={120} placeholder="For example, blood test" /></label><div className="form-row"><label>Type<select name="category" defaultValue="lab_result">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Record date<input name="recordDate" type="date" max={todayInIndia()} /></label></div><label>Short note <span className="optional">Optional</span><input name="notes" maxLength={1000} placeholder="A note to help you find it later" /></label><label className="file-field">Choose a file<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" /><small>PDF, JPG, or PNG. Up to 10 MB. Files stay private to your account.</small></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving record…' : 'Save private record'}</button></form>
            <div className="health-list">{visibleRecords.map((record) => <article key={record.id} className="health-list-item"><div><h3>{record.title}</h3><p>{categories.find(([value]) => value === record.category)?.[1]}{record.record_date ? ` · ${record.record_date}` : ''}</p>{record.notes && <p>{record.notes}</p>}</div><div className="health-actions"><button className="text-action" onClick={() => openRecord(record)}>Open</button><button className="text-action" disabled={busy} onClick={() => removeRecord(record)}>Delete</button></div></article>)}{visibleRecords.length === 0 && <p className="empty-state">No records saved for this profile yet.</p>}</div>
          </section>
          <section className="surface health-panel"><div className="health-panel-heading"><div><p className="eyebrow">Daily routine</p><h2>Medications</h2></div><span>{visibleMedications.length} active</span></div>
            <form onSubmit={addMedication} className="health-form"><label>Medication name<input name="name" required minLength={2} maxLength={120} /></label><div className="form-row"><label>Dose<input name="dose" required maxLength={120} placeholder="As written by your prescriber" /></label><label>Reminder time<input name="reminderTime" type="time" /></label></div><label>Instructions <span className="optional">Optional</span><input name="instructions" maxLength={500} placeholder="Follow the directions on your prescription" /></label><div className="form-row"><label>Start date<input name="startDate" type="date" defaultValue={todayInIndia()} required /></label><label>End date <span className="optional">Optional</span><input name="endDate" type="date" min={todayInIndia()} /></label></div><button className="button button-primary" disabled={busy}>Add medication</button></form>
            <div className="health-list">{visibleMedications.map((medication) => { const loggedToday = taken.includes(medication.id); const dueNow = Boolean(medication.reminder_time && medication.reminder_time.slice(0, 5) <= timeInIndia() && !loggedToday); return <article key={medication.id} className="health-list-item"><div><h3>{medication.name} <span className="med-dose">{medication.dose}</span></h3><p>{medication.reminder_time ? `Daily reminder at ${medication.reminder_time.slice(0, 5)}` : 'No reminder time set'}{dueNow ? ' · Due now' : ''}{medication.end_date ? ` · Through ${medication.end_date}` : ''}</p>{medication.instructions && <p>{medication.instructions}</p>}</div><div className="health-actions">{loggedToday ? <span className="taken-label">Logged today</span> : <button className="text-action" onClick={() => markTaken(medication)}>Log today</button>}<button className="text-action" onClick={() => stopMedication(medication)}>Stop</button></div></article>})}{visibleMedications.length === 0 && <p className="empty-state">No medication reminders for this profile.</p>}</div>
            <p className="health-disclaimer">Reminders help you track a schedule. They do not replace a prescription or advice from a clinician.</p>
          </section>
        </div>
        {profiles.length < 10 && <details className="add-profile-details"><summary>Add another family profile</summary><form onSubmit={addProfile} className="health-form health-form-inline"><label>Name<input name="displayName" required minLength={2} maxLength={100} /></label><label>Relationship<select name="relationship" required defaultValue="child"><option value="child">Child</option><option value="parent">Parent</option><option value="spouse">Spouse</option><option value="dependent">Other dependent</option></select></label><label>Date of birth<input name="dateOfBirth" type="date" max={todayInIndia()} /></label><label className="consent-check"><input name="authorized" type="checkbox" required />I am authorized to manage this person&apos;s health information.</label><button className="button button-secondary" disabled={busy}>Add profile</button></form></details>}
      </>}
      <p className="vault-boundary">Your records are not shared with doctors or clinics from this vault. Sharing requires a separate consent feature.</p>
    </div>
  </main>
}
