-- supabase/seed-agents.sql
-- Run AFTER create-auth-users.js (auth_user_id gets linked by the script)

INSERT INTO agents (id, name, role) VALUES
  ('1220688', 'Alvin Tang Wei Guan',       'Manager'),
  ('1286433', 'Foo Chun Xuan',              'Agent'),
  ('1248892', 'Wong Casey',                 'Agent'),
  ('1243564', 'Chua Chin Chin Zwen',        'Agent'),
  ('1272173', 'Loh Eng Kiat Daniel',        'Agent'),
  ('1231795', 'Ng Kian Yong Samson',        'Manager'),
  ('1231370', 'Celine Teresa Foo',          'Agent'),
  ('1243696', 'Chen Siang Hui',             'Agent'),
  ('1281067', 'Huang Jianshun Richmond',    'Agent'),
  ('1220696', 'Teo Rui Ling Pauline',       'Agent'),
  ('1287511', 'Ng Tian Poh Marco',          'Agent'),
  ('1127688', 'Ong Wui Swoon',              'Agent'),
  ('1249341', 'Tan Guan Ming',              'Agent'),
  ('1269687', 'Tan Verne Lyankuang',        'Agent'),
  ('1220629', 'Jason Ng',                   'Director')
ON CONFLICT (id) DO NOTHING;
