-- Consolidate earlier queue read policies and index new foreign keys.
drop policy if exists "patients and clinic staff see permitted appointments" on public.appointments;
drop policy if exists "patients and clinic staff see permitted queue events" on public.queue_events;
create index if not exists clinic_doctors_user_id_idx on public.clinic_doctors (user_id);
create index if not exists clinic_closures_created_by_idx on public.clinic_closures (created_by);
