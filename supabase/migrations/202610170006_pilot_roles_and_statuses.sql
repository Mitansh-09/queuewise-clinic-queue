-- Extend the existing clinic roles and appointment states for a measured pilot.
alter type public.app_role add value if not exists 'admin';
alter type public.appointment_status add value if not exists 'arrived';
alter type public.appointment_status add value if not exists 'skipped';
