begin;

-- Team contact used by the portal to share API keys over WhatsApp.
-- projects is admin-only under RLS, so phones never reach anon or the MCP.
-- The audit trigger records only team_number/project_key/active, not contacts.
alter table public.projects
  add column contact_name text check (contact_name is null or char_length(btrim(contact_name)) between 1 and 80),
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9]{10,15}$');

comment on column public.projects.contact_phone is 'E.164 digits without +, as wa.me expects.';

-- Data is loaded out of band (supabase/private/project_contacts.sql, gitignored):
-- the repository is public and must not contain phone numbers.

commit;
