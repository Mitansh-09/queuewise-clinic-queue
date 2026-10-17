-- Add a private personal health vault and a clinic-managed doctor directory.
-- Health records are owned by the patient's account and are not shared with clinics.

create table public.care_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  relationship text not null check (relationship in ('self', 'child', 'parent', 'spouse', 'dependent')),
  date_of_birth date,
  authorization_confirmed boolean not null default false check (authorization_confirmed),
  created_at timestamptz not null default now()
);
create unique index care_profiles_one_self_idx on public.care_profiles (account_id) where relationship = 'self';
create index care_profiles_account_idx on public.care_profiles (account_id, created_at);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  care_profile_id uuid not null references public.care_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  category text not null check (category in ('lab_result', 'prescription', 'visit_summary', 'vaccination', 'imaging', 'other')),
  record_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index medical_records_profile_date_idx on public.medical_records (care_profile_id, record_date desc nulls last);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  care_profile_id uuid not null references public.care_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  dose text not null check (char_length(dose) between 1 and 120),
  instructions text check (instructions is null or char_length(instructions) <= 500),
  start_date date not null default current_date,
  end_date date,
  reminder_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index medications_profile_active_idx on public.medications (care_profile_id, active, reminder_time);

create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  taken_on date not null default (now() at time zone 'Asia/Kolkata')::date,
  recorded_at timestamptz not null default now(),
  unique (medication_id, taken_on)
);
create index medication_logs_taken_on_idx on public.medication_logs (taken_on desc);

create table public.clinic_doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  specialty text not null check (char_length(specialty) between 2 and 100),
  qualifications text check (qualifications is null or char_length(qualifications) <= 200),
  experience_years integer check (experience_years is null or experience_years between 0 and 70),
  languages text[] not null default '{}',
  search_terms text[] not null default '{}',
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinic_doctors_clinic_listed_idx on public.clinic_doctors (clinic_id, listed, specialty);
create index clinic_doctors_search_terms_idx on public.clinic_doctors using gin (search_terms);

alter table public.care_profiles enable row level security;
alter table public.medical_records enable row level security;
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.clinic_doctors enable row level security;

create policy "Account owners manage their care profiles" on public.care_profiles
  for all to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

create policy "Account owners manage their medical records" on public.medical_records
  for all to authenticated
  using (exists (select 1 from public.care_profiles cp where cp.id = care_profile_id and cp.account_id = (select auth.uid())))
  with check (exists (select 1 from public.care_profiles cp where cp.id = care_profile_id and cp.account_id = (select auth.uid())));

create policy "Account owners manage their medications" on public.medications
  for all to authenticated
  using (exists (select 1 from public.care_profiles cp where cp.id = care_profile_id and cp.account_id = (select auth.uid())))
  with check (exists (select 1 from public.care_profiles cp where cp.id = care_profile_id and cp.account_id = (select auth.uid())));

create policy "Account owners manage medication logs" on public.medication_logs
  for all to authenticated
  using (exists (
    select 1 from public.medications m join public.care_profiles cp on cp.id = m.care_profile_id
    where m.id = medication_id and cp.account_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.medications m join public.care_profiles cp on cp.id = m.care_profile_id
    where m.id = medication_id and cp.account_id = (select auth.uid())
  ));

create policy "Clinic staff manage their doctor directory" on public.clinic_doctors
  for all to authenticated
  using (exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())))
  with check (exists (select 1 from public.staff_members sm where sm.clinic_id = clinic_doctors.clinic_id and sm.user_id = (select auth.uid())));

create policy "Signed-in patients see listed doctors at active clinics" on public.clinic_doctors
  for select to authenticated
  using (listed and exists (select 1 from public.clinics c where c.id = clinic_doctors.clinic_id and c.active));

revoke all on public.care_profiles, public.medical_records, public.medications, public.medication_logs, public.clinic_doctors from anon;
grant select, insert, update, delete on public.care_profiles, public.medical_records, public.medications, public.medication_logs to authenticated;
grant select, insert, update, delete on public.clinic_doctors to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-records', 'health-records', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create policy "Account owners upload private health records" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'health-records' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Account owners read private health records" on storage.objects
  for select to authenticated
  using (bucket_id = 'health-records' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Account owners delete private health records" on storage.objects
  for delete to authenticated
  using (bucket_id = 'health-records' and (storage.foldername(name))[1] = (select auth.uid())::text);
