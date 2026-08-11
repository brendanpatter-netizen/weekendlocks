'use client';

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { avatarColor, initials } from "@/lib/avatar";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    setCurrentUserId(session.user.id);

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
        <ActivityIndicator color="#0B735F" />
        <Text style={styles.muted}>Loading groups…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Your groups</Text>
      <Text style={styles.muted}>Create a group or join one with a code.</Text>

      <View style={styles.actionsRow}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: "#E1F5EE" }]}>
              <Ionicons name="add-circle-outline" size={20} color="#085041" />
            </View>
            <Text style={styles.h2}>Create a group</Text>
          </View>
          <TextInput
            value={createName}
            onChangeText={setCreateName}
            placeholder="Group name"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <Pressable onPress={createGroup} style={styles.button}>
            <Text style={styles.buttonText}>Create</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: "#E6F1FB" }]}>
              <Ionicons name="key-outline" size={20} color="#0C447C" />
            </View>
            <Text style={styles.h2}>Join with code</Text>
          </View>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="e.g. a1b2c3"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable onPress={joinByCode} style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Join</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        style={{ marginTop: 20 }}
        data={sorted}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => {
          const color = avatarColor(item.id);
          const isOwner = item.owner_user_id === currentUserId;
          return (
            <Link href={{ pathname: "/groups/[id]", params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <View style={[styles.rowBadge, { backgroundColor: color.bg }]}>
                  <Text style={[styles.rowBadgeText, { color: color.fg }]}>{initials(item.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                    {isOwner && (
                      <View style={styles.ownerTag}><Text style={styles.ownerTagText}>Owner</Text></View>
                    )}
                  </View>
                  <Text style={styles.rowSub}>
                    Created {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color="#94A3B8" />
            <Text style={styles.muted}>You’re not in any groups yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 4, backgroundColor: "#F8FAFC" },
  h1: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  h2: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  muted: { color: "#64748B" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16, flexWrap: "wrap" },
  card: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#0B735F",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  buttonText: { color: "white", fontWeight: "700" },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: "#0B735F",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  buttonSecondaryText: { color: "#0B735F", fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  rowBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBadgeText: { fontSize: 14, fontWeight: "700" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontWeight: "700", fontSize: 16, color: "#0F172A", flexShrink: 1 },
  rowSub: { color: "#94A3B8", marginTop: 2, fontSize: 12 },
  ownerTag: { backgroundColor: "#FAEEDA", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ownerTagText: { fontSize: 10, fontWeight: "700", color: "#633806" },

  emptyState: { alignItems: "center", gap: 8, paddingVertical: 32 },
});
