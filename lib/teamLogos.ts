// lib/teamLogos.ts
/**
 * Map the full team name (as The Odds API returns it) to ESPN’s 3-letter logo code.
 * Add or edit any names that differ in casing or spelling from the API.
 */
const ABBR: Record<string, string> = {
  // NFC
  'Arizona Cardinals':       'ARI',
  'Atlanta Falcons':         'ATL',
  'Carolina Panthers':       'CAR',
  'Chicago Bears':           'CHI',
  'Dallas Cowboys':          'DAL',
  'Detroit Lions':           'DET',
  'Green Bay Packers':       'GB',
  'Los Angeles Rams':        'LAR',
  'Minnesota Vikings':       'MIN',
  'New Orleans Saints':      'NO',
  'New York Giants':         'NYG',
  'Philadelphia Eagles':     'PHI',
  'San Francisco 49ers':     'SF',
  'Seattle Seahawks':        'SEA',
  'Tampa Bay Buccaneers':    'TB',
  'Washington Commanders':   'WSH',

  // AFC
  'Baltimore Ravens':        'BAL',
  'Buffalo Bills':           'BUF',
  'Cincinnati Bengals':      'CIN',
  'Cleveland Browns':        'CLE',
  'Denver Broncos':          'DEN',
  'Houston Texans':          'HOU',
  'Indianapolis Colts':      'IND',
  'Jacksonville Jaguars':    'JAX',
  'Kansas City Chiefs':      'KC',
  'Las Vegas Raiders':       'LV',
  'Los Angeles Chargers':    'LAC',
  'Miami Dolphins':          'MIA',
  'New England Patriots':    'NE',
  'New York Jets':           'NYJ',
  'Pittsburgh Steelers':     'PIT',
  'Tennessee Titans':        'TEN',
};

/**
 * Returns a React-Native Image source object for the given team name, or undefined if not found.
 * Example: <Image source={logoSrc('Detroit Lions')} style={{ width: 40, height: 40 }} />
 */
export function logoSrc(teamName: string) {
  const abbr = ABBR[teamName];
  if (!abbr) return undefined;
  return {
    uri: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`,
  };
}
