-- Doctors can read and advance only their assigned doctor's queue.
drop policy if exists "patients see their own appointments" on public.appointments;
drop policy if exists "clinic staff see their clinic appointments" on public.appointments;
create policy "Patients and clinic teams see authorized appointments" on public.appointments for select to authenticated using (
  patient_id = (select auth.uid()) or exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = appointments.clinic_id and sm.user_id = (select auth.uid()) and (
      sm.role in ('admin','receptionist') or (sm.role = 'doctor' and exists (
        select 1 from public.clinic_doctors d join public.clinic_schedules s on s.clinic_id = d.clinic_id
        where d.clinic_id = appointments.clinic_id and d.user_id = sm.user_id and s.id = appointments.schedule_id and d.display_name = s.doctor_name
      ))
    )
  )
);

drop policy if exists "patients see events for their appointments" on public.queue_events;
drop policy if exists "staff see events in their clinics" on public.queue_events;
create policy "Users see queue events they are allowed to access" on public.queue_events for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = queue_events.appointment_id and a.patient_id = (select auth.uid())) or exists (
    select 1 from public.appointments a join public.staff_members sm on sm.clinic_id = a.clinic_id
    where a.id = queue_events.appointment_id and sm.user_id = (select auth.uid()) and (
      sm.role in ('admin','receptionist') or (sm.role = 'doctor' and exists (
        select 1 from public.clinic_doctors d join public.clinic_schedules s on s.clinic_id = d.clinic_id
        where d.clinic_id = a.clinic_id and d.user_id = sm.user_id and s.id = a.schedule_id and d.display_name = s.doctor_name
      ))
    )
  )
);

create or replace function public.advance_queue(p_clinic_id uuid, p_schedule_id uuid)
returns public.appointments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_previous public.appointments; v_next public.appointments; v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role in ('admin', 'receptionist', 'doctor')) then
    raise exception 'Clinic access is required to advance this queue';
  end if;
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id and clinic_id = p_clinic_id for update;
  if not found then raise exception 'This clinic session is unavailable'; end if;
  if exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'doctor')
    and not exists (select 1 from public.clinic_doctors where clinic_id = p_clinic_id and user_id = auth.uid() and display_name = v_schedule.doctor_name) then
    raise exception 'Doctors can only advance their assigned sessions';
  end if;
  select * into v_previous from public.appointments where schedule_id = p_schedule_id and status = 'serving' for update;
  if found then
    update public.appointments set status = 'completed', completed_at = now(), consultation_ended_at = now() where id = v_previous.id;
    insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_previous.id, auth.uid(), 'serving', 'completed');
  end if;
  select * into v_next from public.appointments where schedule_id = p_schedule_id and status = 'arrived' order by token_number for update skip locked limit 1;
  if not found then return null; end if;
  insert into public.queue_events (appointment_id, actor_id, previous_status, next_status) values (v_next.id, auth.uid(), 'arrived', 'serving');
  update public.appointments set status = 'serving', served_at = now(), consultation_started_at = now() where id = v_next.id returning * into v_next;
  return v_next;
end; $$;

revoke all on function public.advance_queue(uuid,uuid) from public, anon;
grant execute on function public.advance_queue(uuid,uuid) to authenticated;
