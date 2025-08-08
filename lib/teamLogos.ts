// lib/teamLogos.ts

type Sport = 'nfl' | 'ncaaf';
type TeamCode = string | number; // NCAA supports numeric ESPN IDs

const NORMALIZE = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/* ──────────────────────────────────────────────────────────
   NFL (all 32) — ESPN uses short lowercase codes in the path
   Example: https://a.espncdn.com/i/teamlogos/nfl/500/dal.png
   ────────────────────────────────────────────────────────── */
export const NFL_LOGOS: Record<string, string> = {
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
  // Washington has been a moving target over the years; ESPN uses 'wsh' now.
  'washington commanders': 'wsh',
  'washington football team': 'wsh',
};

/* ──────────────────────────────────────────────────────────
   NCAA (FBS) — ESPN typically uses numeric IDs:
   https://a.espncdn.com/i/teamlogos/ncaa/500/87.png  ← (Notre Dame example)
   BUT we’ll also accept string codes for convenience (temporary).
   Fill in as needed; when you know the numeric ID for a school,
   replace the string with the number — nothing else changes.
   ────────────────────────────────────────────────────────── */
export const CFB_LOGOS: Record<string, TeamCode> = {
  // Independents
  'notre dame fighting irish': 'ND', // replace with numeric when you have it (e.g. 87)
  'army black knights': 'ARMY',
  'navy midshipmen': 'NAVY',
  'umass minutemen': 'UMASS',
  'uconn huskies': 'UCONN',
  'notre dame': 'ND',
  'army': 'ARMY',
  'navy': 'NAVY',

  // AAC (sample set — add the rest as they show up)
  'south florida bulls': 'USF',
  'memphis tigers': 'MEM',
  'smu mustangs': 'SMU',
  'tulane green wave': 'TULANE',
  'uab blazers': 'UAB',
  'north texas mean green': 'UNT',
  'charlotte 49ers': 'CHAR',
  'florida atlantic owls': 'FAU',
  'east carolina pirates': 'ECU',
  'rice owls': 'RICE',
  'temple owls': 'TEM',
  'tulsa golden hurricane': 'TULSA',
  'utsa roadrunners': 'UTSA',

  // ACC (sample set)
  'florida state seminoles': 'FSU',
  'clemson tigers': 'CLEM',
  'miami hurricanes': 'MIA',
  'north carolina tar heels': 'UNC',
  'duke blue devils': 'DUKE',
  'nc state wolfpack': 'NCST',
  'virginia cavaliers': 'UVA',
  'virginia tech hokies': 'VT',
  'louisville cardinals': 'LOU',
  'georgia tech yellow jackets': 'GT',
  'syracuse orange': 'CUSE',
  'boston college eagles': 'BC',
  'pittsburgh panthers': 'PITT',
  'wake forest demon deacons': 'WAKE',

  // Big Ten (sample set)
  'ohio state buckeyes': 'OSU',
  'michigan wolverines': 'MICH',
  'penn state nittany lions': 'PSU',
  'michigan state spartans': 'MSU',
  'wisconsin badgers': 'WISC',
  'iowa hawkeyes': 'IOWA',
  'illinois fighting illini': 'ILL',
  'minnesota golden gophers': 'MINN',
  'nebraska cornhuskers': 'NEB',
  'northwestern wildcats': 'NU',
  'indiana hoosiers': 'IND',
  'purdue boilermakers': 'PUR',
  'rutgers scarlet knights': 'RUTG',
  'maryland terrapins': 'MD',

  // Big 12 (sample set)
  'oklahoma sooners': 'OU',
  'texas longhorns': 'TEX',
  'oklahoma state cowboys': 'OKST',
  'kansas state wildcats': 'KSU',
  'kansas jayhawks': 'KU',
  'baylor bears': 'BU',
  'texas tech red raiders': 'TTU',
  'tcu horned frogs': 'TCU',
  'west virginia mountaineers': 'WVU',
  'iowa state cyclones': 'ISU',
  'byu cougars': 'BYU',
  'utah utes': 'UTAH',
  'colorado buffaloes': 'COLO',
  'arizona wildcats': 'ARIZ',
  'arizona state sun devils': 'ASU',
  'ucf knights': 'UCF',
  'cincinnati bearcats': 'CIN',
  'houston cougars': 'HOU',

  // SEC (sample set)
  'alabama crimson tide': 'ALA',
  'georgia bulldogs': 'UGA',
  'lsu tigers': 'LSU',
  'texas a&m aggies': 'TAMU',
  'auburn tigers': 'AUB',
  'florida gators': 'UF',
  'tennessee volunteers': 'TENN',
  'mississippi state bulldogs': 'MSST',
  'ole miss rebels': 'MISS',
  'kentucky wildcats': 'UK',
  'south carolina gamecocks': 'SC',
  'arkansas razorbacks': 'ARK',
  'missouri tigers': 'MIZZ',
  'vanderbilt commodores': 'VANDY',
  'oklahoma sooners (sec)': 'OU',
  'texas longhorns (sec)': 'TEX',

  // Pac-12 / MWC / others (sample set)
  'usc trojans': 'USC',
  'ucla bruins': 'UCLA',
  'oregon ducks': 'ORE',
  'washington huskies': 'UW',
  'washington state cougars': 'WSU',
  'oregon state beavers': 'ORST',
  'colorado state rams': 'CSU',
  'boise state broncos': 'BOISE',
  'fresno state bulldogs': 'FRES',
  'san diego state aztecs': 'SDSU',
  'san jose state spartans': 'SJSU',
  'hawaii rainbow warriors': 'HAW',
  'air force falcons': 'AF',
  'utah state aggies': 'USU',
  'wyoming cowboys': 'WYO',
  'nevada wolf pack': 'NEV',
  'unlv rebels': 'UNLV',
  'new mexico lobos': 'UNM',

  // Sun Belt (sample set)
  'appalachian state mountaineers': 'APP',
  'james madison dukes': 'JMU',
  'coastal carolina chanticleers': 'CCU',
  'marshall thundering herd': 'MRSH',
  'georgia southern eagles': 'GASO',
  'georgia state panthers': 'GAST',
  'south alabama jaguars': 'USA',
  'troy trojans': 'TROY',
  'texas state bobcats': 'TXST',
  'ul lafayette ragin cajuns': 'ULL',
  'ul monroe warhawks': 'ULM',
  'arkansas state red wolves': 'ARST',
  'old dominion monarchs': 'ODU',

  // MAC (sample set)
  'toledo rockets': 'TOL',
  'ohio bobcats': 'OHIO',
  'miami (oh) redhawks': 'M-OH',
  'akron zips': 'AKRON',
  'kent state golden flashes': 'KENT',
  'bowling green falcons': 'BGSU',
  'buffalo bulls': 'BUFF',
  'ball state cardinals': 'BALL',
  'central michigan chippewas': 'CMU',
  'eastern michigan eagles': 'EMU',
  'western michigan broncos': 'WMU',
  'northern illinois huskies': 'NIU',

  // C-USA (sample set)
  'liberty flames': 'LIB',
  'jacksonville state gamecocks': 'JSU',
  'new mexico state aggies': 'NMSU',
  'sam houston bearkats': 'SHSU',
  'louisiana tech bulldogs': 'LT',
  'middle tennessee blue raiders': 'MTSU',
  'western kentucky hilltoppers': 'WKU',
  'uta road runners': 'UTSA', // keep if UTSA shows up in your feed for C-USA seasons
  'utep miners': 'UTEP',
  'fiu panthers': 'FIU',

  // Aliases / tricky names
 
};

/* Optional aliases for name quirks you see in your feed */
const CFB_ALIASES: Record<string, string> = {
  'miami redhawks': 'miami (oh) redhawks',
  'miami (ohio) redhawks': 'miami (oh) redhawks',
  'hawaii': 'hawaii rainbow warriors',
  'hawaiʻi': 'hawaiʻi rainbow warriors',
  'ul lafayette': 'ul lafayette ragin cajuns',
  'louisiana-lafayette ragin cajuns': 'ul lafayette ragin cajuns',
  'louisiana lafayette ragin cajuns': 'ul lafayette ragin cajuns',
  'ul monroe': 'ul monroe warhawks',
};

/* ──────────────────────────────────────────────────────────
   Public helper
   ────────────────────────────────────────────────────────── */
export function logoSrc(teamName: string, sport: Sport = 'nfl') {
  const key = NORMALIZE(teamName);
  if (sport === 'nfl') {
    const code = NFL_LOGOS[key];
    if (!code) {
      console.warn(`[logos] NFL team not mapped: "${teamName}"`);
      return { uri: 'about:blank' };
    }
    return { uri: `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png` };
  }

  // NCAA
  const normalized =
    CFB_LOGOS[key] ??
    CFB_LOGOS[NORMALIZE(CFB_ALIASES[key] ?? '')] ??
    null;

  if (!normalized) {
    console.warn(`[logos] NCAA team not mapped: "${teamName}"`);
    return { uri: 'about:blank' };
  }

  const path =
    typeof normalized === 'number'
      ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${normalized}.png`
      : `https://a.espncdn.com/i/teamlogos/ncaa/500/${normalized}.png`;

  return { uri: path };
}
