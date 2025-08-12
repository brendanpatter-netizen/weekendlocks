// app/picks/college.tsx – CFB picks with structured save
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable, Image, Alert
} from "react-native";
import { Link } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "@/lib/supabase";
import { useOdds } from "../../lib/useOdds";
import { logoSrc } from "../../lib/teamLogos";
import { getCurrentCfbWeek, CFB_WEEKS } from "../../lib/cfbWeeks";

type BetType = "spreads" | "totals" | "h2h";
type WeekRow = { id: number; league: "nfl"|"cfb"; season: number; week_num: number; opens_at: string; closes_at: string };

const CFB_SPORT_KEY = "americanfootball_ncaaf";
const SEASON = 2025;

const nick = (name: string) => {
  const p = name.trim().split(/\s+/);
  return (p[p.length - 1] || "").toLowerCase();
};

export default function PicksCFB() {
  const [week, setWeek] = useState<number>(getCurrentCfbWeek());
  const [betType, setBetType] = useState<BetType>("spreads");
  const [userId, setUserId] = useState<string | null>(null);
  const [weekRow, setWeekRow] = useState<WeekRow | null>(null);
  const [gameMap, setGameMap] = useState<Record<string, number>>({});
  const [myPicks, setMyPicks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const { data, error, loading } = useOdds(CFB_SPORT_KEY, week);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: w } = await supabase
          .from("weeks").select("*")
          .eq("league","cfb").eq("season",SEASON).eq("week_num",week)
          .maybeSingle();
        setWeekRow(w as any);

        if (w?.id) {
          const { data: g } = await supabase
            .from("games").select("id, home, away, week_id").eq("week_id", w.id);
          const map: Record<string, number> = {};
          (g ?? []).forEach((row: any) => {
            map[`${row.away.toLowerCase()}@${row.home.toLowerCase()}`] = row.id;
            map[`${nick(row.away)}@${nick(row.home)}`] = row.id;
          });
          setGameMap(map);

          const ids = (g ?? []).map((r: any) => r.id);
          if (ids.length) {
            const { data: ps } = await supabase.from("picks").select("game_id, pick_team");
            const mine: Record<number, string> = {};
            (ps ?? []).forEach((r: any) => { if (ids.includes(r.game_id)) mine[r.game_id] = r.pick_team; });
            setMyPicks(mine);
          } else setMyPicks({});
        } else {
          setGameMap({});
          setMyPicks({});
        }
      } catch {}
    })();
  }, [week]);

  const isOpen = useMemo(() => {
    if (!weekRow) return false;
    const now = Date.now();
    return now >= Date.parse(weekRow.opens_at) && now < Date.parse(weekRow.closes_at);
  }, [weekRow]);

  const labelFor = (type: BetType, o: any) => {
    if (type === "spreads") return `${o.name} ${o.point}`;
    if (type === "h2h")     return `${o.name} ML`;
    return `${o.name} ${o.point}`;
  };

  const savePick = async (oddsGame: any, type: BetType, o: any) => {
    if (!userId) return Alert.alert("Please sign in");
    if (!isOpen)  return Alert.alert("Closed","Picks are closed for this week.");

    const mappedId =
      gameMap[`${oddsGame.away_team.toLowerCase()}@${oddsGame.home_team.toLowerCase()}`] ??
      gameMap[`${nick(oddsGame.away_team)}@${nick(oddsGame.home_team)}`];

    if (!mappedId) return Alert.alert("Can’t save", "No internal game found for this matchup.");

    const label = labelFor(betType, o);
    setSaving(mappedId);

    try {
      const payload = {
        user_id: userId,
        game_id: mappedId,
        pick_team: label,
        pick_market: type,
        pick_side: String(o.name),
        pick_line: typeof o.point === "number" ? o.point : (o.point ? Number(o.point) : null),
        pick_price: typeof o.price === "number" ? o.price : null,
        sport: "cfb",
        week,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("picks")
        .upsert(payload, { onConflict: "user_id,game_id" });
      if (error) throw error;

      setMyPicks((m) => ({ ...m, [mappedId]: label }));
    } catch (e: any) {
      Alert.alert("Couldn’t save pick", e?.message ?? "Try again.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error)   return <Text style={styles.center}>Error: {error.message}</Text>;
  if (!data?.length) return <View style={styles.center}><Text>No games found for week {week}.</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>NCAA Picks — Week {week}</Text>
        <Link href="/picks/page" style={styles.switch}>NFL ↗︎</Link>
      </View>

      <Picker selectedValue={week} onValueChange={(v) => setWeek(Number(v))} style={{ marginBottom: 12 }}>
        {[...Array(CFB_WEEKS)].map((_, i) => <Picker.Item key={i+1} label={`Week ${i+1}`} value={i+1} />)}
      </Picker>

      <View style={styles.tabs}>
        {(["spreads","totals","h2h"] as BetType[]).map((t) => (
          <Pressable key={t} onPress={() => setBetType(t)} style={[styles.tab, betType===t && styles.tabActive]}>
            <Text style={betType===t && styles.tabActiveText}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {data.map((game: any) => {
        const book = game.bookmakers?.[0];
        const market = book?.markets?.find((m: any) => m.key === betType);
        if (!market) return null;

        const mappedId =
          gameMap[`${game.away_team.toLowerCase()}@${game.home_team.toLowerCase()}`] ??
          gameMap[`${nick(game.away_team)}@${nick(game.home_team)}`];

        return (
          <View key={game.id} style={styles.card}>
            <View style={styles.logosRow}>
              <Image source={logoSrc(game.away_team, "ncaaf")} style={styles.logo} />
              <Text style={styles.vs}>@</Text>
              <Image source={logoSrc(game.home_team, "ncaaf")} style={styles.logo} />
            </View>
            <Text style={styles.match}>{game.away_team} @ {game.home_team}</Text>
            <Text style={styles.kick}>{new Date(game.commence_time).toLocaleString()}</Text>

            <View style={{ marginTop: 8, gap: 8 }}>
              {(market.outcomes ?? []).map((o: any) => {
                const label = labelFor(betType, o);
                const isMine = mappedId ? myPicks[mappedId] === label : false;
                return (
                  <Pressable
                    key={o.name + String(o.point ?? "")}
                    disabled={!isOpen || !mappedId || saving === mappedId}
                    onPress={() => savePick(game, betType, o)}
                    style={[
                      styles.pickBtn,
                      isMine && styles.pickBtnActive,
                      (!isOpen || !mappedId || saving === mappedId) && styles.pickBtnDisabled,
                    ]}
                  >
                    <Text style={[styles.pickText, isMine && styles.pickTextActive]}>
                      {label}
                      {typeof o.price === "number" ? `  (${o.price > 0 ? `+${o.price}` : o.price})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!mappedId && <Text style={styles.note}>(No internal game found — check names.)</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  container: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  switch: { color: "#0a84ff", fontSize: 16 },
  tabs: { flexDirection: "row", marginBottom: 12, gap: 8 },
  tab: { flex: 1, padding: 8, borderWidth: 1, borderColor: "#999", alignItems: "center" },
  tabActive: { backgroundColor: "#000" },
  tabActiveText: { color: "#fff" },
  card: { padding: 12, borderWidth: 1, borderRadius: 8, borderColor: "#ccc" },
  match: { fontWeight: "bold", marginBottom: 2, fontSize: 16 },
  kick: { marginTop: 2, fontSize: 12, opacity: 0.7 },
  logosRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginBottom: 6 },
  logo: { width: 42, height: 42, borderRadius: 21 },
  vs: { fontWeight: "bold", fontSize: 16 },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#bbb", backgroundColor: "#fff" },
  pickBtnActive: { borderColor: "#006241", backgroundColor: "#E9F4EF" },
  pickBtnDisabled: { opacity: 0.5 },
  pickText: { fontWeight: "800", color: "#222" },
  pickTextActive: { color: "#006241" },
  note: { marginTop: 6, fontSize: 12, color: "#9a6a00" },
});
