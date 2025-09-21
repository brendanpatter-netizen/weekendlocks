'use client';

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Group = {
  id: string;
  name: string;
  invite_code: string | null;
  owner_user_id: string;
  created_at: string;
};

export default function GroupsIndex() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const sorted = useMemo(
    () =>
      [...groups].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      ),
    [groups]
  );

  async function load() {
    setLoading(true);

    // Ensure we’re signed in; RLS will hide everything if not
    const { data: { session }, error: authErr } = await supabase.auth.getSession();
    if (authErr) {
      Alert.alert("Auth error", authErr.message);
      setLoading(false);
      return;
    }
    if (!session) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // Single, simple query: groups I own OR am a member of
    const { data, error } = await supabase
      .from("groups_for_me")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Load error", error.message);
      setLoading(false);
      return;
    }

    setGroups((data || []) as Group[]);
    setLoading(false);
  }

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      await load();

      // Realtime: if my memberships or owned groups change, reload list
      ch = supabase
        .channel("groups-index")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "group_members",
            filter: user ? `user_id=eq.${user.id}` : undefined,
          },
          () => { void load(); }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "groups",
            filter: user ? `owner_user_id=eq.${user.id}` : undefined,
          },
          () => { void load(); }
        )
        .subscribe();
    })();

    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  // CREATE via RPC (also inserts owner as a member)
  const createGroup = async () => {
    const name = createName.trim();
    if (!name) return Alert.alert("Missing name", "Give your group a name.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return Alert.alert("Sign in required");

    const { data: newId, error } = await supabase.rpc("create_group", { p_name: name });
    if (error || !newId) {
      return Alert.alert("Create failed", error?.message || "No id returned");
    }

    setCreateName("");
    router.push({ pathname: "/groups/[id]", params: { id: String(newId) } });
  };

  // JOIN via RPC (idempotent)
  const joinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return Alert.alert("Sign in required");

    const { data: gId, error } = await supabase.rpc("join_group_via_code", { p_code: code });
    if (error || !gId) {
      return Alert.alert("Not found", "No group found for that invite code.");
    }

    setJoinCode("");
    router.push({ pathname: "/groups/[id]", params: { id: String(gId) } });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading groups…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Your Groups</Text>
      <Text style={styles.muted}>Create a group or join with a code.</Text>

      <View style={styles.card}>
        <Text style={styles.h2}>Create a group</Text>
        <TextInput
          value={createName}
          onChangeText={setCreateName}
          placeholder="Group name"
          style={styles.input}
        />
        <TouchableOpacity onPress={createGroup} style={styles.button}>
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Join with code</Text>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="e.g. a1b2c3"
          autoCapitalize="none"
          style={styles.input}
        />
        <TouchableOpacity onPress={joinByCode} style={styles.button}>
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={sorted}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Link
            href={{ pathname: "/groups/[id]", params: { id: item.id } }}
            style={styles.row}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>
              Created {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={styles.muted}>You’re not in any groups yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  h1: { fontSize: 22, fontWeight: "600" },
  h2: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  muted: { color: "#666" },
  card: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
  },
  button: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  buttonText: { color: "white", fontWeight: "600" },
  row: {
    padding: 12,
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 8,
  },
  rowTitle: { fontWeight: "600", fontSize: 16 },
  rowSub: { color: "#666", marginTop: 2 },
});
