insert into public.projects (team_number, project_key, name) values
  (1, 'equipo-1-cinematch', 'Cinematch'),
  (2, 'equipo-2-zest', 'Zest'),
  (3, 'equipo-3-planify', 'Planify'),
  (4, 'equipo-4-pitstop', 'PitStop'),
  (5, 'equipo-5-watchparty', 'WatchParty'),
  (6, 'equipo-6-nutria', 'Nutria'),
  (7, 'equipo-7-study-arena', 'Study Arena'),
  (8, 'equipo-8-grade-m8', 'Grade-M8'),
  (9, 'equipo-9-zervi', 'Zervi'),
  (10, 'equipo-10-conexia', 'Conexia'),
  (11, 'equipo-11-sportmatch', 'Sportmatch'),
  (12, 'equipo-12-splitit', 'SplitIt'),
  (13, 'equipo-13-microchangas', 'MicroChangas'),
  (14, 'equipo-14-vaiven', 'VaiVen'),
  (15, 'equipo-15-futtracker', 'FutTracker'),
  (16, 'equipo-16-eureka', 'Eureka')
on conflict (team_number) do nothing;
