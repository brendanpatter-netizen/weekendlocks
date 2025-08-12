export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable, Image, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useOdds } from "../../lib/useOdds";
import { logoSrc } from "../../lib/teamLogos";
import { getCurrentCfbWeek, CFB_WEEKS } from "../../lib/cfbWeeks";

type BetType = "spreads" | "totals" | "h2h";
const CFB_SPORT_KEY = "americanfootball_ncaaf";
const SEASON = 2025;

/** Normalize team names (last token + some handy aliases). Extend as you see mismatches. */
const CFB_ALIASES: Record<string, string> = {
  "miami": "hurricanes",
  "miami fl": "hurricanes",
  "miami (fl)": "hurricanes",
  "miami oh": "redhawks",
  "miami (oh)": "redhawks",
  "texas a&m": "aggies",
  "texas am": "aggies",
  "florida state": "seminoles",
  "florida": "gators",
  "georgia": "bulldogs",
  "alabama": "crimson",
  "crimson tide": "crimson",
  "ucf": "knights",
  "byu": "cougars",
  "lsu": "tigers",
  "usc": "trojans",
  "ole miss": "rebels",
  "washington": "huskies",
  "penn state": "nittany",
  "notre dame": "irish",
  "tcu": "horned",
  "texas": "longhorns",
};
function normTeamCFB(name: string) {
  const raw = name.toLowerCase().replace(/[^\w\s()&-]/g, "").trim();
  if (CFB_ALIASES[raw]) return CFB_ALIASES[raw];
  // take last token (e.g., "Georgia Bulldogs" -> "bulldogs")
  const parts = raw.replace(/[()]/g, "").replace(/&/g, "and").split(/\s+/);
  const last = parts[parts.length - 1];
  return CFB_ALIASES[last] || last;
}

export default function PicksCFB() {
  const [week, setWeek] = useState<number>(getCurrentCfbWeek());
  const [betType, setBetType] = useState<BetType>("spreads");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekRow, setWeekRow] = useState<any>(null);
  const [gameMap, setGameMap] = useState<Record<string, number>>({});
  const [myPicks, setMyPicks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const { data, error, loading } = useOdds(CFB_SPORT_KEY, week);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      setBlockMsg(null);

      const { data: w, error: wErr } = await supabase
        .from("weeks")
        .select("*")
        .eq("league", "cfb")
        .eq("season", SEASON)
        .eq("week_num", week)
        .maybeSingle();
      if (wErr) setBlockMsg(`weeks query: ${wErr.message}`);
      setWeekRow(w);

      if (w?.id) {
        const { data: g, error: gErr } = await supabase
          .from("games")
          .select("id, home, away, week_id")
          .eq("week_id", w.id);
        if (gErr) setBlockMsg(`games query: ${gErr.message}`);

        const map: Record<string, number> = {};
        (g ?? []).forEach((row: any) => {
          const key = `${normTeamCFB(row.away)}@${normTeamCFB(row.home)}`;
          map[key] = row.id;
        });
        setGameMap(map);

        const ids = (g ?? []).map((r: any) => r.id);
        if (ids.length) {
          const { data: ps, error: pErr } = await supabase
            .from("picks")
            .select("game_id, pick_team")
            .in("game_id", ids);
          if (pErr) setBlockMsg(`picks query: ${pErr.message}`);
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

  const labelFor = (type: BetType, o: any) =>
    type === "spreads" ? `${o.name} ${o.point}` : type === "h2h" ? `${o.name} ML` : `${o.name} ${o.point}`;

  const savePick = async (oddsGame: any, type: BetType, o: any) => {
    if (!userId) { Alert.alert("Please sign in to save picks."); return; }
    if (!isOpen) { Alert.alert("Closed", "Picks are closed for this week."); return; }

    const away = normTeamCFB(oddsGame.away_team);
    const home = normTeamCFB(oddsGame.home_team);
    const key = `${away}@${home}`;
    const mappedId = gameMap[key];

    if (!mappedId) {
      Alert.alert("Can’t match game", `Couldn’t map "${oddsGame.away_team} @ ${oddsGame.home_team}" to an internal game.\n\nLookup key: ${key}`);
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
        sport: "cfb",
        week,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("picks")
        .upsert(payload, { onConflict: "user_id,game_id" });
      if (upErr) {
        Alert.alert("Save failed", upErr.message);
        return;
      }
      setMyPicks((m) => ({ ...m, [mappedId]: label }));
      Alert.alert("Saved", `Your pick: ${label}`);
    } catch (e: any) {
      Alert.alert("Error", String(e?.message || e));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error) return <Text style={styles.center}>Error: {error.message}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>NCAA Picks — Week {week}</Text>
        <Link href="/picks/page" style={styles.switch}>NFL ↗︎</Link>
      </View>

      <Picker selectedValue={week} onValueChange={(v) => setWeek(Number(v))} style={{ marginBottom: 12 }}>
        {Array.from({ length: CFB_WEEKS }).map((_, i) => (
          <Picker.Item key={i + 1} label={`Week ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      {!!blockMsg && <Text style={styles.warn}>{blockMsg}</Text>}

      {!data?.length ? (
        <View style={styles.center}><Text>No games found for week {week}.</Text></View>
      ) : data.map((game: any) => {
          const book = game.bookmakers?.[0];
          const market = book?.markets?.find((m: any) => m.key === betType);
          if (!market) return null;

          const mappedId = gameMap[`${normTeamCFB(game.away_team)}@${normTeamCFB(game.home_team)}`];

          return (
            <View key={game.id} style={styles.card}>
              <View style={styles.logosRow}>
                <Image source={logoSrc(game.away_team, "ncaaf")} style={styles.logo} />
                <Text style={styles.vs}>@</Text>
                <Image source={logoSrc(game.home_team, "ncaaf")} style={styles.logo} />
              </View>
              <Text style={styles.match}>{game.away_team} @ {game.home_team}</Text>
              <Text style={styles.kick}>{new Date(game.commence_time).toLocaleString()}</Text>

              <View style={{ marginTop: 8 }}>
                {(market.outcomes ?? []).map((o: any, idx: number) => {
                  const label = labelFor(betType, o);
                  const isMine = mappedId ? myPicks[mappedId] === label : false;
                  const disabled = !isOpen || !mappedId || saving === mappedId;
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
                  (No internal game matched — key tried: {`${normTeamCFB(game.away_team)}@${normTeamCFB(game.home_team)}`})
                </Text>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  warn: { color: "#7a4", marginBottom: 8 },
  container: { padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  switch: { color: "#0a84ff", fontSize: 16 },

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

  note: { marginTop: 6, fontSize: 12, color: "#9a6a00" },
});
