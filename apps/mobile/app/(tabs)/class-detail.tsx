import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "@/lib/config/api";
import {
  ClassData,
  CourseUI,
  LessonNodeType,
  LessonNodeUI,
} from "@/types/course";
import { buildTreeFromFlatList } from "@/lib/utils/course-structure";
import {
  CourseStructureProvider,
  useCourseStructure,
} from "@/components/providers/course-structure-provider";
import { authClient } from "@/lib/auth-client";

const LESSON_COLORS = ["#4ECDC4", "#FF6B6B", "#FFD166", "#118AB2"];

function collectLessonNodes(root: LessonNodeUI | null): LessonNodeUI[] {
  if (!root) return [];

  const lessons: LessonNodeUI[] = [];

  const traverse = (node: LessonNodeUI) => {
    if (node.type === LessonNodeType.lesson) {
      lessons.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(root);
  return lessons;
}

const DoAllHomeworkButton: React.FC<{ classId: string }> = ({ classId }) => {
  const router = useRouter();
  const { homeworkCountsMap, course } = useCourseStructure();

  const rootCounts = course.rootLessonNodeId
    ? homeworkCountsMap.get(course.rootLessonNodeId)
    : null;
  const totalPending = rootCounts?.pending || 0;

  if (totalPending === 0) {
    return (
      <View style={[styles.card3d, styles.playButtonDone]}>
        <Text style={styles.playButtonDoneText}>ALL DONE</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(tabs)/do-all-homework",
          params: { classId },
        })
      }
      style={({ pressed }) => [
        styles.card3d,
        styles.playButton,
        pressed && styles.card3dPressed,
      ]}
    >
      <Text style={styles.playButtonText}>PLAY NOW ({totalPending})</Text>
    </Pressable>
  );
};

const ClassDetailContent: React.FC<{
  classData: ClassData;
}> = ({ classData }) => {
  const router = useRouter();
  const { isLoading, course, getHomeworkCounts, refetchHomeworkCounts } =
    useCourseStructure();

  useFocusEffect(
    React.useCallback(() => {
      refetchHomeworkCounts();
    }, [refetchHomeworkCounts]),
  );

  const lessons = useMemo(
    () => collectLessonNodes(course.rootLessonNode),
    [course.rootLessonNode],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading lessons...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerWrap}>
        <View style={[styles.card3d, styles.headerCard]}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.className}>{classData.name.toUpperCase()}</Text>
            <Text style={styles.courseName}>{course.name}</Text>
          </View>
          <DoAllHomeworkButton classId={classData.id} />
        </View>
      </View>

      <View style={styles.timelineWrap}>
        <View style={styles.timelinePath} />

        <ScrollView
          contentContainerStyle={styles.timelineContent}
          showsVerticalScrollIndicator={false}
        >
          {lessons.length === 0 ? (
            <View style={[styles.card3d, styles.emptyCard]}>
              <Text style={styles.emptyTitle}>NO LESSONS YET</Text>
              <Text style={styles.emptyText}>
                Ask your teacher to add lessons.
              </Text>
            </View>
          ) : (
            lessons.map((lesson, index) => {
              const stats = getHomeworkCounts(lesson.id);
              const done = Math.max(0, stats.totalAssigned - stats.pending);
              const isPerfect =
                stats.totalAssigned > 0 && done === stats.totalAssigned;
              const alignLeft = index % 2 === 0;
              const cardColor = LESSON_COLORS[index % LESSON_COLORS.length];

              return (
                <View key={lesson.id} style={styles.timelineRow}>
                  <View
                    style={[styles.nodeCenter, isPerfect && styles.nodePerfect]}
                  >
                    <Text
                      style={[
                        styles.nodeCenterText,
                        isPerfect && styles.nodePerfectText,
                      ]}
                    >
                      {isPerfect ? "🏆" : index + 1}
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.card3d,
                      styles.lessonCard,
                      alignLeft ? styles.leftCard : styles.rightCard,
                      { backgroundColor: cardColor },
                      pressed && styles.card3dPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/lesson-homework",
                        params: {
                          classId: classData.id,
                          lessonId: lesson.id,
                          lessonTitle: lesson.title,
                        },
                      })
                    }
                  >
                    <View style={styles.lessonTopRow}>
                      <Text style={styles.lessonTitle} numberOfLines={2}>
                        {lesson.title}
                      </Text>

                      <View style={styles.statsBadge}>
                        <Text style={styles.statsText}>
                          ⭐ {done}/{stats.totalAssigned}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })
          )}

          <View style={styles.finishWrap}>
            <View style={[styles.card3d, styles.finishBox]}>
              <Text style={styles.finishEmoji}>👑</Text>
            </View>
            <Text style={styles.finishText}>FINISH</Text>
          </View>
        </ScrollView>
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
    backgroundColor: "#F0FDF4",
  },
  headerWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  card3d: {
    borderWidth: 3,
    borderColor: "#1E293B",
    borderBottomWidth: 8,
  },
  card3dPressed: {
    transform: [{ translateY: 4 }],
    borderBottomWidth: 4,
  },
  headerCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
  },
  courseName: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  playButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B6B",
  },
  playButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  playButtonDone: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF08A",
  },
  playButtonDoneText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#B45309",
  },
  timelineWrap: {
    flex: 1,
    marginTop: 8,
  },
  timelinePath: {
    position: "absolute",
    left: "50%",
    top: 14,
    bottom: 76,
    borderLeftWidth: 4,
    borderLeftColor: "#CBD5E1",
    borderStyle: "dashed",
    zIndex: 0,
  },
  timelineContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
    gap: 16,
  },
  timelineRow: {
    position: "relative",
    minHeight: 108,
    justifyContent: "center",
  },
  nodeCenter: {
    position: "absolute",
    left: "50%",
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#1E293B",
    borderBottomWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  nodePerfect: {
    backgroundColor: "#FEF08A",
    borderColor: "#B45309",
  },
  nodeCenterText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
  },
  nodePerfectText: {
    color: "#B45309",
    fontSize: 16,
  },
  lessonCard: {
    width: "42%",
    minHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "flex-start",
    zIndex: 5,
  },
  lessonTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  leftCard: {
    alignSelf: "flex-start",
    marginLeft: "5%",
  },
  rightCard: {
    alignSelf: "flex-end",
    marginRight: "5%",
  },
  lessonTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  statsBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statsText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  finishWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  finishBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: "#A855F7",
    alignItems: "center",
    justifyContent: "center",
  },
  finishEmoji: {
    fontSize: 36,
  },
  finishText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "900",
    color: "#9333EA",
    letterSpacing: 2,
  },
  emptyCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#334155",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
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
