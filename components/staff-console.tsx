'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Appointment, Clinic, Schedule } from '@/lib/types'

const today = () => new Date().toLocaleDateString('en-CA')

export function StaffConsole() {
  const router = useRouter()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clinicId, setClinicId] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadQueue = useCallback(async (id: string) => {
    if (!id) return setAppointments([])
    const { data, error: queueError } = await createClient().from('appointments').select('*').eq('schedule_id', id).order('token_number')
    if (queueError) throw queueError
    setAppointments((data || []) as Appointment[])
  }, [])

  const loadSchedules = useCallback(async (id: string) => {
    if (!id) return setSchedules([])
    const { data, error: schedulesError } = await createClient().from('clinic_schedules').select('*')
      .eq('clinic_id', id).gte('service_date', today()).order('service_date').order('opens_at')
    if (schedulesError) throw schedulesError
    setSchedules((data || []) as Schedule[])
  }, [])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    async function load() {
      try {
        const supabase = createClient()
        const { data: identity } = await supabase.auth.getUser()
        if (!identity.user) { router.push('/login'); return }
        const { data: memberships, error: membershipError } = await supabase.from('staff_members').select('clinic_id')
        if (membershipError) throw membershipError
        const ids = (memberships || []).map((membership) => membership.clinic_id)
        if (ids.length) {
          const { data, error: clinicError } = await supabase.from('clinics').select('*').in('id', ids).order('name')
          if (clinicError) throw clinicError
          setClinics((data || []) as Clinic[])
        }
        channel = supabase.channel(`staff-queue-${identity.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          if (scheduleId) loadQueue(scheduleId).catch(() => undefined)
        }).subscribe()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load the staff console.')
      } finally { setLoading(false) }
    }
    load()
    return () => { if (channel) createClient().removeChannel(channel) }
  }, [loadQueue, router, scheduleId])

  useEffect(() => {
    if (!clinicId) return
    let cancelled = false
    async function load() {
      try {
        const { data, error: schedulesError } = await createClient().from('clinic_schedules').select('*')
          .eq('clinic_id', clinicId).gte('service_date', today()).order('service_date').order('opens_at')
        if (schedulesError) throw schedulesError
        if (!cancelled) setSchedules((data || []) as Schedule[])
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load schedules.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [clinicId])

  useEffect(() => {
    if (!scheduleId) return
    let cancelled = false
    async function load() {
      try {
        const { data, error: queueError } = await createClient().from('appointments').select('*').eq('schedule_id', scheduleId).order('token_number')
        if (queueError) throw queueError
        if (!cancelled) setAppointments((data || []) as Appointment[])
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load queue.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [scheduleId])

  const selectedSchedule = useMemo(() => schedules.find((item) => item.id === scheduleId), [schedules, scheduleId])
  const active = appointments.filter((item) => item.status === 'waiting' || item.status === 'serving')
  const serving = active.find((item) => item.status === 'serving')
  const waiting = active.filter((item) => item.status === 'waiting')

  async function action(fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>) {
    setWorking(true); setError(''); setMessage('')
    try {
      const { error: actionError } = await fn()
      if (actionError) throw actionError
      if (scheduleId) await loadQueue(scheduleId)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That action could not be completed.') }
    finally { setWorking(false) }
  }

  function nextPatient() {
    if (!clinicId || !scheduleId) return
    action(async () => {
      const result = await createClient().rpc('advance_queue', { p_clinic_id: clinicId, p_schedule_id: scheduleId })
      if (!result.error) setMessage(result.data ? `Token ${(result.data as Appointment).token_number} is now being served.` : 'There are no waiting tokens left.')
      return result
    })
  }

  function markNoShow(id: string) {
    action(() => createClient().rpc('set_queue_status', { p_appointment_id: id, p_next_status: 'no_show' }))
  }

  function toggleTokens() {
    if (!selectedSchedule) return
    action(async () => {
      const result = await createClient().rpc('set_token_acceptance', { p_schedule_id: selectedSchedule.id, p_accepting: !selectedSchedule.accepting_tokens })
      if (!result.error) { await loadSchedules(clinicId); setMessage(selectedSchedule.accepting_tokens ? 'New tokens are now closed.' : 'New tokens are now open.') }
      return result
    })
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clinicId) return setError('Choose a clinic before creating a schedule.')
    const form = new FormData(event.currentTarget)
    setWorking(true); setError(''); setMessage('')
    try {
      const { error: scheduleError } = await createClient().rpc('create_clinic_schedule', {
        p_clinic_id: clinicId,
        p_doctor_name: String(form.get('doctorName') || '').trim(),
        p_service_date: String(form.get('serviceDate') || ''),
        p_opens_at: String(form.get('opensAt') || ''),
        p_closes_at: String(form.get('closesAt') || ''),
        p_average_minutes: Number(form.get('averageMinutes')),
        p_capacity: Number(form.get('capacity')),
      })
      if (scheduleError) throw scheduleError
      event.currentTarget.reset()
      await loadSchedules(clinicId)
      setMessage('Schedule saved. Patients can now see it in the booking form.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The schedule could not be saved.') }
    finally { setWorking(false) }
  }

  async function signOut() { await createClient().auth.signOut(); router.push('/') }

  if (loading) return <p className="page-state">Loading the staff console…</p>
  return (
    <div className="portal-layout staff-layout">
      <aside className="portal-side"><Link className="wordmark" href="/"><span className="wordmark-mark" />Queuewise</Link><p>Clinic staff</p><button className="link-button" onClick={signOut}>Sign out</button></aside>
      <main className="portal-main">
        <header className="portal-title"><div><p className="eyebrow">Front desk and doctor view</p><h1>Run today&apos;s queue</h1></div><Link className="button button-secondary" href="/patient">Patient portal</Link></header>
        {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
        {!clinics.length ? <section className="surface setup-note"><h2>Your staff account needs a clinic</h2><p>An administrator needs to add your account to a clinic in the <code>staff_members</code> table. The README contains the exact setup query.</p></section> : <>
          <section className="surface control-bar"><label>Clinic<select value={clinicId} onChange={(event) => { setClinicId(event.target.value); setScheduleId(''); setSchedules([]); setAppointments([]) }}><option value="">Choose a clinic</option>{clinics.map((clinic) => <option value={clinic.id} key={clinic.id}>{clinic.name}</option>)}</select></label><label>Schedule<select value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setAppointments([]) }} disabled={!clinicId}><option value="">Choose a schedule</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.service_date} · {schedule.doctor_name} · {schedule.opens_at.slice(0, 5)}</option>)}</select></label></section>
          {selectedSchedule && <section className="queue-board"><div className="queue-summary"><p>Today&apos;s session</p><h2>{selectedSchedule.doctor_name}</h2><span>{selectedSchedule.opens_at.slice(0, 5)} to {selectedSchedule.closes_at.slice(0, 5)} · {selectedSchedule.last_token}/{selectedSchedule.capacity} tokens issued</span><button className="button button-secondary" onClick={toggleTokens} disabled={working}>{selectedSchedule.accepting_tokens ? 'Close new tokens' : 'Open new tokens'}</button></div><div className="now-serving"><p>Now serving</p><strong>{serving ? serving.token_number : 'None'}</strong><span>{serving ? serving.patient_name : 'No patient in consultation'}</span><button className="button button-primary" onClick={nextPatient} disabled={working}>{serving ? 'Complete and call next' : 'Call next patient'}</button></div></section>}
          {selectedSchedule && <section className="surface queue-table"><div className="section-heading"><h2>Waiting tokens</h2><span>{waiting.length} waiting</span></div>{waiting.length === 0 ? <p className="empty-state">There are no waiting tokens for this session.</p> : <div>{waiting.map((appointment) => <article className="staff-token" key={appointment.id}><strong>{appointment.token_number}</strong><div><h3>{appointment.patient_name}</h3><p>{appointment.phone}</p></div><button className="text-action" disabled={working} onClick={() => markNoShow(appointment.id)}>Mark no-show</button></article>)}</div>}</section>}
          <section className="surface schedule-form"><div><p className="eyebrow">Schedule management</p><h2>Create or update a doctor session</h2><p>Saving the same doctor and date updates that session and reopens token booking.</p></div><form onSubmit={createSchedule} className="schedule-fields"><label>Doctor name<input name="doctorName" required minLength={2} /></label><label>Date<input name="serviceDate" type="date" required min={today()} defaultValue={today()} /></label><label>Opens<input name="opensAt" type="time" required defaultValue="09:00" /></label><label>Closes<input name="closesAt" type="time" required defaultValue="13:00" /></label><label>Average minutes<input name="averageMinutes" type="number" required min="2" max="90" defaultValue="10" /></label><label>Token capacity<input name="capacity" type="number" required min="1" max="200" defaultValue="30" /></label><button className="button button-primary" disabled={working}>Save session</button></form></section>
        </>}
      </main>
    </div>
  )
}
