import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";
import { useTranslation } from "react-i18next";

export interface Assignment {
  id: string;
  title: string;
  description: string;
  hasSubmitted: boolean;
  submittedAt: string | null;
  evaluation?: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  } | null;
  content: any;
}

interface AssignmentModalProps {
  visible: boolean;
  homeworkNodeId: string;
  classId: string;
  onClose: () => void;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  visible,
  homeworkNodeId,
  classId,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const { data: session } = await authClient.getSession();

      if (!session?.session.token) {
        throw new Error(t("assignmentModal.noSessionToken"));
      }
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/mobile/homework/assignments?classId=${classId}&homeworkNodeId=${homeworkNodeId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session.token}`, // Gửi token
          },
        },
      );

      if (!response.ok) {
        throw new Error(t("assignmentModal.fetchFailed"));
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setAssignments(result.data);
      } else {
        setError(result.error || t("assignmentModal.loadFailed"));
      }
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setError(
        err instanceof Error ? err.message : t("assignmentModal.unknownError"),
      );
    } finally {
      setLoading(false);
    }
  }, [classId, homeworkNodeId, t]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setAssignments([]);
      setError(null);
      fetchAssignments();
    }
  }, [visible, fetchAssignments]);

  const handleAssignmentPress = (assignmentId: string) => {
    onClose();
    router.push({
      pathname: "/(tabs)/assignment-detail",
      params: { assignmentId },
    });
  };

  const renderAssignmentItem = ({ item }: { item: Assignment }) => {
    const isPending = !item.hasSubmitted;
    const statusColor = isPending ? "#fef3c7" : "#dcfce7";
    const borderColor = isPending ? "#fcd34d" : "#86efac";
    const statusText = isPending
      ? t("assignmentModal.statusPending")
      : t("assignmentModal.statusCompleted");
    const statusBgColor = isPending ? "#fbbf24" : "#22c55e";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.assignmentItem,
          {
            borderLeftColor: borderColor,
            backgroundColor: statusColor,
          },
          pressed && styles.card3dPressed,
        ]}
        onPress={() => handleAssignmentPress(item.id)}
      >
        <View style={styles.assignmentHeader}>
          <View style={styles.assignmentTitleContainer}>
            <Text style={styles.assignmentTitle}>{item.title}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusBgColor,
                },
              ]}
            >
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.assignmentDescription}>{item.description}</Text>
        )}

        {/* Evaluation display */}
        {item.hasSubmitted && item.evaluation && (
          <View style={styles.evaluationContainer}>
            <View style={styles.evaluationRow}>
              <Text style={styles.evaluationLabel}>
                {t("assignmentModal.result")}
              </Text>
              <Text
                style={[
                  styles.evaluationValue,
                  {
                    color: item.evaluation.isCorrect ? "#22c55e" : "#ef4444",
                  },
                ]}
              >
                {item.evaluation.isCorrect
                  ? t("assignmentModal.correct")
                  : t("assignmentModal.incorrect")}
              </Text>
            </View>
            <View style={styles.evaluationRow}>
              <Text style={styles.evaluationLabel}>
                {t("assignmentModal.score")}
              </Text>
              <Text style={styles.evaluationValue}>
                {item.evaluation.score}/{item.evaluation.maxScore}
              </Text>
            </View>
          </View>
        )}

        {/* Submitted date */}
        {item.hasSubmitted && item.submittedAt && (
          <Text style={styles.submittedDate}>
            {t("assignmentModal.submittedAt", {
              date: new Date(item.submittedAt).toLocaleDateString(
                i18n.language.startsWith("vi") ? "vi-VN" : "en-US",
              ),
            })}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("assignmentModal.title")}</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>
                {t("assignmentModal.loading")}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.card3dPressed,
                ]}
                onPress={fetchAssignments}
              >
                <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
              </Pressable>
            </View>
          ) : assignments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>{t("assignmentModal.empty")}</Text>
            </View>
          ) : (
            <FlatList
              data={assignments}
              renderItem={renderAssignmentItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              scrollEnabled={true}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 35, 20, 0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "80%",
    paddingTop: 16,
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#fde68a",
    borderWidth: 1.5,
    borderColor: "#92400e",
    shadowColor: "#92400e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#334155",
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
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
  retryButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
  },
  listContent: {
    padding: 12,
    paddingBottom: 22,
  },
  assignmentItem: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderWidth: 2,
    borderColor: "#0f172a",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 6,
  },
  assignmentHeader: {
    marginBottom: 8,
  },
  assignmentTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  assignmentTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "white",
  },
  assignmentDescription: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 8,
    lineHeight: 21,
  },
  evaluationContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  evaluationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  evaluationLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  evaluationValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  submittedDate: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
  },
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 3,
  },
});
