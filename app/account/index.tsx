export const unstable_settings = { prerender: false };

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { alert } from "@/lib/alert";
import { colors as theme } from "@/lib/theme";
import { toE164 } from "@/lib/phone";
import { BADGE_IDS, isBadgeId, type BadgeId } from "@/lib/badges";
import { recordLabel, winPct, recordVibe, EMPTY_RECORD, type SeasonRecord } from "@/lib/records";
import TapeCorner from "@/components/TapeCorner";
import BadgeIcon from "@/components/BadgeIcon";

const colors = {
  primary: theme.brand,
  bg: theme.felt,
  text: "#0C1712",
  subtext: "#45564C",
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [badgeId, setBadgeId] = useState<BadgeId | null>(null);
  const [savingBadge, setSavingBadge] = useState<BadgeId | null>(null);
  const [overall, setOverall] = useState<SeasonRecord>(EMPTY_RECORD);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Add a phone number to an email-based account (SMS OTP, same mechanism
  // as the login page's phone sign-in, but via updateUser + a "phone_change"
  // verify instead of signInWithOtp — this attaches to the CURRENT user
  // rather than creating a new one).
  const [addPhoneInput, setAddPhoneInput] = useState("");
  const [addPhoneCode, setAddPhoneCode] = useState("");
  const [addPhoneCodeSent, setAddPhoneCodeSent] = useState(false);
  const [addingPhone, setAddingPhone] = useState(false);

  // Add an email to a phone-based account — Supabase confirms this via a
  // link to the new address (like magic link / reset password), not a code.
  const [addEmailInput, setAddEmailInput] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [addEmailSent, setAddEmailSent] = useState(false);

  // Load email + display name
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");

      // Read profile (username + chosen badge)
      const { data, error } = await supabase
        .from("profiles")
        .select("username, badge_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("profiles read error:", error);
        return;
      }

      // Use DB value or sensible default
      const fallback =
        user.user_metadata?.name ||
        (user.email ? user.email.split("@")[0] : "User");

      setUsername((data?.username ?? fallback).replace(/\s/g, ""));
      setBadgeId(isBadgeId(data?.badge_id) ? data.badge_id : null);

      // Season record across every group this member is in — the same
      // per-(group, sport) rows the group dashboard's Standings sums per
      // group, just summed across all of them here for one account-wide
      // number, since this page has no single group context of its own.
      const { data: records } = await supabase
        .from("member_records")
        .select("wins, losses")
        .eq("user_id", user.id);
      const totals = (records ?? []).reduce(
        (acc, r: any) => ({ wins: acc.wins + r.wins, losses: acc.losses + r.losses }),
        { ...EMPTY_RECORD }
      );
      setOverall(totals);
    })();
  }, []);

  const saveBadge = async (id: BadgeId) => {
    const previous = badgeId;
    setBadgeId(id);
    setSavingBadge(id);
    try {
      const { error } = await supabase.rpc("set_profile_badge", { p_badge_id: id });
      if (error) throw error;
    } catch (e: any) {
      setBadgeId(previous);
      alert("Couldn’t save badge", e?.message ?? "Please try again.");
    } finally {
      setSavingBadge(null);
    }
  };

  // Save via RPC (security definer)
  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      const clean = (username ?? "").trim();

    // Call the RPC (now returns the saved row as JSON)
    const { data, error } = await supabase.rpc("save_profile", {
      p_username: clean,
    });

    if (error) {
      // This logs Postgres' exact message (super useful if anything is off)
      console.warn("save_profile RPC error:", error);
      throw error;
    }

    // Optional: reflect the DB result back into UI
    if (data?.username !== undefined) {
      setUsername((data.username ?? "").toString());
    }

    alert("Saved", "Profile updated.");
  } catch (e: any) {
    alert("Couldn’t save", e?.message ?? "Please try again.");
  } finally {
    setSavingProfile(false);
  }
};

  const savePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords don’t match", "Please re-enter.");
      return;
    }
    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      alert("Password set", "You can now sign in with email + password.");
    } catch (e: any) {
      alert("Couldn’t update password", e?.message ?? "Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const sendAddPhoneCode = async () => {
    const to = toE164(addPhoneInput);
    if (!to) return;
    setAddingPhone(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: to });
      if (error) throw error;
      setAddPhoneCodeSent(true);
      alert("Code sent", "Enter the 6-digit code from your text message.");
    } catch (e: any) {
      alert("Couldn’t send code", e?.message ?? "Please try again.");
    } finally {
      setAddingPhone(false);
    }
  };

  const verifyAddPhoneCode = async () => {
    const to = toE164(addPhoneInput);
    const token = addPhoneCode.trim();
    if (!to || token.length !== 6) return;
    setAddingPhone(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: to, token, type: "phone_change" });
      if (error) throw error;
      setPhone(to);
      setAddPhoneInput("");
      setAddPhoneCode("");
      setAddPhoneCodeSent(false);
      alert("Phone added", "You can now sign in with this phone number too.");
    } catch (e: any) {
      alert("Invalid code", e?.message ?? "Check the code and try again.");
    } finally {
      setAddingPhone(false);
    }
  };

  const sendAddEmail = async () => {
    const addr = addEmailInput.trim();
    if (!addr) return;
    setAddingEmail(true);
    try {
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
      const { error } = await supabase.auth.updateUser({ email: addr }, { emailRedirectTo: origin + "/auth/callback" });
      if (error) throw error;
      setAddEmailSent(true);
      alert("Check your inbox", "Click the confirmation link we sent to finish adding this email.");
    } catch (e: any) {
      alert("Couldn’t add email", e?.message ?? "Please try again.");
    } finally {
      setAddingEmail(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") window.location.assign("/auth/login");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <TapeCorner />
        <Text style={styles.title}>My Account</Text>

        {/* Player card — the badge + live season record, so this page reads
            as a personal card being customized rather than a settings form. */}
        <View style={styles.playerCard}>
          <View style={styles.playerBadgeWrap}>
            {badgeId ? (
              <BadgeIcon id={badgeId} size={34} color={theme.brass} />
            ) : (
              <Text style={styles.playerBadgePlaceholder}>?</Text>
            )}
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{username || "Your name"}</Text>
            {recordLabel(overall) ? (
              <View style={styles.playerRecordRow}>
                <Text style={styles.playerRecordText}>
                  {recordLabel(overall)}{winPct(overall) ? ` · ${winPct(overall)}` : ""}
                </Text>
                {recordVibe(overall) && (
                  <View style={[styles.vibeChip, recordVibe(overall)!.tone === "hot" ? styles.vibeChipHot : styles.vibeChipCold]}>
                    <Text style={[styles.vibeChipText, recordVibe(overall)!.tone === "hot" ? styles.vibeChipTextHot : styles.vibeChipTextCold]}>
                      {recordVibe(overall)!.label}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.playerRecordText}>No picks graded yet this season</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Badge</Text>
          <Text style={styles.badgeHint}>Shows next to your name on the groups list.</Text>
          <View style={styles.badgeGrid}>
            {BADGE_IDS.map((id) => {
              const selected = badgeId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => saveBadge(id)}
                  disabled={savingBadge === id}
                  style={[styles.badgeOption, selected && styles.badgeOptionSelected]}
                >
                  <BadgeIcon id={id} size={22} color={selected ? theme.brass : colors.subtext} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            {email ? (
              <Text style={styles.value}>{email}</Text>
            ) : addEmailSent ? (
              <Text style={styles.value}>Check {addEmailInput} for a confirmation link.</Text>
            ) : (
              <>
                <Text style={styles.value}>—</Text>
                <TextInput
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={addEmailInput}
                  onChangeText={setAddEmailInput}
                  style={styles.input}
                />
                <Pressable onPress={sendAddEmail} disabled={addingEmail || !addEmailInput.trim()} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{addingEmail ? "Sending..." : "Add email"}</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            {phone ? (
              <Text style={styles.value}>{phone}</Text>
            ) : addPhoneCodeSent ? (
              <>
                <Text style={styles.value}>Enter the 6-digit code we texted you.</Text>
                <TextInput
                  placeholder="123456"
                  keyboardType="numeric"
                  maxLength={6}
                  value={addPhoneCode}
                  onChangeText={(t) => setAddPhoneCode(t.replace(/\D/g, ""))}
                  style={styles.input}
                />
                <Pressable onPress={verifyAddPhoneCode} disabled={addingPhone || addPhoneCode.length !== 6} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{addingPhone ? "Verifying..." : "Verify & add"}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.value}>—</Text>
                <TextInput
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                  value={addPhoneInput}
                  onChangeText={setAddPhoneInput}
                  style={styles.input}
                />
                <Pressable onPress={sendAddPhoneCode} disabled={addingPhone || !addPhoneInput.trim()} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{addingPhone ? "Sending..." : "Add phone"}</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Display name (username)</Text>
            <TextInput
              placeholder="e.g. weekend_wizard"
              autoCapitalize="none"
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, ""))}
              style={styles.input}
            />
            <Pressable onPress={saveProfile} disabled={savingProfile} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {savingProfile ? "Saving..." : "Save profile"}
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 12, color: colors.subtext }}>
            Your name is stored in the <Text style={{ fontWeight: "700" }}>profiles</Text> table and
            shows in Groups.
          </Text>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Set / change password</Text>
            <TextInput
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <TextInput
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
            <Pressable onPress={savePassword} disabled={savingPassword} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {savingPassword ? "Saving..." : "Update password"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContent: {
    padding: 20,
    alignItems: "center",
  },
  // The whole page is one card — a single-instance surface, so it gets the
  // full paper treatment (dashed border, tape corner, slight tilt).
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#F5F3E7",
    borderRadius: 10,
    padding: 20,
    paddingTop: 24,
    gap: 16,
    borderWidth: 1.5,
    borderColor: "rgba(12,23,18,0.18)",
    borderStyle: "dashed",
  },
  title: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 24, color: "#B23A2E", textTransform: "uppercase" },

  // The player card — badge left, name + live record right. Sits on the
  // same chalk-paper card as everything else on this page (the account
  // page has no board-hero layout of its own), so the badge circle uses a
  // darker felt backing to read as its own object rather than another
  // sheet of paper.
  playerCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  playerBadgeWrap: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: theme.felt,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(179,120,31,0.5)",
  },
  playerBadgePlaceholder: { fontSize: 24, fontWeight: "800", color: "rgba(245,243,231,0.4)" },
  playerInfo: { flex: 1, minWidth: 0, gap: 3 },
  playerName: { fontSize: 20, fontWeight: "800", color: colors.text },
  playerRecordRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  playerRecordText: { fontSize: 13, color: colors.subtext, fontWeight: "600" },
  // Same dashed ink-only pill as the group Standings' streak badge — see
  // app/groups/[id]/index.tsx's vibeChip.
  vibeChip: {
    borderWidth: 1.5, borderStyle: "dashed", borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  vibeChipHot: { borderColor: "#B23A2E", backgroundColor: "rgba(178,58,46,0.08)" },
  vibeChipCold: { borderColor: theme.brand, backgroundColor: "rgba(11,115,95,0.08)" },
  vibeChipText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  vibeChipTextHot: { color: "#B23A2E" },
  vibeChipTextCold: { color: theme.brand },

  badgeHint: { fontSize: 12, color: colors.subtext },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeOption: {
    width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FDFCF8", borderWidth: 1.5, borderColor: "rgba(12,23,18,0.12)", borderStyle: "dashed",
  },
  badgeOptionSelected: { borderColor: theme.brass, backgroundColor: "rgba(179,120,31,0.1)" },

  section: { gap: 10 },
  sectionTitle: { fontFamily: "PermanentMarker_400Regular, cursive", fontSize: 16, color: "#B23A2E", textTransform: "uppercase" },
  row: {
    backgroundColor: "#FDFCF8",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(12,23,18,0.12)",
    gap: 8,
  },
  label: { fontSize: 12, color: colors.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 16, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "rgba(12,23,18,0.18)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    fontSize: 16,
    color: colors.text,
  },
  primaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  primaryBtnText: { color: "white", fontWeight: "800" },
  // Ghost/secondary, matching the documented button pattern — not a filled
  // gold button, which isn't a component this design system defines.
  signOutBtn: {
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  signOutText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
});
