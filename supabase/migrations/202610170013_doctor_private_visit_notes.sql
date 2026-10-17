-- Keep patient-shared visit details out of the receptionist queue row.
create table public.appointment_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  patient_id uuid references public.profiles(id) on delete set null,
  note text not null check (char_length(note) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.appointment_notes enable row level security;
create policy "Patients and assigned doctors read shared visit notes" on public.appointment_notes for select to authenticated using (
  patient_id = (select auth.uid()) or exists (
    select 1 from public.appointments a
    join public.clinic_schedules s on s.id = a.schedule_id
    join public.staff_members sm on sm.clinic_id = a.clinic_id and sm.user_id = (select auth.uid()) and sm.role = 'doctor'
    join public.clinic_doctors d on d.clinic_id = s.clinic_id and d.user_id = sm.user_id and d.display_name = s.doctor_name
    where a.id = appointment_notes.appointment_id
  )
);
revoke all on public.appointment_notes from anon, authenticated;
grant select on public.appointment_notes to authenticated;
do $$ begin
  if exists (select 1 from public.appointments where visit_reason is not null) then
    raise exception 'Legacy visit notes exist. Preserve them in appointment_notes before applying this migration.';
  end if;
end $$;
alter table public.appointments drop column if exists visit_reason;

create or replace function public.book_queue_token(p_clinic_id uuid, p_schedule_id uuid, p_patient_name text, p_phone text, p_visit_reason text default null)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules; v_appointment public.appointments;
begin
  if auth.uid() is null then raise exception 'Sign in before booking a token'; end if;
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found then raise exception 'This clinic session is unavailable'; end if;
  if v_schedule.service_date <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'Tokens can only be booked for today'; end if;
  if not v_schedule.accepting_tokens then raise exception 'This clinic is not accepting tokens right now'; end if;
  if v_schedule.last_token >= v_schedule.capacity then raise exception 'Today''s token limit has been reached'; end if;
  if exists (select 1 from public.clinic_closures cc where cc.clinic_id = p_clinic_id and cc.closed_on = v_schedule.service_date and (cc.doctor_name is null or cc.doctor_name = v_schedule.doctor_name)) then raise exception 'This doctor is unavailable on that date'; end if;
  if exists (select 1 from public.clinic_schedules cs where cs.id = v_schedule.id and not coalesce((select allow_online_booking from public.clinic_settings where clinic_id = p_clinic_id), true)) then raise exception 'Online booking is currently disabled'; end if;
  if exists (select 1 from public.appointments where schedule_id = p_schedule_id and patient_id = auth.uid() and status not in ('cancelled', 'no_show')) then raise exception 'You already have an active token for this clinic session'; end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_schedule.id returning * into v_schedule;
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number, source)
    values (p_clinic_id, p_schedule_id, auth.uid(), trim(p_patient_name), trim(p_phone), v_schedule.last_token, 'online') returning * into v_appointment;
  if nullif(trim(p_visit_reason), '') is not null then
    insert into public.appointment_notes (appointment_id, patient_id, note) values (v_appointment.id, auth.uid(), trim(p_visit_reason));
  end if;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), null, 'waiting');
  return v_appointment;
end; $$;

create or replace function public.add_walk_in(p_clinic_id uuid, p_schedule_id uuid, p_patient_name text, p_phone text, p_visit_reason text default null)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules; v_appointment public.appointments;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist')) then raise exception 'Receptionist access is required to add a walk-in'; end if;
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found or v_schedule.service_date <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose an active session for today'; end if;
  if v_schedule.last_token >= v_schedule.capacity then raise exception 'Today''s token limit has been reached'; end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_schedule.id returning * into v_schedule;
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number, source, status, checked_in_at)
    values (p_clinic_id, p_schedule_id, null, trim(p_patient_name), trim(p_phone), v_schedule.last_token, 'walk_in', 'arrived', now()) returning * into v_appointment;
  if nullif(trim(p_visit_reason), '') is not null then
    insert into public.appointment_notes (appointment_id, patient_id, note) values (v_appointment.id, null, trim(p_visit_reason));
  end if;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), null, 'arrived');
  return v_appointment;
end; $$;

revoke all on function public.book_queue_token(uuid,uuid,text,text,text), public.add_walk_in(uuid,uuid,text,text,text) from public, anon;
grant execute on function public.book_queue_token(uuid,uuid,text,text,text), public.add_walk_in(uuid,uuid,text,text,text) to authenticated;
