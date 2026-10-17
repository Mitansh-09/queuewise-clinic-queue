# Queuewise

Queuewise is a live token queue and daily scheduling application for small clinics. It replaces an unclear physical waiting line with a private patient portal and a focused staff console.

## Problem statement

Patients at small clinics often wait without knowing their place in the queue or the likely wait time. Receptionists must answer repeated questions while also managing no-shows and changing schedules. Queuewise gives patients a token and a live estimate while staff operate a single, ordered queue.

## Target users

- Patients booking a same-day clinic token
- Receptionists managing arrivals, no-shows, and the next patient
- Doctors setting an available session and consultation duration

## What the product does

1. A patient creates an account and books one token in an available same-day doctor session.
2. The database assigns the next token atomically and rejects duplicate bookings for the same session.
3. The patient sees their token, people ahead, and an estimate based on the clinic's average consultation time.
4. A receptionist or doctor advances the queue, closes a no-show, and opens or closes token booking.
5. Queue changes are delivered to signed-in users in real time.

## Key features

- Password-based patient and staff accounts
- Role-based database access with Supabase Row Level Security
- Atomic token allocation that prevents duplicate token numbers
- Private patient queue position and wait estimate
- Live queue updates via Supabase Realtime
- Doctor sessions with date, hours, average consultation time, and capacity
- Reception controls for next patient, completion, no-show, and token availability
- Privacy Policy, Terms of Use, and a custom favicon

## Tech stack

- Next.js 16 and React 19
- TypeScript
- Supabase Auth, Postgres, Realtime, and Row Level Security
- CSS with a custom responsive interface

## Architecture

The browser uses Supabase's publishable key only. Sensitive queue operations are implemented as database functions. Each function checks the authenticated user before making a change. The service role key is not used by the application.

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
| `staff_members` | Assigns a receptionist or doctor to one clinic |
| `clinic_schedules` | Daily doctor sessions, capacity, and token availability |
| `appointments` | Queue tokens and their lifecycle |
| `queue_events` | Audit trail for queue status changes |

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a new Supabase project, or use an existing project. In Authentication settings, enable email and password sign-in. Configure the Site URL as `http://localhost:3000` for local development and add your deployed URL before production use.

### 3. Apply the database migration

Run the contents of [`supabase/migrations/202610170001_create_queuewise.sql`](supabase/migrations/202610170001_create_queuewise.sql) in the Supabase SQL Editor. This creates the tables, RLS policies, secure queue functions, and Realtime publication.

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

1. Register the first clinic staff account in Queuewise.
2. In Supabase SQL Editor, add a clinic.

```sql
insert into public.clinics (name, address)
values ('Harbor Family Clinic', '12 Main Road, Your City')
returning id;
```

3. Find the staff account ID in `auth.users`, then link it to the clinic using the returned clinic ID.

```sql
insert into public.staff_members (clinic_id, user_id, role)
values ('clinic-id-here', 'staff-user-id-here', 'receptionist');
```

4. Sign in as that staff member, open **Clinic staff**, select the clinic, and create a doctor session.

The first signed-in account should retain its `patient` profile role. Clinic authorization is based on `staff_members`, which prevents a user from granting themselves staff access in the browser.

## Security decisions

- Row Level Security is enabled on every public table.
- Patients can read only their own bookings and queue events.
- Staff can read tokens only for clinics they are assigned to.
- Booking, advancing, schedule creation, and no-show actions use authenticated database functions that verify clinic membership.
- The profile update permission permits only display name and phone, so a user cannot change their own role.
- The UI uses only the Supabase publishable key.

## Reliability and error handling

- Token creation locks the chosen schedule before incrementing its counter.
- The database rejects token bookings for a closed, full, past, or already-booked session.
- Queue status changes use an audit event.
- The interface shows loading, empty, success, and error states for booking and staff actions.
- Wait time is clearly presented as an estimate, not a guarantee.

## Deployment

Deploy the repository to Vercel or another Next.js host. Add the same two environment variables in the host's project settings. In Supabase Authentication, set the production URL as the Site URL and add it to Redirect URLs.

Before submission, test the deployed app in a private browser window with a patient account and a staff account. Confirm that a token booking appears for the patient and updates in the staff console.

## Suggested demo flow

1. Explain the long, uncertain clinic waiting line problem.
2. Sign in as a staff member and create a doctor session.
3. Sign in as a patient and book a token.
4. Show the patient token and estimated wait.
5. Return to the staff console and call the next patient.
6. Show the patient portal updating live.
7. Demonstrate closing tokens and marking a no-show.

## Limits for this first release

Queuewise manages clinic flow, not clinical records. It deliberately does not store symptoms, diagnoses, prescriptions, payments, or emergency requests. An estimate can change with real consultation lengths and urgent clinic needs.
