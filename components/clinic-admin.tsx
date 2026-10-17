'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Closure = { id: string; closed_on: string; doctor_name: string | null; reason: string | null }

export function ClinicAdmin({ clinicId }: { clinicId: string }) {
  const [cutoff, setCutoff] = useState('60')
  const [online, setOnline] = useState(true)
  const [closures, setClosures] = useState<Closure[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [settings, dates] = await Promise.all([
        supabase.from('clinic_settings').select('*').eq('clinic_id', clinicId).maybeSingle(),
        supabase.from('clinic_closures').select('id,closed_on,doctor_name,reason').eq('clinic_id', clinicId).gte('closed_on', new Date().toLocaleDateString('en-CA')).order('closed_on'),
      ])
      if (cancelled) return
      if (settings.error) setError(settings.error.message)
      else if (settings.data) { setCutoff(String(settings.data.default_cancellation_cutoff_minutes)); setOnline(settings.data.allow_online_booking) }
      if (dates.error) setError(dates.error.message)
      else setClosures((dates.data || []) as Closure[])
    }
    load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Clinic settings could not be loaded.'))
    return () => { cancelled = true }
  }, [clinicId])

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const { error: saveError } = await createClient().rpc('set_clinic_settings', { p_clinic_id: clinicId, p_cutoff: Number(cutoff), p_online: online })
    if (saveError) setError(saveError.message); else setMessage('Clinic booking settings saved.')
    setBusy(false)
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    const { error: addError } = await createClient().rpc('set_clinic_staff', { p_clinic_id: clinicId, p_user_id: String(values.get('userId') || '').trim(), p_role: String(values.get('role') || 'receptionist') })
    if (addError) setError(addError.message); else { setMessage('Clinic role saved.'); form.reset() }
    setBusy(false)
  }

  async function addClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    const { data, error: addError } = await createClient().rpc('set_clinic_closure', {
      p_clinic_id: clinicId,
      p_closed_on: String(values.get('date') || ''),
      p_doctor_name: String(values.get('doctorName') || '').trim() || null,
      p_reason: String(values.get('reason') || '').trim() || null,
    })
    if (addError) setError(addError.message); else { setClosures((items) => [...items.filter((item) => item.id !== data.id), data as Closure].sort((a, b) => a.closed_on.localeCompare(b.closed_on))); setMessage('Closure day saved.'); form.reset() }
    setBusy(false)
  }

  async function removeClosure(id: string) {
    const { error: removeError } = await createClient().rpc('remove_clinic_closure', { p_closure_id: id })
    if (removeError) setError(removeError.message); else setClosures((items) => items.filter((item) => item.id !== id))
  }

  return <section className="surface clinic-admin-panel">
    <p className="eyebrow">Clinic administration</p><h2>Clinic settings</h2>
    {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
    <form className="schedule-fields" onSubmit={saveSettings}>
      <label>Cancellation cutoff before session, in minutes<input type="number" min="0" max="1440" value={cutoff} onChange={(event) => setCutoff(event.target.value)} /></label>
      <label className="check-label"><input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} /> Allow online bookings</label>
      <button className="button button-primary" disabled={busy}>Save settings</button>
    </form>
    <h3>Clinic staff accounts</h3><p className="helper-text">Enter the account UUID from the clinic’s registered staff member. Role changes are restricted to clinic admins.</p>
    <form className="schedule-fields" onSubmit={addStaff}>
      <label>Account UUID<input name="userId" required /></label>
      <label>Clinic role<select name="role"><option value="receptionist">Receptionist</option><option value="doctor">Doctor</option><option value="admin">Clinic admin</option></select></label>
      <button className="button button-secondary" disabled={busy}>Save staff role</button>
    </form>
    <h3>Leave and closure days</h3>
    <form className="schedule-fields" onSubmit={addClosure}>
      <label>Date<input type="date" name="date" required min={new Date().toLocaleDateString('en-CA')} /></label>
      <label>Doctor name, or leave blank for whole clinic<input name="doctorName" /></label>
      <label>Reason (optional)<input name="reason" maxLength={200} /></label>
      <button className="button button-secondary" disabled={busy}>Add closure</button>
    </form>
    <div className="health-list">{closures.map((closure) => <article className="health-list-item" key={closure.id}><div><strong>{closure.closed_on}</strong><p>{closure.doctor_name || 'Whole clinic'}{closure.reason ? ` · ${closure.reason}` : ''}</p></div><button type="button" className="text-action" onClick={() => removeClosure(closure.id)}>Remove</button></article>)}{closures.length === 0 && <p className="empty-state">No future closure days recorded.</p>}</div>
  </section>
}
