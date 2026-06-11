-- supabase/rls-policies.sql
-- Run AFTER schema.sql

-- ── AGENTS ──
CREATE POLICY "Authenticated can view agents"
  ON agents FOR SELECT TO authenticated USING (true);

-- ── CLIENT LEADS ──
CREATE POLICY "Public can submit client lead"
  ON client_leads FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Agents see own client leads"
  ON client_leads FOR SELECT TO authenticated
  USING (
    assigned_to = (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Director sees all client leads"
  ON client_leads FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE auth_user_id = auth.uid() AND role = 'Director')
  );

CREATE POLICY "Director can assign client leads"
  ON client_leads FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE auth_user_id = auth.uid() AND role = 'Director')
  );

-- ── RECRUITMENT LEADS ──
CREATE POLICY "Public can submit recruitment lead"
  ON recruitment_leads FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Agents see own recruitment leads"
  ON recruitment_leads FOR SELECT TO authenticated
  USING (
    assigned_to = (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Director sees all recruitment leads"
  ON recruitment_leads FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE auth_user_id = auth.uid() AND role = 'Director')
  );

CREATE POLICY "Director can assign recruitment leads"
  ON recruitment_leads FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE auth_user_id = auth.uid() AND role = 'Director')
  );
