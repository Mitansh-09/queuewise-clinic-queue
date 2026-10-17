-- Preserve the original session/token when a patient moves a booking.
create table public.appointment_reschedules (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  previous_schedule_id uuid not null references public.clinic_schedules(id),
  previous_token_number integer not null,
  next_schedule_id uuid not null references public.clinic_schedules(id),
  next_token_number integer not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index appointment_reschedules_appointment_idx on public.appointment_reschedules (appointment_id, changed_at desc);
alter table public.appointment_reschedules enable row level security;
create policy "Users see reschedule history for their permitted queue" on public.appointment_reschedules for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = appointment_reschedules.appointment_id and a.patient_id = (select auth.uid())) or
  exists (select 1 from public.appointments a join public.staff_members sm on sm.clinic_id = a.clinic_id
    where a.id = appointment_reschedules.appointment_id and sm.user_id = (select auth.uid()) and sm.role in ('admin','receptionist'))
);
revoke all on public.appointment_reschedules from anon;
grant select on public.appointment_reschedules to authenticated;

create or replace function public.reschedule_queue_token(p_appointment_id uuid, p_new_schedule_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appointment public.appointments; v_old public.clinic_schedules; v_new public.clinic_schedules; v_cutoff integer; v_prev public.appointment_status; v_old_token integer;
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
  if exists (select 1 from public.clinic_closures cc where cc.clinic_id = v_new.clinic_id and cc.closed_on = v_new.service_date and (cc.doctor_name is null or cc.doctor_name = v_new.doctor_name)) then raise exception 'The selected doctor is unavailable on that date'; end if;
  if exists (select 1 from public.appointments where schedule_id = v_new.id and patient_id = auth.uid() and status not in ('cancelled','no_show')) then raise exception 'You already have a token for that session'; end if;
  update public.clinic_schedules set last_token = last_token + 1 where id = v_new.id returning * into v_new;
  v_prev := v_appointment.status;
  v_old_token := v_appointment.token_number;
  insert into public.appointment_reschedules (appointment_id, previous_schedule_id, previous_token_number, next_schedule_id, next_token_number, changed_by)
    values (v_appointment.id, v_old.id, v_old_token, v_new.id, v_new.last_token, auth.uid());
  update public.appointments set schedule_id = v_new.id, clinic_id = v_new.clinic_id, token_number = v_new.last_token, status = 'waiting', checked_in_at = null
    where id = v_appointment.id returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), v_prev, 'waiting');
  return v_appointment;
end; $$;
revoke all on function public.reschedule_queue_token(uuid,uuid) from public, anon;
grant execute on function public.reschedule_queue_token(uuid,uuid) to authenticated;
