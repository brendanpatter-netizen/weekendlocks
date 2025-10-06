// app/picks/page.tsx
export const unstable_settings = { prerender: false };

import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { events } from "@/lib/events";
import { useOdds } from "@/lib/useOdds";
import { logoSrc } from "@/lib/teamLogos";
import { getCurrentWeek } from "@/lib/nflWeeks";

type BetType = "spreads" | "totals" | "h2h";
const NFL_SPORT_KEY = "americanfootball_nfl";
const SEASON = 2025;

// NFL team name normalization is a bit simpler than CFB
function normTeamNFL(name: string) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").trim();
}

function Tab({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.tab,
        active && styles.tabActive,
        disabled && styles.tabDisabled,
      ]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function PicksNFL() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = typeof params.group === "string" ? params.group : undefined;

  const [week, setWeek] = useState<number>(
    typeof params.w === "string" ? Number(params.w) || 1 : getCurrentWeek?.() ?? 1
  );
  const [betType, setBetType] = useState<BetType>("spreads");

  const [userId, setUserId] = useState<string | null>(null);
  const [weekRow, setWeekRow] = useState<any>(null);
  const [gameMap, setGameMap] = useState<Record<string, number>>({});
  const [myPicks, setMyPicks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, loading, error } = useOdds(NFL_SPORT_KEY, week);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // week + games + my picks (scoped to group or solo)
  useEffect(() => {
    (async () => {
      setNotice(null);

      const { data: w, error: wErr } = await supabase
        .from("weeks")
        .select("*")
        .eq("league", "nfl")
        .eq("season", SEASON)
        .eq("week_num", week)
        .maybeSingle();

      if (wErr) setNotice(`weeks: ${wErr.message}`);
      setWeekRow(w);

      if (!w?.id) {
        setGameMap({});
        setMyPicks({});
        return;
      }

      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, home, away, week_id")
        .eq("week_id", w.id);
      if (gErr) setNotice(`games: ${gErr.message}`);

      const map: Record<string, number> = {};
      (g ?? []).forEach((row: any) => {
        map[`${normTeamNFL(row.away)}@${normTeamNFL(row.home)}`] = row.id;
      });
      setGameMap(map);

      const ids = (g ?? []).map((r: any) => r.id);
      if (!ids.length || !userId) {
        setMyPicks({});
        return;
      }

      let q = supabase
        .from("picks")
        .select("game_id, pick_team")
        .in("game_id", ids)
        .eq("user_id", userId);
      q = groupId ? q.eq("group_id", groupId) : q.is("group_id", null);

      const { data: ps, error: pErr } = await q;
      if (pErr) setNotice(`picks: ${pErr.message}`);

      const mine: Record<number, string> = {};
      (ps ?? []).forEach((r: any) => {
        mine[r.game_id] = r.pick_team;
      });
      setMyPicks(mine);
    })();
  }, [week, userId, groupId]);

  const isOpen = useMemo(() => {
    if (!weekRow) return false;
    const now = Date.now();
    return (
      now >= Date.parse(weekRow.opens_at) &&
      now < Date.parse(weekRow.closes_at)
    );
  }, [weekRow]);

  const openLabel = useMemo(() => {
    if (!weekRow) return "";
    const closes = new Date(weekRow.closes_at);
    return isOpen
      ? `OPEN – closes ${closes.toLocaleString()}`
      : `CLOSED – closed ${closes.toLocaleString()}`;
  }, [isOpen, weekRow]);

  const marketHas = useMemo(() => {
    const has = { spreads: false, totals: false, h2h: false };
    for (const g of data ?? []) {
      const keys = g.bookmakers?.[0]?.markets?.map((m: any) => m.key) ?? [];
      if (keys.includes("spreads")) has.spreads = true;
      if (keys.includes("totals")) has.totals = true;
      if (keys.includes("h2h")) has.h2h = true;
    }
    return has;
  }, [data]);

  const labelFor = (type: BetType, o: any) =>
    type === "spreads"
      ? `${o.name} ${o.point}`
      : type === "h2h"
      ? `${o.name} ML`
      : `${o.name} ${o.point}`;

  const savePick = async (oddsGame: any, type: BetType, o: any) => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to save picks.");
      return router.push(groupId ? `/groups/${groupId}` : "/groups");
    }
    if (!isOpen) Alert.alert("Heads up", openLabel);

    const key = `${normTeamNFL(oddsGame.away_team)}@${normTeamNFL(
      oddsGame.home_team
    )}`;
    const mappedId = gameMap[key];

    if (!mappedId) {
      Alert.alert(
        "Not linked to games table",
        "This matchup isn’t linked to a row in your games table yet, so it can’t be saved to the group."
      );
      return;
    }

    const label =
      type === "spreads"
        ? `${o.name} ${o.point}`
        : type === "h2h"
        ? `${o.name} ML`
        : `${o.name} ${o.point}`;

    const row = {
      user_id: userId,
      group_id: groupId ?? null,
      sport: "nfl",
      week,
      game_id: mappedId,
      pick_team: label,
      created_at: new Date().toISOString(),
    };

    setSaving(mappedId);
    try {
      const { error } = await supabase.from("picks").insert(row);
      if (error) {
        console.error("[NFL] insert error", error);
        Alert.alert("Save failed", error.message);
        return;
      }

      setMyPicks((m) => ({ ...m, [mappedId]: label }));
      events.emitPickSaved({
        league: "nfl",
        week,
        game_id: mappedId,
        user_id: userId!,
        pick_team: label,
        group_id: groupId ?? null,
      });

      Alert.alert(
        "Saved",
        `Added ${label} to Week ${week}${groupId ? " (group)" : ""}.`
      );
    } catch (e: any) {
      console.error("[NFL] unexpected save error", e);
      Alert.alert("Error", String(e?.message || e));
    } finally {
      setSaving(null);
      router.push(groupId ? `/groups/${groupId}` : "/groups");
    }
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;
  if (error) return <Text style={styles.center}>Error: {error.message}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>NFL — Week {week}</Text>
        <Link
          href={{
            pathname: "/picks/college",
            params: groupId ? { group: groupId } : {},
          }}
          style={styles.switch}
        >
          NCAA ↗︎
        </Link>
      </View>

      <Text
        style={[
          styles.badge,
          isOpen ? styles.badgeOpen : styles.badgeClosed,
        ]}
      >
        {openLabel}
      </Text>

      <Picker
        selectedValue={week}
        onValueChange={(v) => setWeek(Number(v))}
        style={{ marginBottom: 12 }}
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <Picker.Item key={i + 1} label={`Week ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      <View style={styles.tabsRow}>
        <Tab
          label="SPREADS"
          active={betType === "spreads"}
          disabled={!marketHas.spreads}
          onPress={() => setBetType("spreads")}
        />
        <Tab
          label="TOTALS"
          active={betType === "totals"}
          disabled={!marketHas.totals}
          onPress={() => setBetType("totals")}
        />
        <Tab
          label="H2H"
          active={betType === "h2h"}
          disabled={!marketHas.h2h}
          onPress={() => setBetType("h2h")}
        />
      </View>

      {!!notice && <Text style={styles.warn}>{notice}</Text>}

      {!data?.length ? (
        <View style={styles.center}>
          <Text>No games found for week {week}.</Text>
        </View>
      ) : (
        data.map((game: any) => {
          const book = game.bookmakers?.[0];
          const market = book?.markets?.find((m: any) => m.key === betType);
          if (!market) return null;

          const mappedId =
            gameMap[
              `${normTeamNFL(game.away_team)}@${normTeamNFL(
                game.home_team
              )}`
            ];

          return (
            <View key={game.id} style={styles.card}>
              <View style={styles.logosRow}>
                <Image
                  source={logoSrc(game.away_team, "nfl")}
                  style={styles.logo}
                />
                <Text style={styles.vs}>@</Text>
                <Image
                  source={logoSrc(game.home_team, "nfl")}
                  style={styles.logo}
                />
              </View>

              <Text style={styles.match}>
                {game.away_team} @ {game.home_team}
              </Text>
              <Text style={styles.kick}>
                {new Date(game.commence_time).toLocaleString()}
              </Text>

              <View style={{ marginTop: 8 }}>
                {(market.outcomes ?? []).map((o: any, idx: number) => {
                  const label = labelFor(betType, o);
                  const isMine = mappedId ? myPicks[mappedId] === label : false;
                  const disabled = saving === mappedId;

                  return (
                    <View
                      key={o.name + String(o.point ?? "") + idx}
                      style={{ marginTop: idx ? 8 : 0 }}
                    >
                      <Pressable
                        disabled={disabled}
                        onPress={() => savePick(game, betType, o)}
                        style={
                          isMine
                            ? [styles.pickBtn, styles.pickBtnActive]
                            : disabled
                            ? [styles.pickBtn, styles.pickBtnDisabled]
                            : styles.pickBtn
                        }
                      >
                        <Text
                          style={
                            isMine
                              ? [styles.pickText, styles.pickTextActive]
                              : styles.pickText
                          }
                        >
                          {label}
                          {typeof o.price === "number"
                            ? `  (${o.price > 0 ? `+${o.price}` : o.price})`
                            : ""}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "600" },
  switch: { color: "#0a84ff", fontSize: 16 },
  warn: { color: "#7a4", marginBottom: 8 },

  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontWeight: "800",
    marginBottom: 8,
  },
  badgeOpen: { backgroundColor: "#E9F4EF", color: "#006241" },
  badgeClosed: { backgroundColor: "#FDECEA", color: "#A4000F" },

  tabsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#eee",
  },
  tabActive: { backgroundColor: "#111", borderColor: "#111" },
  tabDisabled: { opacity: 0.5 },
  tabText: { fontWeight: "700", color: "#333" },
  tabTextActive: { color: "#fff" },

  card: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  logosRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  logo: { width: 42, height: 42, borderRadius: 21 },
  vs: { fontWeight: "bold", fontSize: 16, marginHorizontal: 8 },
  match: { fontWeight: "bold", marginBottom: 2, fontSize: 16 },
  kick: { marginTop: 2, fontSize: 12, opacity: 0.7 },

  pickBtn: {
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbb",
    backgroundColor: "#fff",
  },
  pickBtnActive: { borderColor: "#006241", backgroundColor: "#E9F4EF" },
  pickBtnDisabled: { opacity: 0.5 },
  pickText: { fontWeight: "800", color: "#222" },
  pickTextActive: { color: "#006241" },
});
