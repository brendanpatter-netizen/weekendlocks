export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable, Image, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { events } from "@/lib/events";
import { useOdds } from "@/lib/useOdds";
import { logoSrc } from "@/lib/teamLogos";

// ---------- config ----------
type BetType = "spreads" | "totals" | "h2h";
const NFL_SPORT_KEY = "americanfootball_nfl";
const SEASON = 2025;

// If you have a util for current week, import that. Fallback to 1.
function getCurrentWeek() {
  return 1;
}

// ---------- team normalization ----------
const NFL_ALIASES: Record<string, string> = {
  "dallas": "cowboys", "cowboys": "cowboys",
  "philadelphia": "eagles", "eagles": "eagles",
  "san francisco": "49ers", "niners": "49ers", "49ers": "49ers",
  "new york": "giants", "giants": "giants", "jets": "jets",
  "kansas": "chiefs", "kansas city": "chiefs", "chiefs": "chiefs",
  "green bay": "packers", "packers": "packers",
  "new england": "patriots", "patriots": "patriots",
  "pittsburgh": "steelers", "steelers": "steelers",
  "cleveland": "browns", "browns": "browns",
  "los angeles": "rams", "rams": "rams", "chargers": "chargers",
  "seattle": "seahawks", "seahawks": "seahawks",
  "buffalo": "bills", "bills": "bills",
  "miami": "dolphins", "dolphins": "dolphins",
  "baltimore": "ravens", "ravens": "ravens",
  "houston": "texans", "texans": "texans",
  "jacksonville": "jaguars", "jaguars": "jaguars",
  "detroit": "lions", "lions": "lions",
  "minnesota": "vikings", "vikings": "vikings",
  "atlanta": "falcons", "falcons": "falcons",
  "new orleans": "saints", "saints": "saints",
  "tampa bay": "buccaneers", "buccaneers": "buccaneers",
  "chicago": "bears", "bears": "bears",
  "indianapolis": "colts", "colts": "colts",
  "tennessee": "titans", "titans": "titans",
  "cincinnati": "bengals", "bengals": "bengals",
  "carolina": "panthers", "panthers": "panthers",
  "washington": "commanders", "commanders": "commanders",
  "las vegas": "raiders", "raiders": "raiders",
  "denver": "broncos", "broncos": "broncos",
  "arizona": "cardinals", "cardinals": "cardinals",
};
function normTeamNFL(name: string) {
  const raw = name.toLowerCase().replace(/[^\w\s-]/g, "").trim();
  if (NFL_ALIASES[raw]) return NFL_ALIASES[raw];
  const parts = raw.split(/\s+/);
  const last = parts[parts.length - 1];
  return NFL_ALIASES[last] || last;
}

// ---------- small UI helper ----------
function Tab({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.tab, active && styles.tabActive, disabled && styles.tabDisabled]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- component ----------
export default function PicksNFL() {
  const [week, setWeek] = useState<number>(getCurrentWeek());
  const [betType, setBetType] = useState<BetType>("spreads");

  const [userId, setUserId] = useState<string | null>(null);
  const [weekRow, setWeekRow] = useState<any>(null);
  const [gameMap, setGameMap] = useState<Record<string, number>>({});
  const [myPicks, setMyPicks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // odds
  const { data, error, loading } = useOdds(NFL_SPORT_KEY, week);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Pull weeks/games and build a mapping; also pre-load existing picks
  useEffect(() => {
    (async () => {
      setNotice(null);

      const { data: w, error: wErr } = await supabase
        .from("weeks").select("*")
        .eq("league", "nfl").eq("season", SEASON).eq("week_num", week)
        .maybeSingle();

      if (wErr) setNotice(`weeks: ${wErr.message}`);
      setWeekRow(w);

      if (w?.id) {
        const { data: g, error: gErr } = await supabase
          .from("games").select("id, home, away, week_id").eq("week_id", w.id);

        if (gErr) setNotice(`games: ${gErr.message}`);

        const map: Record<string, number> = {};
        (g ?? []).forEach((row: any) => {
          map[`${normTeamNFL(row.away)}@${normTeamNFL(row.home)}`] = row.id;
        });
        setGameMap(map);

        const ids = (g ?? []).map((r: any) => r.id);
        if (ids.length) {
          const { data: ps, error: pErr } = await supabase
            .from("picks").select("game_id, pick_team").in("game_id", ids);
          if (pErr) setNotice(`picks: ${pErr.message}`);
          const mine: Record<number, string> = {};
          (ps ?? []).forEach((r: any) => { mine[r.game_id] = r.pick_team; });
          setMyPicks(mine);
        } else {
          setMyPicks({});
        }
      } else {
        setGameMap({});
        setMyPicks({});
      }
    })();
  }, [week]);

  const isOpen = useMemo(() => {
    if (!weekRow) return false;
    const now = Date.now();
    return now >= Date.parse(weekRow.opens_at) && now < Date.parse(weekRow.closes_at);
  }, [weekRow]);

  const openLabel = useMemo(() => {
    if (!weekRow) return "";
    const closes = new Date(weekRow.closes_at);
    return isOpen ? `OPEN – closes ${closes.toLocaleString()}` : `CLOSED – closed ${closes.toLocaleString()}`;
  }, [isOpen, weekRow]);

  // Availability for tabs (enable/disable)
  const marketHas = useMemo(() => {
    const has = { spreads: false, totals: false, h2h: false };
    for (const g of (data ?? [])) {
      const keys = g.bookmakers?.[0]?.markets?.map((m: any) => m.key) ?? [];
      if (keys.includes("spreads")) has.spreads = true;
      if (keys.includes("totals")) has.totals = true;
      if (keys.includes("h2h")) has.h2h = true;
    }
    return has;
  }, [data]);

  const labelFor = (type: BetType, o: any) =>
    type === "spreads" ? `${o.name} ${o.point}` :
    type === "h2h"     ? `${o.name} ML` :
                         `${o.name} ${o.point}`;

  const savePick = async (oddsGame: any, type: BetType, o: any) => {
    if (!userId) { Alert.alert("Sign in required", "Please sign in to save picks."); return; }
    if (!isOpen)  { Alert.alert("Picks closed", openLabel); return; }

    const key = `${normTeamNFL(oddsGame.away_team)}@${normTeamNFL(oddsGame.home_team)}`;
    const mappedId = gameMap[key];

    if (!mappedId) {
      Alert.alert(
        "Can’t match game",
        `The odds game couldn't be matched to your internal 'games' row.\n\nLookup key used:\n${key}\n\nCheck 'games' (away/home) and 'weeks' linkage.`
      );
      return;
    }

    const label = labelFor(type, o);

    setSaving(mappedId);
    try {
      const payload = {
        user_id: userId,
        game_id: mappedId,
        pick_team: label,
        pick_market: type,
        pick_side: String(o.name),
        pick_line: o.point != null ? Number(o.point) : null,
        pick_price: typeof o.price === "number" ? o.price : null,
        sport: "nfl",
        week,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const { error: upErr } = await supabase
        .from("picks")
        .upsert(payload, { onConflict: "user_id,game_id,pick_market" });

      if (upErr) {
        Alert.alert("Save failed", upErr.message);
        return;
      }

      setMyPicks((m) => ({ ...m, [mappedId]: label }));

      events.emitPickSaved({ league: "nfl", week, game_id: mappedId, user_id: userId!, pick_team: label });

      Alert.alert("Saved", `Your pick: ${label}`);
    } catch (e: any) {
      Alert.alert("Error", String(e?.message || e));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>NFL Picks — Week {week}</Text>
        <Link href="/picks/college" style={styles.switch}>NCAA ↗︎</Link>
      </View>

      <Text style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>{openLabel}</Text>

      <Picker selectedValue={week} onValueChange={(v) => setWeek(Number(v))} style={{ marginBottom: 12 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <Picker.Item key={i + 1} label={`Week ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      {/* Tabs row (global) */}
      <View style={styles.tabsRow}>
        <Tab label="SPREADS" active={betType==="spreads"} disabled={!marketHas.spreads} onPress={() => setBetType("spreads")} />
        <Tab label="TOTALS"  active={betType==="totals"}  disabled={!marketHas.totals}  onPress={() => setBetType("totals")} />
        <Tab label="H2H"     active={betType==="h2h"}     disabled={!marketHas.h2h}     onPress={() => setBetType("h2h")} />
      </View>

      {!!notice && <Text style={styles.warn}>{notice}</Text>}

      {!data?.length ? (
        <View style={styles.center}><Text>No games found for week {week}.</Text></View>
      ) : (
        data.map((game: any) => {
          const book = game.bookmakers?.[0];
          const market = book?.markets?.find((m: any) => m.key === betType);
          if (!market) return null;

          const mappedId = gameMap[`${normTeamNFL(game.away_team)}@${normTeamNFL(game.home_team)}`];
          const disabledWholeCard = !isOpen || !mappedId;

          return (
            <View key={game.id} style={styles.card}>
              <View style={styles.logosRow}>
                <Image source={logoSrc(game.away_team, "nfl")} style={styles.logo} />
                <Text style={styles.vs}>@</Text>
                <Image source={logoSrc(game.home_team, "nfl")} style={styles.logo} />
              </View>

              <Text style={styles.match}>{game.away_team} @ {game.home_team}</Text>
              <Text style={styles.kick}>{new Date(game.commence_time).toLocaleString()}</Text>

              <View style={{ marginTop: 8, opacity: disabledWholeCard ? 0.6 : 1 }}>
                {(market.outcomes ?? []).map((o: any, idx: number) => {
                  const label = labelFor(betType, o);
                  const isMine = mappedId ? myPicks[mappedId] === label : false;
                  const disabled = disabledWholeCard || saving === mappedId;

                  return (
                    <View key={o.name + String(o.point ?? "") + idx} style={{ marginTop: idx ? 8 : 0 }}>
                      <Pressable
                        disabled={disabled}
                        onPress={() => savePick(game, betType, o)}
                        style={
                          isMine
                            ? [styles.pickBtn, styles.pickBtnActive]
                            : disabled ? [styles.pickBtn, styles.pickBtnDisabled] : styles.pickBtn
                        }
                      >
                        <Text style={isMine ? [styles.pickText, styles.pickTextActive] : styles.pickText}>
                          {label}{typeof o.price === "number" ? `  (${o.price > 0 ? `+${o.price}` : o.price})` : ""}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {!mappedId && (
                <Text style={styles.note}>
                  Not clickable: this odds matchup didn’t map to a row in your <Text style={{fontWeight: "700"}}>games</Text> table.
                  {"\n"}Lookup key tried: <Text style={{fontWeight:"700"}}>{`${normTeamNFL(game.away_team)}@${normTeamNFL(game.home_team)}`}</Text>
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  container: { padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  switch: { color: "#0a84ff", fontSize: 16 },

  warn: { color: "#7a4", marginBottom: 8 },

  badge: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, fontWeight: "800", marginBottom: 8 },
  badgeOpen: { backgroundColor: "#E9F4EF", color: "#006241" },
  badgeClosed: { backgroundColor: "#FDECEA", color: "#A4000F" },

  // tabs
  tabsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  tab: { flex: 1, borderWidth: 1, borderColor: "#bbb", borderRadius: 6, paddingVertical: 10, alignItems: "center", backgroundColor: "#eee" },
  tabActive: { backgroundColor: "#111", borderColor: "#111" },
  tabDisabled: { opacity: 0.45 },
  tabText: { fontWeight: "700", color: "#333" },
  tabTextActive: { color: "#fff" },

  card: { padding: 12, borderWidth: 1, borderRadius: 8, borderColor: "#ccc", backgroundColor: "#fff", marginBottom: 12 },
  logosRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  logo: { width: 42, height: 42, borderRadius: 21 },
  vs: { fontWeight: "bold", fontSize: 16, marginHorizontal: 8 },

  match: { fontWeight: "bold", marginBottom: 2, fontSize: 16 },
  kick: { marginTop: 2, fontSize: 12, opacity: 0.7 },

  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#bbb", backgroundColor: "#fff" },
  pickBtnActive: { borderColor: "#006241", backgroundColor: "#E9F4EF" },
  pickBtnDisabled: { opacity: 0.5 },
  pickText: { fontWeight: "800", color: "#222" },
  pickTextActive: { color: "#006241" },

  note: { marginTop: 8, fontSize: 12, color: "#9a6a00" },
});
