// supabase/create-auth-users.js
// One-time script to create Supabase Auth accounts for all agents.
// Run: node supabase/create-auth-users.js
// Requires: npm install @supabase/supabase-js (run from dpg-leadgen folder)
// Uses SERVICE_ROLE key — never put this in any HTML file.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
const SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';

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
      console.error(`FAIL ${agent.name} (${agent.id}): ${error.message}`);
      continue;
    }

    const { error: linkErr } = await supabase
      .from('agents')
      .update({ auth_user_id: data.user.id, email })
      .eq('id', agent.id);

    if (linkErr) {
      console.error(`LINK FAIL ${agent.name}: ${linkErr.message}`);
    } else {
      console.log(`OK ${agent.name} | login: ${email} | pass: ${password}`);
    }
  }
  console.log('\nDone. Share credentials securely. Agents should change password on first login.');
}

main();
