import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";

type Group = { id: string; name: string; invite_code: string | null; owner_user_id: string; created_at: string };

export default function GroupsIndex() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [groups]
  );

  async function load() {
    setLoading(true);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) { Alert.alert("Auth error", authErr.message); setLoading(false); return; }
    if (!user) { setGroups([]); setLoading(false); return; }

    // 1) groups where I'm a member
    const { data: mm, error: mmErr } = await supabase
      .from("group_members")
      .select("groups!inner(id, name, invite_code, owner_user_id, created_at)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (mmErr) { Alert.alert("Load error (members)", mmErr.message); setLoading(false); return; }

    const memberGroups: Group[] = (mm || []).map((r: any) => r.groups);

    // 2) groups I own (fallback if trigger hasn’t added me as a member yet)
    const { data: owned, error: ownedErr } = await supabase
      .from("groups")
      .select("id, name, invite_code, owner_user_id, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (ownedErr) { Alert.alert("Load error (owned)", ownedErr.message); setLoading(false); return; }

    // merge by id (avoid dupes)
    const map = new Map<string, Group>();
    [...memberGroups, ...(owned || [])].forEach(g => map.set(g.id, g));
    setGroups(Array.from(map.values()));
    setLoading(false);
  }

  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await load();

      // realtime: refresh when my memberships change or I create/rename groups I own
      channel = supabase
        .channel("groups-index")
        .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, load)
        .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: user ? `owner_user_id=eq.${user.id}` : undefined }, load)
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const createGroup = async () => {
    const name = createName.trim();
    if (!name) return Alert.alert("Missing name", "Give your group a name.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Sign in required");

    const { data, error } = await supabase
      .from("groups")
      .insert({ name, owner_user_id: user.id })
      .select("id")
      .single();

    if (error) {
      return Alert.alert("Create failed", error.message);
    }

    setCreateName("");
    // navigate right away; detail page will load members & invite code
    router.push({ pathname: "/groups/[id]", params: { id: data!.id } });
  };

  const joinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Sign in required");

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id, invite_code")
      .eq("invite_code", code)
      .single();

    if (gErr || !g) return Alert.alert("Not found", "No group found for that invite code.");

    const { error: mErr } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, user_id: user.id });

    if (mErr) return Alert.alert("Join failed", mErr.message);

    setJoinCode("");
    router.push({ pathname: "/groups/[id]", params: { id: g.id } });
  };

  if (loading) {
    return (<View style={styles.container}><ActivityIndicator /><Text style={styles.muted}>Loading groups…</Text></View>);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Your Groups</Text>
      <Text style={styles.muted}>Create a group or join with a code.</Text>

      <View style={styles.card}>
        <Text style={styles.h2}>Create a group</Text>
        <TextInput value={createName} onChangeText={setCreateName} placeholder="Group name" style={styles.input} />
        <TouchableOpacity onPress={createGroup} style={styles.button}><Text style={styles.buttonText}>Create</Text></TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Join with code</Text>
        <TextInput value={joinCode} onChangeText={setJoinCode} placeholder="e.g. a1b2c3d4e5f6" autoCapitalize="none" style={styles.input} />
        <TouchableOpacity onPress={joinByCode} style={styles.button}><Text style={styles.buttonText}>Join</Text></TouchableOpacity>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={sortedGroups}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/groups/[id]", params: { id: item.id } }} style={styles.row}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>Created {new Date(item.created_at).toLocaleDateString()}</Text>
          </Link>
        )}
        ListEmptyComponent={<Text style={styles.muted}>You’re not in any groups yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  h1: { fontSize: 22, fontWeight: "600" },
  h2: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  muted: { color: "#666" },
  card: { backgroundColor: "white", padding: 12, borderRadius: 12, elevation: 2, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  button: { backgroundColor: "#111", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: "flex-start" },
  buttonText: { color: "white", fontWeight: "600" },
  row: { padding: 12, backgroundColor: "white", borderRadius: 12, marginBottom: 8 },
  rowTitle: { fontWeight: "600", fontSize: 16 },
  rowSub: { color: "#666", marginTop: 2 },
});
