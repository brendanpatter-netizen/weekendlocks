import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router, Href } from "expo-router";
import { getCurrentWeek as getCurrentNFLWeek } from "@/lib/nflWeeks";
import { useOdds } from "@/lib/useOdds";
import { supabase } from "@/lib/supabase";

// helpers from section above (paste here)
function norm(s: string) { /* same as above */ return (s||"").toLowerCase().replace(/\./g,"").replace(/state|st\./g,"state").replace(/[\s\-]+/g," ").trim();}
async function resolveGameId(opts:{sport:"nfl"|"cfb";week:number;home:string;away:string;commenceIso:string;}){const startMs=Date.parse(opts.commenceIso);const windowMs=3*60*60*1000;const {data}=await supabase.from("games").select("id, home_team, away_team, start_time, sport, week").eq("sport",opts.sport).eq("week",opts.week); if(!data) return null; const nHome=norm(opts.home), nAway=norm(opts.away); let best:any=null, bestDelta=1/0; for(const g of data){const dHome=norm(g.home_team), dAway=norm(g.away_team); const time=Date.parse(g.start_time); const delta=Math.abs(time-startMs); const nameMatch=(dHome.includes(nHome)||nHome.includes(dHome)) && (dAway.includes(nAway)||nAway.includes(dAway)); if(nameMatch && delta<bestDelta && delta<=windowMs){best=g; bestDelta=delta;}} return best?.id??null;}

type MarketKey = "spreads" | "totals" | "h2h";

export default function NFLPicksPage() {
  const params = useLocalSearchParams<{ group?: string; w?: string }>();
  const groupId = Array.isArray(params.group) ? params.group[0] : params.group;

  const [tab, setTab] = useState<MarketKey>("spreads");
  const [week, setWeek] = useState<number>(() => {
    const n = Number(Array.isArray(params.w) ? params.w[0] : params.w);
    return Number.isFinite(n) && n > 0 ? n : getCurrentNFLWeek();
  });

  // Odds API hook (you already have this)
  const { data: games, loading, error } = useOdds("americanfootball_nfl", week, {
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
        sport: "nfl",
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
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("picks").insert(insert);
      if (error) {
        console.error("Supabase insert error:", error);
        alert(`Could not save pick: ${error.message}`);
        return;
      }
      if (groupId) router.push(`/groups/${groupId}`);
    } catch (e) {
      console.error(e);
      alert("Could not save pick.");
    }
  }

  const marketsFor = (g: any) => {
    const bm = g.bookmakers?.[0];
    return bm?.markets ?? [];
  };

  return (
    <View style={{ padding: 12, gap: 12 }}>
      <Text style={{ fontWeight: "800", fontSize: 18 }}>NFL — Week {week}</Text>

      {/* Week select (web) */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text>Week</Text>
        <select
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          style={{ padding: 6, borderRadius: 8, border: "1px solid #CBD5E1" } as any}
        >
          {Array.from({ length: 18 }).map((_, i) => (
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
              <Text style={[styles.tabText, tab === k && { color: "white" }]}>
                {k.toUpperCase()}
              </Text>
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
            const ms = marketsFor(g);
            const m = ms.find((x: any) => x.key === tab);
            const outcomes: any[] = m?.outcomes ?? [];
            return (
              <View style={styles.gameCard}>
                <Text style={{ fontWeight: "800" }}>
                  {g.away_team} @ {g.home_team}
                </Text>
                <Text style={{ color: "#475569" }}>
                  {new Date(g.commence_time).toLocaleString()}
                </Text>

                <View style={{ gap: 8, marginTop: 8 }}>
                  {outcomes.map((o, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handlePick(g, o, tab)}
                      style={styles.outcomeBtn}
                    >
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
    gap: 4,
  },
  outcomeBtn: {
    backgroundColor: "#0B735F22",
    borderWidth: 1,
    borderColor: "#0B735F55",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
