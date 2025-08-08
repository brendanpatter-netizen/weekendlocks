// scripts/build-cfb-ids.mjs
// Build lib/cfbIds.json from ESPN's college football (FBS) team list.
// Requires Node 18+ (global fetch). Run: node scripts/build-cfb-ids.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_PATH = resolve(__dirname, '../lib/cfbIds.json');
const DTS_PATH = resolve(__dirname, '../lib/cfbIds.json.d.ts');

// ESPN API endpoint for CFB teams (FBS group = 80). Supports paging.
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';
const FBS_GROUP = 80;

// Normalizer to generate extra alias keys in the JSON (optional)
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const stripDiacritics = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function fetchPage(page = 1, limit = 400) {
  const url = `${BASE}?groups=${FBS_GROUP}&limit=${limit}&page=${page}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    throw new Error(`ESPN fetch failed (${res.status}) for ${url}`);
  }
  return res.json();
}

async function getAllTeams() {
  // First page to learn total pageCount
  const first = await fetchPage(1);
  const leagues = first?.sports?.[0]?.leagues?.[0];
  const pageCount = leagues?.pageCount ?? 1;

  const pages = [first];
  for (let p = 2; p <= pageCount; p++) {
    pages.push(await fetchPage(p));
  }
  const teams = [];
  for (const data of pages) {
    const items = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    for (const item of items) {
      if (!item?.team) continue;
      teams.push(item.team);
    }
  }
  return teams;
}

function buildMap(teams) {
  // We’ll create a map with a few key variations to maximize matching.
  // Keys -> ESPN numeric id (string)
  const map = {};

  for (const t of teams) {
    const id = String(t.id);
    // These are safe keys to include in JSON (string -> string)
    const candidates = new Set([
      t.displayName,                   // "Boise State Broncos"
      t.shortDisplayName,              // "Boise State"
      t.name ? `${t.location} ${t.name}` : null, // "Boise State Broncos"
      t.name,                          // "Broncos"
      t.location,                      // "Boise State"
      // normalized/clean versions:
      stripDiacritics(t.displayName),
      stripDiacritics(t.shortDisplayName),
      stripDiacritics(t.name ? `${t.location} ${t.name}` : ''),
      stripDiacritics(t.name),
      stripDiacritics(t.location),
    ].filter(Boolean));

    // Also add normalized tokens as separate keys (best effort)
    for (const k of [...candidates]) {
      candidates.add(norm(k));
    }

    // Save candidates
    for (const key of candidates) {
      if (!key) continue;
      map[key] = id;
    }
  }

  // Handcrafted aliases for common API naming differences
  const aliases = {
    'Miami (FL) Hurricanes': '2390',
    'Miami Hurricanes': '2390',
    'Miami (OH) RedHawks': '195',
    'San Jose State Spartans': map['San José State Spartans'] ?? '23',
    'Hawaii Rainbow Warriors': map['Hawaiʻi Rainbow Warriors'] ?? '62',
    'Texas–San Antonio Roadrunners': map['UTSA Roadrunners'] ?? '2636',
  };
  for (const [k, v] of Object.entries(aliases)) {
    map[k] = v;
    map[norm(k)] = v;
    map[stripDiacritics(k)] = v;
  }

  return map;
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  console.log('Fetching ESPN FBS teams…');
  const teams = await getAllTeams();
  console.log(`Fetched ${teams.length} teams.`);

  const map = buildMap(teams);
  const sorted = sortObject(map);

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  await writeFile(
    DTS_PATH,
    `declare const ids: Record<string, string>;\nexport default ids;\n`,
    'utf8'
  );

  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
