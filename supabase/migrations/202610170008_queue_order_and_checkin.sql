-- Walk-ins are already physically present. Online bookings must be checked in before they can be called.
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
  insert into public.appointments (clinic_id, schedule_id, patient_id, patient_name, phone, token_number, visit_reason, source, status, checked_in_at)
    values (p_clinic_id, p_schedule_id, null, trim(p_patient_name), trim(p_phone), v_schedule.last_token, nullif(trim(p_visit_reason), ''), 'walk_in', 'arrived', now())
    returning * into v_appointment;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_appointment.id, auth.uid(), null, 'arrived');
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
  select * into v_next from public.appointments where schedule_id = p_schedule_id and status = 'arrived'
    order by token_number for update skip locked limit 1;
  if not found then return null; end if;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_next.id, auth.uid(), 'arrived', 'serving');
  update public.appointments set status = 'serving', served_at = now(), consultation_started_at = now() where id = v_next.id returning * into v_next;
  return v_next;
end; $$;

revoke all on function public.add_walk_in(uuid,uuid,text,text,text), public.advance_queue(uuid,uuid) from public, anon;
grant execute on function public.add_walk_in(uuid,uuid,text,text,text), public.advance_queue(uuid,uuid) to authenticated;
