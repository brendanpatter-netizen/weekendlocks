// lib/teamLogos.ts
// Logo resolver for NFL + NCAA (FBS).
// Requires: lib/cfbIds.json (generated) and tsconfig with "resolveJsonModule": true.

import type { ImageSourcePropType } from 'react-native';
import cfbRaw from './cfbIds.json';

export type Sport = 'nfl' | 'ncaaf';
type StringMap = Record<string, string>;

/* ──────────────────────────────────────────────────────────
   Normalizers
   ────────────────────────────────────────────────────────── */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents (e.g., Hawaiʻi → hawaii)
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
}
function skinnyKey(s: string): string {
  return normalizeName(s).replace(/[^a-z0-9]/g, '');
}

/* ──────────────────────────────────────────────────────────
   NFL (all 32) — ESPN uses 2–3 letter codes in the CDN path
   e.g. https://a.espncdn.com/i/teamlogos/nfl/500/dal.png
   Keys are normalized, e.g. "arizona cardinals"
   ────────────────────────────────────────────────────────── */
export const NFL_LOGOS: StringMap = {
  'arizona cardinals': 'ari',
  'atlanta falcons': 'atl',
  'baltimore ravens': 'bal',
  'buffalo bills': 'buf',
  'carolina panthers': 'car',
  'chicago bears': 'chi',
  'cincinnati bengals': 'cin',
  'cleveland browns': 'cle',
  'dallas cowboys': 'dal',
  'denver broncos': 'den',
  'detroit lions': 'det',
  'green bay packers': 'gb',
  'houston texans': 'hou',
  'indianapolis colts': 'ind',
  'jacksonville jaguars': 'jax',
  'kansas city chiefs': 'kc',
  'las vegas raiders': 'lv',
  'los angeles chargers': 'lac',
  'los angeles rams': 'lar',
  'miami dolphins': 'mia',
  'minnesota vikings': 'min',
  'new england patriots': 'ne',
  'new orleans saints': 'no',
  'new york giants': 'nyg',
  'new york jets': 'nyj',
  'philadelphia eagles': 'phi',
  'pittsburgh steelers': 'pit',
  'san francisco 49ers': 'sf',
  'seattle seahawks': 'sea',
  'tampa bay buccaneers': 'tb',
  'tennessee titans': 'ten',
  'washington commanders': 'wsh',
  'washington football team': 'wsh',
};

/* ──────────────────────────────────────────────────────────
   NCAA (FBS) — ESPN uses numeric team IDs in the CDN path
   e.g. https://a.espncdn.com/i/teamlogos/ncaa/500/68.png
   We import a big JSON map, then expand with normalized keys
   and a few hand-crafted aliases.
   ────────────────────────────────────────────────────────── */

// Hand-crafted aliases where Odds API / ESPN names differ
const NCAA_ALIAS_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['Miami (FL) Hurricanes', '2390'],
  ['Miami Hurricanes', '2390'],
  ['Miami (OH) RedHawks', '195'],
  ['UTSA Roadrunners', '2636'],
  ['Texas–San Antonio Roadrunners', '2636'],
  ['UAB Blazers', '5'],
  ['Appalachian State Mountaineers', '2026'],
  ['Boise State Broncos', '68'],
  ['BYU Cougars', '252'],
  ['San José State Spartans', '23'],
  ['San Jose State Spartans', '23'],
  ['Hawaiʻi Rainbow Warriors', '62'],
  ['Hawaii Rainbow Warriors', '62'],
];

const NCAA_ALIASES: StringMap = Object.fromEntries(NCAA_ALIAS_ENTRIES);

/** Expand the imported JSON to include multiple key variants. */
function expandCfbMap(base: Record<string, string | number>): StringMap {
  const out: StringMap = {};
  for (const [name, idAny] of Object.entries(base)) {
    const id = String(idAny);
    const k1 = name;
    const k2 = normalizeName(name);
    const k3 = skinnyKey(name);
    out[k1] = id;
    out[k2] = id;
    out[k3] = id;

    // Also fix common punctuation variants
    const simple = name
      .replace(/St\./g, 'State')
      .replace(/[’']/g, '')
      .replace(/–/g, '-');
    const simpleNorm = normalizeName(simple);
    const simpleSkinny = skinnyKey(simple);
    out[simple] ??= id;
    out[simpleNorm] ??= id;
    out[simpleSkinny] ??= id;
  }

  // Merge manual aliases last (last write wins)
  for (const [k, id] of Object.entries(NCAA_ALIASES)) {
    out[k] = id;
    out[normalizeName(k)] = id;
    out[skinnyKey(k)] = id;
  }
  return out;
}

export const CFB_LOGOS: StringMap = expandCfbMap(
  cfbRaw as Record<string, string | number>
);

/* ──────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────── */
export function logoUri(teamName: string, sport: Sport = 'nfl'): string {
  if (sport === 'ncaaf') {
    const id =
      CFB_LOGOS[teamName] ??
      CFB_LOGOS[normalizeName(teamName)] ??
      CFB_LOGOS[skinnyKey(teamName)];

    if (!id) {
      console.warn(`[logos] NCAA team not mapped: "${teamName}"`);
      return 'about:blank';
    }
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
  }

  // NFL
  const key = normalizeName(teamName);
  const code = NFL_LOGOS[key];
  if (!code) {
    console.warn(`[logos] NFL team not mapped: "${teamName}"`);
    return 'about:blank';
  }
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`;
}

export function logoSrc(teamName: string, sport: Sport = 'nfl'): ImageSourcePropType {
  return { uri: logoUri(teamName, sport) };
}
