# DPG Website → Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate DPG website from Google Sheets webhooks + client-side JS auth to Supabase (cloud database + real auth), rebuild Agent Portal with two-tab unassigned leads view, and prepare for Hostinger deployment.

**Architecture:** Static HTML site on Hostinger reads/writes to Supabase via the Supabase JS CDN client. All form submissions go to Supabase tables. Agent Portal authenticates against Supabase Auth and displays live lead data. Director (Jason) assigns leads in the portal; assigned leads auto-push to agent's CRM instance on assignment.

**Tech Stack:** Supabase JS v2 (CDN), Supabase Auth (email/password), PostgreSQL RLS policies, vanilla JS, Hostinger static hosting.

---

## ⚠️ Known Issues & Fixes (Read Before Building)

### Issue 1 — CRITICAL: `agents-data.js` exposes all credentials publicly
- **Problem:** `agents-data.js` is a public JS file loaded in the browser. It contains every agent's ID, full name, role, and the shared password `GE@DPG123`. Anyone can open DevTools → Sources and read it.
- **Fix:** Delete `agents-data.js` entirely. Move all agent data into Supabase `agents` table. Move auth to Supabase Auth (each agent gets their own email/password login). Remove all references to `DPG_PASSWORD`.

### Issue 2 — CRITICAL: Google Sheet CSV is publicly readable
- **Problem:** `agent-portal.html` fetches leads from a public Google Sheet CSV URL. Anyone with that URL can read all lead/client data — no auth required.
- **Fix:** Replace with Supabase queries protected by Row Level Security (RLS). Agents only see leads assigned to them. Director sees all unassigned leads.

### Issue 3: Leads stored in localStorage (client-side)
- **Problem:** `gap-calculator.html` saves leads to `localStorage` as a fallback. This data never reaches the server — it's stuck in that one browser. If the webhook failed, the lead is lost.
- **Fix:** Remove all `localStorage` lead storage. Supabase is the sole source of truth. Show a proper error if the Supabase INSERT fails.

### Issue 4: Shared password — no individual agent accountability
- **Problem:** All 15 agents use `GE@DPG123`. If one agent leaves or is removed, changing the password locks out everyone.
- **Fix:** Each agent gets their own Supabase Auth account with individual credentials. Initial password set to `DPG-{agentId}` (e.g. `DPG-1220688`). Jason can reset via Supabase dashboard.

### Issue 5: Powerbank page has no webhook connected
- **Problem:** `powerbank.html` has `YOUR_APPS_SCRIPT_URL_HERE` as a placeholder — form submissions go nowhere.
- **Fix:** Wire it up to Supabase in the same migration pass as all other tools.

### Issue 6: Supabase anon key will be visible in HTML source
- **Problem:** Static HTML can't hide environment variables. The Supabase anon key will be visible in page source.
- **Fix:** This is acceptable IF Row Level Security is correctly configured. The anon key + RLS means anonymous users can only INSERT (submit forms) — they cannot read any data. This is the standard Supabase pattern for public-facing forms.

### Issue 7: CORS must be configured for production domain
- **Problem:** Supabase blocks requests from unknown origins by default.
- **Fix:** In Supabase dashboard → Settings → API → add your Hostinger domain (e.g. `https://dreamplannersgroup.com.sg`) to allowed origins before going live.

### Issue 8: CRM bridge deferred
- **Problem:** Auto-pushing assigned leads to agent's CRM requires the CRM to be running on VPS with a known URL endpoint. CRM hasn't been migrated to VPS yet.
- **Fix:** Add a `crm_url` column to the `agents` table now (nullable). The push logic will be wired in a separate plan once the CRM VPS migration is done. For now, leads just get assigned in Supabase.

---

## Prerequisites (Jason must complete before any coding starts)

1. Create Supabase account at supabase.com → create project named `dpg-website`
2. From Supabase dashboard → Settings → API → copy:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **anon public key**
   - **service_role key** (keep secret — only used in the one-time migration script)
3. Purchase Hostinger plan + custom domain
4. Share with Evan: Supabase URL, anon key, service_role key, and final domain name

---

## File Structure

**New files:**
- `supabase/schema.sql` — all table definitions
- `supabase/rls-policies.sql` — Row Level Security policies
- `supabase/seed-agents.sql` — inserts agent rows into `agents` table
- `supabase/create-auth-users.js` — one-time script to create Supabase Auth accounts for all agents
- `config.js` — shared Supabase client init (one file, included by all pages)

**Modified files:**
- `agent-login.html` — swap client-side auth for Supabase Auth
- `agent-portal.html` — major rebuild: two-tab unassigned leads (Director), my leads (Agents)
- `gap-calculator.html` — replace WEBHOOK_URL with Supabase INSERT
- `health-check.html` — replace WEBHOOK_URL with Supabase INSERT
- `life-stage.html` — replace WEBHOOK_URL with Supabase INSERT
- `comparison.html` — replace WEBHOOK_URL with Supabase INSERT
- `cpf-guide.html` — replace WEBHOOK_URL with Supabase INSERT
- `tax-guide.html` — replace WEBHOOK_URL with Supabase INSERT
- `careers.html` — replace WEBHOOK_URL with Supabase INSERT
- `enneagram.html` — replace WEBHOOK_URL with Supabase INSERT
- `powerbank.html` — replace placeholder with Supabase INSERT

**Deleted files:**
- `agents-data.js` — replaced entirely by Supabase Auth + `agents` table

---

## Task 1: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write the schema file**

```sql
-- supabase/schema.sql
-- Run this in Supabase dashboard → SQL Editor

-- Agents table (mirrors Supabase Auth users for easy querying)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,                        -- GE agent code e.g. "1220688"
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Director', 'Manager', 'Agent')),
  email TEXT,
  crm_url TEXT,                               -- future: VPS CRM instance URL
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales/client leads from public tools
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL CHECK (tool IN (
    'gap_calculator', 'health_check', 'life_stage',
    'comparison', 'cpf_guide', 'tax_guide', 'powerbank'
  )),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  tool_data JSONB NOT NULL DEFAULT '{}',      -- stores all tool-specific inputs
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned')),
  assigned_to TEXT REFERENCES agents(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruitment leads from careers + enneagram
CREATE TABLE IF NOT EXISTS recruitment_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('careers', 'enneagram')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source_data JSONB NOT NULL DEFAULT '{}',    -- stores form-specific data
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned')),
  assigned_to TEXT REFERENCES agents(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_leads ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Run schema in Supabase**
  - Go to Supabase dashboard → SQL Editor → New query
  - Paste contents of `supabase/schema.sql`
  - Click Run
  - Expected: "Success. No rows returned" for all statements

---

## Task 2: Row Level Security Policies

**Files:**
- Create: `supabase/rls-policies.sql`

- [ ] **Step 1: Write the RLS policies file**

```sql
-- supabase/rls-policies.sql
-- Run this in Supabase dashboard → SQL Editor AFTER schema.sql

-- ── AGENTS TABLE ──
-- Anyone authenticated can read the agents list (needed for assignment dropdown)
CREATE POLICY "Authenticated can view agents"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

-- ── CLIENT LEADS ──
-- Anonymous users (public forms) can insert leads
CREATE POLICY "Public can submit client lead"
  ON client_leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Agents can see leads assigned to them only
CREATE POLICY "Agents see own client leads"
  ON client_leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = (
      SELECT id FROM agents WHERE auth_user_id = auth.uid()
    )
  );

-- Director can see ALL client leads
CREATE POLICY "Director sees all client leads"
  ON client_leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE auth_user_id = auth.uid()
      AND role = 'Director'
    )
  );

-- Director can assign leads (update status + assigned_to)
CREATE POLICY "Director can assign client leads"
  ON client_leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE auth_user_id = auth.uid()
      AND role = 'Director'
    )
  );

-- ── RECRUITMENT LEADS ──
-- Anonymous users (public forms) can insert
CREATE POLICY "Public can submit recruitment lead"
  ON recruitment_leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Agents see recruitment leads assigned to them
CREATE POLICY "Agents see own recruitment leads"
  ON recruitment_leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = (
      SELECT id FROM agents WHERE auth_user_id = auth.uid()
    )
  );

-- Director sees all recruitment leads
CREATE POLICY "Director sees all recruitment leads"
  ON recruitment_leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE auth_user_id = auth.uid()
      AND role = 'Director'
    )
  );

-- Director can assign recruitment leads
CREATE POLICY "Director can assign recruitment leads"
  ON recruitment_leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE auth_user_id = auth.uid()
      AND role = 'Director'
    )
  );
```

- [ ] **Step 2: Run RLS policies in Supabase**
  - SQL Editor → New query → paste `supabase/rls-policies.sql` → Run
  - Expected: "Success. No rows returned"

- [ ] **Step 3: Verify RLS is enabled**
  - Go to Supabase → Table Editor → click `client_leads`
  - Confirm "RLS enabled" badge is shown on the table
  - Repeat for `recruitment_leads` and `agents`

---

## Task 3: Seed Agents + Create Auth Users

**Files:**
- Create: `supabase/seed-agents.sql`
- Create: `supabase/create-auth-users.js`

- [ ] **Step 1: Write seed-agents.sql**

```sql
-- supabase/seed-agents.sql
-- Run AFTER auth users are created (Task 3, Step 4)
-- This links each agent row to their Supabase Auth user

-- Insert agent rows first (auth_user_id linked in Step 4)
INSERT INTO agents (id, name, role) VALUES
  ('1220688', 'Alvin Tang Wei Guan', 'Manager'),
  ('1286433', 'Foo Chun Xuan', 'Agent'),
  ('1248892', 'Wong Casey', 'Agent'),
  ('1243564', 'Chua Chin Chin Zwen', 'Agent'),
  ('1272173', 'Loh Eng Kiat Daniel', 'Agent'),
  ('1231795', 'Ng Kian Yong Samson', 'Manager'),
  ('1231370', 'Celine Teresa Foo', 'Agent'),
  ('1243696', 'Chen Siang Hui', 'Agent'),
  ('1281067', 'Huang Jianshun Richmond', 'Agent'),
  ('1220696', 'Teo Rui Ling Pauline', 'Agent'),
  ('1287511', 'Ng Tian Poh Marco', 'Agent'),
  ('1127688', 'Ong Wui Swoon', 'Agent'),
  ('1249341', 'Tan Guan Ming', 'Agent'),
  ('1269687', 'Tan Verne Lyankuang', 'Agent'),
  ('1220629', 'Jason Ng', 'Director')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Write create-auth-users.js**

```js
// supabase/create-auth-users.js
// Run once with: node supabase/create-auth-users.js
// Requires: npm install @supabase/supabase-js
// Uses the SERVICE_ROLE key (not anon key) — never put this in frontend HTML

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
const SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'; // keep secret

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const AGENTS = [
  { id: '1220688', name: 'Alvin Tang Wei Guan',       role: 'Manager'  },
  { id: '1286433', name: 'Foo Chun Xuan',              role: 'Agent'    },
  { id: '1248892', name: 'Wong Casey',                 role: 'Agent'    },
  { id: '1243564', name: 'Chua Chin Chin Zwen',        role: 'Agent'    },
  { id: '1272173', name: 'Loh Eng Kiat Daniel',        role: 'Agent'    },
  { id: '1231795', name: 'Ng Kian Yong Samson',        role: 'Manager'  },
  { id: '1231370', name: 'Celine Teresa Foo',          role: 'Agent'    },
  { id: '1243696', name: 'Chen Siang Hui',             role: 'Agent'    },
  { id: '1281067', name: 'Huang Jianshun Richmond',    role: 'Agent'    },
  { id: '1220696', name: 'Teo Rui Ling Pauline',       role: 'Agent'    },
  { id: '1287511', name: 'Ng Tian Poh Marco',          role: 'Agent'    },
  { id: '1127688', name: 'Ong Wui Swoon',              role: 'Agent'    },
  { id: '1249341', name: 'Tan Guan Ming',              role: 'Agent'    },
  { id: '1269687', name: 'Tan Verne Lyankuang',        role: 'Agent'    },
  { id: '1220629', name: 'Jason Ng',                   role: 'Director' },
];

async function main() {
  for (const agent of AGENTS) {
    const email = `${agent.id}@dpg.internal`;
    const password = `DPG-${agent.id}`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { agent_id: agent.id, name: agent.name, role: agent.role }
    });

    if (error) {
      console.error(`❌ ${agent.name} (${agent.id}): ${error.message}`);
      continue;
    }

    // Link auth user to agents table
    const { error: updateErr } = await supabase
      .from('agents')
      .update({ auth_user_id: data.user.id, email })
      .eq('id', agent.id);

    if (updateErr) {
      console.error(`❌ Link failed for ${agent.name}: ${updateErr.message}`);
    } else {
      console.log(`✅ ${agent.name} (${agent.id}) created. Login: ${email} / ${password}`);
    }
  }
  console.log('\nDone. Share individual passwords securely with each agent.');
  console.log('Remind agents to change their password on first login.');
}

main();
```

- [ ] **Step 3: Run seed-agents.sql**
  - Supabase → SQL Editor → paste `supabase/seed-agents.sql` → Run
  - Expected: 15 rows inserted into `agents`

- [ ] **Step 4: Run create-auth-users.js**
  - In terminal (on this Mac): `cd ~/dpg-leadgen && npm install @supabase/supabase-js`
  - Fill in `SUPABASE_URL` and `SERVICE_ROLE_KEY` in the script
  - Run: `node supabase/create-auth-users.js`
  - Expected: 15 lines of `✅ [Name] created`

- [ ] **Step 5: Verify in Supabase dashboard**
  - Go to Supabase → Authentication → Users
  - Confirm 15 users exist with emails like `1220688@dpg.internal`
  - Go to Table Editor → agents → confirm `auth_user_id` is populated for all rows

- [ ] **Step 6: Commit**
```bash
cd ~/dpg-leadgen
git add supabase/schema.sql supabase/rls-policies.sql supabase/seed-agents.sql supabase/create-auth-users.js
git commit -m "feat: add supabase schema, RLS policies, and agent seed data"
```

---

## Task 4: Shared Supabase Config File

**Files:**
- Create: `config.js`

- [ ] **Step 1: Create config.js**

```js
// config.js
// Supabase anon key is safe to expose in frontend — RLS protects all data reads.
// Anonymous users can only INSERT (submit forms). They cannot SELECT any data.

const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 2: Fill in the real values from your Supabase dashboard**
  - Supabase → Settings → API → Project URL → paste into `SUPABASE_URL`
  - Supabase → Settings → API → anon public key → paste into `SUPABASE_ANON_KEY`

- [ ] **Step 3: Add Supabase CDN + config.js to every HTML page that needs it**

Add these two lines to the `<head>` of: `gap-calculator.html`, `health-check.html`, `life-stage.html`, `comparison.html`, `cpf-guide.html`, `tax-guide.html`, `careers.html`, `enneagram.html`, `powerbank.html`, `agent-login.html`, `agent-portal.html`

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>
```

- [ ] **Step 4: Commit**
```bash
git add config.js
git commit -m "feat: add shared supabase config"
```

---

## Task 5: Migrate Form Pages — Client Leads (6 pages)

**Pages:** `gap-calculator.html`, `health-check.html`, `life-stage.html`, `comparison.html`, `cpf-guide.html`, `tax-guide.html`

All 6 follow the same pattern. Below is the full pattern using Gap Calculator as the reference. Apply identically to each page, adjusting `tool` value and `tool_data` fields.

**Files:**
- Modify: `gap-calculator.html`
- Modify: `health-check.html`
- Modify: `life-stage.html`
- Modify: `comparison.html`
- Modify: `cpf-guide.html`
- Modify: `tax-guide.html`

- [ ] **Step 1: In gap-calculator.html — delete the WEBHOOK_URL line (line ~513)**

Remove:
```js
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwOoNH9fH8dBiVYckE2_yAlHv0y6fl7GhwcqXSdLqPlaMMrlfOpxNFuRhWGI_51QhzV/exec';
```

- [ ] **Step 2: In gap-calculator.html — replace the webhook fetch block (~lines 752-757) with Supabase INSERT**

Remove:
```js
if (WEBHOOK_URL) {
  fetch(WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).catch(() => {});
}
```

Replace with:
```js
const { error: sbError } = await _supabase
  .from('client_leads')
  .insert({
    tool: 'gap_calculator',
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    tool_data: {
      age: payload.age,
      income: payload.income,
      marital: payload.marital,
      dependents: payload.dependents,
      expenses: payload.expenses,
      loans: payload.loans,
      existing_death: payload.existing_death,
      existing_ci: payload.existing_ci,
      has_hosp: payload.has_hosp,
      gap_score: payload.gap_score,
      death_gap: payload.death_gap,
      ci_gap: payload.ci_gap,
      total_gap: payload.total_gap
    }
  });

if (sbError) {
  console.error('Lead submission failed:', sbError.message);
  alert('Something went wrong. Please try again or contact us directly.');
  return;
}
```

- [ ] **Step 3: In gap-calculator.html — remove localStorage lead storage (~lines 747-749)**

Remove:
```js
const leads = JSON.parse(localStorage.getItem('dpg_gap_leads') || '[]');
leads.push(payload);
localStorage.setItem('dpg_gap_leads', JSON.stringify(leads));
```

- [ ] **Step 4: Make the submit function async**

Find the function that calls the webhook (likely `submitLead` or similar). Add `async` keyword:
```js
// Before:
function submitLead() {
// After:
async function submitLead() {
```

- [ ] **Step 5: Repeat Steps 1-4 for remaining 5 pages**

For each page, the `tool` value and `tool_data` fields are:

**health-check.html:**
```js
tool: 'health_check',
tool_data: { /* all health check question answers */ }
```

**life-stage.html:**
```js
tool: 'life_stage',
tool_data: { /* life stage selections */ }
```

**comparison.html:**
```js
tool: 'comparison',
tool_data: { /* plan comparison inputs */ }
```

**cpf-guide.html:**
```js
tool: 'cpf_guide',
tool_data: { /* CPF inputs */ }
```

**tax-guide.html:**
```js
tool: 'tax_guide',
tool_data: { /* tax inputs */ }
```

- [ ] **Step 6: Commit**
```bash
git add gap-calculator.html health-check.html life-stage.html comparison.html cpf-guide.html tax-guide.html
git commit -m "feat: migrate client lead forms from Google Sheets to Supabase"
```

---

## Task 6: Migrate Form Pages — Recruitment Leads (2 pages) + Powerbank

**Files:**
- Modify: `careers.html`
- Modify: `enneagram.html`
- Modify: `powerbank.html`

- [ ] **Step 1: In careers.html — delete WEBHOOK_URL line (~line 414)**

Remove:
```js
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbx0D9ptoRKFm0rW1d15qPJU_WR-DCH2eX3xkJivEgUv3QtZ9cIDvoHcwXthglHtfXjb/exec';
```

- [ ] **Step 2: In careers.html — replace webhook fetch with Supabase INSERT**

Remove the fetch block and replace with:
```js
const { error: sbError } = await _supabase
  .from('recruitment_leads')
  .insert({
    source: 'careers',
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    source_data: {
      age: formData.age,
      education: formData.education,
      current_job: formData.current_job,
      motivation: formData.motivation
      // include all careers form fields here
    }
  });

if (sbError) {
  console.error('Submission failed:', sbError.message);
  alert('Something went wrong. Please try again.');
  return;
}
```

- [ ] **Step 3: Make careers submit function async**

```js
async function submitCareers() {
```

- [ ] **Step 4: In enneagram.html — delete WEBHOOK_URL line (~line 971)**

Remove:
```js
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbx0D9ptoRKFm0rW1d15qPJU_WR-DCH2eX3xkJivEgUv3QtZ9cIDvoHcwXthglHtfXjb/exec';
```

- [ ] **Step 5: In enneagram.html — replace webhook fetch with Supabase INSERT**

```js
const { error: sbError } = await _supabase
  .from('recruitment_leads')
  .insert({
    source: 'enneagram',
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    source_data: {
      personality_type: formData.personalityType,
      type_name: formData.typeName,
      scores: formData.scores   // all enneagram type scores
    }
  });

if (sbError) {
  console.error('Submission failed:', sbError.message);
  alert('Something went wrong. Please try again.');
  return;
}
```

- [ ] **Step 6: In powerbank.html — replace placeholder with Supabase INSERT**

Remove:
```js
var WEBHOOK_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

Remove the `if (WEBHOOK_URL && WEBHOOK_URL !== 'YOUR_APPS_SCRIPT_URL_HERE')` block and replace with:
```js
const { error: sbError } = await _supabase
  .from('client_leads')
  .insert({
    tool: 'powerbank',
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    tool_data: {
      // include all powerbank redemption form fields here
    }
  });

if (sbError) {
  console.error('Submission failed:', sbError.message);
  alert('Something went wrong. Please try again.');
  return;
}
```

- [ ] **Step 7: Commit**
```bash
git add careers.html enneagram.html powerbank.html
git commit -m "feat: migrate recruitment leads and powerbank to Supabase"
```

---

## Task 7: Migrate Agent Login to Supabase Auth

**Files:**
- Modify: `agent-login.html`
- Delete: `agents-data.js` (after this task is complete)

- [ ] **Step 1: Add Supabase CDN + config.js to agent-login.html `<head>`**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>
```

- [ ] **Step 2: Replace the entire `<script>` block at the bottom of agent-login.html**

Remove everything from `<script src="agents-data.js">` to the closing `</script>` and replace with:

```html
<script>
  // Check if already logged in
  _supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = 'agent-portal.html';
  });

  async function handleLogin(e) {
    e.preventDefault();
    const agentId = document.getElementById('agentId').value.trim();
    const password = document.getElementById('password').value;
    const err = document.getElementById('loginError');
    err.classList.remove('visible');

    const email = `${agentId}@dpg.internal`;

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
      err.classList.add('visible');
      document.getElementById('password').value = '';
      return;
    }

    // Store agent_id from user metadata for easy access
    localStorage.setItem('dpg_agent_id', data.user.user_metadata.agent_id);
    window.location.href = 'agent-portal.html';
  }
</script>
```

- [ ] **Step 3: Remove `<script src="agents-data.js"></script>` from agent-login.html**

- [ ] **Step 4: Test login manually**
  - Open `agent-login.html` in browser
  - Try logging in with Agent ID `1220629` and password `DPG-1220629`
  - Expected: redirect to `agent-portal.html`
  - Try wrong password — expected: error message shown

- [ ] **Step 5: Delete agents-data.js**
```bash
rm ~/dpg-leadgen/agents-data.js
```

- [ ] **Step 6: Commit**
```bash
git add agent-login.html
git rm agents-data.js
git commit -m "feat: migrate agent login to Supabase Auth, remove agents-data.js"
```

---

## Task 8: Rebuild Agent Portal — Two-Tab Unassigned Leads (Director View)

**Files:**
- Modify: `agent-portal.html`

This is the largest task. The portal has two types of users:
- **Director (Jason, ID 1220629):** sees Unassigned Leads (Sales tab + Recruitment tab), can assign to agents
- **Agents:** see only My Leads (assigned to them)

- [ ] **Step 1: Replace auth check at top of agent-portal.html script block**

Find and remove the existing auth check:
```js
const session = JSON.parse(localStorage.getItem('dpg_agent') || 'null');
if (!session || !DPG_AGENTS[session.id]) {
    window.location.href = 'agent-login.html';
}
```

Replace with:
```js
let currentAgent = null;

async function initPortal() {
  const { data: { session }, error } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = 'agent-login.html';
    return;
  }

  const agentId = session.user.user_metadata.agent_id;

  // Fetch agent profile from agents table
  const { data: agent } = await _supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    window.location.href = 'agent-login.html';
    return;
  }

  currentAgent = agent;
  document.getElementById('agentName').textContent = agent.name;
  document.getElementById('agentRole').textContent = agent.role;
  document.getElementById('agentIdDisplay').textContent = 'ID: ' + agent.id;

  if (agent.role === 'Director') {
    showDirectorView();
  } else {
    showAgentView();
  }
}

initPortal();
```

- [ ] **Step 2: Add the Director unassigned leads HTML panel**

Find the existing `<!-- LEADS -->` panel in `agent-portal.html` and replace it with:

```html
<!-- DIRECTOR: UNASSIGNED LEADS -->
<div class="portal-panel" id="panel-leads-director" style="display:none;">
  <h2 class="portal-section-title">Unassigned Leads</h2>
  <p class="portal-section-sub">Assign leads to agents from here.</p>

  <div class="leads-tabs">
    <button class="leads-tab active" id="tab-sales" onclick="switchLeadTab('sales')">Sales Leads</button>
    <button class="leads-tab" id="tab-recruitment" onclick="switchLeadTab('recruitment')">Recruitment Leads</button>
  </div>

  <div id="leads-sales-panel">
    <div id="salesLeadsContent"><p>Loading...</p></div>
  </div>
  <div id="leads-recruitment-panel" style="display:none;">
    <div id="recruitmentLeadsContent"><p>Loading...</p></div>
  </div>
</div>

<!-- AGENT: MY LEADS -->
<div class="portal-panel" id="panel-leads-agent" style="display:none;">
  <h2 class="portal-section-title">My Leads</h2>
  <p class="portal-section-sub">Leads assigned to you by Jason.</p>
  <div id="myLeadsContent"><p>Loading...</p></div>
</div>
```

- [ ] **Step 3: Add Director view functions to script block**

```js
function switchLeadTab(tab) {
  document.getElementById('leads-sales-panel').style.display = tab === 'sales' ? '' : 'none';
  document.getElementById('leads-recruitment-panel').style.display = tab === 'recruitment' ? '' : 'none';
  document.getElementById('tab-sales').classList.toggle('active', tab === 'sales');
  document.getElementById('tab-recruitment').classList.toggle('active', tab === 'recruitment');
}

async function showDirectorView() {
  document.getElementById('panel-leads-director').style.display = '';
  document.getElementById('panel-leads-agent').style.display = 'none';
  await loadSalesLeads();
  await loadRecruitmentLeads();
}

async function loadSalesLeads() {
  const { data: leads, error } = await _supabase
    .from('client_leads')
    .select('*')
    .eq('status', 'unassigned')
    .order('created_at', { ascending: false });

  const { data: agents } = await _supabase
    .from('agents')
    .select('id, name')
    .eq('is_active', true)
    .neq('role', 'Director');

  if (error) {
    document.getElementById('salesLeadsContent').innerHTML = '<p>Error loading leads.</p>';
    return;
  }

  document.getElementById('salesLeadsContent').innerHTML = renderLeadsTable(leads, agents, 'client');
}

async function loadRecruitmentLeads() {
  const { data: leads, error } = await _supabase
    .from('recruitment_leads')
    .select('*')
    .eq('status', 'unassigned')
    .order('created_at', { ascending: false });

  const { data: agents } = await _supabase
    .from('agents')
    .select('id, name')
    .eq('is_active', true)
    .neq('role', 'Director');

  if (error) {
    document.getElementById('recruitmentLeadsContent').innerHTML = '<p>Error loading leads.</p>';
    return;
  }

  document.getElementById('recruitmentLeadsContent').innerHTML = renderLeadsTable(leads, agents, 'recruitment');
}

function renderLeadsTable(leads, agents, type) {
  if (!leads || leads.length === 0) {
    return '<div class="leads-empty"><h3>No unassigned leads</h3></div>';
  }

  const agentOptions = agents.map(a =>
    `<option value="${a.id}">${a.name}</option>`
  ).join('');

  const toolLabel = {
    gap_calculator: 'Gap Calculator',
    health_check: 'Health Check',
    life_stage: 'Life Stage',
    comparison: 'Comparison',
    cpf_guide: 'CPF Guide',
    tax_guide: 'Tax Guide',
    powerbank: 'Powerbank',
    careers: 'Careers',
    enneagram: 'Enneagram'
  };

  const rows = leads.map(lead => {
    const source = lead.tool || lead.source;
    const toolData = lead.tool_data || lead.source_data || {};
    const toolDataStr = Object.entries(toolData)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `<span class="tool-data-pill"><b>${k.replace(/_/g,' ')}:</b> ${v}</span>`)
      .join(' ');

    return `
      <tr>
        <td>${lead.name}</td>
        <td>${lead.phone || '—'}</td>
        <td>${lead.email || '—'}</td>
        <td><span class="tool-badge">${toolLabel[source] || source}</span><div class="tool-data-wrap">${toolDataStr}</div></td>
        <td>${new Date(lead.created_at).toLocaleDateString('en-SG')}</td>
        <td>
          <select class="assign-select" id="assign-${lead.id}">
            <option value="">Select agent...</option>
            ${agentOptions}
          </select>
          <button class="assign-btn" onclick="assignLead('${lead.id}','${type}')">Assign</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="leads-table-wrap">
      <table class="leads-table">
        <thead>
          <tr>
            <th>Name</th><th>Phone</th><th>Email</th>
            <th>Tool & Inputs</th><th>Date</th><th>Assign To</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function assignLead(leadId, type) {
  const agentId = document.getElementById('assign-' + leadId).value;
  if (!agentId) { alert('Please select an agent first.'); return; }

  const table = type === 'client' ? 'client_leads' : 'recruitment_leads';

  const { error } = await _supabase
    .from(table)
    .update({
      status: 'assigned',
      assigned_to: agentId,
      assigned_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) {
    alert('Assignment failed: ' + error.message);
    return;
  }

  // Remove the row from the table without full reload
  const row = document.getElementById('assign-' + leadId).closest('tr');
  row.remove();
}
```

- [ ] **Step 4: Add Agent view function**

```js
async function showAgentView() {
  document.getElementById('panel-leads-agent').style.display = '';
  document.getElementById('panel-leads-director').style.display = 'none';

  const { data: clientLeads } = await _supabase
    .from('client_leads')
    .select('*')
    .eq('assigned_to', currentAgent.id)
    .order('assigned_at', { ascending: false });

  const { data: recruitLeads } = await _supabase
    .from('recruitment_leads')
    .select('*')
    .eq('assigned_to', currentAgent.id)
    .order('assigned_at', { ascending: false });

  const allLeads = [...(clientLeads || []), ...(recruitLeads || [])];
  document.getElementById('leadsCount').textContent = allLeads.length;

  if (allLeads.length === 0) {
    document.getElementById('myLeadsContent').innerHTML = '<div class="leads-empty"><h3>No leads assigned yet</h3></div>';
    return;
  }

  const toolLabel = {
    gap_calculator: 'Gap Calculator', health_check: 'Health Check',
    life_stage: 'Life Stage', comparison: 'Comparison',
    cpf_guide: 'CPF Guide', tax_guide: 'Tax Guide',
    powerbank: 'Powerbank', careers: 'Careers', enneagram: 'Enneagram'
  };

  const rows = allLeads.map(lead => {
    const source = lead.tool || lead.source;
    return `<tr>
      <td>${lead.name}</td>
      <td>${lead.phone || '—'}</td>
      <td>${lead.email || '—'}</td>
      <td><span class="tool-badge">${toolLabel[source] || source}</span></td>
      <td>${new Date(lead.assigned_at || lead.created_at).toLocaleDateString('en-SG')}</td>
    </tr>`;
  }).join('');

  document.getElementById('myLeadsContent').innerHTML = `
    <div class="leads-table-wrap">
      <table class="leads-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Assigned</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
```

- [ ] **Step 5: Add logout handler**

Find the existing logout button/function and update it:
```js
async function logout() {
  await _supabase.auth.signOut();
  localStorage.removeItem('dpg_agent_id');
  window.location.href = 'agent-login.html';
}
```

- [ ] **Step 6: Remove `<script src="agents-data.js"></script>` from agent-portal.html**

- [ ] **Step 7: Add minimal CSS for new tab UI (inside `<style>` block in agent-portal.html)**

```css
.leads-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.leads-tab {
  padding: 10px 24px; border-radius: 40px; border: 1px solid rgba(255,255,255,0.15);
  background: transparent; color: rgba(255,255,255,0.6); cursor: pointer;
  font-family: 'DM Sans', sans-serif; font-size: 0.9rem; transition: all 0.2s;
}
.leads-tab.active {
  background: var(--gold); color: var(--white);
  border-color: var(--gold); font-weight: 600;
}
.tool-badge {
  display: inline-block; background: rgba(184,149,42,0.15);
  color: var(--gold); border-radius: 4px; padding: 2px 8px;
  font-size: 0.78rem; font-weight: 600; white-space: nowrap;
}
.tool-data-wrap { margin-top: 4px; }
.tool-data-pill {
  display: inline-block; background: rgba(255,255,255,0.06);
  border-radius: 4px; padding: 2px 6px; font-size: 0.72rem;
  color: rgba(255,255,255,0.6); margin: 2px 2px 0 0;
}
.assign-select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
  color: var(--white); border-radius: 6px; padding: 6px 10px;
  font-family: 'DM Sans', sans-serif; font-size: 0.85rem; width: 100%;
}
.assign-btn {
  margin-top: 6px; width: 100%; padding: 7px; background: var(--gold);
  color: var(--white); border: none; border-radius: 6px; cursor: pointer;
  font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 600;
}
.assign-btn:hover { opacity: 0.85; }
```

- [ ] **Step 8: Commit**
```bash
git add agent-portal.html
git commit -m "feat: rebuild agent portal with two-tab lead management and Supabase auth"
```

---

## Task 9: Hostinger Deployment

**Prerequisites:** Hostinger plan purchased, domain registered, DNS pointed to Hostinger.

- [ ] **Step 1: Add production domain to Supabase CORS**
  - Supabase dashboard → Settings → API → scroll to "Additional Allowed Origins"
  - Add: `https://your-domain.com.sg` (use your actual domain)
  - Also add: `https://www.your-domain.com.sg`
  - Save

- [ ] **Step 2: Upload site to Hostinger**
  - Log into Hostinger → hPanel → File Manager
  - Navigate to `public_html`
  - Upload all files from `~/dpg-leadgen/` (all HTML, CSS, JS, images, config.js)
  - Do NOT upload: `supabase/` folder (server-only scripts), `docs/` folder, `node_modules/`

- [ ] **Step 3: Verify config.js has correct Supabase URL and anon key**
  - Open `config.js` → confirm both values are filled in (not placeholder text)

- [ ] **Step 4: Test live site**
  - Visit `https://your-domain.com.sg`
  - Submit a test lead via Gap Calculator
  - Check Supabase → Table Editor → client_leads — confirm row appeared
  - Log into Agent Portal as Jason (ID: 1220629, password: DPG-1220629)
  - Confirm unassigned lead appears in Sales Leads tab
  - Assign to an agent → confirm row disappears from unassigned
  - Log in as that agent → confirm lead appears in My Leads

- [ ] **Step 5: Remove test lead from Supabase**
  - Supabase → Table Editor → client_leads → delete the test row

- [ ] **Step 6: Update Netlify redirect (optional)**
  - If keeping the Netlify URL alive temporarily, add a redirect in Netlify dashboard → Domain Settings to point to new Hostinger domain

---

## Self-Review Checklist

- [x] All 9 form pages migrated (gap calc, health check, life stage, comparison, cpf guide, tax guide, careers, enneagram, powerbank)
- [x] Powerbank page connected for first time (was placeholder)
- [x] agents-data.js deleted (security fix)
- [x] Shared password removed (each agent has own credentials)
- [x] localStorage lead storage removed (Supabase is source of truth)
- [x] RLS configured: anon INSERT only, agents see own leads, director sees all
- [x] Two-tab director view: Sales Leads + Recruitment Leads
- [x] Each lead shows which tool was used + all input data
- [x] Assignment flow: director assigns → lead disappears from unassigned → appears in agent's My Leads
- [x] Logout wired to Supabase signOut
- [x] CORS configured for production domain
- [x] CRM bridge: deferred (crm_url column added to agents table, bridge built in separate plan)
- [x] Roadshow: deferred (still in development, no changes needed)

---

## Deferred: CRM Bridge (Plan B)

Once the CRM is migrated to VPS with multi-tenancy, a follow-up plan will:
1. Each CRM instance registers its URL → stored in `agents.crm_url`
2. `assignLead()` function extended: after Supabase UPDATE, fires a POST to `agent.crm_url/api/leads` with client data
3. If agent has no `crm_url`, assignment still works — lead just stays in Supabase only
4. On CRM first activation → bulk sync endpoint pulls all `client_leads WHERE assigned_to = agentId`
