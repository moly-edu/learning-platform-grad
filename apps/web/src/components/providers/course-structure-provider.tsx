import React, {
  createContext,
  useContext,
  useState,
  useTransition,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import {
  AddNodeInputType,
  CourseUI,
  LessonNodeContent,
  LessonNodeType,
  LessonNodeUI,
} from "@/types/course";
import { api } from "@/lib/api-client";
import {
  transformToUINode,
  findNodeById,
  updateNodeInTree,
  removeNodeFromTree,
  addChildToNode,
  moveNodeInTree,
} from "@/components/course-structure/utils/course-structure-utiles";
import {
  buildHomeworkCountsMap,
  HomeworkCountResult,
} from "../course-structure/utils/homework-count-utils";

// ===== TYPES =====
export interface ClassStudentInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface AssignmentEvaluation {
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

interface StudentSubmissionStatus {
  hasSubmitted: boolean;
  submittedAt: string | null;
  attemptCount: number;
  correctAttemptCount: number;
  evaluation?: AssignmentEvaluation;
}

interface UpdateAssignmentStatusPayload {
  submittedAt?: string | null;
  evaluation?: AssignmentEvaluation;
  attemptCount?: number;
  correctAttemptCount?: number;
  isFirstAttempt?: boolean;
}

interface CourseStructureContextValue {
  // Config
  classId?: string;
  isAdmin: boolean;
  isMember: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isOwner: boolean;

  // Course data
  course: CourseUI;
  selectedNodeId: string | null;
  selectedNode: LessonNodeUI | null;

  // Tree UI states (ĐƠN GIẢN HƠN - không cần loadedNodeIds, loadingNodeIds)
  expandedNodeIds: Set<string>;

  // Class lesson node states
  classLessonNodes: Map<string, any[]>;
  classLessonNodeCounts: Map<
    string,
    { lesson_note: number; homework_imp: number }
  >;
  expandedClassLessonNodes: Set<string>;

  // Homework counts (student only)
  homeworkCountsMap: Map<string, HomeworkCountResult>;
  getHomeworkCounts: (nodeId: string) => HomeworkCountResult;

  // Loading states
  isPending: boolean;
  loadingAction: string | null;
  isInitialLoading: boolean; // NEW: Track initial tree load
  loadingClassLessonNodeIds: Set<string>; // NEW: Separate loading state

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  toggleNodeExpanded: (node: LessonNodeUI) => void; // Đơn giản hơn - không async
  handleAddNode: (
    type: AddNodeInputType,
    options?: AddNodeOptions,
  ) => Promise<void>;
  handleDeleteNode: (nodeId: string) => Promise<void>;
  handleMoveNode: (
    nodeId: string,
    targetParentId: string,
    targetIndex: number,
  ) => Promise<void>;
  handleUpdateNode: (
    nodeId: string,
    updates: { title?: string; content?: any },
  ) => Promise<void>;
  isUpdatingNode: string | null;

  // Class lesson node actions
  handleToggleClassLessonNodes: (nodeId: string) => Promise<void>;
  handleAddClassLessonNode: (
    nodeId: string,
    type: "lesson_note" | "homework_imp",
    content?: Record<string, any>,
  ) => Promise<string | undefined>;
  handleDeleteClassLessonNode: (
    nodeId: string,
    classLessonNodeId: string,
    type: "lesson_note" | "homework_imp",
  ) => Promise<void>;
  getClassLessonNodesByType: (
    nodeId: string,
    type: "lesson_note" | "homework_imp",
  ) => any[];
  studentSubmissionStatus: Map<string, StudentSubmissionStatus>;
  updateAssignmentStatus: (
    assignmentId: string,
    payload?: UpdateAssignmentStatusPayload,
  ) => Promise<void>;

  // Assignment stats (teacher)
  assignmentStats: Map<
    string,
    { total: number; assigned: number; submitted: number }
  >;

  // Teacher student view
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  classStudents: ClassStudentInfo[];
  classStudentStats: Map<string, { totalAssigned: number; correct: number }>;
  isTeacherStudentView: boolean;
  isLoadingStudentView: boolean;
  reloadSelectedStudentData: () => Promise<void>;
}

export interface AddNodeOptions {
  title?: string;
  content?: LessonNodeContent;
}

const CourseStructureContext = createContext<
  CourseStructureContextValue | undefined
>(undefined);

// ===== PROVIDER =====
interface CourseStructureProviderProps {
  children: React.ReactNode;
  initialCourse: CourseUI;
  classId?: string;
  userRole:
    | "org_admin"
    | "org_member"
    | "class_teacher"
    | "class_student"
    | "class_owner";
}

export const CourseStructureProvider: React.FC<
  CourseStructureProviderProps
> = ({ children, initialCourse, classId, userRole }) => {
  // ===== CONFIG =====
  const config = {
    classId,
    isAdmin: userRole === "org_admin",
    isMember: userRole === "org_member",
    isTeacher: userRole === "class_teacher",
    isStudent: userRole === "class_student",
    isOwner: userRole === "class_owner",
  };

  // ===== COURSE DATA =====
  const [course, setCourse] = useState<CourseUI>(initialCourse);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialCourse.rootLessonNodeId,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(
    // Chỉ loading nếu là student (cần load homework counts)
    config.isStudent && !!classId,
  );

  // ===== TREE UI STATES (ĐƠN GIẢN HƠN) =====
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(
      initialCourse.rootLessonNodeId ? [initialCourse.rootLessonNodeId] : [],
    ),
  );

  const [isUpdatingNode, setIsUpdatingNode] = useState<string | null>(null);

  // ===== CLASS LESSON NODE STATES =====
  const [classLessonNodes, setClassLessonNodes] = useState<Map<string, any[]>>(
    new Map(),
  );
  const [classLessonNodeCounts, setClassLessonNodeCounts] = useState<
    Map<string, { lesson_note: number; homework_imp: number }>
  >(new Map());
  const [expandedClassLessonNodes, setExpandedClassLessonNodes] = useState<
    Set<string>
  >(new Set());
  const [loadingClassLessonNodeIds, setLoadingClassLessonNodeIds] = useState<
    Set<string>
  >(new Set());

  // ===== HOMEWORK COUNTS (STUDENT) =====
  const [homeworkCountsMap, setHomeworkCountsMap] = useState<
    Map<string, HomeworkCountResult>
  >(new Map());

  const [studentSubmissionStatus, setStudentSubmissionStatus] = useState<
    Map<string, StudentSubmissionStatus>
  >(new Map());

  // ===== TEACHER STUDENT VIEW =====
  const [selectedStudentId, setSelectedStudentIdState] = useState<
    string | null
  >(null);
  const [classStudents, setClassStudents] = useState<ClassStudentInfo[]>([]);
  const [classStudentStats, setClassStudentStats] = useState<
    Map<string, { totalAssigned: number; correct: number }>
  >(new Map());
  const [isLoadingStudentView, setIsLoadingStudentView] = useState(false);
  const isTeacherStudentView = config.isTeacher && !!selectedStudentId;

  // ===== ASSIGNMENT STATS (TEACHER) =====
  const [assignmentStats, setAssignmentStats] = useState<
    Map<string, { total: number; assigned: number; submitted: number }>
  >(new Map());

  // ===== LOADING STATES =====
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // ===== DERIVED VALUES =====
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !course.rootLessonNode) return null;
    return findNodeById(course.rootLessonNode, selectedNodeId);
  }, [selectedNodeId, course.rootLessonNode]);

  // ===== INITIAL LOAD: Load full tree =====
  useEffect(() => {
    // Nếu KHÔNG phải student → Skip
    if (!config.isStudent || !classId) {
      setIsInitialLoading(false);
      return;
    }

    // KIỂM TRA: Nếu initialCourse chưa có rootLessonNode → Có vấn đề
    if (!initialCourse.rootLessonNode) {
      console.error("❌ initialCourse.rootLessonNode is null!");
      setIsInitialLoading(false);
      return;
    }

    // Nếu là student → Load homework counts
    const loadHomeworkCounts = async () => {
      try {
        const statusRes = await api.courses.getHomeworkStatus({
          query: { courseId: initialCourse.id, classId },
        });
        const statusResult =
          statusRes.status === 200
            ? statusRes.body
            : { success: false as const };
        console.log("statusResult", statusResult);

        if (statusResult.success && statusResult.data) {
          const {
            assignedByLessonNode,
            submittedByLessonNode,
            correctByLessonNode,
            submissionsByAssignmentId,
          } = statusResult.data;

          const countsMap = buildHomeworkCountsMap(
            initialCourse.rootLessonNode!,
            assignedByLessonNode,
            submittedByLessonNode,
            correctByLessonNode,
          );
          console.log("countsMap: ", countsMap);

          setHomeworkCountsMap(countsMap);

          // 🎯 Lưu submission status luôn (thay vì gọi getStudentSubmissionStatus sau)
          if (submissionsByAssignmentId) {
            const submissionStatusMap = new Map<
              string,
              StudentSubmissionStatus
            >();

            Object.entries(submissionsByAssignmentId).forEach(
              ([assignmentId, status]) => {
                submissionStatusMap.set(assignmentId, status);
              },
            );

            setStudentSubmissionStatus(submissionStatusMap);
          }

          console.log(`✅ Homework counts loaded for ${countsMap.size} nodes`);

          // Debug: Log một số counts
          let totalPending = 0;
          countsMap.forEach((counts) => {
            totalPending += counts.pending;
          });
          console.log(`Total pending homeworks: ${totalPending}`);
        }
      } catch (error) {
        console.error("❌ Error loading homework counts:", error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadHomeworkCounts();
  }, [initialCourse.id, classId, config.isStudent]);

  useEffect(() => {
    // Chỉ load khi có classId (teacher hoặc student)
    if (!classId || (!config.isTeacher && !config.isStudent)) {
      return;
    }

    const loadClassLessonNodeCounts = async () => {
      if (!initialCourse.rootLessonNode) return;

      try {
        // Lấy tất cả homework node IDs từ tree
        const homeworkNodeIds: string[] = [];

        function collectHomeworkIds(node: LessonNodeUI) {
          if (node.type === "homework") {
            homeworkNodeIds.push(node.id);
          }
          if (node.children && node.children.length > 0) {
            node.children.forEach(collectHomeworkIds);
          }
        }

        collectHomeworkIds(initialCourse.rootLessonNode);

        if (homeworkNodeIds.length === 0) {
          console.log("No homework nodes found");
          return;
        }

        console.log(
          `📊 Loading class lesson node counts for ${homeworkNodeIds.length} homework nodes...`,
        );

        // Load counts
        const countsRes = await api.classLessonNodes.getClassLessonNodeCounts({
          body: { lessonNodeIds: homeworkNodeIds, classId },
        });
        const countsResult =
          countsRes.status === 200
            ? countsRes.body
            : { success: false as const };

        if (countsResult.success && countsResult.data) {
          const newMap = new Map<
            string,
            { lesson_note: number; homework_imp: number }
          >();
          Object.entries(countsResult.data).forEach(([id, counts]) => {
            newMap.set(id, counts as any);
          });
          setClassLessonNodeCounts(newMap);

          console.log(
            `✅ Loaded class lesson node counts for ${newMap.size} nodes`,
          );
        }
      } catch (error) {
        console.error("Error loading class lesson node counts:", error);
      }
    };

    loadClassLessonNodeCounts();
  }, [
    classId,
    config.isTeacher,
    config.isStudent,
    initialCourse.rootLessonNode,
  ]);

  // ===== LOAD CLASS STUDENTS + STATS (teacher only) =====
  useEffect(() => {
    if (!config.isTeacher || !classId) return;

    const loadStudentsAndStats = async () => {
      try {
        const [studentsRes, summaryRes] = await Promise.all([
          api.classes.getClassStudents({ params: { classId } }),
          api.courses.getAllStudentsHomeworkSummary({
            query: { courseId: initialCourse.id, classId },
          }),
        ]);
        const students = studentsRes.status === 200 ? studentsRes.body : [];
        const summaryResult =
          summaryRes.status === 200
            ? summaryRes.body
            : { success: false as const };
        setClassStudents(students);

        if (summaryResult.success && summaryResult.data) {
          const statsMap = new Map<
            string,
            { totalAssigned: number; correct: number }
          >();
          Object.entries(summaryResult.data).forEach(([studentId, stats]) => {
            statsMap.set(studentId, stats);
          });
          setClassStudentStats(statsMap);
        }
      } catch (error) {
        console.error("Error loading class students:", error);
      }
    };

    loadStudentsAndStats();
  }, [config.isTeacher, classId, initialCourse.id]);

  // ===== LOAD ASSIGNMENT STATS (teacher only) =====
  useEffect(() => {
    if (!config.isTeacher || !classId) return;

    const loadStats = async () => {
      try {
        const statsRes = await api.classLessonNodes.getAssignmentStatsBatch({
          params: { classId },
        });
        const result =
          statsRes.status === 200 ? statsRes.body : { success: false as const };
        if (result.success && result.data) {
          const statsMap = new Map<
            string,
            { total: number; assigned: number; submitted: number }
          >();
          Object.entries(result.data).forEach(([id, stats]) => {
            statsMap.set(
              id,
              stats as { total: number; assigned: number; submitted: number },
            );
          });
          setAssignmentStats(statsMap);
        }
      } catch (error) {
        console.error("Error loading assignment stats:", error);
      }
    };

    loadStats();
  }, [config.isTeacher, classId]);

  // ===== LOAD SELECTED STUDENT HOMEWORK STATUS (teacher student view) =====
  const loadSelectedStudentData = useCallback(async () => {
    if (
      !config.isTeacher ||
      !classId ||
      !selectedStudentId ||
      !initialCourse.rootLessonNode
    ) {
      return;
    }

    setIsLoadingStudentView(true);
    try {
      const statusRes = await api.courses.getHomeworkStatusForTeacher({
        query: {
          courseId: initialCourse.id,
          classId,
          studentId: selectedStudentId,
        },
      });
      const statusResult =
        statusRes.status === 200 ? statusRes.body : { success: false as const };

      if (statusResult.success && statusResult.data) {
        const {
          assignedByLessonNode,
          submittedByLessonNode,
          correctByLessonNode,
          submissionsByAssignmentId,
        } = statusResult.data;

        const countsMap = buildHomeworkCountsMap(
          initialCourse.rootLessonNode,
          assignedByLessonNode,
          submittedByLessonNode,
          correctByLessonNode,
        );
        setHomeworkCountsMap(countsMap);

        if (submissionsByAssignmentId) {
          const submissionStatusMap = new Map<
            string,
            StudentSubmissionStatus
          >();

          Object.entries(submissionsByAssignmentId).forEach(([id, status]) => {
            submissionStatusMap.set(id, status);
          });
          setStudentSubmissionStatus(submissionStatusMap);
        } else {
          setStudentSubmissionStatus(new Map());
        }
      }
    } catch (error) {
      console.error("Error loading student homework status:", error);
    } finally {
      setIsLoadingStudentView(false);
    }
  }, [
    config.isTeacher,
    classId,
    selectedStudentId,
    initialCourse.id,
    initialCourse.rootLessonNode,
  ]);

  useEffect(() => {
    if (!selectedStudentId && config.isTeacher) {
      // Clear data when deselected
      setHomeworkCountsMap(new Map());
      setStudentSubmissionStatus(new Map());
      return;
    }

    loadSelectedStudentData();
  }, [selectedStudentId, loadSelectedStudentData]);

  const setSelectedStudentId = useCallback((id: string | null) => {
    setSelectedStudentIdState(id);
  }, []);

  const reloadSelectedStudentData = useCallback(async () => {
    await loadSelectedStudentData();
  }, [loadSelectedStudentData]);

  // ===== ACTION: Toggle expand/collapse (ĐƠN GIẢN) =====
  const toggleNodeExpanded = useCallback((node: LessonNodeUI) => {
    const nodeId = node.id;

    setExpandedNodeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // ===== ACTION: Add node =====
  const handleAddNode = useCallback(
    async (type: AddNodeInputType, options?: AddNodeOptions): Promise<void> => {
      if (!selectedNode) {
        alert("Vui lòng chọn một node trước");
        return;
      }

      if (type === LessonNodeType.homework) {
        if (selectedNode.type !== LessonNodeType.lesson) {
          alert("Chỉ có thể thêm Homework vào Lesson!");
          return;
        }
      } else {
        if (selectedNode.type === LessonNodeType.lesson) {
          alert("Không thể thêm Module/Lesson vào Lesson!");
          return;
        }
      }

      setLoadingAction(`add-${type}`);

      startTransition(async () => {
        const defaultTitle =
          type === LessonNodeType.module
            ? "New Module"
            : type === LessonNodeType.lesson
              ? "New Lesson"
              : "New Homework";

        const addRes = await api.courses.addLessonNode({
          params: { courseId: course.id },
          body: {
            parentId: selectedNode.id,
            type: type as "module" | "lesson" | "homework",
            title: options?.title ?? defaultTitle,
            content: options?.content,
          },
        });
        const result = (
          addRes.status === 200
            ? addRes.body
            : { success: false, error: (addRes.body as any).error }
        ) as { success: boolean; data?: any; error?: string };

        if (result.success && result.data) {
          const newNode: LessonNodeUI = {
            ...transformToUINode(result.data),
            children: [],
            childrenLoaded: true,
          };

          setCourse((prev) => {
            if (!prev.rootLessonNode) return prev;

            const updatedRoot = addChildToNode(
              prev.rootLessonNode,
              selectedNode.id,
              newNode,
            );

            return {
              ...prev,
              rootLessonNode: updatedRoot,
            };
          });

          // Auto expand parent
          setExpandedNodeIds((prev) => new Set([...prev, selectedNode.id]));
        } else {
          alert(result.error || "Có lỗi xảy ra khi thêm node");
        }

        setLoadingAction(null);
      });
    },
    [selectedNode, course.id],
  );

  // ===== ACTION: Delete node =====
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (nodeId === course.rootLessonNodeId) {
        alert("Không thể xóa root course!");
        return;
      }

      if (
        !confirm(
          "Bạn có chắc muốn xóa node này? Tất cả children cũng sẽ bị xóa.",
        )
      ) {
        return;
      }

      setLoadingAction(`delete-${nodeId}`);

      startTransition(async () => {
        const deleteRes = await api.courses.deleteLessonNode({
          params: { courseId: course.id, nodeId },
          body: undefined,
        });
        const result = (
          deleteRes.status === 200
            ? deleteRes.body
            : { success: false, error: (deleteRes.body as any).error }
        ) as { success: boolean; data?: any; error?: string };

        if (result.success) {
          setCourse((prev) => {
            if (!prev.rootLessonNode) return prev;

            const updatedRoot = removeNodeFromTree(prev.rootLessonNode, nodeId);

            return {
              ...prev,
              rootLessonNode: updatedRoot,
            };
          });

          if (selectedNodeId === nodeId) {
            setSelectedNodeId(course.rootLessonNodeId);
          }

          setExpandedNodeIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(nodeId);
            return newSet;
          });
        } else {
          alert(result.error || "Có lỗi xảy ra khi xóa node");
        }

        setLoadingAction(null);
      });
    },
    [course.id, course.rootLessonNodeId, selectedNodeId],
  );

  const handleMoveNode = useCallback(
    async (nodeId: string, targetParentId: string, targetIndex: number) => {
      if (nodeId === course.rootLessonNodeId) {
        alert("Không thể di chuyển root course!");
        return;
      }

      setLoadingAction(`move-${nodeId}`);

      try {
        const moveRes = await api.courses.reorderLessonNode({
          params: { courseId: course.id, nodeId },
          body: {
            targetParentId,
            targetIndex,
          },
        });

        const result = (
          moveRes.status === 200
            ? moveRes.body
            : { success: false, error: (moveRes.body as any).error }
        ) as { success: boolean; data?: any; error?: string };

        if (!result.success) {
          alert(result.error || "Có lỗi xảy ra khi sắp xếp node");
          return;
        }

        setCourse((prev) => {
          if (!prev.rootLessonNode) return prev;

          const updatedRoot = moveNodeInTree(
            prev.rootLessonNode,
            nodeId,
            targetParentId,
            targetIndex,
          );

          return {
            ...prev,
            rootLessonNode: updatedRoot,
          };
        });

        setExpandedNodeIds((prev) => new Set([...prev, targetParentId]));
      } catch (error) {
        console.error("Error moving lesson node:", error);
        alert("Có lỗi xảy ra khi sắp xếp node");
      } finally {
        setLoadingAction(null);
      }
    },
    [course.id, course.rootLessonNodeId],
  );

  // ===== ACTION: Update node =====
  const handleUpdateNode = useCallback(
    async (nodeId: string, updates: { title?: string; content?: any }) => {
      setIsUpdatingNode(nodeId);

      try {
        const updateRes = await api.courses.updateLessonNode({
          params: { courseId: course.id, nodeId },
          body: updates,
        });
        const result = (
          updateRes.status === 200
            ? updateRes.body
            : { success: false, error: (updateRes.body as any).error }
        ) as { success: boolean; data?: any; error?: string };

        if (result.success && result.data) {
          setCourse((prev) => {
            if (!prev.rootLessonNode) return prev;

            const updatedRoot = updateNodeInTree(
              prev.rootLessonNode,
              nodeId,
              (node) => ({
                ...node,
                title: result.data.title,
                content: result.data.content,
                updatedAt: result.data.updatedAt,
              }),
            );

            return {
              ...prev,
              rootLessonNode: updatedRoot,
            };
          });
        } else {
          alert(result.error || "Có lỗi xảy ra khi cập nhật");
        }
      } catch (error) {
        console.error("Error updating node:", error);
        alert("Có lỗi xảy ra");
      } finally {
        setIsUpdatingNode(null);
      }
    },
    [course.id],
  );

  // ===== CLASS LESSON NODE ACTIONS (GIỮ NGUYÊN) =====
  const handleToggleClassLessonNodes = useCallback(
    async (nodeId: string) => {
      if (!classId) return;

      const isExpanded = expandedClassLessonNodes.has(nodeId);
      if (isExpanded) {
        setExpandedClassLessonNodes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(nodeId);
          return newSet;
        });
        return;
      }

      setLoadingClassLessonNodeIds((prev) => new Set([...prev, nodeId]));

      try {
        // 1. Load class lesson nodes
        const loadRes = await api.classLessonNodes.loadClassLessonNode({
          query: { lessonNodeId: nodeId, classId },
        });
        const result = (
          loadRes.status === 200 ? loadRes.body : { success: false as const }
        ) as { success: boolean; data?: any[]; error?: string };

        if (!result.success || !result.data) {
          throw new Error("Failed to load class lesson nodes");
        }

        setClassLessonNodes((prev) => new Map(prev).set(nodeId, result.data!));
        setExpandedClassLessonNodes((prev) => new Set([...prev, nodeId]));

        // 🎯 Submission status đã được load từ getStudentHomeworkStatusByClass
        // Không cần gọi API thêm nữa!
      } catch (error) {
        console.error("Error toggling class lesson nodes:", error);
      } finally {
        setLoadingClassLessonNodeIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(nodeId);
          return newSet;
        });
      }
    },
    [classId, expandedClassLessonNodes, config.isStudent],
  );

  const handleAddClassLessonNode = useCallback(
    async (
      nodeId: string,
      type: "lesson_note" | "homework_imp",
      content?: Record<string, any>,
    ): Promise<string | undefined> => {
      if (!classId) return undefined;

      setLoadingAction(`add-classlessonnode-${nodeId}`);

      const addRes = await api.classLessonNodes.addClassLessonNode({
        body: {
          lessonNodeId: nodeId,
          classId: classId,
          type,
          content: content,
        },
      });
      const result = (
        addRes.status === 201
          ? addRes.body
          : { success: false, error: (addRes.body as any).error }
      ) as { success: boolean; data?: any; error?: string };

      if (result.success && result.data) {
        startTransition(() => {
          setClassLessonNodes((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(nodeId) || [];
            newMap.set(nodeId, [result.data, ...existing]);
            return newMap;
          });

          setClassLessonNodeCounts((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(nodeId) || {
              lesson_note: 0,
              homework_imp: 0,
            };
            newMap.set(nodeId, {
              ...current,
              [type]: current[type] + 1,
            });
            return newMap;
          });

          setExpandedClassLessonNodes((prev) => new Set([...prev, nodeId]));
        });

        setLoadingAction(null);
        return result.data.id;
      } else {
        alert(result.error || "Có lỗi xảy ra");
        setLoadingAction(null);
        return undefined;
      }
    },
    [classId],
  );

  const handleDeleteClassLessonNode = useCallback(
    async (
      nodeId: string,
      classLessonNodeId: string,
      type: "lesson_note" | "homework_imp",
    ) => {
      if (!classId) return;

      if (!confirm("Bạn có chắc muốn xóa?")) return;

      setLoadingAction(`delete-classlessonnode-${classLessonNodeId}`);

      startTransition(async () => {
        const deleteRes = await api.classLessonNodes.deleteClassLessonNode({
          params: { classLessonNodeId },
          query: { classId },
          body: undefined,
        });
        const result = (
          deleteRes.status === 200
            ? deleteRes.body
            : { success: false, error: (deleteRes.body as any).error }
        ) as { success: boolean; data?: any; error?: string };

        if (result.success) {
          setClassLessonNodes((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(nodeId) || [];
            newMap.set(
              nodeId,
              existing.filter((a) => a.id !== classLessonNodeId),
            );
            return newMap;
          });

          setClassLessonNodeCounts((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(nodeId) || {
              lesson_note: 0,
              homework_imp: 0,
            };
            newMap.set(nodeId, {
              ...current,
              [type]: Math.max(0, current[type] - 1),
            });
            return newMap;
          });
        } else {
          alert(result.error || "Có lỗi xảy ra");
        }

        setLoadingAction(null);
      });
    },
    [classId],
  );

  const getClassLessonNodesByType = useCallback(
    (nodeId: string, type: "lesson_note" | "homework_imp") => {
      const allClassLessonNodes = classLessonNodes.get(nodeId) || [];
      return allClassLessonNodes.filter((a) => a.type === type);
    },
    [classLessonNodes],
  );

  // ===== HELPER: Get homework counts =====
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

  // ===== ACTION: Update assignment status when completed =====
  const updateAssignmentStatus = useCallback(
    async (
      assignmentId: string,
      payload?: UpdateAssignmentStatusPayload,
    ): Promise<void> => {
      const currentStatus = studentSubmissionStatus.get(assignmentId);
      const isFirstAttempt =
        payload?.isFirstAttempt ?? !currentStatus?.hasSubmitted;

      // Update studentSubmissionStatus
      setStudentSubmissionStatus((prev) => {
        const newMap = new Map(prev);
        const previousStatus = newMap.get(assignmentId);
        const hasSubmittedBefore = previousStatus?.hasSubmitted === true;

        const previousAttemptCount =
          previousStatus?.attemptCount ?? (hasSubmittedBefore ? 1 : 0);
        const previousCorrectAttemptCount =
          previousStatus?.correctAttemptCount ??
          (previousStatus?.evaluation?.isCorrect ? 1 : 0);

        const nextAttemptCount =
          payload?.attemptCount ??
          (hasSubmittedBefore ? previousAttemptCount + 1 : 1);
        const nextCorrectAttemptCount =
          payload?.correctAttemptCount ??
          (hasSubmittedBefore
            ? previousCorrectAttemptCount +
              (payload?.evaluation?.isCorrect ? 1 : 0)
            : payload?.evaluation?.isCorrect
              ? 1
              : 0);

        if (hasSubmittedBefore) {
          newMap.set(assignmentId, {
            ...previousStatus,
            hasSubmitted: true,
            submittedAt:
              previousStatus.submittedAt ?? payload?.submittedAt ?? null,
            evaluation: previousStatus.evaluation ?? payload?.evaluation,
            attemptCount: nextAttemptCount,
            correctAttemptCount: nextCorrectAttemptCount,
          });
        } else {
          newMap.set(assignmentId, {
            hasSubmitted: true,
            submittedAt: payload?.submittedAt ?? new Date().toISOString(),
            evaluation: payload?.evaluation,
            attemptCount: nextAttemptCount,
            correctAttemptCount: nextCorrectAttemptCount,
          });
        }

        return newMap;
      });

      // Reload homework counts để đảm bảo chính xác
      if (
        config.isStudent &&
        classId &&
        initialCourse.rootLessonNode &&
        isFirstAttempt
      ) {
        try {
          const statusRes = await api.courses.getHomeworkStatus({
            query: { courseId: initialCourse.id, classId },
          });
          const statusResult =
            statusRes.status === 200
              ? statusRes.body
              : { success: false as const };

          if (statusResult.success && statusResult.data) {
            const {
              assignedByLessonNode,
              submittedByLessonNode,
              correctByLessonNode,
              submissionsByAssignmentId,
            } = statusResult.data;

            const countsMap = buildHomeworkCountsMap(
              initialCourse.rootLessonNode,
              assignedByLessonNode,
              submittedByLessonNode,
              correctByLessonNode,
            );

            setHomeworkCountsMap(countsMap);

            // Cập nhật submission status từ dữ liệu mới
            if (submissionsByAssignmentId) {
              setStudentSubmissionStatus((prev) => {
                const mergedMap = new Map(prev);

                Object.entries(submissionsByAssignmentId).forEach(
                  ([id, status]) => {
                    const previousStatus = mergedMap.get(id);

                    if (previousStatus?.hasSubmitted) {
                      mergedMap.set(id, {
                        ...status,
                        hasSubmitted: true,
                        submittedAt:
                          previousStatus.submittedAt ?? status.submittedAt,
                        evaluation:
                          previousStatus.evaluation ?? status.evaluation,
                        attemptCount: Math.max(
                          previousStatus.attemptCount ?? 0,
                          status.attemptCount ?? 0,
                        ),
                        correctAttemptCount: Math.max(
                          previousStatus.correctAttemptCount ?? 0,
                          status.correctAttemptCount ?? 0,
                        ),
                      });
                      return;
                    }

                    mergedMap.set(id, status);
                  },
                );

                return mergedMap;
              });
            }
          }
        } catch (error) {
          console.error("Error reloading homework counts:", error);
        }
      }
    },
    [
      config.isStudent,
      classId,
      initialCourse.id,
      initialCourse.rootLessonNode,
      studentSubmissionStatus,
    ],
  );

  // ===== CONTEXT VALUE =====
  const value: CourseStructureContextValue = {
    // Config
    ...config,

    // Data
    course,
    selectedNodeId,
    selectedNode,

    // Tree UI
    expandedNodeIds,

    // Class lesson nodes
    classLessonNodes,
    classLessonNodeCounts,
    expandedClassLessonNodes,

    // Homework counts
    homeworkCountsMap,
    getHomeworkCounts,

    // Loading
    isPending,
    loadingAction,
    isInitialLoading,
    loadingClassLessonNodeIds,
    handleUpdateNode,
    isUpdatingNode,

    // Actions
    setSelectedNodeId,
    toggleNodeExpanded,
    handleAddNode,
    handleDeleteNode,
    handleMoveNode,
    handleToggleClassLessonNodes,
    handleAddClassLessonNode,
    handleDeleteClassLessonNode,
    getClassLessonNodesByType,
    studentSubmissionStatus,
    updateAssignmentStatus,

    // Assignment stats (teacher)
    assignmentStats,

    // Teacher student view
    selectedStudentId,
    setSelectedStudentId,
    classStudents,
    classStudentStats,
    isTeacherStudentView,
    isLoadingStudentView,
    reloadSelectedStudentData,
  };

  return (
    <CourseStructureContext.Provider value={value}>
      {children}
    </CourseStructureContext.Provider>
  );
};

// ===== HOOK =====
export const useCourseStructure = () => {
  const context = useContext(CourseStructureContext);
  if (!context) {
    throw new Error(
      "useCourseStructure must be used within CourseStructureProvider",
    );
  }
  return context;
};

export const useOptionalCourseStructure = () => {
  return useContext(CourseStructureContext);
};
