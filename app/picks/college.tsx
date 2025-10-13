import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { getCurrentCfbWeek as getCurrentCFBWeek } from "@/lib/cfbWeeks";
import { useOdds } from "@/lib/useOdds";
import { supabase } from "@/lib/supabase";

/* ---------- team logos (tolerant import: function or map) ---------- */
let teamLogosMod: any;
try { teamLogosMod = require("@/lib/teamLogos"); } catch {}
function getTeamLogo(name?: string | null): string | null {
  if (!name) return null;
  const m = teamLogosMod ?? {};
  if (typeof m.getTeamLogo === "function") return m.getTeamLogo(name);
  if (typeof m.default === "function") return m.default(name);
  if (m.default && typeof m.default === "object") return m.default[name] ?? null;
  if (m && typeof m === "object") return m[name] ?? null;
  return null;
}

type MarketKey = "spreads" | "totals" | "h2h";

/* helpers */
function norm(s: string) {
  return (s ?? "").toLowerCase().replace(/\./g, "").replace(/&/g, "and")
    .replace(/\s+st\./g, " state").replace(/[\s\-]+/g, " ").trim();
}
function computeSide(game: any, outcome: any, market: MarketKey)
  : "home" | "away" | "over" | "under" | "team" {
  const on = norm(outcome?.name ?? "");
  if (market === "totals") {
    if (on.startsWith("over")) return "over";
    if (on.startsWith("under")) return "under";
    return "team";
  }
  const home = norm(game.home_team ?? game.home ?? "");
  const away = norm(game.away_team ?? game.away ?? "");
  if (on.includes(home)) return "home";
  if (on.includes(away)) return "away";
  return "team";
}

/* resolve/create game id (same as NFL, league='cfb') */
async function resolveOrCreateGameId(opts: {
  league: "nfl" | "cfb"; week: number; home: string; away: string; commenceIso: string; externalId?: string | null;
}) {
  const center = new Date(opts.commenceIso).getTime();
  const windowMs = 48 * 60 * 60 * 1000;
  const fromIso = new Date(center - windowMs).toISOString();
  const toIso = new Date(center + windowMs).toISOString();

  const { data: rows } = await supabase
    .from("games")
    .select("id, home, away, kickoff_at")
    .gte("kickoff_at", fromIso)
    .lte("kickoff_at", toIso);

  if (rows?.length) {
    const feedHome = norm(opts.home), feedAway = norm(opts.away);
    for (const r of rows) {
      const rh = norm(r.home), ra = norm(r.away);
      const dir = (rh.includes(feedHome) || feedHome.includes(rh)) && (ra.includes(feedAway) || feedAway.includes(ra));
      const swap = (rh.includes(feedAway) || feedAway.includes(rh)) && (ra.includes(feedHome) || feedHome.includes(ra));
      if (dir || swap) return r.id;
    }
  }

  const { data, error } = await supabase.rpc("upsert_game_from_feed", {
    _league: opts.league, _week: opts.week, _kickoff_at: opts.commenceIso,
    _home: opts.home, _away: opts.away, _external_id: opts.externalId ?? null,
  });

  if (error) return null;
  return data as number | null;
}

export default function CFBPicksPage() {
  const params = useLocalSearchParams<{ group?: string; w?: string }>();
  const groupId = useMemo(
    () => (Array.isArray(params.group) ? params.group[0] : params.group) ?? null,
    [params.group]
  );

  const [tab, setTab] = useState<MarketKey>("spreads");
  const [week, setWeek] = useState<number>(() => {
    const n = Number(Array.isArray(params.w) ? params.w[0] : params.w);
    return Number.isFinite(n) && n > 0 ? n : getCurrentCFBWeek();
  });

  const { data: games, loading, error } = useOdds("americanfootball_ncaaf", week, {
    markets: ["spreads", "totals", "h2h"],
    region: "us",
    oddsFormat: "american",
  });

  function conflictCols() {
    return groupId ? "group_id,user_id,sport,week" : "user_id,sport,week";
  }

  async function handlePick(game: any, outcome: any, market: MarketKey) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { router.push("/auth" as Href); return; }

    const gameId = await resolveOrCreateGameId({
      league: "cfb", week,
      home: game.home_team ?? game.home ?? "",
      away: game.away_team ?? game.away ?? "",
      commenceIso: game.commence_time,
      externalId: game.id ?? null,
    });
    if (!gameId) { alert("Could not resolve/create matchup in the DB."); return; }

    const row = {
      user_id: user.id,
      group_id: groupId,
      sport: "cfb" as const,
      week,
      game_id: gameId,
      market,
      team: outcome?.name ?? null,
      price: typeof outcome?.price === "number" ? outcome.price : null,
      line: typeof outcome?.point === "number" ? String(outcome.point) : null,
      side: computeSide(game, outcome, market),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("picks")
      .upsert(row, { onConflict: conflictCols(), ignoreDuplicates: false });

    if (upsertErr) { alert(`Could not save pick: ${upsertErr.message}`); return; }
    if (groupId) router.push(`/groups/${groupId}` as Href);
  }

  async function handleClear() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user; if (!user) return;

    let q = supabase.from("picks").delete()
      .eq("user_id", user.id)
      .eq("sport", "cfb")
      .eq("week", week);
    if (groupId !== null) q = q.eq("group_id", groupId);

    const { error: delErr } = await q;
    if (delErr) alert(`Could not clear pick: ${delErr.message}`);
  }

  const weekOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}>
      <Text style={{ fontWeight: "800", fontSize: 18 }}>College Football — Week {week}</Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text>Week</Text>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))}
                style={{ padding: 6, borderRadius: 8, border: "1px solid #CBD5E1" } as any}>
          {weekOptions.map((w) => (<option key={w} value={w}>{w}</option>))}
        </select>

        <View style={{ flexDirection: "row", gap: 8, marginLeft: "auto" }}>
          {(["spreads", "totals", "h2h"] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)}
              style={[styles.tab, tab === k && { backgroundColor: "#0B735F", borderColor: "#0B735F" }]}>
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
                <Text style={{ fontWeight: "800", flex: 1 }}>{g.away_team} @ {g.home_team}</Text>
                {!!hLogo && <Image source={{ uri: hLogo }} style={styles.logo} />}
              </View>
              <Text style={{ color: "#475569" }}>{new Date(g.commence_time).toLocaleString()}</Text>

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

              <View style={{ marginTop: 8, alignItems: "flex-end" }}>
                <Pressable onPress={handleClear} style={styles.clearBtn}>
                  <Text style={{ color: "#EF4444", fontWeight: "700" }}>Clear my pick</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, borderColor: "#CBD5E1", backgroundColor: "#F1F5F9" },
  tabText: { fontWeight: "800", color: "#0F172A" },
  gameCard: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, marginBottom: 10, gap: 6 },
  outcomeBtn: { backgroundColor: "#0B735F22", borderWidth: 1, borderColor: "#0B735F55", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  clearBtn: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: 6, borderColor: "#EF4444", backgroundColor: "#EF44440D" },
  logo: { width: 28, height: 28, resizeMode: "contain" },
});
