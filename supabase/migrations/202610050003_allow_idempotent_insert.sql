begin;

-- PostgreSQL requires SELECT privilege on the conflict target for
-- INSERT ... ON CONFLICT DO NOTHING. RLS still exposes no measurement rows
-- to anon because there is deliberately no anon SELECT policy.
grant select on public.measurement to anon;

commit;
