import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";
import { ClassData, CourseUI, LessonNodeType } from "@/types/course";
import {
  buildTreeFromFlatList,
  findNodeById,
} from "@/lib/utils/course-structure";
import {
  CourseStructureProvider,
  useCourseStructure,
} from "@/components/providers/course-structure-provider";
import { AssignmentModal } from "@/components/AssignmentModal";

const LessonHomeworkContent: React.FC<{
  classId: string;
  lessonId: string;
  lessonTitle?: string;
}> = ({ classId, lessonId, lessonTitle }) => {
  const router = useRouter();
  const { isLoading, course, getHomeworkCounts, refetchHomeworkCounts } =
    useCourseStructure();

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(
    null,
  );

  useFocusEffect(
    React.useCallback(() => {
      refetchHomeworkCounts();
    }, [refetchHomeworkCounts]),
  );

  const lessonNode = useMemo(() => {
    if (!course.rootLessonNode || !lessonId) return null;
    const found = findNodeById(course.rootLessonNode, lessonId);
    if (!found || found.type !== LessonNodeType.lesson) return null;
    return found;
  }, [course.rootLessonNode, lessonId]);

  const homeworkNodes = useMemo(() => {
    if (!lessonNode) return [];
    return lessonNode.children.filter(
      (child) => child.type === LessonNodeType.homework,
    );
  }, [lessonNode]);

  const lessonCounts = lessonNode ? getHomeworkCounts(lessonNode.id) : null;
  const lessonDone = lessonCounts
    ? Math.max(0, lessonCounts.totalAssigned - lessonCounts.pending)
    : 0;

  const onPressHomework = (homeworkNodeId: string) => {
    setSelectedHomeworkId(homeworkNodeId);
    setShowAssignmentModal(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading homework...</Text>
      </View>
    );
  }

  if (!lessonNode) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Lesson not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerCard}>
        <Pressable
          style={({ pressed }) => [
            styles.backPill,
            pressed && styles.card3dPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.backPillText}>◀ Back</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.lessonTitle} numberOfLines={1}>
            {lessonNode.title || lessonTitle || "Lesson"}
          </Text>
          <Text style={styles.lessonStats}>
            {lessonDone}/{lessonCounts?.totalAssigned || 0}
          </Text>
        </View>
      </View>

      {homeworkNodes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No homework yet</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {homeworkNodes.map((hw) => {
            const counts = getHomeworkCounts(hw.id);
            const done = Math.max(0, counts.totalAssigned - counts.pending);
            const hasAssignments = counts.totalAssigned > 0;

            return (
              <Pressable
                key={hw.id}
                style={({ pressed }) => [
                  styles.homeworkCard,
                  !hasAssignments && styles.homeworkCardDisabled,
                  hasAssignments && pressed && styles.card3dPressed,
                ]}
                onPress={() => hasAssignments && onPressHomework(hw.id)}
                disabled={!hasAssignments}
              >
                <Text style={styles.homeworkCardTitle} numberOfLines={2}>
                  {hw.title}
                </Text>
                <Text style={styles.homeworkCardStats}>
                  {done}/{counts.totalAssigned}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selectedHomeworkId ? (
        <AssignmentModal
          visible={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          homeworkNodeId={selectedHomeworkId}
          classId={classId}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default function LessonHomeworkScreen() {
  const { classId, lessonId, lessonTitle } = useLocalSearchParams<{
    classId: string;
    lessonId: string;
    lessonTitle?: string;
  }>();

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
        <Text style={styles.loadingText}>Loading lesson...</Text>
      </View>
    );
  }

  if (error || !classData || !courseUI || !classId || !lessonId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>
          {error || "Failed to load lesson"}
        </Text>
      </View>
    );
  }

  return (
    <CourseStructureProvider initialCourse={courseUI} classId={classId}>
      <LessonHomeworkContent
        classId={classId}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
      />
    </CourseStructureProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fef9c3",
  },
  headerCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#854d0e",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 10,
  },
  backPill: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fde68a",
    borderWidth: 2,
    borderColor: "#854d0e",
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 5,
  },
  backPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  headerTextWrap: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  lessonStats: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#fde68a",
    color: "#78350f",
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#854d0e",
  },
  cardsRow: {
    paddingHorizontal: 12,
    paddingBottom: 18,
    gap: 10,
  },
  homeworkCard: {
    width: 260,
    minHeight: 160,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#854d0e",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    shadowColor: "#854d0e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 10,
  },
  homeworkCardDisabled: {
    borderColor: "#d6d3d1",
    backgroundColor: "#f5f5f4",
    shadowOpacity: 0.06,
  },
  homeworkCardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  homeworkCardStats: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#fde68a",
    color: "#78350f",
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#854d0e",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#475569",
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
    backgroundColor: "#fef9c3",
    padding: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9a3412",
    textAlign: "center",
  },
  backButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 4,
  },
});
