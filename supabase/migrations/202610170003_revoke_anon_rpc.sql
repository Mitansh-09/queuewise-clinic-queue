-- Supabase default grants can give exposed-schema functions an explicit anon ACL.
revoke all on function public.book_queue_token(uuid, uuid, text, text) from anon;
revoke all on function public.advance_queue(uuid, uuid) from anon;
revoke all on function public.set_queue_status(uuid, public.appointment_status) from anon;
revoke all on function public.get_patient_queue_status(uuid) from anon;
revoke all on function public.create_clinic_schedule(uuid, text, date, time, time, integer, integer) from anon;
revoke all on function public.set_token_acceptance(uuid, boolean) from anon;
