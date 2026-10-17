export type Clinic = { id: string; name: string; address: string; active: boolean }

export type Schedule = {
  id: string
  clinic_id: string
  doctor_name: string
  service_date: string
  opens_at: string
  closes_at: string
  average_minutes: number
  capacity: number
  accepting_tokens: boolean
  last_token: number
  fee: number
  cancellation_cutoff_minutes: number
}

export type AppointmentStatus = 'waiting' | 'arrived' | 'serving' | 'completed' | 'no_show' | 'skipped' | 'cancelled'

export type Appointment = {
  id: string
  clinic_id: string
  schedule_id: string
  patient_id: string | null
  patient_name: string
  phone: string
  token_number: number
  status: AppointmentStatus
  created_at: string
  source: 'online' | 'walk_in'
  checked_in_at: string | null
  consultation_started_at: string | null
  consultation_ended_at: string | null
}

export type QueueStatus = {
  token_number: number
  status: AppointmentStatus
  people_ahead: number
  estimated_wait_minutes: number
  clinic_name: string
  doctor_name: string
  service_date: string
  average_consult_minutes: number
}
