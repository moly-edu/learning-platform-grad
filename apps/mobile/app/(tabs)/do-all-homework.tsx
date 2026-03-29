import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";
import AssignmentWidget from "@/components/AssignmentWidget";

interface PendingAssignment {
  assignmentId: string;
  studentAssignmentId: string;
  title: string;
  homeworkTitle: string;
}

interface DisplayedAssignment extends PendingAssignment {
  index: number;
  isCompleted: boolean;
  isCorrect?: boolean;
}

export default function DoAllHomeworkScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingWhenOpened, setPendingWhenOpened] = useState<
    PendingAssignment[]
  >([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [evaluationMap, setEvaluationMap] = useState<
    Map<string, { isCorrect: boolean }>
  >(new Map());
  const [currentAssignmentId, setCurrentAssignmentId] = useState<
    string | undefined
  >();
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);

  useEffect(() => {
    const loadPendingAssignments = async () => {
      if (!classId) {
        setError("No class ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: session } = await authClient.getSession();
        if (!session?.session.token) {
          throw new Error("No session token");
        }

        const response = await fetch(
          `${API_BASE_URL}/api/mobile/class/pending-assignments?classId=${classId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.token}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load assignments");
        }

        const result = await response.json();

        if (result.success && result.data) {
          const assignments: PendingAssignment[] = result.data;
          setPendingWhenOpened(assignments);

          if (assignments.length > 0) {
            setCurrentAssignmentId(assignments[0].assignmentId);
          }
        } else {
          throw new Error(result.error || "Failed to load assignments");
        }
      } catch (err) {
        console.error("Load pending assignments error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadPendingAssignments();
  }, [classId]);

  const displayedAssignments: DisplayedAssignment[] = useMemo(
    () =>
      pendingWhenOpened.map((assignment, idx) => ({
        ...assignment,
        index: idx + 1,
        isCompleted: completedIds.has(assignment.assignmentId),
      })),
    [pendingWhenOpened, completedIds],
  );

  const completedCount = displayedAssignments.filter(
    (a) => a.isCompleted,
  ).length;
  const totalCount = displayedAssignments.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const allCompleted =
    pendingWhenOpened.length > 0 &&
    pendingWhenOpened.every((a) => completedIds.has(a.assignmentId));

  const handleAssignmentCompleted = useCallback(
    (assignmentId: string) => {
      setCompletedIds((prev) => new Set([...prev, assignmentId]));

      const currentIdx = pendingWhenOpened.findIndex(
        (a) => a.assignmentId === assignmentId,
      );

      if (currentIdx < pendingWhenOpened.length - 1) {
        setTimeout(() => {
          setCurrentAssignmentId(
            pendingWhenOpened[currentIdx + 1].assignmentId,
          );
        }, 300);
      }
    },
    [pendingWhenOpened],
  );

  const handleEvaluationUpdate = useCallback(
    (assignmentId: string, isCorrect: boolean) => {
      setEvaluationMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(assignmentId, { isCorrect });
        return newMap;
      });
    },
    [],
  );

  const handleWidgetError = useCallback((nextError: string) => {
    console.error("Widget error:", nextError);
  }, []);

  const handleCurrentAssignmentCompleted = useCallback(() => {
    if (!currentAssignmentId) return;
    handleAssignmentCompleted(currentAssignmentId);
  }, [currentAssignmentId, handleAssignmentCompleted]);

  const selectAssignment = (assignmentId: string) => {
    setCurrentAssignmentId(assignmentId);
    setShowAssignmentsModal(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.loadingText}>Preparing assignments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (pendingWhenOpened.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>Nothing pending</Text>
          <Text style={styles.successText}>
            You already finished all homework for this class.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to class</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (allCompleted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.successIcon}>🏆</Text>
          <Text style={styles.successTitle}>Awesome work!</Text>
          <Text style={styles.successText}>
            You finished all {displayedAssignments.length} assignments.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          style={styles.progressBarButton}
          onPress={() => setShowAssignmentsModal(true)}
        >
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </Pressable>

        <View style={styles.widgetWrap}>
          {currentAssignmentId ? (
            <AssignmentWidget
              key={currentAssignmentId}
              assignmentId={currentAssignmentId}
              onCompleted={handleCurrentAssignmentCompleted}
              onEvaluationUpdate={handleEvaluationUpdate}
              onError={handleWidgetError}
            />
          ) : (
            <View style={styles.centerContainerSmall}>
              <Text style={styles.emptyText}>No assignment selected.</Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={showAssignmentsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAssignmentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assignments</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowAssignmentsModal(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={displayedAssignments}
              keyExtractor={(item) => item.assignmentId}
              contentContainerStyle={styles.assignmentListContent}
              renderItem={({ item }) => {
                const isCurrent = item.assignmentId === currentAssignmentId;
                const evaluation = evaluationMap.get(item.assignmentId);
                const isCorrect = evaluation?.isCorrect;

                return (
                  <Pressable
                    style={[
                      styles.assignmentItem,
                      isCurrent && styles.assignmentItemCurrent,
                      item.isCompleted &&
                        (isCorrect === false
                          ? styles.assignmentItemWrong
                          : styles.assignmentItemDone),
                    ]}
                    onPress={() => selectAssignment(item.assignmentId)}
                  >
                    <View style={styles.assignmentTopRow}>
                      <Text style={styles.assignmentIndex}>#{item.index}</Text>
                      <Text style={styles.assignmentStatus}>
                        {item.isCompleted
                          ? isCorrect === false
                            ? "Try again"
                            : "Done"
                          : "Pending"}
                      </Text>
                    </View>
                    <Text style={styles.assignmentTitle} numberOfLines={1}>
                      {item.title || `Assignment ${item.index}`}
                    </Text>
                    <Text style={styles.assignmentSubtitle} numberOfLines={1}>
                      {item.homeworkTitle}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#f0fdfa",
  },
  centerContainerSmall: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "700",
  },
  errorIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: "#b91c1c",
    textAlign: "center",
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 18,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  progressBarButton: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e",
  },
  widgetWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    minHeight: 320,
  },
  emptyText: {
    fontSize: 15,
    color: "#94a3b8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "70%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  modalCloseText: {
    fontSize: 18,
    color: "#334155",
    fontWeight: "700",
  },
  assignmentListContent: {
    padding: 12,
    paddingBottom: 20,
    gap: 8,
  },
  assignmentItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assignmentItemCurrent: {
    borderColor: "#38bdf8",
    backgroundColor: "#e0f2fe",
  },
  assignmentItemDone: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  assignmentItemWrong: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  assignmentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  assignmentIndex: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  assignmentStatus: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "800",
  },
  assignmentTitle: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "800",
  },
  assignmentSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
});
