// scripts/seed-mock-members.mjs
// One-off: create 3 throwaway auth users and add them as members of a group,
// for testing the leaderboard/chat/dashboard with more than one person.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (server-only, never
// prefixed EXPO_PUBLIC_ — do not commit real values). Run:
//   node scripts/seed-mock-members.mjs <group_id>

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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const groupId = process.argv[2];
if (!groupId) {
  console.error('Usage: node scripts/seed-mock-members.mjs <group_id>');
  process.exit(1);
}

const authHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const MOCK_USERS = [
  { email: 'mock.member.1@weekendlocks.test', username: 'mock_member_1', display_name: 'Alex (Mock)' },
  { email: 'mock.member.2@weekendlocks.test', username: 'mock_member_2', display_name: 'Sam (Mock)' },
  { email: 'mock.member.3@weekendlocks.test', username: 'mock_member_3', display_name: 'Jordan (Mock)' },
];
const MOCK_PASSWORD = 'MockTest123!';

async function createAuthUser({ email }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password: MOCK_PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`create user ${email} failed (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

async function upsertProfile({ id, username, display_name }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ id, username, display_name }]),
  });
  if (!res.ok) throw new Error(`upsert profile ${id} failed (${res.status}): ${await res.text()}`);
}

async function addGroupMember({ group_id, user_id }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/group_members?on_conflict=group_id,user_id`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ group_id, user_id, role: 'member' }]),
  });
  if (!res.ok) throw new Error(`add member ${user_id} to ${group_id} failed (${res.status}): ${await res.text()}`);
}

async function main() {
  console.log(`Seeding 3 mock members into group ${groupId}...`);
  for (const u of MOCK_USERS) {
    const created = await createAuthUser(u);
    const userId = created.id;
    await upsertProfile({ id: userId, username: u.username, display_name: u.display_name });
    await addGroupMember({ group_id: groupId, user_id: userId });
    console.log(`  + ${u.display_name} (${u.email}) -> ${userId}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
