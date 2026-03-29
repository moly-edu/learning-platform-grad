import { authClient } from "@/lib/auth-client";
import { API_BASE_URL } from "@/lib/config/api";
import { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Settings, BookOpen, Users, ClipboardList } from "lucide-react-native";

interface ClassData {
  id: string;
  name: string;
  createdAt: string;
  course?: {
    id: string;
    name: string;
  };
  _count?: {
    members: number;
  };
}

interface PendingAssignments {
  [classId: string]: number;
}

export default function IndexTab() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAssignments, setPendingAssignments] =
    useState<PendingAssignments>({});

  const fetchPendingAssignments = useCallback(
    async (classesData: ClassData[], token: string) => {
      try {
        const pendingMap: PendingAssignments = {};

        // Fetch pending assignments cho mỗi class
        for (const classItem of classesData) {
          if (!classItem.course) continue; // Bỏ qua nếu không có course
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/mobile/class/homework-status?classId=${classItem.id}&courseId=${classItem.course.id}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                const { assignedByLessonNode, submittedByLessonNode } =
                  result.data;

                // Calculate total pending
                let totalAssigned = 0;
                let totalSubmitted = 0;

                Object.values(assignedByLessonNode || {}).forEach(
                  (count: any) => {
                    totalAssigned += count;
                  },
                );

                Object.values(submittedByLessonNode || {}).forEach(
                  (count: any) => {
                    totalSubmitted += count;
                  },
                );

                pendingMap[classItem.id] = totalAssigned - totalSubmitted;
              }
            }
          } catch (error) {
            console.error(
              `Error fetching pending for class ${classItem.id}:`,
              error,
            );
          }
        }

        setPendingAssignments(pendingMap);
      } catch (error) {
        console.error("Error fetching pending assignments:", error);
      }
    },
    [],
  );

  const fetchClasses = useCallback(async () => {
    try {
      // Lấy session token từ better-auth
      const { data: session } = await authClient.getSession();

      if (!session?.session.token) {
        throw new Error("No session token available");
      }

      const response = await fetch(`${API_BASE_URL}/api/mobile/classes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session.token}`, // Gửi token
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch classes");
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setClasses(result.data);
        // Fetch pending assignments after getting classes
        await fetchPendingAssignments(result.data, session?.session.token);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPendingAssignments]);

  useEffect(() => {
    if (!isPending && session?.user) {
      fetchClasses();
    }
  }, [session, isPending, fetchClasses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClasses();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.loadingText}>Loading your classes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderClassItem = ({ item }: { item: ClassData }) => {
    const pending = pendingAssignments[item.id] || 0;
    const hasPending = pending > 0;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.classCard,
          styles.card3d,
          pressed && styles.card3dPressed,
        ]}
        onPress={() =>
          router.push({
            pathname: "/(tabs)/class-detail",
            params: { classId: item.id },
          })
        }
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardIconWrap}>
            <BookOpen size={22} color="#0f766e" />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.className}>{item.name}</Text>
            {item.course && (
              <Text style={styles.courseName} numberOfLines={1}>
                {item.course.name}
              </Text>
            )}
          </View>
          {pending >= 0 && (
            <View
              style={[
                styles.pendingBadge,
                hasPending
                  ? styles.pendingBadgeDanger
                  : styles.pendingBadgeGood,
              ]}
            >
              <Text style={styles.pendingBadgeText}>
                {hasPending ? `${pending} to do` : "Done"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.infoPill}>
            <Users size={14} color="#475569" />
            <Text style={styles.infoPillText}>
              {item._count?.members || 0} friends
            </Text>
          </View>
          <View style={styles.infoPill}>
            <ClipboardList size={14} color="#475569" />
            <Text style={styles.infoPillText}>
              {hasPending ? "Need practice" : "Great progress"}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hi learner!</Text>
            <Text style={styles.subtitle}>Pick a class and keep going.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.settingsButton,
              styles.card3dMini,
              pressed && styles.card3dPressed,
            ]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Settings size={20} color="#0f172a" />
          </Pressable>
        </View>

        {classes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No classes yet</Text>
            <Text style={styles.centerText}>
              Ask your teacher to add you to a class.
            </Text>
          </View>
        ) : (
          <FlatList
            data={classes}
            renderItem={renderClassItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ecfeff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 17,
    color: "#0f766e",
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  greeting: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
    marginTop: 4,
  },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#0f172a",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  centerText: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
  },
  classCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTextWrap: {
    flex: 1,
  },
  className: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 3,
    color: "#0f172a",
  },
  courseName: {
    fontSize: 14,
    color: "#475569",
  },
  pendingBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 68,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0f172a",
  },
  pendingBadgeDanger: {
    backgroundColor: "#fee2e2",
  },
  pendingBadgeGood: {
    backgroundColor: "#dcfce7",
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1f2937",
  },
  cardBottomRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoPillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },
  card3d: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  card3dMini: {
    borderWidth: 2,
    borderColor: "#0f172a",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 6,
  },
  card3dPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.08,
    elevation: 3,
  },
});
