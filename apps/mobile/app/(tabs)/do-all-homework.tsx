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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        setError(t("doAll.noClassId"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: session } = await authClient.getSession();
        if (!session?.session.token) {
          throw new Error(t("doAll.noSessionToken"));
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
          throw new Error(errorData.error || t("doAll.loadAssignmentsFailed"));
        }

        const result = await response.json();

        if (result.success && result.data) {
          const assignments: PendingAssignment[] = result.data;
          setPendingWhenOpened(assignments);

          if (assignments.length > 0) {
            setCurrentAssignmentId(assignments[0].assignmentId);
          }
        } else {
          throw new Error(result.error || t("doAll.loadAssignmentsFailed"));
        }
      } catch (err) {
        console.error("Load pending assignments error:", err);
        setError(err instanceof Error ? err.message : t("doAll.unknownError"));
      } finally {
        setLoading(false);
      }
    };

    loadPendingAssignments();
  }, [classId, t]);

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
          <Text style={styles.loadingText}>{t("doAll.preparing")}</Text>
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
            <Text style={styles.backButtonText}>{t("common.goBack")}</Text>
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
          <Text style={styles.successTitle}>
            {t("doAll.nothingPendingTitle")}
          </Text>
          <Text style={styles.successText}>
            {t("doAll.nothingPendingDescription")}
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("doAll.backToClass")}</Text>
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
          <Text style={styles.successTitle}>{t("doAll.awesomeWork")}</Text>
          <Text style={styles.successText}>
            {t("doAll.allDoneDescription", {
              count: displayedAssignments.length,
            })}
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("common.done")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          style={({ pressed }) => [
            styles.progressBarButton,
            pressed && styles.card3dPressed,
          ]}
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
              <Text style={styles.emptyText}>
                {t("doAll.noAssignmentSelected")}
              </Text>
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
              <Text style={styles.modalTitle}>{t("doAll.assignments")}</Text>
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
                    style={({ pressed }) => [
                      styles.assignmentItem,
                      isCurrent && styles.assignmentItemCurrent,
                      item.isCompleted &&
                        (isCorrect === false
                          ? styles.assignmentItemWrong
                          : styles.assignmentItemDone),
                      pressed && styles.card3dPressed,
                    ]}
                    onPress={() => selectAssignment(item.assignmentId)}
                  >
                    <View style={styles.assignmentTopRow}>
                      <Text style={styles.assignmentIndex}>#{item.index}</Text>
                      <Text style={styles.assignmentStatus}>
                        {item.isCompleted
                          ? isCorrect === false
                            ? t("doAll.statusTryAgain")
                            : t("doAll.statusDone")
                          : t("doAll.statusPending")}
                      </Text>
                    </View>
                    <Text style={styles.assignmentTitle} numberOfLines={1}>
                      {item.title ||
                        t("doAll.defaultAssignmentTitle", {
                          index: item.index,
                        })}
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
    backgroundColor: "#fefce8",
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
    backgroundColor: "#fefce8",
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
    borderWidth: 2,
    borderColor: "#042f2e",
    shadowColor: "#042f2e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  progressBarButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#854d0e",
    backgroundColor: "#ffffff",
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 8,
  },
  progressTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "#fde68a",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#92400e",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e",
  },
  widgetWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#854d0e",
    backgroundColor: "#ffffff",
    minHeight: 320,
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 10,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    borderWidth: 2,
    borderColor: "#854d0e",
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
    backgroundColor: "#fde68a",
    borderWidth: 1.5,
    borderColor: "#854d0e",
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#854d0e",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 6,
  },
  assignmentItemCurrent: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfeff",
  },
  assignmentItemDone: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  assignmentItemWrong: {
    borderColor: "#dc2626",
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
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 3,
  },
});
