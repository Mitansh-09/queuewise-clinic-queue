-- Keep clinic configuration and clinician identity changes exclusive to clinic admins.
drop policy if exists "Assigned clinic staff add doctor listings" on public.clinic_doctors;
drop policy if exists "Assigned clinic staff update doctor listings" on public.clinic_doctors;
drop policy if exists "Assigned clinic staff remove doctor listings" on public.clinic_doctors;
create policy "Clinic admins add doctor listings" on public.clinic_doctors for insert to authenticated with check (
  exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid()) and sm.role = 'admin')
);
create policy "Clinic admins update doctor listings" on public.clinic_doctors for update to authenticated using (
  exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid()) and sm.role = 'admin')
) with check (
  exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid()) and sm.role = 'admin')
);
create policy "Clinic admins remove doctor listings" on public.clinic_doctors for delete to authenticated using (
  exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid()) and sm.role = 'admin')
);

create or replace function public.create_clinic_schedule(p_clinic_id uuid, p_doctor_name text, p_service_date date, p_opens_at time, p_closes_at time, p_average_minutes integer, p_capacity integer, p_fee numeric default 0)
returns public.clinic_schedules language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin') then
    raise exception 'Clinic administrator access is required to change schedules or fees';
  end if;
  if p_service_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'A schedule cannot be created in the past'; end if;
  if exists (select 1 from public.clinic_closures cc where cc.clinic_id = p_clinic_id and cc.closed_on = p_service_date and (cc.doctor_name is null or cc.doctor_name = trim(p_doctor_name))) then
    raise exception 'This doctor has a closure on that date';
  end if;
  insert into public.clinic_schedules (clinic_id, doctor_name, service_date, opens_at, closes_at, average_minutes, capacity, fee, cancellation_cutoff_minutes)
  values (p_clinic_id, trim(p_doctor_name), p_service_date, p_opens_at, p_closes_at, p_average_minutes, p_capacity, p_fee,
    coalesce((select default_cancellation_cutoff_minutes from public.clinic_settings where clinic_id = p_clinic_id), 60))
  on conflict (clinic_id, service_date, doctor_name) do update set opens_at = excluded.opens_at, closes_at = excluded.closes_at,
    average_minutes = excluded.average_minutes, capacity = excluded.capacity, fee = excluded.fee,
    cancellation_cutoff_minutes = excluded.cancellation_cutoff_minutes, accepting_tokens = true returning * into v_schedule;
  return v_schedule;
end; $$;

revoke all on function public.create_clinic_schedule(uuid,text,date,time,time,integer,integer,numeric) from public, anon;
grant execute on function public.create_clinic_schedule(uuid,text,date,time,time,integer,integer,numeric) to authenticated;
