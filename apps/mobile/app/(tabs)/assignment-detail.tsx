import React from "react";
import { View, Text, StyleSheet, Pressable, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AssignmentWidget from "@/components/AssignmentWidget";
import { useTranslation } from "react-i18next";

export default function AssignmentDetailScreen() {
  const { t } = useTranslation();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();

  if (!assignmentId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>
            {t("assignmentDetail.missingTitle")}
          </Text>
          <Text style={styles.errorText}>
            {t("assignmentDetail.missingDescription")}
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.widgetFrame}>
          <AssignmentWidget
            key={assignmentId}
            assignmentId={assignmentId}
            onCompleted={(submission) => {
              console.log("Assignment completed:", submission);
            }}
            onError={(error) => {
              console.error("Assignment error:", error);
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fefce8",
  },
  container: {
    flex: 1,
    backgroundColor: "#fefce8",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  widgetFrame: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#854d0e",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fefce8",
    padding: 18,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 16,
    color: "#c2410c",
    textAlign: "center",
    marginBottom: 16,
  },
  backButton: {
    minHeight: 46,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#042f2e",
    shadowColor: "#042f2e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
