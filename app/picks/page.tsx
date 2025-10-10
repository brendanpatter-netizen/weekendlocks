import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { useOdds } from "@/lib/useOdds";
import { supabase } from "@/lib/supabase";

/* -------------------- team logos (tolerant import) -------------------- */
let teamLogosMod: any;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  teamLogosMod = require("@/lib/teamLogos");
} catch {}
function getTeamLogo(name?: string | null): string | null {
  if (!name) return null;
  const m = teamLogosMod ?? {};
  if (typeof m.getTeamLogo === "function") return m.getTeamLogo(name);
  if (typeof m.default === "function") return m.default(name);
  if (m.default && typeof m.default === "object") return m.default[name] ?? null;
  if (m && typeof m === "object") return m[name] ?? null;
  return null;
}
/* --------------------------------------------------------------------- */

type MarketKey = "spreads" | "totals" | "h2h";

/* ------------------ name normalizer & side calculator ----------------- */
function n(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/\s+st\./g, " state")
    .replace(/[\s\-]+/g, " ")
    .trim();
}
function computeSide(
  game: any,
  outcome: any,
  market: MarketKey
): "home" | "away" | "over" | "under" | "team" {
  const on = n(outcome?.name ?? "");
  if (market === "totals") {
    if (on.startsWith("over")) return "over";
    if (on.startsWith("under")) return "under";
    return "team";
  }
  const home = n(game.home_team ?? game.home ?? "");
  const away = n(game.away_team ?? game.away ?? "");
  if (on.includes(home)) return "home";
  if (on.includes(away)) return "away";
  return "team";
}
/* --------------------------------------------------------------------- */

/* --------------------------- resolver (NFL) --------------------------- */
const NFL_ALIASES: Record<string, string> = {
  "ny giants": "new york giants",
  giants: "new york giants",
  "ny jets": "new york jets",
  jets: "new york jets",
  "la rams": "los angeles rams",
  rams: "los angeles rams",
  "la chargers": "los angeles chargers",
  chargers: "los angeles chargers",
  jax: "jacksonville jaguars",
  bucs: "tampa bay buccaneers",
  "no saints": "new orleans saints",
  "ne patriots": "new england patriots",
  "gb packers": "green bay packers",
  "kc chiefs": "kansas city chiefs",
  "lv raiders": "las vegas raiders",
  "ari cardinals": "arizona cardinals",
  "sf 49ers": "san francisco 49ers",
  "sea seahawks": "seattle seahawks",
  "tb": "tampa bay buccaneers",
  "wsh": "washington commanders",
};
function aliasNFL(name: string) {
  const s = n(name);
  return NFL_ALIASES[s] ?? s;
}
async function resolveGameId(opts: {
  week: number;
  home: string;
  away: string;
  commenceIso: string;
}) {
  const center = new Date(opts.commenceIso).getTime();
  const windowMs = 48 * 60 * 60 * 1000;
  const fromIso = new Date(center - windowMs).toISOString();
  const toIso = new Date(center + windowMs).toISOString();

  const { data, error } = await supabase
    .from("games")
    .select("id, home, away, kickoff_at, week_id")
    .gte("kickoff_at", fromIso)
    .lte("kickoff_at", toIso);

  if (error || !data?.length) return null;

  const feedHome = aliasNFL(opts.home);
  const feedAway = aliasNFL(opts.away);
  let best: any = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const g of data) {
    const gh = aliasNFL(g.home);
    const ga = aliasNFL(g.away);
    const t = Date.parse(g.kickoff_at);
    if (!Number.isFinite(t)) continue;
    const delta = Math.abs(t - center);
    if (delta > windowMs) continue;

    const dir =
      (gh.includes(feedHome) || feedHome.includes(gh)) &&
      (ga.includes(feedAway) || feedAway.includes(ga));
    const swap =
      (gh.includes(feedAway) || feedAway.includes(gh)) &&
      (ga.includes(feedHome) || feedHome.includes(ga));
    if ((dir || swap) && delta < bestDelta) {
      best = g;
      bestDelta = delta;
    }
  }
  return best?.id ?? null;
}
/* --------------------------------------------------------------------- */

export default function NFLPicksPage() {
  const params = useLocalSearchParams<{ group?: string; w?: string }>();
  const groupId = useMemo(
    () => (Array.isArray(params.group) ? params.group[0] : params.group),
    [params.group]
  );

  const [tab, setTab] = useState<MarketKey>("spreads");
  const [week, setWeek] = useState<number>(() => {
    const n = Number(Array.isArray(params.w) ? params.w[0] : params.w);
    return Number.isFinite(n) && n > 0 ? n : getCurrentNFLWeek();
  });

  const selectStyle: React.CSSProperties = {
    padding: 6,
    borderRadius: 8,
    border: "1px solid #CBD5E1",
  };

  const { data: games, loading, error } = useOdds("americanfootball_nfl", week, {
    markets: ["spreads", "totals", "h2h"],
    region: "us",
    oddsFormat: "american",
  });

  async function handlePick(game: any, outcome: any, market: MarketKey) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      router.push("/auth" as Href);
      return;
    }

    const gameId = await resolveGameId({
      week,
      home: game.home_team ?? game.home ?? "",
      away: game.away_team ?? game.away ?? "",
      commenceIso: game.commence_time,
    });
    if (!gameId) {
      alert("This matchup isn’t synced to your DB yet.");
      return;
    }

    const insert = {
      user_id: user.id,
      group_id: groupId ?? null,
      sport: "nfl" as const,
      week,
      game_id: gameId,
      market,
      team: outcome?.name ?? null,
      price: typeof outcome?.price === "number" ? outcome.price : null,
      line: typeof outcome?.point === "number" ? String(outcome.point) : null,
      side: computeSide(game, outcome, market), // <— satisfies NOT NULL side
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("picks").insert(insert);
    if (error) {
      alert(`Could not save pick: ${error.message}`);
      return;
    }
    if (groupId) router.push(`/groups/${groupId}` as Href);
  }

  const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1) as number[];

  return (
    <ScrollView
      style={{ flex: 1 }}                                // fill the page via flex
      contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}  // spacing and scroll room
>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontWeight: "800", fontSize: 18, flex: 1 }}>NFL — Week {week}</Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/picks/college",
              params: { group: groupId, w: String(week) },
            } as Href)
          }
          style={{ paddingVertical: 6, paddingHorizontal: 8 }}
        >
          <Text style={{ color: "#0B735F", fontWeight: "700" }}>NCAA ↗</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text>Week</Text>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} style={selectStyle}>
          {weekOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <View style={{ flexDirection: "row", gap: 8, marginLeft: "auto" }}>
          {(["spreads", "totals", "h2h"] as MarketKey[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[
                styles.tab,
                tab === k && { backgroundColor: "#0B735F", borderColor: "#0B735F" },
              ]}
            >
              <Text style={[styles.tabText, tab === k && { color: "white" }]}>{k.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text>Error loading odds.</Text>
      ) : (
        (games ?? []).map((g: any) => {
          const markets = g.bookmakers?.[0]?.markets ?? [];
          const m = markets.find((x: any) => x.key === tab);
          const outcomes: any[] = m?.outcomes ?? [];
          const hLogo = getTeamLogo(g.home_team);
          const aLogo = getTeamLogo(g.away_team);

          return (
            <View key={g.id} style={styles.gameCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {!!aLogo && <Image source={{ uri: aLogo }} style={styles.logo} />}
                <Text style={{ fontWeight: "800", flex: 1 }}>
                  {g.away_team} @ {g.home_team}
                </Text>
                {!!hLogo && <Image source={{ uri: hLogo }} style={styles.logo} />}
              </View>
              <Text style={{ color: "#475569" }}>
                {new Date(g.commence_time).toLocaleString()}
              </Text>

              <View style={{ gap: 8, marginTop: 8 }}>
                {outcomes.map((o, i) => (
                  <Pressable key={i} onPress={() => handlePick(g, o, tab)} style={styles.outcomeBtn}>
                    <Text style={{ fontWeight: "700" }}>
                      {o.name}
                      {typeof o.point === "number" ? ` ${o.point > 0 ? "+" : ""}${o.point}` : ""}
                      {typeof o.price === "number" ? `  (${o.price})` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
  },
  tabText: { fontWeight: "800", color: "#0F172A" },
  gameCard: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  outcomeBtn: {
    backgroundColor: "#0B735F22",
    borderWidth: 1,
    borderColor: "#0B735F55",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logo: { width: 28, height: 28, resizeMode: "contain" },
});
