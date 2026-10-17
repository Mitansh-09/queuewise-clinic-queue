-- Tighten function exposure and index operational joins.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create index appointments_clinic_id_idx on public.appointments (clinic_id);
create index queue_events_actor_id_idx on public.queue_events (actor_id);
create index queue_events_appointment_id_idx on public.queue_events (appointment_id);
create index staff_members_user_id_idx on public.staff_members (user_id);

drop policy "patients see their own appointments" on public.appointments;
drop policy "clinic staff see their clinic appointments" on public.appointments;
create policy "patients and clinic staff see permitted appointments" on public.appointments for select to authenticated using (
  patient_id = (select auth.uid())
  or exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = appointments.clinic_id and sm.user_id = (select auth.uid())
  )
);

drop policy "patients see events for their appointments" on public.queue_events;
drop policy "staff see events in their clinics" on public.queue_events;
create policy "patients and clinic staff see permitted queue events" on public.queue_events for select to authenticated using (
  exists (
    select 1 from public.appointments a
    where a.id = queue_events.appointment_id and (
      a.patient_id = (select auth.uid())
      or exists (
        select 1 from public.staff_members sm
        where sm.clinic_id = a.clinic_id and sm.user_id = (select auth.uid())
      )
    )
  )
);
