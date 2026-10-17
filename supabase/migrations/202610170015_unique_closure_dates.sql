-- Treat a whole-clinic closure as one date/doctor combination even when doctor_name is NULL.
alter table public.clinic_closures drop constraint if exists clinic_closures_clinic_id_closed_on_doctor_name_key;
create unique index clinic_closures_scope_date_unique on public.clinic_closures (clinic_id, closed_on, (coalesce(doctor_name, '')));

create or replace function public.set_clinic_closure(p_clinic_id uuid, p_closed_on date, p_doctor_name text, p_reason text)
returns public.clinic_closures language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.clinic_closures;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin') then raise exception 'Only a clinic administrator can manage closure days'; end if;
  if p_closed_on < (now() at time zone 'Asia/Kolkata')::date then raise exception 'A closure cannot be added in the past'; end if;
  insert into public.clinic_closures (clinic_id, closed_on, doctor_name, reason, created_by)
    values (p_clinic_id, p_closed_on, nullif(trim(p_doctor_name), ''), nullif(trim(p_reason), ''), auth.uid())
  on conflict (clinic_id, closed_on, (coalesce(doctor_name, ''))) do update set reason = excluded.reason returning * into v_row;
  return v_row;
end; $$;
