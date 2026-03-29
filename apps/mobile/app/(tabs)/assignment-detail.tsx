import React from "react";
import { View, Text, StyleSheet, Pressable, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AssignmentWidget from "@/components/AssignmentWidget";

export default function AssignmentDetailScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();

  if (!assignmentId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Missing assignment</Text>
          <Text style={styles.errorText}>No assignment ID provided.</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0fdfa",
  },
  container: {
    flex: 1,
    backgroundColor: "#f0fdfa",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
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
  },
  backButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
