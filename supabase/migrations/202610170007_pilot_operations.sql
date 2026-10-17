-- Clinic setup, complete queue transitions, timestamps, and measured reports.
alter table public.staff_members drop constraint if exists staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check
  check (role in ('receptionist', 'doctor', 'admin'));

alter table public.appointments
  add column if not exists source text not null default 'online' check (source in ('online', 'walk_in')),
  add column if not exists visit_reason text check (visit_reason is null or char_length(visit_reason) <= 500),
  add column if not exists consultation_started_at timestamptz,
  add column if not exists consultation_ended_at timestamptz,
  add column if not exists skipped_at timestamptz;

update public.appointments set consultation_started_at = served_at where consultation_started_at is null and served_at is not null;
update public.appointments set consultation_ended_at = completed_at where consultation_ended_at is null and completed_at is not null;

alter table public.clinic_schedules
  add column if not exists fee numeric(10,2) not null default 0 check (fee >= 0),
  add column if not exists cancellation_cutoff_minutes integer not null default 60 check (cancellation_cutoff_minutes between 0 and 1440);

alter table public.clinic_doctors add column if not exists user_id uuid references public.profiles(id) on delete set null;
create unique index if not exists clinic_doctors_user_idx on public.clinic_doctors (clinic_id, user_id) where user_id is not null;

create table if not exists public.clinic_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  default_cancellation_cutoff_minutes integer not null default 60 check (default_cancellation_cutoff_minutes between 0 and 1440),
  allow_online_booking boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_closures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  closed_on date not null,
  doctor_name text,
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, closed_on, doctor_name)
);
create index if not exists clinic_closures_clinic_date_idx on public.clinic_closures (clinic_id, closed_on);

alter table public.clinic_settings enable row level security;
alter table public.clinic_closures enable row level security;
create policy "Clinic members read their clinic settings" on public.clinic_settings for select to authenticated
  using (exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_settings.clinic_id and sm.user_id = (select auth.uid())));
create policy "Clinic members read their closures" on public.clinic_closures for select to authenticated
  using (exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_closures.clinic_id and sm.user_id = (select auth.uid())));
revoke all on public.clinic_settings, public.clinic_closures from anon;
grant select on public.clinic_settings, public.clinic_closures to authenticated;

create or replace function public.create_clinic(p_name text, p_address text)
returns public.clinics language plpgsql security definer set search_path = public, pg_temp as $$
declare v_clinic public.clinics;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only a platform administrator can create a clinic';
  end if;
  insert into public.clinics (name, address) values (trim(p_name), trim(p_address)) returning * into v_clinic;
  insert into public.clinic_settings (clinic_id) values (v_clinic.id);
  insert into public.staff_members (clinic_id, user_id, role) values (v_clinic.id, auth.uid(), 'admin');
  return v_clinic;
end; $$;

create or replace function public.set_clinic_settings(p_clinic_id uuid, p_cutoff integer, p_online boolean)
returns public.clinic_settings language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.clinic_settings;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin') then
    raise exception 'Only a clinic administrator can change clinic settings';
  end if;
  insert into public.clinic_settings (clinic_id, default_cancellation_cutoff_minutes, allow_online_booking)
    values (p_clinic_id, p_cutoff, p_online)
  on conflict (clinic_id) do update set default_cancellation_cutoff_minutes = excluded.default_cancellation_cutoff_minutes,
    allow_online_booking = excluded.allow_online_booking, updated_at = now() returning * into v_row;
  return v_row;
end; $$;

create or replace function public.set_clinic_staff(p_clinic_id uuid, p_user_id uuid, p_role public.app_role)
returns public.staff_members language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.staff_members;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin')
    and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only a platform or clinic administrator can manage staff';
  end if;
  if p_role not in ('admin', 'doctor', 'receptionist') then raise exception 'Select a clinic staff role'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'No account exists for that user ID'; end if;
  insert into public.staff_members (clinic_id, user_id, role) values (p_clinic_id, p_user_id, p_role)
  on conflict (clinic_id, user_id) do update set role = excluded.role returning * into v_row;
  return v_row;
end; $$;

create or replace function public.set_clinic_closure(p_clinic_id uuid, p_closed_on date, p_doctor_name text, p_reason text)
returns public.clinic_closures language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.clinic_closures;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin') then
    raise exception 'Only a clinic administrator can manage closure days';
  end if;
  insert into public.clinic_closures (clinic_id, closed_on, doctor_name, reason, created_by)
    values (p_clinic_id, p_closed_on, nullif(trim(p_doctor_name), ''), nullif(trim(p_reason), ''), auth.uid())
  on conflict (clinic_id, closed_on, doctor_name) do update set reason = excluded.reason
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.remove_clinic_closure(p_closure_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.clinic_closures cc where cc.id = p_closure_id and exists (
    select 1 from public.staff_members sm where sm.clinic_id = cc.clinic_id and sm.user_id = auth.uid() and sm.role = 'admin'
  );
  if not found then raise exception 'Closure not found or access denied'; end if;
end; $$;

drop function if exists public.book_queue_token(uuid, uuid, text, text);
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
  if exists (select 1 from public.clinic_closures cc where cc.clinic_id = p_clinic_id and cc.closed_on = v_schedule.service_date
    and (cc.doctor_name is null or cc.doctor_name = v_schedule.doctor_name)) then raise exception 'This doctor is unavailable on that date'; end if;
  if exists (select 1 from public.clinic_schedules cs where cs.id = v_schedule.id and not coalesce((select allow_online_booking from public.clinic_settings where clinic_id = p_clinic_id), true)) then
    raise exception 'Online booking is currently disabled';
  end if;
  if exists (select 1 from public.appointments where schedule_id = p_schedule_id and patient_id = auth.uid() and status not in ('cancelled', 'no_show')) then
    raise exception 'You already have an active token for this clinic session';
  end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_schedule.id returning * into v_schedule;
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number, visit_reason, source)
    values (p_clinic_id, p_schedule_id, auth.uid(), trim(p_patient_name), trim(p_phone), v_schedule.last_token, nullif(trim(p_visit_reason), ''), 'online')
    returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), null, 'waiting');
  return v_appointment;
end; $$;

create or replace function public.add_walk_in(p_clinic_id uuid, p_schedule_id uuid, p_patient_name text, p_phone text, p_visit_reason text default null)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules; v_appointment public.appointments;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist')) then
    raise exception 'Receptionist access is required to add a walk-in';
  end if;
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found or v_schedule.service_date <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose an active session for today'; end if;
  if v_schedule.last_token >= v_schedule.capacity then raise exception 'Today''s token limit has been reached'; end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_schedule.id returning * into v_schedule;
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number, visit_reason, source)
    values (p_clinic_id, p_schedule_id, null, trim(p_patient_name), trim(p_phone), v_schedule.last_token, nullif(trim(p_visit_reason), ''), 'walk_in')
    returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), null, 'waiting');
  return v_appointment;
end; $$;

create or replace function public.mark_queue_arrived(p_appointment_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appointment public.appointments; v_prev public.appointment_status;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or not exists (select 1 from public.staff_members where clinic_id = v_appointment.clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist')) then
    raise exception 'Receptionist access is required for check-in';
  end if;
  if v_appointment.status not in ('waiting', 'skipped') then raise exception 'Only a waiting or skipped token can check in'; end if;
  v_prev := v_appointment.status;
  update public.appointments set status = 'arrived', checked_in_at = coalesce(checked_in_at, now()), skipped_at = null where id = p_appointment_id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (p_appointment_id, auth.uid(), v_prev, 'arrived');
  return v_appointment;
end; $$;

create or replace function public.advance_queue(p_clinic_id uuid, p_schedule_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_previous public.appointments; v_next public.appointments; v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist', 'doctor')) then
    raise exception 'Clinic access is required to advance this queue';
  end if;
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found then raise exception 'This clinic session is unavailable'; end if;
  select * into v_previous from public.appointments where schedule_id = p_schedule_id and status = 'serving' for update;
  if found then
    update public.appointments set status = 'completed', completed_at = now(), consultation_ended_at = now() where id = v_previous.id;
    insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_previous.id, auth.uid(), 'serving', 'completed');
  end if;
  select * into v_next from public.appointments where schedule_id = p_schedule_id and status in ('arrived', 'waiting')
    order by case when status = 'arrived' then 0 else 1 end, token_number for update skip locked limit 1;
  if not found then return null; end if;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_next.id, auth.uid(), v_next.status, 'serving');
  update public.appointments set status = 'serving', served_at = now(), consultation_started_at = now() where id = v_next.id returning * into v_next;
  return v_next;
end; $$;

create or replace function public.set_queue_status(p_appointment_id uuid, p_next_status public.appointment_status)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appointment public.appointments; v_prev public.appointment_status;
begin
  if p_next_status not in ('no_show', 'skipped', 'waiting') then raise exception 'This queue action is not permitted'; end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found or not exists (select 1 from public.staff_members where clinic_id = v_appointment.clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist')) then
    raise exception 'Receptionist access is required to change this token';
  end if;
  if p_next_status = 'waiting' and v_appointment.status <> 'skipped' then raise exception 'Only skipped tokens can be returned to the queue'; end if;
  if p_next_status <> 'waiting' and v_appointment.status not in ('waiting', 'arrived', 'serving') then raise exception 'This token has already been closed'; end if;
  v_prev := v_appointment.status;
  update public.appointments set status = p_next_status,
    no_show_at = case when p_next_status = 'no_show' then now() else no_show_at end,
    skipped_at = case when p_next_status = 'skipped' then now() else null end,
    consultation_ended_at = case when p_next_status in ('no_show','skipped') and v_prev = 'serving' then now() else consultation_ended_at end
    where id = p_appointment_id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), v_prev, p_next_status);
  return v_appointment;
end; $$;

create or replace function public.cancel_queue_token(p_appointment_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appointment public.appointments; v_schedule public.clinic_schedules; v_cutoff integer; v_prev public.appointment_status;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id and patient_id = auth.uid() for update;
  if not found then raise exception 'Token not found'; end if;
  select * into v_schedule from public.clinic_schedules where id = v_appointment.schedule_id;
  select coalesce((select default_cancellation_cutoff_minutes from public.clinic_settings where clinic_id = v_appointment.clinic_id), v_schedule.cancellation_cutoff_minutes) into v_cutoff;
  if (v_schedule.service_date + v_schedule.opens_at) - (v_cutoff * interval '1 minute') <= now() then raise exception 'The clinic cancellation cutoff has passed. Contact the clinic for help.'; end if;
  if v_appointment.status not in ('waiting', 'arrived') then raise exception 'This token can no longer be cancelled online'; end if;
  v_prev := v_appointment.status;
  update public.appointments set status = 'cancelled' where id = p_appointment_id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), v_prev, 'cancelled');
  return v_appointment;
end; $$;

create or replace function public.reschedule_queue_token(p_appointment_id uuid, p_new_schedule_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appointment public.appointments; v_old public.clinic_schedules; v_new public.clinic_schedules; v_cutoff integer; v_prev public.appointment_status;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id and patient_id = auth.uid() for update;
  if not found then raise exception 'Token not found'; end if;
  select * into v_old from public.clinic_schedules where id = v_appointment.schedule_id;
  select coalesce((select default_cancellation_cutoff_minutes from public.clinic_settings where clinic_id = v_appointment.clinic_id), v_old.cancellation_cutoff_minutes) into v_cutoff;
  if (v_old.service_date + v_old.opens_at) - (v_cutoff * interval '1 minute') <= now() then raise exception 'The reschedule cutoff has passed. Contact the clinic for help.'; end if;
  if v_appointment.status not in ('waiting', 'arrived') then raise exception 'This token can no longer be rescheduled online'; end if;
  select * into v_new from public.clinic_schedules where id = p_new_schedule_id and clinic_id = v_appointment.clinic_id for update;
  if not found or v_new.service_date < (now() at time zone 'Asia/Kolkata')::date or not v_new.accepting_tokens or v_new.last_token >= v_new.capacity then raise exception 'The new clinic session is unavailable'; end if;
  if v_new.id = v_old.id then raise exception 'Choose a different session'; end if;
  if exists (select 1 from public.appointments where schedule_id = v_new.id and patient_id = auth.uid() and status not in ('cancelled','no_show')) then raise exception 'You already have a token for that session'; end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_new.id returning * into v_new;
  v_prev := v_appointment.status;
  update public.appointments set schedule_id = v_new.id, clinic_id = v_new.clinic_id, token_number = v_new.last_token,
    status = 'waiting', checked_in_at = null where id = v_appointment.id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), v_prev, 'waiting');
  return v_appointment;
end; $$;

drop function if exists public.get_patient_queue_status(uuid);
create or replace function public.get_patient_queue_status(p_appointment_id uuid)
returns table (token_number integer, status public.appointment_status, people_ahead bigint, estimated_wait_minutes integer, clinic_name text, doctor_name text, service_date date, average_consult_minutes integer)
language sql security definer set search_path = public, pg_temp as $$
  select a.token_number, a.status,
    count(q.id) filter (where q.status in ('waiting','arrived','serving')) as people_ahead,
    (count(q.id) filter (where q.status in ('waiting','arrived','serving')) * effective.minutes)::integer,
    c.name, s.doctor_name, s.service_date, effective.minutes
  from public.appointments a join public.clinic_schedules s on s.id = a.schedule_id join public.clinics c on c.id = a.clinic_id
  cross join lateral (
    select case when count(*) >= 3 then
      greatest(2, least(90, round(avg(extract(epoch from (coalesce(x.consultation_ended_at,x.completed_at) - coalesce(x.consultation_started_at,x.served_at))) / 60.0))::integer))
      else s.average_minutes end as minutes
    from public.appointments x where x.schedule_id = s.id and x.status = 'completed'
      and coalesce(x.consultation_ended_at,x.completed_at) is not null and coalesce(x.consultation_started_at,x.served_at) is not null
      and coalesce(x.consultation_ended_at,x.completed_at) > coalesce(x.consultation_started_at,x.served_at)
  ) effective
  left join public.appointments q on q.schedule_id = a.schedule_id and q.token_number < a.token_number
  where a.id = p_appointment_id and a.patient_id = auth.uid()
  group by a.id, s.id, c.id, effective.minutes;
$$;

drop function if exists public.create_clinic_schedule(uuid,text,date,time,time,integer,integer);
create or replace function public.create_clinic_schedule(p_clinic_id uuid, p_doctor_name text, p_service_date date, p_opens_at time, p_closes_at time, p_average_minutes integer, p_capacity integer, p_fee numeric default 0)
returns public.clinic_schedules language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role in ('admin','receptionist')) then raise exception 'Clinic admin or receptionist access is required'; end if;
  if p_service_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'A schedule cannot be created in the past'; end if;
  if exists (select 1 from public.clinic_closures cc where cc.clinic_id = p_clinic_id and cc.closed_on = p_service_date and (cc.doctor_name is null or cc.doctor_name = trim(p_doctor_name))) then raise exception 'This doctor has a closure on that date'; end if;
  insert into public.clinic_schedules (clinic_id, doctor_name, service_date, opens_at, closes_at, average_minutes, capacity, fee, cancellation_cutoff_minutes)
  values (p_clinic_id, trim(p_doctor_name), p_service_date, p_opens_at, p_closes_at, p_average_minutes, p_capacity, p_fee,
    coalesce((select default_cancellation_cutoff_minutes from public.clinic_settings where clinic_id = p_clinic_id), 60))
  on conflict (clinic_id, service_date, doctor_name) do update set opens_at = excluded.opens_at, closes_at = excluded.closes_at,
    average_minutes = excluded.average_minutes, capacity = excluded.capacity, fee = excluded.fee,
    cancellation_cutoff_minutes = excluded.cancellation_cutoff_minutes, accepting_tokens = true returning * into v_schedule;
  return v_schedule;
end; $$;

revoke all on function public.create_clinic(text,text), public.set_clinic_settings(uuid,integer,boolean), public.set_clinic_staff(uuid,uuid,public.app_role), public.set_clinic_closure(uuid,date,text,text), public.remove_clinic_closure(uuid), public.add_walk_in(uuid,uuid,text,text,text), public.mark_queue_arrived(uuid), public.cancel_queue_token(uuid), public.reschedule_queue_token(uuid,uuid) from public, anon;
grant execute on function public.create_clinic(text,text), public.set_clinic_settings(uuid,integer,boolean), public.set_clinic_staff(uuid,uuid,public.app_role), public.set_clinic_closure(uuid,date,text,text), public.remove_clinic_closure(uuid), public.add_walk_in(uuid,uuid,text,text,text), public.mark_queue_arrived(uuid), public.cancel_queue_token(uuid), public.reschedule_queue_token(uuid,uuid) to authenticated;
revoke all on function public.book_queue_token(uuid,uuid,text,text,text), public.advance_queue(uuid,uuid), public.set_queue_status(uuid,public.appointment_status), public.get_patient_queue_status(uuid), public.create_clinic_schedule(uuid,text,date,time,time,integer,integer,numeric) from public, anon;
grant execute on function public.book_queue_token(uuid,uuid,text,text,text), public.advance_queue(uuid,uuid), public.set_queue_status(uuid,public.appointment_status), public.get_patient_queue_status(uuid), public.create_clinic_schedule(uuid,text,date,time,time,integer,integer,numeric) to authenticated;

-- Keep queue events and appointment changes available for existing live queue clients.
do $$ begin
  alter publication supabase_realtime add table public.appointments;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
