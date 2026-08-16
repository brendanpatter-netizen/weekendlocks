// scripts/toggle-mock-member.mjs
// One-off: add/remove the existing mock.member.1 auth user as a member of a
// group, for spot-checking real-data rendering without creating new users.
// Run:
//   node scripts/toggle-mock-member.mjs add <group_id>
//   node scripts/toggle-mock-member.mjs remove <group_id>

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = resolve(__dirname, '../.env.local');
  const lines = readFileSync(path, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const action = process.argv[2];
const groupId = process.argv[3];
if (!SUPABASE_URL || !SERVICE_KEY || !['add', 'remove'].includes(action) || !groupId) {
  console.error('Usage: node scripts/toggle-mock-member.mjs <add|remove> <group_id>');
  process.exit(1);
}

const MOCK_USER_ID = '28a3e5ec-e46f-43c4-a60d-3075eacc0729';

const authHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  if (action === 'add') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_members?on_conflict=group_id,user_id`, {
      method: 'POST',
      headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ group_id: groupId, user_id: MOCK_USER_ID, role: 'member' }]),
    });
    if (!res.ok) throw new Error(`add failed (${res.status}): ${await res.text()}`);
    console.log(`Added mock.member.1 to group ${groupId}`);
  } else {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/group_members?group_id=eq.${groupId}&user_id=eq.${MOCK_USER_ID}`,
      { method: 'DELETE', headers: authHeaders }
    );
    if (!res.ok) throw new Error(`remove failed (${res.status}): ${await res.text()}`);
    console.log(`Removed mock.member.1 from group ${groupId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
