import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { API_BASE_URL } from "@/lib/config/api";
import {
  ClassData,
  CourseUI,
  LessonNodeUI,
  LessonNodeType,
} from "@/types/course";
import { buildTreeFromFlatList } from "@/lib/utils/course-structure";
import {
  CourseStructureProvider,
  useCourseStructure,
} from "@/components/providers/course-structure-provider";
import { authClient } from "@/lib/auth-client";
import { AssignmentModal } from "@/components/AssignmentModal";

interface TreeNodeProps {
  node: LessonNodeUI;
  level: number;
  isExpanded: boolean;
  onToggleExpand: (node: LessonNodeUI) => void;
  onSelectNode: (nodeId: string | null) => void;
  isSelected: boolean;
  homeworkCounts?: { totalAssigned: number; pending: number; correct: number };
  showStats?: boolean;
}

function getNodeTypeLabel(type: LessonNodeType | string) {
  if (type === LessonNodeType.course) return "Course";
  if (type === LessonNodeType.module) return "Module";
  if (type === LessonNodeType.lesson) return "Lesson";
  return "Node";
}

function getNodeIcon(type: LessonNodeType | string) {
  if (type === LessonNodeType.course) return "📚";
  if (type === LessonNodeType.module) return "📦";
  if (type === LessonNodeType.lesson) return "📝";
  return "📘";
}

function getStatsBadge(
  correct: number,
  total: number,
): {
  label: string;
  bgColor: string;
  textColor: string;
} | null {
  if (total === 0) return null;
  const ratio = correct / total;

  if (ratio >= 0.7) {
    return {
      label: `${correct}/${total}`,
      bgColor: "#dcfce7",
      textColor: "#166534",
    };
  }

  if (ratio >= 0.4) {
    return {
      label: `${correct}/${total}`,
      bgColor: "#fef3c7",
      textColor: "#92400e",
    };
  }

  return {
    label: `${correct}/${total}`,
    bgColor: "#fee2e2",
    textColor: "#991b1b",
  };
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  isExpanded,
  onToggleExpand,
  onSelectNode,
  isSelected,
  homeworkCounts,
  showStats = false,
}) => {
  if (node.type === LessonNodeType.homework) return null;

  const hasChildren = node._count.children > 0;
  const canExpand = hasChildren && node.type !== LessonNodeType.lesson;
  const leftPadding = 12 + level * 16;

  const handlePress = () => {
    onSelectNode(node.id);
    if (canExpand) {
      onToggleExpand(node);
    }
  };

  const statsBadge =
    showStats && homeworkCounts
      ? getStatsBadge(homeworkCounts.correct, homeworkCounts.totalAssigned)
      : null;

  return (
    <View style={styles.treeNodeWrap}>
      <Pressable
        style={[
          styles.treeNode,
          {
            marginLeft: leftPadding,
          },
          isSelected && styles.treeNodeSelected,
        ]}
        onPress={handlePress}
      >
        <View style={styles.treeNodeRow}>
          <View style={styles.treeNodeMainInfo}>
            <Text style={styles.nodeChevron}>
              {canExpand ? (isExpanded ? "▼" : "▶") : "•"}
            </Text>
            <Text style={styles.nodeIcon}>{getNodeIcon(node.type)}</Text>
            <View style={styles.nodeTextGroup}>
              <Text style={styles.nodeTitle}>{node.title}</Text>
              <Text style={styles.nodeTypeLabel}>
                {getNodeTypeLabel(node.type)}
              </Text>
            </View>
          </View>

          {homeworkCounts && homeworkCounts.totalAssigned > 0 ? (
            showStats ? (
              statsBadge ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: statsBadge.bgColor },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: statsBadge.textColor }]}
                  >
                    {statsBadge.label}
                  </Text>
                </View>
              ) : null
            ) : (
              <View
                style={[
                  styles.badge,
                  homeworkCounts.pending > 0
                    ? styles.badgePending
                    : styles.badgeCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    homeworkCounts.pending > 0
                      ? styles.badgePendingText
                      : styles.badgeCompletedText,
                  ]}
                >
                  {homeworkCounts.pending > 0
                    ? `${homeworkCounts.pending}`
                    : "✓"}
                </Text>
              </View>
            )
          ) : null}
        </View>
      </Pressable>

      {isExpanded && node.children.length > 0 ? (
        <View>
          {node.children.map((child) => (
            <TreeNodeRenderer
              key={child.id}
              node={child}
              level={level + 1}
              showStats={showStats}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const TreeNodeRenderer: React.FC<{
  node: LessonNodeUI;
  level: number;
  showStats?: boolean;
}> = ({ node, level, showStats = false }) => {
  const {
    selectedNodeId,
    expandedNodeIds,
    setSelectedNodeId,
    toggleNodeExpanded,
    getHomeworkCounts,
  } = useCourseStructure();

  return (
    <TreeNode
      node={node}
      level={level}
      isExpanded={expandedNodeIds.has(node.id)}
      onToggleExpand={toggleNodeExpanded}
      onSelectNode={setSelectedNodeId}
      isSelected={selectedNodeId === node.id}
      homeworkCounts={getHomeworkCounts(node.id)}
      showStats={showStats}
    />
  );
};

const DetailPanel: React.FC<{ classId: string; showStats?: boolean }> = ({
  classId,
  showStats = false,
}) => {
  const { selectedNode, getHomeworkCounts } = useCourseStructure();
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(
    null,
  );

  if (!selectedNode) {
    return (
      <View style={styles.detailPlaceholder}>
        <Text style={styles.detailPlaceholderTitle}>Pick a lesson</Text>
        <Text style={styles.detailPlaceholderText}>
          Tap a card above to see details and assignments.
        </Text>
      </View>
    );
  }

  const homeworkNodes =
    selectedNode.type === LessonNodeType.lesson
      ? selectedNode.children.filter(
          (child) => child.type === LessonNodeType.homework,
        )
      : [];

  const handleHomeworkPress = (homeworkId: string) => {
    setSelectedHomeworkId(homeworkId);
    setShowAssignmentModal(true);
  };

  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeaderRow}>
        <View style={styles.typeTag}>
          <Text style={styles.typeTagText}>
            {getNodeTypeLabel(selectedNode.type)}
          </Text>
        </View>
        <Text style={styles.detailEmoji}>{getNodeIcon(selectedNode.type)}</Text>
      </View>

      <Text style={styles.detailTitle}>{selectedNode.title}</Text>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.sectionText}>
          {(selectedNode.content as { description?: string })?.description ||
            "No description yet."}
        </Text>
      </View>

      {selectedNode.type === LessonNodeType.lesson ? (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>
            Homework ({homeworkNodes.length})
          </Text>
          {homeworkNodes.length === 0 ? (
            <Text style={styles.emptyText}>
              No homework for this lesson yet.
            </Text>
          ) : (
            <View style={styles.homeworkList}>
              {homeworkNodes.map((hw) => {
                const counts = getHomeworkCounts(hw.id);
                const hasAssignments = counts.totalAssigned > 0;
                const hasPending = counts.pending > 0;
                const stats = getStatsBadge(
                  counts.correct,
                  counts.totalAssigned,
                );

                return (
                  <Pressable
                    key={hw.id}
                    style={[
                      styles.homeworkCard,
                      !hasAssignments && styles.homeworkCardDisabled,
                    ]}
                    onPress={() => hasAssignments && handleHomeworkPress(hw.id)}
                    disabled={!hasAssignments}
                  >
                    <View style={styles.homeworkTopRow}>
                      <Text
                        style={[
                          styles.homeworkTitle,
                          !hasAssignments && styles.homeworkMuted,
                        ]}
                      >
                        📋 {hw.title}
                      </Text>

                      {hasAssignments ? (
                        showStats ? (
                          stats ? (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: stats.bgColor },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.badgeText,
                                  { color: stats.textColor },
                                ]}
                              >
                                {stats.label}
                              </Text>
                            </View>
                          ) : null
                        ) : (
                          <View
                            style={[
                              styles.badge,
                              hasPending
                                ? styles.badgePending
                                : styles.badgeCompleted,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                hasPending
                                  ? styles.badgePendingText
                                  : styles.badgeCompletedText,
                              ]}
                            >
                              {hasPending ? `${counts.pending}` : "✓"}
                            </Text>
                          </View>
                        )
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.homeworkSubtitle,
                        !hasAssignments && styles.homeworkMuted,
                      ]}
                    >
                      {hasAssignments
                        ? `${counts.totalAssigned} assignment${counts.totalAssigned > 1 ? "s" : ""} · ${counts.pending} pending`
                        : "No assignments yet"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {selectedHomeworkId ? (
        <AssignmentModal
          visible={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          homeworkNodeId={selectedHomeworkId}
          classId={classId}
        />
      ) : null}
    </View>
  );
};

const DoAllHomeworkButton: React.FC<{ classId: string }> = ({ classId }) => {
  const router = useRouter();
  const { homeworkCountsMap, course } = useCourseStructure();

  const rootCounts = course.rootLessonNodeId
    ? homeworkCountsMap.get(course.rootLessonNodeId)
    : null;
  const totalPending = rootCounts?.pending || 0;

  if (totalPending === 0) {
    return (
      <View style={styles.doAllButtonDone}>
        <Text style={styles.doAllButtonDoneText}>🎉 All homework done</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.doAllButton}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/do-all-homework",
          params: { classId },
        })
      }
    >
      <Text style={styles.doAllButtonText}>
        ▶ Do all homework ({totalPending})
      </Text>
    </Pressable>
  );
};

const ClassDetailContent: React.FC<{
  classData: ClassData;
}> = ({ classData }) => {
  const { isLoading, course, homeworkCountsMap, refetchHomeworkCounts } =
    useCourseStructure();
  const [showStats, setShowStats] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refetchHomeworkCounts();
    }, [refetchHomeworkCounts]),
  );

  const rootCounts = course.rootLessonNodeId
    ? homeworkCountsMap.get(course.rootLessonNodeId)
    : null;
  const totalAssigned = rootCounts?.totalAssigned || 0;
  const totalCorrect = rootCounts?.correct || 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading course structure...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.horizontalLayout}>
        <View style={styles.leftPane}>
          <View style={styles.heroCard}>
            <Text style={styles.className}>{classData.name}</Text>
            <Text style={styles.courseName}>Course: {course.name}</Text>

            {totalAssigned > 0 ? (
              <View style={styles.heroActionsRow}>
                <View style={styles.heroActionItem}>
                  <DoAllHomeworkButton classId={classData.id} />
                </View>

                <Pressable
                  style={[
                    styles.statsToggleButton,
                    styles.heroActionItem,
                    showStats && styles.statsToggleButtonActive,
                  ]}
                  onPress={() => setShowStats((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.statsToggleText,
                      showStats && styles.statsToggleTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {showStats
                      ? `📊 ${totalCorrect}/${totalAssigned}`
                      : "📊 Stats"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <DoAllHomeworkButton classId={classData.id} />
            )}
          </View>

          <View style={[styles.panelCard, styles.treePanelCard]}>
            <Text style={styles.panelTitle}>Course map</Text>
            <Text style={styles.panelSubtitle}>
              Tap a card to select and open it.
            </Text>

            <ScrollView contentContainerStyle={styles.treeScrollContent}>
              {course.rootLessonNode ? (
                <TreeNodeRenderer
                  node={course.rootLessonNode}
                  level={0}
                  showStats={showStats}
                />
              ) : (
                <Text style={styles.emptyText}>No course structure yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>

        <View style={styles.rightPane}>
          <View style={[styles.panelCard, styles.detailPanelCard]}>
            <Text style={styles.panelTitle}>Lesson details</Text>
            <ScrollView contentContainerStyle={styles.detailScrollContent}>
              <DetailPanel classId={classData.id} showStats={showStats} />
            </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [courseUI, setCourseUI] = useState<CourseUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClassData = async () => {
      try {
        const { data: session } = await authClient.getSession();

        if (!session?.session.token) {
          throw new Error("No session token available");
        }

        if (!classId) {
          setError("No class ID provided");
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/mobile/class?classId=${classId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch class");
        }

        const result = await response.json();
        if (result.success && result.data) {
          const { classData, nodes } = result.data;
          const rootNode = buildTreeFromFlatList(nodes);

          const nextCourseUI: CourseUI = {
            id: classData.course.id,
            name: classData.course.name,
            organizationId: "",
            rootLessonNodeId: classData.course.rootLessonNodeId,
            rootLessonNode: rootNode,
            course: classData.course,
          };

          setClassData(classData);
          setCourseUI(nextCourseUI);
        } else {
          setError(result.error || "Failed to load class");
        }
      } catch (err) {
        console.error("Error fetching class:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [classId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading class...</Text>
      </View>
    );
  }

  if (error || !classData || !courseUI) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Could not open class</Text>
        <Text style={styles.errorText}>{error || "Failed to load class"}</Text>
      </View>
    );
  }

  return (
    <CourseStructureProvider initialCourse={courseUI} classId={classId}>
      <ClassDetailContent classData={classData} />
    </CourseStructureProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0fdfa",
  },
  horizontalLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  leftPane: {
    width: "42%",
    gap: 10,
  },
  rightPane: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  heroActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroActionItem: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  courseName: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
    marginBottom: 8,
  },
  doAllButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  doAllButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  doAllButtonDone: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  doAllButtonDoneText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#166534",
  },
  statsToggleButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
  },
  statsToggleButtonActive: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  statsToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  statsToggleTextActive: {
    color: "#92400e",
  },
  panelCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#bae6fd",
    padding: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  treePanelCard: {
    flex: 1,
  },
  detailPanelCard: {
    flex: 1,
  },
  treeScrollContent: {
    paddingBottom: 12,
  },
  detailScrollContent: {
    paddingBottom: 16,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  panelSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 10,
  },
  treeNodeWrap: {
    marginBottom: 8,
  },
  treeNode: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 2,
  },
  treeNodeSelected: {
    backgroundColor: "#e0f2fe",
    borderColor: "#38bdf8",
  },
  treeNodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  treeNodeMainInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nodeChevron: {
    fontSize: 14,
    width: 18,
    color: "#334155",
    textAlign: "center",
  },
  nodeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  nodeTextGroup: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  nodeTypeLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  badge: {
    minWidth: 34,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePending: {
    backgroundColor: "#fee2e2",
  },
  badgeCompleted: {
    backgroundColor: "#dcfce7",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  badgePendingText: {
    color: "#991b1b",
  },
  badgeCompletedText: {
    color: "#166534",
  },
  detailPanel: {
    marginTop: 2,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailEmoji: {
    fontSize: 24,
  },
  typeTag: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 8,
  },
  sectionWrap: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 24,
  },
  homeworkList: {
    gap: 8,
  },
  homeworkCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  homeworkCardDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  homeworkTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  homeworkTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400e",
    flex: 1,
  },
  homeworkSubtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#b45309",
  },
  homeworkMuted: {
    color: "#94a3b8",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  detailPlaceholder: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 14,
    marginTop: 8,
  },
  detailPlaceholderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 4,
  },
  detailPlaceholderText: {
    fontSize: 14,
    color: "#64748b",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "700",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    padding: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 15,
    color: "#c2410c",
    textAlign: "center",
  },
});
