-- Queuewise schema: all public tables use RLS. No service-role key is required by the app.
create type public.app_role as enum ('patient', 'receptionist', 'doctor');
create type public.appointment_status as enum ('waiting', 'serving', 'completed', 'no_show', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  phone text check (char_length(phone) between 7 and 20),
  role public.app_role not null default 'patient',
  created_at timestamptz not null default now()
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.staff_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null check (role in ('receptionist', 'doctor')),
  primary key (clinic_id, user_id)
);

create table public.clinic_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_name text not null check (char_length(doctor_name) between 2 and 80),
  service_date date not null,
  opens_at time not null,
  closes_at time not null,
  average_minutes integer not null default 10 check (average_minutes between 2 and 90),
  capacity integer not null default 30 check (capacity between 1 and 200),
  accepting_tokens boolean not null default true,
  last_token integer not null default 0 check (last_token >= 0),
  created_at timestamptz not null default now(),
  unique (clinic_id, service_date, doctor_name),
  check (closes_at > opens_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  schedule_id uuid not null references public.clinic_schedules(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  patient_name text not null check (char_length(patient_name) between 2 and 80),
  phone text not null check (char_length(phone) between 7 and 20),
  token_number integer not null check (token_number > 0),
  status public.appointment_status not null default 'waiting',
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  served_at timestamptz,
  completed_at timestamptz,
  no_show_at timestamptz,
  unique (schedule_id, token_number),
  unique (schedule_id, patient_id)
);

create index appointments_schedule_status_token_idx on public.appointments (schedule_id, status, token_number);
create index appointments_patient_created_idx on public.appointments (patient_id, created_at desc);

create table public.queue_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status public.appointment_status,
  next_status public.appointment_status not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.staff_members enable row level security;
alter table public.clinic_schedules enable row level security;
alter table public.appointments enable row level security;
alter table public.queue_events enable row level security;

create policy "profiles are visible to their owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "patients may update permitted profile details" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "active clinics are visible to signed-in users" on public.clinics for select to authenticated using (active = true);
create policy "staff see their memberships" on public.staff_members for select to authenticated using ((select auth.uid()) = user_id);
create policy "schedules are visible to signed-in users" on public.clinic_schedules for select to authenticated using (true);
create policy "patients see their own appointments" on public.appointments for select to authenticated using ((select auth.uid()) = patient_id);
create policy "clinic staff see their clinic appointments" on public.appointments for select to authenticated using (
  exists (select 1 from public.staff_members sm where sm.clinic_id = appointments.clinic_id and sm.user_id = (select auth.uid()))
);
create policy "patients see events for their appointments" on public.queue_events for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = queue_events.appointment_id and a.patient_id = (select auth.uid()))
);
create policy "staff see events in their clinics" on public.queue_events for select to authenticated using (
  exists (
    select 1 from public.appointments a join public.staff_members sm on sm.clinic_id = a.clinic_id
    where a.id = queue_events.appointment_id and sm.user_id = (select auth.uid())
  )
);

revoke all on public.profiles, public.clinics, public.staff_members, public.clinic_schedules, public.appointments, public.queue_events from anon;
grant select on public.clinics, public.clinic_schedules to authenticated;
grant select on public.profiles, public.staff_members, public.appointments, public.queue_events to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Patient'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.book_queue_token(
  p_clinic_id uuid,
  p_schedule_id uuid,
  p_patient_name text,
  p_phone text
)
returns public.appointments
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_schedule public.clinic_schedules;
  v_appointment public.appointments;
begin
  if auth.uid() is null then raise exception 'Sign in before booking a token'; end if;
  select * into v_schedule from public.clinic_schedules
  where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found then raise exception 'This clinic session is unavailable'; end if;
  if v_schedule.service_date <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'Tokens can only be booked for today'; end if;
  if not v_schedule.accepting_tokens then raise exception 'This clinic is not accepting tokens right now'; end if;
  if v_schedule.last_token >= v_schedule.capacity then raise exception 'Today''s token limit has been reached'; end if;
  if exists (select 1 from public.appointments where schedule_id = p_schedule_id and patient_id = auth.uid()) then
    raise exception 'You already have a token for this clinic session';
  end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_schedule.id returning * into v_schedule;
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number)
  values (p_clinic_id, p_schedule_id, auth.uid(), trim(p_patient_name), trim(p_phone), v_schedule.last_token)
  returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status)
  values (v_appointment.id, auth.uid(), null, 'waiting');
  return v_appointment;
end;
$$;

create or replace function public.advance_queue(p_clinic_id uuid, p_schedule_id uuid)
returns public.appointments
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_previous public.appointments;
  v_next public.appointments;
  v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid()) then
    raise exception 'Only clinic staff can advance this queue';
  end if;
  select * into v_schedule from public.clinic_schedules
  where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found then raise exception 'This clinic session is unavailable'; end if;
  select * into v_previous from public.appointments
  where schedule_id = p_schedule_id and status = 'serving' for update;
  if found then
    update public.appointments set status = 'completed', completed_at = now() where id = v_previous.id;
    insert into public.queue_events (appointment_id, actor_id, previous_status, next_status)
    values (v_previous.id, auth.uid(), 'serving', 'completed');
  end if;
  select * into v_next from public.appointments
  where schedule_id = p_schedule_id and status = 'waiting'
  order by token_number for update skip locked limit 1;
  if not found then return null; end if;
  update public.appointments set status = 'serving', served_at = now() where id = v_next.id returning * into v_next;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status)
  values (v_next.id, auth.uid(), 'waiting', 'serving');
  return v_next;
end;
$$;

create or replace function public.get_patient_queue_status(p_appointment_id uuid)
returns table (
  token_number integer,
  status public.appointment_status,
  people_ahead bigint,
  estimated_wait_minutes integer,
  clinic_name text,
  doctor_name text,
  service_date date
)
language sql
security definer set search_path = public, pg_temp
as $$
  select
    a.token_number,
    a.status,
    count(q.id) filter (where q.status in ('waiting', 'serving')) as people_ahead,
    (count(q.id) filter (where q.status in ('waiting', 'serving')) * s.average_minutes)::integer as estimated_wait_minutes,
    c.name,
    s.doctor_name,
    s.service_date
  from public.appointments a
  join public.clinic_schedules s on s.id = a.schedule_id
  join public.clinics c on c.id = a.clinic_id
  left join public.appointments q on q.schedule_id = a.schedule_id and q.token_number < a.token_number
  where a.id = p_appointment_id and a.patient_id = auth.uid()
  group by a.id, s.id, c.id;
$$;

create or replace function public.create_clinic_schedule(
  p_clinic_id uuid,
  p_doctor_name text,
  p_service_date date,
  p_opens_at time,
  p_closes_at time,
  p_average_minutes integer,
  p_capacity integer
)
returns public.clinic_schedules
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid()) then
    raise exception 'Only clinic staff can create a schedule';
  end if;
  if p_service_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'A schedule cannot be created in the past'; end if;
  insert into public.clinic_schedules (clinic_id, doctor_name, service_date, opens_at, closes_at, average_minutes, capacity)
  values (p_clinic_id, trim(p_doctor_name), p_service_date, p_opens_at, p_closes_at, p_average_minutes, p_capacity)
  on conflict (clinic_id, service_date, doctor_name) do update set
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    average_minutes = excluded.average_minutes,
    capacity = excluded.capacity,
    accepting_tokens = true
  returning * into v_schedule;
  return v_schedule;
end;
$$;

create or replace function public.set_token_acceptance(p_schedule_id uuid, p_accepting boolean)
returns public.clinic_schedules
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare v_schedule public.clinic_schedules;
begin
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id for update;
  if not found then raise exception 'Schedule not found'; end if;
  if not exists (select 1 from public.staff_members where clinic_id = v_schedule.clinic_id and user_id = auth.uid()) then
    raise exception 'Only clinic staff can change token availability';
  end if;
  update public.clinic_schedules set accepting_tokens = p_accepting where id = p_schedule_id returning * into v_schedule;
  return v_schedule;
end;
$$;

create or replace function public.set_queue_status(p_appointment_id uuid, p_next_status public.appointment_status)
returns public.appointments
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_appointment public.appointments;
  v_previous_status public.appointment_status;
begin
  if p_next_status not in ('no_show', 'cancelled') then raise exception 'This queue action is not permitted'; end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;
  if not exists (select 1 from public.staff_members where clinic_id = v_appointment.clinic_id and user_id = auth.uid()) then
    raise exception 'Only clinic staff can update this token';
  end if;
  if v_appointment.status not in ('waiting', 'serving') then raise exception 'This token has already been closed'; end if;
  v_previous_status := v_appointment.status;
  update public.appointments set status = p_next_status,
    no_show_at = case when p_next_status = 'no_show' then now() else no_show_at end
  where id = v_appointment.id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status)
  values (v_appointment.id, auth.uid(), v_previous_status, p_next_status);
  return v_appointment;
end;
$$;

revoke all on function public.book_queue_token(uuid, uuid, text, text) from public, anon;
revoke all on function public.advance_queue(uuid, uuid) from public, anon;
revoke all on function public.set_queue_status(uuid, public.appointment_status) from public, anon;
revoke all on function public.get_patient_queue_status(uuid) from public, anon;
revoke all on function public.create_clinic_schedule(uuid, text, date, time, time, integer, integer) from public, anon;
revoke all on function public.set_token_acceptance(uuid, boolean) from public, anon;
grant execute on function public.book_queue_token(uuid, uuid, text, text) to authenticated;
grant execute on function public.advance_queue(uuid, uuid) to authenticated;
grant execute on function public.set_queue_status(uuid, public.appointment_status) to authenticated;
grant execute on function public.get_patient_queue_status(uuid) to authenticated;
grant execute on function public.create_clinic_schedule(uuid, text, date, time, time, integer, integer) to authenticated;
grant execute on function public.set_token_acceptance(uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.appointments;
