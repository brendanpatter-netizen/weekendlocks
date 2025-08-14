import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Share,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../../lib/supabase";

type Member = { user_id: string; role: "owner" | "admin" | "member" };
type Profile = { id: string; username: string | null };
type Group = {
  id: string;
  name: string;
  invite_code: string | null;
  owner_user_id: string;
  created_at: string;
};

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      const { data: g, error: gErr } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();
      if (gErr || !g) {
        setLoading(false);
        return Alert.alert("Error", gErr?.message || "Group not found");
      }
      setGroup(g);
      setInviteCode(g.invite_code ?? "");

      const { data: m, error: mErr } = await supabase
        .from("group_members")
        .select("user_id, role")
        .eq("group_id", g.id)
        .order("role", { ascending: true });

      if (mErr) {
        setLoading(false);
        return Alert.alert("Error", mErr.message);
      }
      setMembers(m || []);

      const ids = (m || []).map((x) => x.user_id);
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", ids);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p) => (map[p.id] = p));
        setProfiles(map);
      }
      setLoading(false);
    };

    const channel = supabase
      .channel(`group-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${id}`,
        },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "groups",
          filter: `id=eq.${id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    void load();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const shareInvite = async () => {
    if (!inviteCode) return;
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://weekendlocks.com";
    const url = `${base}/groups/join?code=${inviteCode}`;
    try {
      await Share.share({
        message: `Join my Weekend Locks group "${group?.name}": ${url} (code: ${inviteCode})`,
      });
    } catch (e: any) {
      Alert.alert("Share failed", e?.message || "Could not share invite.");
    }
  };

  const leaveGroup = async () => {
    if (!group) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Sign in required");
    const { error } = await supabase
      .from("group_members")
      .delete()
      .match({ group_id: group.id, user_id: user.id });
    if (error) return Alert.alert("Error", error.message);
  };

  if (loading || !group) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading group…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>{group.name}</Text>

      <View style={styles.cardRow}>
        <TextInput
          value={inviteCode}
          editable={false}
          style={[styles.input, { flex: 1 }]}
        />
        <TouchableOpacity onPress={shareInvite} style={styles.button}>
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Members</Text>
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => {
            const username =
              profiles[item.user_id]?.username ??
              item.user_id.slice(0, 8) + "…";
            return (
              <View style={styles.memberRow}>
                <Text style={styles.rowTitle}>{username}</Text>
                <Text style={styles.muted}>{item.role}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.muted}>No members yet.</Text>
          }
        />
      </View>

      <TouchableOpacity
        onPress={leaveGroup}
        style={[styles.button, { backgroundColor: "#c00", alignSelf: "flex-start" }]}
      >
        <Text style={styles.buttonText}>Leave group</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 22, fontWeight: "600" },
  h2: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  muted: { color: "#666" },
  card: { backgroundColor: "white", padding: 12, borderRadius: 12, elevation: 2 },
  cardRow: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  button: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonText: { color: "white", fontWeight: "600" },
  memberRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowTitle: { fontWeight: "600" },
});
