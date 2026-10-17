'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Appointment, Clinic, Schedule } from '@/lib/types'
import { ClinicDoctorManager } from '@/components/doctor-directory'
import { ClinicAdmin } from '@/components/clinic-admin'

type Member = { clinic_id: string; role: 'admin' | 'doctor' | 'receptionist' }
type SharedNote = { appointment_id: string; note: string }
type Report = { booked: number; arrived: number; completed: number; noShows: number; averageWait: number; averageConsult: number }
const today = () => new Date().toLocaleDateString('en-CA')

export function StaffConsole() {
  const router = useRouter()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [sharedNotes, setSharedNotes] = useState<Record<string, string>>({})
  const [clinicId, setClinicId] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [userId, setUserId] = useState('')
  const [platformAdmin, setPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [report, setReport] = useState<Report | null>(null)

  const currentRole = members.find((item) => item.clinic_id === clinicId)?.role
  const canManageClinic = currentRole === 'admin'
  const selectedSchedule = useMemo(() => schedules.find((item) => item.id === scheduleId), [schedules, scheduleId])
  const active = appointments.filter((item) => ['waiting', 'arrived', 'serving'].includes(item.status))
  const serving = active.find((item) => item.status === 'serving')
  const waiting = active.filter((item) => item.status === 'waiting' || item.status === 'arrived')

  const loadQueue = useCallback(async (id: string) => {
    if (!id) return setAppointments([])
    const supabase = createClient()
    const { data, error: queueError } = await supabase.from('appointments').select('*').eq('schedule_id', id).order('token_number')
    if (queueError) throw queueError
    const rows = (data || []) as Appointment[]
    setAppointments(rows)
    if (currentRole === 'doctor' && rows.length) {
      const { data: notes, error: notesError } = await supabase.from('appointment_notes').select('appointment_id,note').in('appointment_id', rows.map((item) => item.id))
      if (notesError) throw notesError
      setSharedNotes(Object.fromEntries(((notes || []) as SharedNote[]).map((item) => [item.appointment_id, item.note])))
    } else setSharedNotes({})
  }, [currentRole])

  const loadSchedules = useCallback(async (id: string) => {
    if (!id) return setSchedules([])
    const supabase = createClient()
    const { data, error: schedulesError } = await supabase.from('clinic_schedules').select('*')
      .eq('clinic_id', id).gte('service_date', today()).order('service_date').order('opens_at')
    if (schedulesError) throw schedulesError
    const role = members.find((item) => item.clinic_id === id)?.role
    if (role === 'doctor' && userId) {
      const { data: assigned, error: doctorError } = await supabase.from('clinic_doctors').select('display_name').eq('clinic_id', id).eq('user_id', userId)
      if (doctorError) throw doctorError
      const names = new Set((assigned || []).map((item) => item.display_name.toLocaleLowerCase()))
      setSchedules(((data || []) as Schedule[]).filter((item) => names.has(item.doctor_name.toLocaleLowerCase())))
    } else setSchedules((data || []) as Schedule[])
  }, [members, userId])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    async function load() {
      try {
        const supabase = createClient()
        const { data: identity } = await supabase.auth.getUser()
        if (!identity.user) { router.push('/login?next=/staff'); return }
        setUserId(identity.user.id)
        const [profile, memberships] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', identity.user.id).single(),
          supabase.from('staff_members').select('clinic_id,role'),
        ])
        if (profile.error) throw profile.error
        if (memberships.error) throw memberships.error
        const isPlatformAdmin = profile.data.role === 'admin'
        setPlatformAdmin(isPlatformAdmin)
        const nextMembers = (memberships.data || []) as Member[]
        setMembers(nextMembers)
        const ids = nextMembers.map((item) => item.clinic_id)
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
        const supabase = createClient()
        const { data, error: schedulesError } = await supabase.from('clinic_schedules').select('*').eq('clinic_id', clinicId).gte('service_date', today()).order('service_date').order('opens_at')
        if (schedulesError) throw schedulesError
        let visible = (data || []) as Schedule[]
        const role = members.find((item) => item.clinic_id === clinicId)?.role
        if (role === 'doctor' && userId) {
          const { data: assigned, error: doctorError } = await supabase.from('clinic_doctors').select('display_name').eq('clinic_id', clinicId).eq('user_id', userId)
          if (doctorError) throw doctorError
          const names = new Set((assigned || []).map((item) => item.display_name.toLocaleLowerCase()))
          visible = visible.filter((item) => names.has(item.doctor_name.toLocaleLowerCase()))
        }
        if (!cancelled) setSchedules(visible)
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load schedules.') }
    }
    load()
    return () => { cancelled = true }
  }, [clinicId, members, userId])

  useEffect(() => {
    if (!scheduleId) return
    let cancelled = false
    async function load() {
      try {
        const { data, error: queueError } = await createClient().from('appointments').select('*').eq('schedule_id', scheduleId).order('token_number')
        if (queueError) throw queueError
        if (!cancelled) {
          const rows = (data || []) as Appointment[]
          setAppointments(rows)
          if (currentRole === 'doctor' && rows.length) {
            const { data: notes, error: notesError } = await createClient().from('appointment_notes').select('appointment_id,note').in('appointment_id', rows.map((item) => item.id))
            if (notesError) throw notesError
            if (!cancelled) setSharedNotes(Object.fromEntries(((notes || []) as SharedNote[]).map((item) => [item.appointment_id, item.note])))
          } else if (!cancelled) setSharedNotes({})
        }
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load today’s queue.') }
    }
    load()
    return () => { cancelled = true }
  }, [scheduleId, currentRole])

  async function runAction(fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>) {
    setWorking(true); setError(''); setMessage('')
    try {
      const { error: actionError } = await fn()
      if (actionError) throw actionError
      if (scheduleId) await loadQueue(scheduleId)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That action could not be completed.') }
    finally { setWorking(false) }
  }

  async function advance() {
    if (!clinicId || !scheduleId) return
    await runAction(async () => {
      const result = await createClient().rpc('advance_queue', { p_clinic_id: clinicId, p_schedule_id: scheduleId })
      if (!result.error) setMessage(result.data ? `Token ${(result.data as Appointment).token_number} is now in consultation.` : 'No active patients remain in this session.')
      return result
    })
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clinicId) return setError('Choose a clinic before creating a session.')
    const form = event.currentTarget
    const values = new FormData(form)
    setWorking(true); setError(''); setMessage('')
    try {
      const { error: saveError } = await createClient().rpc('create_clinic_schedule', {
        p_clinic_id: clinicId, p_doctor_name: String(values.get('doctorName') || '').trim(),
        p_service_date: String(values.get('serviceDate') || ''), p_opens_at: String(values.get('opensAt') || ''),
        p_closes_at: String(values.get('closesAt') || ''), p_average_minutes: Number(values.get('averageMinutes')),
        p_capacity: Number(values.get('capacity')), p_fee: Number(values.get('fee') || 0),
      })
      if (saveError) throw saveError
      form.reset(); await loadSchedules(clinicId); setMessage('Doctor session saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The session could not be saved.') }
    finally { setWorking(false) }
  }

  async function addWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clinicId || !scheduleId) return setError('Choose today’s clinic session first.')
    const form = event.currentTarget
    const values = new FormData(form)
    setWorking(true); setError(''); setMessage('')
    try {
      const { data, error: walkInError } = await createClient().rpc('add_walk_in', {
        p_clinic_id: clinicId, p_schedule_id: scheduleId, p_patient_name: String(values.get('name') || '').trim(),
        p_phone: String(values.get('phone') || '').trim(), p_visit_reason: String(values.get('reason') || '').trim() || null,
      })
      if (walkInError) throw walkInError
      form.reset(); await loadQueue(scheduleId); await loadSchedules(clinicId)
      setMessage(`Walk-in added as token ${(data as Appointment).token_number}.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Walk-in could not be added.') }
    finally { setWorking(false) }
  }

  async function loadReport() {
    if (!clinicId) return
    setWorking(true); setError('')
    try {
      const { data: todaySchedules, error: scheduleError } = await createClient().from('clinic_schedules').select('id').eq('clinic_id', clinicId).eq('service_date', today())
      if (scheduleError) throw scheduleError
      const ids = (todaySchedules || []).map((item) => item.id)
      if (!ids.length) { setReport({ booked: 0, arrived: 0, completed: 0, noShows: 0, averageWait: 0, averageConsult: 0 }); return }
      const { data, error: reportError } = await createClient().from('appointments').select('status,checked_in_at,consultation_started_at,consultation_ended_at,created_at').in('schedule_id', ids)
      if (reportError) throw reportError
      const rows = data || []
      const waits = rows.flatMap((row) => row.checked_in_at && row.consultation_started_at ? [Math.max(0, (new Date(row.consultation_started_at).getTime() - new Date(row.checked_in_at).getTime()) / 60000)] : [])
      const durations = rows.flatMap((row) => row.consultation_started_at && row.consultation_ended_at ? [Math.max(0, (new Date(row.consultation_ended_at).getTime() - new Date(row.consultation_started_at).getTime()) / 60000)] : [])
      setReport({ booked: rows.length, arrived: rows.filter((row) => row.checked_in_at).length, completed: rows.filter((row) => row.status === 'completed').length, noShows: rows.filter((row) => row.status === 'no_show').length,
        averageWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
        averageConsult: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0 })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The daily report could not be loaded.') }
    finally { setWorking(false) }
  }

  async function createClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setWorking(true); setError('')
    const { data, error: createError } = await createClient().rpc('create_clinic', { p_name: String(values.get('name') || '').trim(), p_address: String(values.get('address') || '').trim() })
    if (createError) setError(createError.message)
    else { setClinics((items) => [...items, data as Clinic]); setMembers((items) => [...items, { clinic_id: (data as Clinic).id, role: 'admin' }]); setClinicId((data as Clinic).id); setMessage('Clinic created. You are its first clinic administrator.'); form.reset() }
    setWorking(false)
  }

  async function signOut() { await createClient().auth.signOut(); router.push('/') }
  if (loading) return <p className="page-state">Loading clinic workspace…</p>

  return <div className="portal-layout staff-layout">
    <aside className="portal-side"><Link className="wordmark" href="/"><span className="wordmark-mark" />MedVault</Link><p>{currentRole ? `Clinic ${currentRole}` : 'Clinic workspace'}</p><Link className="link-button" href="/patient">Patient portal</Link><button className="link-button" onClick={signOut}>Sign out</button></aside>
    <main className="portal-main">
      <header className="portal-title"><div><p className="eyebrow">Clinic operations</p><h1>{currentRole === 'doctor' ? 'Doctor view' : currentRole === 'admin' ? 'Clinic admin' : 'Today’s queue'}</h1></div></header>
      {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
      {!clinics.length && !platformAdmin ? <section className="surface setup-note"><h2>This account is not assigned to a clinic</h2><p>Ask the clinic administrator to add your account as a receptionist, doctor, or clinic admin.</p></section> : null}
      {platformAdmin && <section className="surface clinic-create"><p className="eyebrow">Platform setup</p><h2>Create a clinic</h2><form className="schedule-fields" onSubmit={createClinic}><label>Clinic name<input name="name" minLength={2} maxLength={120} required /></label><label>Clinic address<input name="address" minLength={5} maxLength={240} required /></label><button className="button button-primary" disabled={working}>Create clinic</button></form></section>}
      {clinics.length > 0 && <>
        <section className="surface control-bar"><label>Clinic<select value={clinicId} onChange={(event) => { setClinicId(event.target.value); setScheduleId(''); setAppointments([]); setReport(null) }}><option value="">Choose a clinic</option>{clinics.map((clinic) => <option value={clinic.id} key={clinic.id}>{clinic.name}</option>)}</select></label>
          <label>Today’s doctor session<select value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setAppointments([]) }} disabled={!clinicId}><option value="">Choose a session</option>{schedules.filter((item) => item.service_date === today()).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.doctor_name} · {schedule.opens_at.slice(0, 5)}</option>)}</select></label></section>
        {selectedSchedule && <section className="queue-board"><div className="queue-summary"><p>Today’s session</p><h2>{selectedSchedule.doctor_name}</h2><span>{selectedSchedule.opens_at.slice(0, 5)} to {selectedSchedule.closes_at.slice(0, 5)} · {selectedSchedule.last_token}/{selectedSchedule.capacity} tokens · Fee ₹{Number(selectedSchedule.fee || 0).toFixed(0)}</span>
          {currentRole !== 'doctor' && <button className="button button-secondary" onClick={() => runAction(async () => { const result = await createClient().rpc('set_token_acceptance', { p_schedule_id: selectedSchedule.id, p_accepting: !selectedSchedule.accepting_tokens }); if (!result.error) { await loadSchedules(clinicId); setMessage(selectedSchedule.accepting_tokens ? 'Online token booking closed.' : 'Online token booking opened.') }; return result })} disabled={working}>{selectedSchedule.accepting_tokens ? 'Close tokens' : 'Open tokens'}</button>}</div>
          <div className="now-serving"><p>Now in consultation</p><strong>{serving?.token_number ?? 'None'}</strong><span>{serving?.patient_name || 'No patient in consultation'}</span>{(currentRole === 'doctor' || currentRole === 'receptionist' || currentRole === 'admin') && <button className="button button-primary" onClick={advance} disabled={working}>{serving ? 'Finish and call next' : 'Call next patient'}</button>}</div></section>}
        {selectedSchedule && currentRole !== 'doctor' && <section className="surface walk-in-panel"><p className="eyebrow">Front desk</p><h2>Add a walk-in</h2><p>Walk-ins receive the next token in this doctor’s shared queue.</p><form className="schedule-fields walk-in-form" onSubmit={addWalkIn}><label>Patient name<input name="name" minLength={2} maxLength={80} required /></label><label>Mobile number<input name="phone" inputMode="tel" minLength={7} maxLength={20} required /></label><label>Reason to share with doctor, optional<input name="reason" maxLength={500} /></label><button className="button button-primary" disabled={working}>Add to queue</button></form></section>}
        {selectedSchedule && <section className="surface queue-table"><div className="section-heading"><h2>Today’s patients</h2><span>{waiting.length} waiting · {appointments.length} booked</span></div>{appointments.length === 0 ? <p className="empty-state">No patients booked for this session.</p> : <div className="staff-list">{appointments.map((appointment) => <article className={`staff-token staff-token-${appointment.status}`} key={appointment.id}><strong>{appointment.token_number}</strong><div><h3>{appointment.patient_name}</h3><p>{appointment.source === 'walk_in' ? 'Walk-in' : 'Online'} · {appointment.phone}</p>{currentRole === 'doctor' && sharedNotes[appointment.id] && <p className="doctor-visit-note"><strong>Patient-shared reason:</strong> {sharedNotes[appointment.id]}</p>}</div><span className={`status status-${appointment.status}`}>{appointment.status.replace('_', ' ')}</span><div className="staff-row-actions">{currentRole !== 'doctor' && appointment.status === 'waiting' && <button className="text-action" disabled={working} onClick={() => runAction(() => createClient().rpc('mark_queue_arrived', { p_appointment_id: appointment.id }))}>Mark arrived</button>}{currentRole !== 'doctor' && ['waiting','arrived'].includes(appointment.status) && <><button className="text-action" disabled={working} onClick={() => runAction(() => createClient().rpc('set_queue_status', { p_appointment_id: appointment.id, p_next_status: 'skipped' }))}>Skip</button><button className="text-action" disabled={working} onClick={() => runAction(() => createClient().rpc('set_queue_status', { p_appointment_id: appointment.id, p_next_status: 'no_show' }))}>No-show</button></>}{currentRole !== 'doctor' && appointment.status === 'skipped' && <button className="text-action" disabled={working} onClick={() => runAction(() => createClient().rpc('set_queue_status', { p_appointment_id: appointment.id, p_next_status: 'waiting' }))}>Return to queue</button>}</div></article>)}</div>}</section>}
        {canManageClinic && <section className="surface schedule-form"><div><p className="eyebrow">Schedule management</p><h2>Create a doctor session</h2><p>Set the doctor, date, opening hours, starting estimate, fee, and token limit.</p></div><form onSubmit={createSchedule} className="schedule-fields"><label>Doctor name<input name="doctorName" required minLength={2} /></label><label>Date<input name="serviceDate" type="date" required min={today()} defaultValue={today()} /></label><label>Opens<input name="opensAt" type="time" required defaultValue="09:00" /></label><label>Closes<input name="closesAt" type="time" required defaultValue="13:00" /></label><label>Starting average consult minutes<input name="averageMinutes" type="number" required min="2" max="90" defaultValue="10" /></label><label>Token capacity<input name="capacity" type="number" required min="1" max="200" defaultValue="30" /></label><label>Consultation fee, ₹<input name="fee" type="number" min="0" step="0.01" defaultValue="0" /></label><button className="button button-primary" disabled={working}>Save session</button></form></section>}
        {clinicId && canManageClinic && <ClinicDoctorManager clinicId={clinicId} />}
        {clinicId && canManageClinic && <ClinicAdmin clinicId={clinicId} />}
        {clinicId && canManageClinic && <section className="surface report-panel"><div className="section-heading"><div><p className="eyebrow">Daily operations</p><h2>Today’s report</h2></div><button className="button button-secondary" onClick={loadReport} disabled={working}>Refresh report</button></div>{report ? <div className="report-grid">{[['Patients booked',report.booked],['Arrived',report.arrived],['Completed',report.completed],['No-shows',report.noShows],['Average recorded wait',`${report.averageWait} min`],['Average consult',`${report.averageConsult} min`]].map(([label,value]) => <div className="report-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <p className="empty-state">The report uses recorded arrival and consultation timestamps. Refresh to calculate today’s figures.</p>}<p className="helper-text">Wait averages include only patients with both arrival and consultation start times. No historical comparison is shown until real data exists.</p></section>}
      </>}
    </main>
  </div>
}
