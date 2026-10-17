'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Appointment, Clinic, QueueStatus, Schedule } from '@/lib/types'

const today = () => new Date().toLocaleDateString('en-CA')

function labelFor(status: Appointment['status']) {
  return status.replace('_', ' ')
}

export function PatientPortal() {
  const router = useRouter()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [queueStatuses, setQueueStatuses] = useState<Record<string, QueueStatus>>({})
  const [clinicId, setClinicId] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [preferredDoctor, setPreferredDoctor] = useState('')
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refreshAppointments = useCallback(async () => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase.from('appointments').select('*').order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    const next = (data || []) as Appointment[]
    setAppointments(next)
    const active = next.filter((item) => item.status === 'waiting' || item.status === 'serving')
    const responses = await Promise.all(active.map(async (item) => {
      const { data: status } = await supabase.rpc('get_patient_queue_status', { p_appointment_id: item.id })
      return [item.id, (status as QueueStatus[] | null)?.[0]] as const
    }))
    setQueueStatuses(Object.fromEntries(responses.filter((entry): entry is [string, QueueStatus] => Boolean(entry[1]))))
  }, [])

  const loadSchedules = useCallback(async (id: string) => {
    if (!id) return setSchedules([])
    const { data, error: fetchError } = await createClient().from('clinic_schedules')
      .select('*').eq('clinic_id', id).eq('service_date', today()).order('opens_at')
    if (fetchError) throw fetchError
    setSchedules((data || []) as Schedule[])
  }, [])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    async function load() {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) { router.push(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`); return }
        const { data, error: clinicsError } = await supabase.from('clinics').select('*').order('name')
        if (clinicsError) throw clinicsError
        const nextClinics = (data || []) as Clinic[]
        setClinics(nextClinics)
        const requested = new URLSearchParams(window.location.search)
        const requestedClinic = requested.get('clinic')
        if (requestedClinic && nextClinics.some((item) => item.id === requestedClinic)) {
          setClinicId(requestedClinic)
          setPreferredDoctor(requested.get('doctor') || '')
        }
        await refreshAppointments()
        channel = supabase.channel(`patient-queue-${userData.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          refreshAppointments().catch(() => undefined)
        }).subscribe()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load your account.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { if (channel) createClient().removeChannel(channel) }
  }, [refreshAppointments, router])

  useEffect(() => {
    if (!clinicId) return
    let cancelled = false
    async function load() {
      try {
        const { data, error: fetchError } = await createClient().from('clinic_schedules')
          .select('*').eq('clinic_id', clinicId).eq('service_date', today()).order('opens_at')
        if (fetchError) throw fetchError
        if (!cancelled) {
          const nextSchedules = (data || []) as Schedule[]
          setSchedules(nextSchedules)
          if (preferredDoctor) {
            const match = nextSchedules.find((item) => item.doctor_name.toLocaleLowerCase() === preferredDoctor.toLocaleLowerCase())
            if (match) setScheduleId(match.id)
          }
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load schedules.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [clinicId, preferredDoctor])

  const selectedSchedule = useMemo(() => schedules.find((schedule) => schedule.id === scheduleId), [schedules, scheduleId])

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clinicId || !scheduleId) return setError('Choose a clinic and today\'s doctor first.')
    setBooking(true); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    try {
      const { error: bookingError } = await createClient().rpc('book_queue_token', {
        p_clinic_id: clinicId,
        p_schedule_id: scheduleId,
        p_patient_name: String(form.get('name') || '').trim(),
        p_phone: String(form.get('phone') || '').trim(),
      })
      if (bookingError) throw bookingError
      event.currentTarget.reset()
      setMessage('Your token is confirmed. The live card below will update as the queue moves.')
      await refreshAppointments()
      await loadSchedules(clinicId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not book your token.')
    } finally {
      setBooking(false)
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  if (loading) return <p className="page-state">Loading your queue…</p>
  return (
    <div className="portal-layout">
      <aside className="portal-side"><Link className="wordmark" href="/"><span className="wordmark-mark" />MedVault</Link><p>Patient portal</p><button className="link-button" onClick={signOut}>Sign out</button></aside>
      <main className="portal-main">
        <header className="portal-title"><div><p className="eyebrow">Patient portal</p><h1>Your clinic queue</h1></div><Link className="button button-secondary" href="/staff">Clinic staff</Link></header>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
        <section className="portal-grid">
          <div className="surface booking-surface"><h2>Book today&apos;s token</h2><p>One active token is allowed for each clinic session.</p>
            <form onSubmit={book} className="stack-form">
              <label>Clinic<select value={clinicId} onChange={(event) => { setClinicId(event.target.value); setScheduleId(''); setPreferredDoctor('') }} required><option value="">Choose a clinic</option>{clinics.map((clinic) => <option value={clinic.id} key={clinic.id}>{clinic.name}</option>)}</select></label>
              <label>Doctor and time<select value={scheduleId} onChange={(event) => setScheduleId(event.target.value)} required disabled={!clinicId}><option value="">Choose today&apos;s session</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id} disabled={!schedule.accepting_tokens}>{schedule.doctor_name} · {schedule.opens_at.slice(0, 5)} to {schedule.closes_at.slice(0, 5)} {!schedule.accepting_tokens ? '(closed)' : ''}</option>)}</select></label>
              {selectedSchedule && <p className="helper-text">Average consultation: {selectedSchedule.average_minutes} minutes. {selectedSchedule.capacity - selectedSchedule.last_token} tokens remain.</p>}
              <label>Your name<input name="name" required minLength={2} maxLength={80} /></label>
              <label>Mobile number<input name="phone" required inputMode="tel" minLength={7} maxLength={20} /></label>
              <button className="button button-primary" disabled={booking}>{booking ? 'Booking token' : 'Book token'}</button>
            </form>
          </div>
          <div className="surface"><h2>My tokens</h2>{appointments.length === 0 ? <p className="empty-state">You do not have a token yet. Book one for an available clinic session.</p> : <div className="appointment-list">{appointments.map((appointment) => {
            const status = queueStatuses[appointment.id]
            return <article key={appointment.id} className="appointment-card"><div><p className="token-label">Token</p><strong className="token-number">{appointment.token_number}</strong></div><div><span className={`status status-${appointment.status}`}>{labelFor(appointment.status)}</span><h3>{status?.clinic_name || 'Clinic visit'}</h3>{status ? <><p>{status.doctor_name} · {status.people_ahead} {status.people_ahead === 1 ? 'person' : 'people'} ahead</p><p className="wait">Estimated wait: {status.estimated_wait_minutes} minutes</p></> : <p>This token is closed.</p>}</div></article>
          })}</div>}</div>
        </section>
      </main>
    </div>
  )
}
