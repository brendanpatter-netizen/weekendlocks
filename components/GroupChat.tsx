// components/GroupChat.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { avatarColor, initials } from "@/lib/avatar";

type ChatMessage = { id: string; user_id: string; body: string; created_at: string };

export default function GroupChat({
  groupId, nameById, currentUserId,
}: { groupId: string; nameById: Map<string, string>; currentUserId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("group_messages")
        .select("id, user_id, body, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (mounted) setMessages((data ?? []) as ChatMessage[]);
      if (mounted) setLoading(false);
    })();

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending]);

  async function send() {
    const body = text.trim();
    if (!body || !currentUserId) return;
    setSending(true);
    const { data, error } = await supabase
      .from("group_messages")
      .insert({ group_id: groupId, user_id: currentUserId, body })
      .select("id, user_id, body, created_at")
      .single();
    setSending(false);
    if (error) { Alert.alert("Could not send message", error.message); return; }
    setText("");
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chat</Text>

      <View style={styles.listBox}>
        {loading ? (
          <Text style={styles.empty}>Loading chat…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.empty}>No messages yet. Say hi!</Text>
        ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.list}
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={({ item }) => {
            const name = nameById.get(item.user_id) ?? "Someone";
            const color = avatarColor(item.user_id);
            const mine = item.user_id === currentUserId;
            return (
              <View style={styles.msgRow}>
                <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                  <Text style={[styles.avatarText, { color: color.fg }]}>{initials(name)}</Text>
                </View>
                <View style={[styles.bubble, mine && styles.bubbleMine]}>
                  <Text style={styles.msgName}>{name}</Text>
                  <Text style={styles.msgBody}>{item.body}</Text>
                  <Text style={styles.msgTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                </View>
              </View>
            );
          }}
        />
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message your group…"
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
          maxLength={1000}
        />
        <Pressable onPress={send} disabled={!canSend} style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}>
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 8 },
  cardTitle: { fontWeight: "800" },
  empty: { paddingVertical: 8, color: "#64748B" },

  listBox: {
    height: 320, backgroundColor: "#F8FAFC", borderRadius: 10,
    borderWidth: 1, borderColor: "#E2E8F0", padding: 8,
  },
  list: { flex: 1 },
  msgRow: { flexDirection: "row", gap: 8, paddingVertical: 6, alignItems: "flex-end" },

  avatar: { width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 11, fontWeight: "700" },

  bubble: { maxWidth: "75%", backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: "#0B735F22" },
  msgName: { fontSize: 12, fontWeight: "700", color: "#0B735F", marginBottom: 2 },
  msgBody: { fontSize: 15, color: "#0F172A" },
  msgTime: { fontSize: 11, color: "#94A3B8", marginTop: 3, textAlign: "right" },

  inputRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 15,
  },
  sendBtn: { backgroundColor: "#0B735F", paddingHorizontal: 16, borderRadius: 999, justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});
