import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CourseUI, LessonNodeUI, HomeworkCountResult } from "@/types/course";
import { buildHomeworkCountsMap } from "@/lib/utils/course-structure";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";

interface CourseStructureContextValue {
  // Config
  classId: string;

  // Course data
  course: CourseUI;
  selectedNodeId: string | null;
  selectedNode: LessonNodeUI | null;

  // Tree UI states
  expandedNodeIds: Set<string>;

  // Homework counts (student)
  homeworkCountsMap: Map<string, HomeworkCountResult>;
  getHomeworkCounts: (nodeId: string) => HomeworkCountResult;

  // Loading states
  isLoading: boolean;

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  toggleNodeExpanded: (node: LessonNodeUI) => void;
  refetchHomeworkCounts: () => Promise<void>;
}

const CourseStructureContext = createContext<
  CourseStructureContextValue | undefined
>(undefined);

interface CourseStructureProviderProps {
  children: React.ReactNode;
  initialCourse: CourseUI;
  classId: string;
}

export const CourseStructureProvider: React.FC<
  CourseStructureProviderProps
> = ({ children, initialCourse, classId }) => {
  const [course] = useState<CourseUI>(initialCourse);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialCourse.rootLessonNodeId,
  );
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(
      initialCourse.rootLessonNodeId ? [initialCourse.rootLessonNodeId] : [],
    ),
  );
  const [homeworkCountsMap, setHomeworkCountsMap] = useState<
    Map<string, HomeworkCountResult>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const selectedNode: LessonNodeUI | null = selectedNodeId
    ? findNodeById(course.rootLessonNode, selectedNodeId)
    : null;

  function findNodeById(
    node: LessonNodeUI | null,
    id: string,
  ): LessonNodeUI | null {
    if (!node) return null;
    if (node.id === id) return node;

    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }

    return null;
  }

  // Load homework status for student
  const loadHomeworkCounts = useCallback(async () => {
    try {
      const { data: session } = await authClient.getSession();

      if (!session?.session.token) {
        throw new Error("No session token available");
      }
      if (!initialCourse.rootLessonNode) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/mobile/class/homework-status?classId=${classId}&courseId=${initialCourse.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session.token}`, // Gửi token
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const {
            assignedByLessonNode,
            submittedByLessonNode,
            correctByLessonNode,
          } = result.data;
          const countsMap = buildHomeworkCountsMap(
            initialCourse.rootLessonNode,
            assignedByLessonNode,
            submittedByLessonNode,
            correctByLessonNode || {},
          );
          setHomeworkCountsMap(countsMap);
        }
      }
    } catch (error) {
      console.error("Error loading homework counts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [classId, initialCourse.id, initialCourse.rootLessonNode]);

  useEffect(() => {
    loadHomeworkCounts();
  }, [loadHomeworkCounts]);

  const toggleNodeExpanded = useCallback((node: LessonNodeUI) => {
    setExpandedNodeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }
      return newSet;
    });
  }, []);

  const getHomeworkCounts = useCallback(
    (nodeId: string): HomeworkCountResult => {
      return (
        homeworkCountsMap.get(nodeId) || {
          totalAssigned: 0,
          pending: 0,
          correct: 0,
        }
      );
    },
    [homeworkCountsMap],
  );

  return (
    <CourseStructureContext.Provider
      value={{
        classId,
        course,
        selectedNodeId,
        selectedNode,
        expandedNodeIds,
        homeworkCountsMap,
        getHomeworkCounts,
        isLoading,
        setSelectedNodeId,
        toggleNodeExpanded,
        refetchHomeworkCounts: loadHomeworkCounts,
      }}
    >
      {children}
    </CourseStructureContext.Provider>
  );
};

export const useCourseStructure = () => {
  const context = useContext(CourseStructureContext);
  if (!context) {
    throw new Error(
      "useCourseStructure must be used within CourseStructureProvider",
    );
  }
  return context;
};
