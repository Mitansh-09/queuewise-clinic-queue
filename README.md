# MedVault

MedVault is a patient health organizer and multi-clinic service directory. Patients can keep personal health documents and medication reminders together, browse participating clinic listings, and use a simple specialty keyword guide. Clinic teams also manage doctor profiles, schedules, and live token queues.

## Problem statement

People often manage health records across paper files, clinic portals, and family members’ devices. Patients also need an easier way to find participating clinicians. Clinic staff need a directory and a practical way to run the day’s queue. MedVault keeps a patient-owned vault separate from clinic queue data and clinician listings.

## Target users

- Patients booking a same-day clinic token
- Receptionists managing arrivals, no-shows, and the next patient
- Doctors setting an available session and consultation duration
- Individuals and family caregivers organizing health documents and medication reminders
- Participating clinics maintaining real clinician profiles and same-day queues

## What the product does

1. A patient creates private health profiles for themself and dependents in their care.
2. The patient uploads health documents into a private account-owned vault, organized by profile and record type.
3. The patient records medication reminder times and logs doses.
4. Patients search clinician listings by name, specialty, clinic, and clinic-entered search terms.
5. The browser-only care guide matches keywords to a specialty and shows corresponding clinic listings. It does not diagnose or send symptom text to an AI service.
6. Patients book a same-day token and can check in with staff. Clinic teams operate a shared online and walk-in queue with live updates and timestamped transitions.

## Key features

- Password-based patient and staff accounts
- Role-based database access with Supabase Row Level Security
- Atomic token allocation that prevents duplicate token numbers
- Private patient queue position and wait estimate
- Live queue updates via Supabase Realtime
- Doctor sessions with date, hours, average consultation time, and capacity
- Reception controls for next patient, completion, no-show, and token availability
- Separate patient, receptionist, doctor, and clinic-admin access
- One-tap arrival, skip, no-show, restore-to-queue, and call-next workflow
- Walk-in registration in the same token sequence as online bookings
- Patient cancellation and rescheduling before the clinic cutoff
- Doctor view limited to assigned doctor sessions, including a separately protected patient-shared visit reason
- Clinic settings for booking, cancellation cutoff, session fees, and closure days
- Daily booked, arrival, completion, no-show, wait, and consultation figures from recorded timestamps
- Live in-page “consider leaving” nudge based on the patient-entered travel time and current queue estimate
- Privacy Policy, Terms of Use, and a custom favicon
- Private family health profiles and document vault
- PDF, JPG, and PNG uploads, limited to 10 MB per file
- Medication reminders and daily dose logs
- Clinic-managed directory of doctors, specialties, qualifications, languages, and search terms
- Browser-only care guide for specialty navigation

## Tech stack

- Next.js 16 and React 19
- TypeScript
- Supabase Auth, Postgres, Realtime, and Row Level Security
- CSS with a custom responsive interface

## Architecture

The browser uses Supabase's publishable key only. Sensitive queue operations are implemented as database functions. Each function checks the authenticated user before making a change. Clinic session dates use India Standard Time. The service role key is not used by the application.

```text
Patient portal / Staff console
          ↓
Supabase Auth session
          ↓
RLS-protected Postgres tables and queue RPC functions
          ↓
Realtime appointment updates
          ↓
Patient and staff screens refresh their queue state
```

### Main data model

| Table | Purpose |
| --- | --- |
| `profiles` | Account name, phone, and default patient role |
| `clinics` | Clinic name, address, and active state |
| `staff_members` | Assigns a receptionist, doctor, or clinic admin to one clinic |
| `clinic_schedules` | Daily doctor sessions, capacity, and token availability |
| `appointments` | Queue tokens, optional patient-shared reason, source, and workflow timestamps |
| `queue_events` | Audit trail for queue status changes |
| `clinic_settings`, `clinic_closures` | Clinic booking preferences and doctor/clinic closure days |

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a new Supabase project, or use an existing project. In Authentication settings, enable email and password sign-in. Configure the Site URL as `http://localhost:3000` for local development and add your deployed URL before production use.

### 3. Apply the database migrations

Apply the migrations in order. The first five create and secure the original queue and MedVault schema. Migrations six through fifteen add pilot roles, timestamps, clinic operations, stricter doctor access, reschedule history, and private visit notes. Do not omit the RLS policies.

- [`202610170001_create_queuewise.sql`](supabase/migrations/202610170001_create_queuewise.sql)
- [`202610170002_harden_queue_access.sql`](supabase/migrations/202610170002_harden_queue_access.sql)
- [`202610170003_revoke_anon_rpc.sql`](supabase/migrations/202610170003_revoke_anon_rpc.sql)
- [`202610170004_add_medvault.sql`](supabase/migrations/202610170004_add_medvault.sql)
- [`202610170005_harden_doctor_directory_policies.sql`](supabase/migrations/202610170005_harden_doctor_directory_policies.sql)
- [`202610170006_pilot_roles_and_statuses.sql`](supabase/migrations/202610170006_pilot_roles_and_statuses.sql)
- [`202610170007_pilot_operations.sql`](supabase/migrations/202610170007_pilot_operations.sql)
- [`202610170008_queue_order_and_checkin.sql`](supabase/migrations/202610170008_queue_order_and_checkin.sql)
- [`202610170009_doctor_scoped_queue_access.sql`](supabase/migrations/202610170009_doctor_scoped_queue_access.sql)
- [`202610170010_admin_only_configuration.sql`](supabase/migrations/202610170010_admin_only_configuration.sql)
- [`202610170011_finalize_queue_policy_indexes.sql`](supabase/migrations/202610170011_finalize_queue_policy_indexes.sql)
- [`202610170012_record_reschedules.sql`](supabase/migrations/202610170012_record_reschedules.sql)
- [`202610170013_doctor_private_visit_notes.sql`](supabase/migrations/202610170013_doctor_private_visit_notes.sql)
- [`202610170014_pilot_permission_edges.sql`](supabase/migrations/202610170014_pilot_permission_edges.sql)
- [`202610170015_unique_closure_dates.sql`](supabase/migrations/202610170015_unique_closure_dates.sql)

### 4. Configure environment variables

Copy `.env.example` to `.env.local`, then add your Supabase project values.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Use a publishable key. Never put a Supabase secret key or service-role key in `.env.local` with a `NEXT_PUBLIC_` prefix.

### 5. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## First clinic setup

1. Register a platform administrator account and set its `profiles.role` to `admin` from the Supabase SQL Editor. This is a one-time trusted bootstrap. Users cannot change their own role from the app.

```sql
update public.profiles set role = 'admin' where id = 'registered-account-uuid';
```

2. Sign in to Clinic staff and create a clinic. The creator becomes its clinic admin.
3. Register receptionist and doctor accounts. Use the clinic admin screen to assign each account UUID a clinic role.
4. Add each doctor profile and link the doctor account UUID. Doctor accounts only see sessions matching their linked doctor profile.
5. Add session times, fees, average consult minutes, and capacity in clinic staff.

For manual recovery, an administrator can add a clinic directly:

```sql
insert into public.clinics (name, address)
values ('Your Clinic Name', 'Your clinic address')
returning id;
```

Find the staff account ID in `auth.users`, then link it to the clinic using the returned clinic ID.

```sql
insert into public.staff_members (clinic_id, user_id, role)
values ('clinic-id-here', 'staff-user-id-here', 'receptionist');
```

The patient directory has no seeded sample doctors.

The first signed-in account should retain its `patient` profile role. Clinic authorization is based on `staff_members`, which prevents a user from granting themselves staff access in the browser.

## Security decisions

- Row Level Security is enabled on every public table.
- Patients can read only their own bookings and queue events.
- Staff can read tokens only for clinics they are assigned to.
- Booking, walk-ins, arrival, status changes, advancing, schedule management, clinic setup, staff roles, and closures use authenticated database functions or RLS policies that verify the patient or clinic role.
- The profile update permission permits only display name and phone, so a user cannot change their own role.
- The UI uses only the Supabase publishable key.
- Health profiles, document metadata, medications, and dose logs are restricted to the account that owns the profile through RLS.
- Uploaded files use a private bucket, account-prefixed object paths, PDF/JPG/PNG types, and a 10 MB limit.
- Clinic staff do not have access to patient vault documents in this version. Patient record sharing is not implemented.
- The care guide uses a small local keyword map and a narrow red-flag phrase list. It is not an AI, diagnosis, or triage service, may miss urgent symptoms, and cannot determine whether it is safe to wait.
- The leave-time nudge is visible only while the patient page is open. It uses the clinic estimate and user-entered travel time. No SMS or WhatsApp provider is connected, and no external alert delivery is promised.
- The deployed Supabase project is in Australia (Sydney). This is a student demonstration and has not had a hospital privacy, clinical-safety, legal, or independent security review. Do not claim healthcare compliance or use it for hospital production without those reviews.

## Reliability and error handling

- Token creation locks the chosen schedule before incrementing its counter.
- The database rejects token bookings for a closed, full, past, or already-booked session.
- Queue status changes use an audit event.
- The interface shows loading, empty, success, and error states for booking and staff actions.
- Booking time, check-in, consultation start, consultation end, skip, and no-show events are timestamped. Reports calculate wait only where both check-in and consultation-start timestamps exist.
- Wait time is clearly presented as an estimate, not a guarantee.

## Deployment

Deploy the repository to Vercel or another Next.js host. Add the same two environment variables in the host's project settings. In Supabase Authentication, set the production URL as the Site URL and add it to Redirect URLs.

Before submission, test the deployed app in a private browser window with a patient account and a staff account. Confirm that a token booking appears for the patient and updates in the staff console.

## Suggested demo flow

1. Explain the long, uncertain clinic waiting line problem.
2. Sign in as a staff member and create a doctor session.
3. Sign in as a patient and book a token.
4. Show the patient token and estimated wait.
5. In the receptionist view, check in the patient and call the next patient.
6. Show the patient portal updating live.
7. Demonstrate a walk-in, skip/no-show, and the daily timestamp report.

## Limits for this first release

MedVault stores user-uploaded documents and medication schedules but does not read or interpret their contents. Reminders are visible in the signed-in app and are not guaranteed push notifications. The release does not include clinician access to patient records, payments, insurance, ABDM integration, AI medical chat, emergency dispatch, or clinical decision support. The care guide is a keyword navigator only. Queue estimates can change with real consultation lengths and urgent clinic needs.
