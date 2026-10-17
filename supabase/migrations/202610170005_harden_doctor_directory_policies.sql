-- Keep the doctor directory tenant-scoped and avoid overlapping SELECT policies.
drop policy "Clinic staff manage their doctor directory" on public.clinic_doctors;
drop policy "Signed-in patients see listed doctors at active clinics" on public.clinic_doctors;

create policy "Patients and assigned staff read doctor listings" on public.clinic_doctors
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_members sm
      where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())
    )
    or (
      listed and exists (
        select 1 from public.clinics c
        where c.id = clinic_doctors.clinic_id and c.active
      )
    )
  );

create policy "Assigned clinic staff add doctor listings" on public.clinic_doctors
  for insert to authenticated
  with check (exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())
  ));

create policy "Assigned clinic staff update doctor listings" on public.clinic_doctors
  for update to authenticated
  using (exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())
  ));

create policy "Assigned clinic staff remove doctor listings" on public.clinic_doctors
  for delete to authenticated
  using (exists (
    select 1 from public.staff_members sm
    where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())
  ));
