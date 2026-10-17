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
}

export type AppointmentStatus = 'waiting' | 'serving' | 'completed' | 'no_show' | 'cancelled'

export type Appointment = {
  id: string
  clinic_id: string
  schedule_id: string
  patient_id: string
  patient_name: string
  phone: string
  token_number: number
  status: AppointmentStatus
  created_at: string
}

export type QueueStatus = {
  token_number: number
  status: AppointmentStatus
  people_ahead: number
  estimated_wait_minutes: number
  clinic_name: string
  doctor_name: string
  service_date: string
}
