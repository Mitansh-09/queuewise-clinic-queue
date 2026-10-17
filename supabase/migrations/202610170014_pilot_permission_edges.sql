-- Close role and date checks at the database boundary.
create or replace function public.set_token_acceptance(p_schedule_id uuid, p_accepting boolean)
returns public.clinic_schedules language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.clinic_schedules;
begin
  select * into v_schedule from public.clinic_schedules where id = p_schedule_id for update;
  if not found then raise exception 'Schedule not found'; end if;
  if not exists (select 1 from public.staff_members where clinic_id = v_schedule.clinic_id and user_id = auth.uid() and role in ('admin','receptionist')) then
    raise exception 'Clinic admin or receptionist access is required to change token availability';
  end if;
  update public.clinic_schedules set accepting_tokens = p_accepting where id = p_schedule_id returning * into v_schedule;
  return v_schedule;
end; $$;

create or replace function public.set_clinic_closure(p_clinic_id uuid, p_closed_on date, p_doctor_name text, p_reason text)
returns public.clinic_closures language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.clinic_closures;
begin
  if not exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = auth.uid() and role = 'admin') then
    raise exception 'Only a clinic administrator can manage closure days';
  end if;
  if p_closed_on < (now() at time zone 'Asia/Kolkata')::date then raise exception 'A closure cannot be added in the past'; end if;
  insert into public.clinic_closures (clinic_id, closed_on, doctor_name, reason, created_by)
    values (p_clinic_id, p_closed_on, nullif(trim(p_doctor_name), ''), nullif(trim(p_reason), ''), auth.uid())
  on conflict (clinic_id, closed_on, doctor_name) do update set reason = excluded.reason
  returning * into v_row;
  return v_row;
end; $$;

revoke all on function public.set_token_acceptance(uuid,boolean), public.set_clinic_closure(uuid,date,text,text) from public, anon;
grant execute on function public.set_token_acceptance(uuid,boolean), public.set_clinic_closure(uuid,date,text,text) to authenticated;
