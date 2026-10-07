begin;

-- Team contact used by the portal to share API keys over WhatsApp.
-- projects is admin-only under RLS, so phones never reach anon or the MCP.
-- The audit trigger records only team_number/project_key/active, not contacts.
alter table public.projects
  add column contact_name text check (contact_name is null or char_length(btrim(contact_name)) between 1 and 80),
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9]{10,15}$');

comment on column public.projects.contact_phone is 'E.164 digits without +, as wa.me expects.';

update public.projects p
set contact_name = c.contact_name, contact_phone = c.contact_phone
from (values
  (1, 'Tobias Grati', '5491140249957'),
  (2, 'Maria Clara Lopez', '5491154561135'),
  (3, 'Julieta Iglesias', '5491123632203'),
  (4, 'Manuel Lostaló', '5491133837591'),
  (5, 'Manuel Salas Seeber', '5491122602402'),
  (6, 'Camila Catalini', '5491121714128'),
  (7, 'Julieta Garberoglio', '5491138785508'),
  (8, 'Hilario Lagos', '5491149359444'),
  (9, 'Agustín', '5491168013604'),
  (10, 'Pedro Ramirez Neira', '5491141476274'),
  (11, 'Ignacio Chevallier Boutell', '5491123474306'),
  (12, 'Francisco Manfredi', '5492235210404'),
  (13, 'Mirko Vrancic', '5491138565512'),
  (14, 'Anapaola Borda', '5491144772102'),
  (15, 'Felipe Germano', '5491163358812'),
  (16, 'Carla Boggio', '5493487472923')
) as c(team_number, contact_name, contact_phone)
where p.team_number = c.team_number;

commit;
