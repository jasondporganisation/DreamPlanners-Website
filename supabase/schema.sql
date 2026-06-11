-- supabase/schema.sql
-- Run this in Supabase dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Director', 'Manager', 'Agent')),
  email TEXT,
  crm_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL CHECK (tool IN (
    'gap_calculator', 'health_check', 'life_stage',
    'comparison', 'cpf_guide', 'tax_guide'
  )),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  tool_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned')),
  assigned_to TEXT REFERENCES agents(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruitment_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('careers', 'enneagram')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned')),
  assigned_to TEXT REFERENCES agents(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_leads ENABLE ROW LEVEL SECURITY;
