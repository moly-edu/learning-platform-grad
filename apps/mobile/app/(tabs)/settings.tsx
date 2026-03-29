import { authClient } from "@/lib/auth-client";
import React, { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import {
  LogOutIcon,
  AlertCircle,
  User,
  Mail,
  CheckCircle,
} from "lucide-react-native";

export default function SettingsTab() {
  const { data: session } = authClient.useSession();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setError("");
    setSuccess("");
    setLoading(true);

    const { error: signOutError } = await authClient.signOut();
    setLoading(false);

    if (signOutError) {
      setError(signOutError.message || "Sign out failed. Please try again.");
    } else {
      setSuccess("Signed out successfully.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your account information</Text>
        </View>

        {error ? (
          <View style={[styles.messageBox, styles.errorBox]}>
            <AlertCircle size={20} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.messageBox, styles.successBox]}>
            <CheckCircle size={20} color="#16a34a" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {session?.user.image ? (
              <Image
                source={{ uri: session.user.image }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <User size={34} color="#ffffff" />
              </View>
            )}
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <User size={18} color="#334155" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>
                {session?.user.name || "No name available"}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Mail size={18} color="#334155" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {session?.user.email || "No email available"}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          disabled={loading}
          style={({ pressed }) => [
            styles.signOutButton,
            loading && styles.buttonDisabled,
            pressed && styles.card3dPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.signOutRow}>
              <LogOutIcon size={20} color="#ffffff" />
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ecfeff",
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#0f172a",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: "#475569",
  },
  messageBox: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#334155",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 4,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  successBox: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#b91c1c",
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: "#15803d",
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#0f172a",
    padding: 16,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 10,
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: 6,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#bfdbfe",
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#99f6e4",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  signOutButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#7f1d1d",
    shadowColor: "#7f1d1d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 3,
  },
});
