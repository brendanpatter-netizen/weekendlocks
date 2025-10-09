import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";
import { useOdds } from "@/lib/useOdds";
import { supabase } from "@/lib/supabase";

// ---- tolerant logo helper (same as NFL) ----
let teamLogosMod: any;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  teamLogosMod = require("@/lib/teamLogos");
} catch {}
function getTeamLogo(name: string | undefined | null): string | null {
  if (!name) return null;
  const m = teamLogosMod ?? {};
  if (typeof m.getTeamLogo === "function") return m.getTeamLogo(name);
  if (typeof m.default === "function") return m.default(name);
  if (m.default && typeof m.default === "object") return m.default[name] ?? null;
  if (m && typeof m === "object") return m[name] ?? null;
  return null;
}
// --------------------------------------------

type MarketKey = "spreads" | "totals" | "h2h";

/* ---------- same resolver, but without NFL alias table ---------- */
function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/\s+st\./g, " state")
    .replace(/[\s\-]+/g, " ")
    .trim();
}
function aliasNameCFB(name: string) {
  // add specific CFB aliases here if you find mismatches later
  return norm(name);
}
async function resolveGameId(opts: {
  sport: "nfl" | "cfb";
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

  const feedHome = aliasNameCFB(opts.home);
  const feedAway = aliasNameCFB(opts.away);

  let best: any = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const g of data) {
    const gh = aliasNameCFB(g.home);
    const ga = aliasNameCFB(g.away);
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
/* ---------- end resolver ---------- */

export default function CFBBetsPage() {
  const params = useLocalSearchParams<{ group?: string; w?: string }>();
  const groupId = useMemo(
    () => (Array.isArray(params.group) ? params.group[0] : params.group),
    [params.group]
  );

  const [tab, setTab] = useState<MarketKey>("spreads");
  const [week, setWeek] = useState<number>(() => {
    const n = Number(Array.isArray(params.w) ? params.w[0] : params.w);
    return Number.isFinite(n) && n > 0 ? n : getCurrentCFBWeek();
  });

  const selectStyle: React.CSSProperties = {
    padding: 6,
    borderRadius: 8,
    border: "1px solid #CBD5E1",
  };

  const { data: games, loading, error } = useOdds("americanfootball_ncaaf", week, {
    markets: ["spreads", "totals", "h2h"],
    region: "us",
    oddsFormat: "american",
  });

  async function handlePick(game: any, outcome: any, market: MarketKey) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.push("/auth" as Href);
        return;
      }

      const gameId = await resolveGameId({
        sport: "cfb",
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
        sport: "cfb" as const,
        week,
        game_id: gameId,
        market,
        team: outcome?.name ?? null,
        price: typeof outcome?.price === "number" ? outcome.price : null,
        line: typeof outcome?.point === "number" ? String(outcome.point) : null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("picks").insert(insert);
      if (error) {
        console.error("Supabase insert error:", error);
        alert(`Could not save pick: ${error.message}`);
        return;
      }
      if (groupId) router.push(`/groups/${groupId}` as Href);
    } catch (e) {
      console.error(e);
      alert("Could not save pick.");
    }
  }

  const firstMarkets = (g: any) => g.bookmakers?.[0]?.markets ?? [];

  return (
    <View style={{ padding: 12, gap: 12 }}>
      <Text style={{ fontWeight: "800", fontSize: 18 }}>College Football — Week {week}</Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text>Week</Text>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} style={selectStyle}>
          {Array.from({ length: 15 }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
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
        <FlatList
          data={games ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item: g }) => {
            const markets = firstMarkets(g);
            const m = markets.find((x: any) => x.key === tab);
            const outcomes: any[] = m?.outcomes ?? [];
            const hLogo = getTeamLogo(g.home_team);
            const aLogo = getTeamLogo(g.away_team);

            return (
              <View style={styles.gameCard}>
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
          }}
        />
      )}
    </View>
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
