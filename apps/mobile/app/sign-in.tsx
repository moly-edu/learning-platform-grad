import { authClient } from "@/lib/auth-client";
import { LogInIcon, AlertCircle } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useTranslation } from "react-i18next";

export default function SignInPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError(t("signIn.missingCredentials"));
      return;
    }

    setLoading(true);
    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message || t("signIn.loginFailed"));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{t("signIn.title")}</Text>
          <Text style={styles.subtitle}>{t("signIn.subtitle")}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={20} color="#dc2626" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>{t("signIn.email")}</Text>
            <TextInput
              placeholder={t("signIn.emailPlaceholder")}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>{t("signIn.password")}</Text>
            <TextInput
              placeholder={t("signIn.passwordPlaceholder")}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
              secureTextEntry
              autoComplete="password"
              style={styles.input}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              styles.card3d,
              loading && styles.buttonDisabled,
              pressed && styles.card3dPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.buttonContent}>
                <LogInIcon
                  size={20}
                  color="#ffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>{t("signIn.submit")}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ecfeff",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#991b1b",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#7f1d1d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 5,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    color: "#b91c1c",
    fontSize: 14,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 10,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: "#111827",
  },
  button: {
    marginTop: 4,
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderWidth: 2,
    borderColor: "#042f2e",
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 17,
  },
  card3d: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 3,
  },
});
