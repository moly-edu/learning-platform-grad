// components/course-structure/CourseStructureManager.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  BarChart3,
  User,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CreateClassForm } from "@/components/forms/create-class-form";
import { api } from "@/lib/api-client";
import { LessonNodeType, LessonNodeUI, CourseUI } from "@/types/course";
import {
  CourseStructureProvider,
  useCourseStructure,
} from "@/components/providers/course-structure-provider";
import WidgetMarketplaceDialog from "../widget/marketplace/WidgetMarketplaceDialog";
import TeacherAssignmentDialog from "../widget/homework/TeacherCreateAssignmentDialog";
import TeacherViewAssignmentDialog from "../widget/homework/TeacherViewAssignmentDialog";
import StudentViewAssignmentDialog from "../widget/homework/StudentViewAssignmentDialog";
import TeacherStudentAssignmentViewDialog from "../widget/homework/TeacherStudentAssignmentViewDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import StudentDoAllHomeworkDialog from "./StudentDoAllHomeworkDialog";
import ClassMembersTable from "../class/ClassMembersTable";
import ClassSearchUser from "../class/ClassSearchUser";
import dynamic from "next/dynamic";
import Link from "next/link";

// ===== PROPS =====
interface CourseStructureManagerProps {
  initialCourse: CourseUI;
  classId?: string;
  userRole:
    | "org_admin"
    | "org_member"
    | "class_teacher"
    | "class_student"
    | "class_owner";
}

interface EditableTitleProps {
  initialTitle: string;
  onSave: (newTitle: string) => void;
  isUpdating: boolean;
  className?: string;
}

type OwnerClassItem = {
  id: string;
  name: string;
  courseId: string;
};

const EditableTitle: React.FC<EditableTitleProps> = ({
  initialTitle,
  onSave,
  isUpdating,
  className = "block w-full",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔑 Sync khi đổi node
  useEffect(() => {
    setTitle(initialTitle);
    setIsEditing(false);
  }, [initialTitle]);

  // Auto focus
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = title.trim();

    if (!trimmed) {
      setTitle(initialTitle);
      setIsEditing(false);
      return;
    }

    if (trimmed !== initialTitle) {
      onSave(trimmed); // optimistic
    }

    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTitle(initialTitle);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isUpdating}
        className={`bg-card border border-blue-500 rounded px-2 py-1 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-muted px-2 py-1 rounded ${className}`}
      title="Click to edit"
    >
      {title}
    </span>
  );
};

// ===== STUDENT ONLY UI =====
const StudentCourseStructureContent: React.FC = () => {
  const {
    course,
    selectedNodeId,
    selectedNode,
    expandedNodeIds,
    isInitialLoading,
    loadingClassLessonNodeIds,
    classLessonNodeCounts,
    expandedClassLessonNodes,
    setSelectedNodeId,
    toggleNodeExpanded,
    handleToggleClassLessonNodes,
    getClassLessonNodesByType,
    getHomeworkCounts,
    studentSubmissionStatus,
  } = useCourseStructure();

  const [showStats, setShowStats] = useState(false);

  const getStatsBadge = (correct: number, total: number) => {
    if (total === 0) return null;
    const ratio = correct / total;

    if (ratio >= 0.7) {
      return {
        label: `${correct}/${total}`,
        colorClass: "bg-emerald-100 text-emerald-700",
        ratio,
      };
    }

    if (ratio >= 0.4) {
      return {
        label: `${correct}/${total}`,
        colorClass: "bg-amber-100 text-amber-700",
        ratio,
      };
    }

    return {
      label: `${correct}/${total}`,
      colorClass: "bg-rose-100 text-rose-700",
      ratio,
    };
  };

  const getNodeIcon = (node: LessonNodeUI, isExpanded: boolean) => {
    switch (node.type) {
      case LessonNodeType.lesson:
        return <File className="w-4 h-4 text-blue-500" />;
      case LessonNodeType.course:
        return <BookOpen className="w-4 h-4 text-indigo-500" />;
      default:
        return isExpanded ? (
          <FolderOpen className="w-4 h-4 text-amber-500" />
        ) : (
          <Folder className="w-4 h-4 text-amber-500" />
        );
    }
  };

  const renderStudentNode = (
    node: LessonNodeUI,
    level: number = 0,
  ): React.ReactNode => {
    if (node.type === LessonNodeType.homework) return null;

    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node._count.children > 0;

    const homeworkCounts = getHomeworkCounts(node.id);
    const hasPendingHomework =
      homeworkCounts.totalAssigned > 0 && homeworkCounts.pending > 0;

    return (
      <div key={node.id} className="group">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
            isSelected
              ? "bg-indigo-100 border border-indigo-300"
              : "hover:bg-muted"
          }`}
          style={{ marginLeft: `${level * 14}px` }}
          onClick={() => setSelectedNodeId(node.id)}
        >
          {hasChildren && node.type !== LessonNodeType.lesson ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpanded(node);
              }}
              className="p-0.5 rounded hover:bg-background"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {getNodeIcon(node, isExpanded)}
          <span className="text-base font-medium text-foreground">
            {node.title}
          </span>

          {homeworkCounts.totalAssigned > 0 &&
            (showStats ? (
              (() => {
                const stats = getStatsBadge(
                  homeworkCounts.correct,
                  homeworkCounts.totalAssigned,
                );
                return stats ? (
                  <span
                    className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${stats.colorClass}`}
                    title={`${homeworkCounts.correct} correct / ${homeworkCounts.totalAssigned} total`}
                  >
                    {stats.label}
                  </span>
                ) : null;
              })()
            ) : (
              <span
                className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${
                  hasPendingHomework
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-100 text-emerald-700"
                }`}
                title={`${homeworkCounts.pending} pending / ${homeworkCounts.totalAssigned} total`}
              >
                {hasPendingHomework ? `${homeworkCounts.pending}` : "Done"}
              </span>
            ))}
        </div>

        {isExpanded && node.children?.length > 0 && (
          <div className="mt-1 space-y-1">
            {node.children.map((child) => renderStudentNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const homeworkNodes = useMemo(() => {
    if (selectedNode && selectedNode.type === LessonNodeType.lesson) {
      return (selectedNode.children || []).filter(
        (child) => child.type === LessonNodeType.homework,
      );
    }
    return [];
  }, [selectedNode]);

  const Editor = useMemo(
    () =>
      dynamic(() => import("@/components/course-structure/Editor"), {
        ssr: false,
      }),
    [],
  );

  const rootCounts = getHomeworkCounts(course.rootLessonNodeId || "");

  return (
    <div className="flex h-screen bg-linear-to-b from-indigo-50/80 via-background to-sky-50/60">
      <div className="w-90 border-r border-border bg-card/95 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div className="rounded-2xl bg-linear-to-r from-indigo-500 to-sky-500 text-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-white/80">
              Student Learning View
            </p>
            <h2 className="text-xl font-bold leading-snug mt-1">
              {course.name}
            </h2>
            <p className="text-sm text-white/90 mt-1">
              {rootCounts.correct}/{rootCounts.totalAssigned} correct •{" "}
              {rootCounts.pending} pending
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <StudentDoAllHomeworkDialog />
            <button
              onClick={() => setShowStats((prev) => !prev)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                showStats
                  ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {showStats ? "Hide Score View" : "Show Score View"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isInitialLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-base text-muted-foreground">
                Loading course...
              </span>
            </div>
          ) : course.rootLessonNode ? (
            <div className="space-y-1">
              {renderStudentNode(course.rootLessonNode)}
            </div>
          ) : (
            <div className="p-4 text-base text-muted-foreground">
              Nothing here
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {selectedNode ? (
          <div className="max-w-5xl mx-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
              <div className="mb-5">
                <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mb-2">
                  {selectedNode.type}
                </div>
                <h1 className="text-3xl font-bold text-foreground leading-tight">
                  {selectedNode.title}
                </h1>
              </div>

              <Editor
                key={selectedNode.id}
                initialContent={
                  selectedNode.content
                    ? (selectedNode.content as any[])
                    : undefined
                }
                editable={false}
                onSave={async () => {}}
              />

              {selectedNode.type === LessonNodeType.lesson && (
                <div className="border-t border-border mt-6 pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Homework
                  </h3>

                  {homeworkNodes.length === 0 ? (
                    <div className="text-base text-muted-foreground">
                      No assignments yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {homeworkNodes.map((hw) => {
                        const hwImplCount =
                          classLessonNodeCounts.get(hw.id)?.homework_imp || 0;
                        const hwClassLessonNodes = getClassLessonNodesByType(
                          hw.id,
                          "homework_imp",
                        );
                        const isHwExpanded = expandedClassLessonNodes.has(
                          hw.id,
                        );

                        const homeworkCounts = getHomeworkCounts(hw.id);
                        const hasPendingHomework = homeworkCounts.pending > 0;

                        return (
                          <div
                            key={hw.id}
                            className="rounded-xl border border-border bg-muted/30"
                          >
                            <div className="flex items-center gap-2 p-3">
                              <File className="w-4 h-4 text-orange-500" />
                              <span className="text-base font-semibold flex-1">
                                {hw.title}
                              </span>

                              {hwImplCount > 0 && (
                                <span className="text-xs text-muted-foreground bg-orange-100 px-2.5 py-1 rounded-full">
                                  {hwImplCount}
                                </span>
                              )}

                              {homeworkCounts.totalAssigned > 0 &&
                                (showStats ? (
                                  (() => {
                                    const stats = getStatsBadge(
                                      homeworkCounts.correct,
                                      homeworkCounts.totalAssigned,
                                    );
                                    return stats ? (
                                      <span
                                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${stats.colorClass}`}
                                      >
                                        {stats.label}
                                      </span>
                                    ) : null;
                                  })()
                                ) : (
                                  <span
                                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                      hasPendingHomework
                                        ? "bg-rose-500 text-white"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {hasPendingHomework
                                      ? `${homeworkCounts.pending} pending`
                                      : "Done"}
                                  </span>
                                ))}

                              <button
                                onClick={() =>
                                  handleToggleClassLessonNodes(hw.id)
                                }
                                className="p-1.5 hover:bg-muted rounded"
                              >
                                {loadingClassLessonNodeIds.has(hw.id) ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isHwExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            {isHwExpanded && (
                              <div className="px-3 pb-3 space-y-2">
                                {hwClassLessonNodes.length === 0 ? (
                                  <div className="text-sm text-muted-foreground italic py-1">
                                    No assignments yet.
                                  </div>
                                ) : (
                                  hwClassLessonNodes.map(
                                    (classLessonNode, index) => {
                                      const submissionStatus =
                                        studentSubmissionStatus.get(
                                          classLessonNode.id,
                                        );
                                      const isPending =
                                        !submissionStatus ||
                                        !submissionStatus.hasSubmitted;

                                      return (
                                        <div
                                          key={classLessonNode.id}
                                          className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                                            isPending
                                              ? "bg-amber-50 border border-amber-200"
                                              : "bg-emerald-50 border border-emerald-200"
                                          }`}
                                        >
                                          <span className="font-semibold text-orange-700 min-w-fit">
                                            Assignment {hwImplCount - index}
                                          </span>

                                          <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                              isPending
                                                ? "bg-amber-500 text-white"
                                                : "bg-emerald-500 text-white"
                                            }`}
                                          >
                                            {isPending ? "Not done" : "Done"}
                                          </span>

                                          {!isPending &&
                                            submissionStatus?.evaluation && (
                                              <div className="flex items-center gap-1">
                                                {submissionStatus.evaluation
                                                  .isCorrect ? (
                                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                ) : (
                                                  <XCircle className="w-4 h-4 text-rose-600" />
                                                )}
                                                <span className="font-semibold">
                                                  {
                                                    submissionStatus.evaluation
                                                      .score
                                                  }
                                                  /
                                                  {
                                                    submissionStatus.evaluation
                                                      .maxScore
                                                  }
                                                </span>
                                              </div>
                                            )}

                                          <div className="flex-1" />

                                          <StudentViewAssignmentDialog
                                            assignmentId={classLessonNode.id}
                                          />
                                        </div>
                                      );
                                    },
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        Notes
                        {(classLessonNodeCounts.get(selectedNode.id)
                          ?.lesson_note || 0) > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground bg-blue-100 px-2.5 py-1 rounded-full">
                            {
                              classLessonNodeCounts.get(selectedNode.id)
                                ?.lesson_note
                            }
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={() =>
                          handleToggleClassLessonNodes(selectedNode.id)
                        }
                        className="p-1.5 hover:bg-muted rounded"
                      >
                        {loadingClassLessonNodeIds.has(selectedNode.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : expandedClassLessonNodes.has(selectedNode.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {expandedClassLessonNodes.has(selectedNode.id) && (
                      <div className="space-y-2">
                        {getClassLessonNodesByType(
                          selectedNode.id,
                          "lesson_note",
                        ).map((note) => (
                          <div
                            key={note.id}
                            className="flex items-center gap-2 p-3 rounded-lg bg-blue-50"
                          >
                            <span className="text-base">
                              📝 {note.content?.text || "Note"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-lg text-muted-foreground">
              Select a node to view details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const CourseStructureRoleContent: React.FC = () => {
  const { isStudent } = useCourseStructure();

  if (isStudent) {
    return <StudentCourseStructureContent />;
  }

  return <CourseStructureContent />;
};

// ===== MAIN COMPONENT (UI Only - Logic từ Context) =====
const CourseStructureContent: React.FC = () => {
  const {
    // Config
    classId,
    isAdmin,
    isMember,
    isTeacher,
    isStudent,
    isOwner,

    // Data
    course,
    selectedNodeId,
    selectedNode,

    // Tree UI states
    expandedNodeIds,
    isInitialLoading,
    loadingClassLessonNodeIds,

    // Class lesson node states
    classLessonNodeCounts: classLessonNodeCounts,
    expandedClassLessonNodes: expandedClassLessonNodes,

    // Loading
    isPending,
    loadingAction,
    handleUpdateNode,
    isUpdatingNode,

    // Actions
    setSelectedNodeId,
    toggleNodeExpanded,
    handleAddNode,
    handleDeleteNode,
    handleToggleClassLessonNodes: handleToggleClassLessonNodes,
    handleAddClassLessonNode: handleAddClassLessonNode,
    handleDeleteClassLessonNode: handleDeleteClassLessonNode,
    getClassLessonNodesByType: getClassLessonNodesByType,
    getHomeworkCounts,
    studentSubmissionStatus,

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
  } = useCourseStructure();

  // Stats mode toggle (student only)
  const [showStats, setShowStats] = useState(false);
  // Teacher student select dialog
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  // Class manager dialog (for owner+member/admin)
  const [classManagerOpen, setClassManagerOpen] = useState(false);
  // Members manager dialog (for owner)
  const [memberManagerOpen, setMemberManagerOpen] = useState(false);

  const {
    data: ownedClasses = [],
    isLoading: isLoadingOwnedClasses,
    refetch: refetchOwnedClasses,
  } = useQuery({
    queryKey: ["class-manager-owned-classes", course.id],
    enabled: classManagerOpen,
    queryFn: async () => {
      const res = await api.classes.getUserClasses();
      if (res.status !== 200) return [] as OwnerClassItem[];

      const ownerClasses = (res.body.owner ?? []) as OwnerClassItem[];
      return ownerClasses.filter(
        (classItem) => classItem.courseId === course.id,
      );
    },
  });

  // Fetch class members for the dialog
  const { data: classData, isLoading: isLoadingClassData } = useQuery({
    queryKey: ["class-members-data", classId],
    enabled: memberManagerOpen && !!classId,
    queryFn: async () => {
      if (!classId) return null;
      const res = await api.classes.getClassWithCourse({ params: { classId } });
      if (res.status !== 200) return null;
      return res.body.data?.classData || null;
    },
  });

  // Derived: selected student name
  const selectedStudentName = useMemo(() => {
    if (!selectedStudentId) return "";
    return classStudents.find((s) => s.id === selectedStudentId)?.name || "";
  }, [selectedStudentId, classStudents]);

  // Helper: get stats badge color based on correct ratio
  const getStatsBadge = (correct: number, total: number) => {
    if (total === 0) return null;
    const ratio = correct / total;
    let colorClass: string;
    if (ratio >= 0.7) {
      colorClass = "bg-green-100 text-green-700";
    } else if (ratio >= 0.4) {
      colorClass = "bg-yellow-100 text-yellow-700";
    } else {
      colorClass = "bg-red-100 text-red-700";
    }
    return { label: `${correct}/${total}`, colorClass, ratio };
  };

  // ===== HELPER: Get icon for node type =====
  const getNodeIcon = (node: LessonNodeUI, isExpanded: boolean) => {
    switch (node.type) {
      case LessonNodeType.lesson:
        return <File className="w-4 h-4 text-blue-500" />;
      case LessonNodeType.course:
        return <BookOpen className="w-4 h-4 text-purple-500" />;
      case LessonNodeType.homework:
        return <File className="w-4 h-4 text-orange-500" />;
      default:
        return isExpanded ? (
          <FolderOpen className="w-4 h-4 text-yellow-500" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-500" />
        );
    }
  };

  // ===== RENDER: Tree node (recursive) =====
  const renderNode = (
    node: LessonNodeUI,
    level: number = 0,
  ): React.ReactNode => {
    if (node.type === LessonNodeType.homework) return null;

    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node._count.children > 0;
    const isDeleting = loadingAction === `delete-${node.id}`;

    // Get homework counts (student or teacher-student-view)
    const homeworkCounts =
      isStudent || isTeacherStudentView ? getHomeworkCounts(node.id) : null;
    const hasPendingHomework = homeworkCounts && homeworkCounts.pending > 0;

    return (
      <div key={node.id} className="group">
        <div
          className={`flex items-center gap-1 py-1 px-2 hover:bg-muted cursor-pointer ${
            isSelected ? "bg-blue-100 border-l-2 border-blue-500" : ""
          } ${isDeleting ? "opacity-50" : ""}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedNodeId(node.id)}
        >
          <div className="flex items-center gap-1 flex-1">
            {/* Expand/collapse button (ĐƠN GIẢN - không loading) */}
            {hasChildren && node.type !== LessonNodeType.lesson ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpanded(node); // Không async
                }}
                className="p-0.5 hover:bg-muted/80 rounded"
                disabled={isDeleting}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {getNodeIcon(node, isExpanded)}
            <span className="text-sm">{node.title}</span>

            {/* Badge homework counts (student or teacher-student-view) */}
            {(isStudent || isTeacherStudentView) &&
              homeworkCounts &&
              homeworkCounts.totalAssigned > 0 &&
              (showStats || isTeacherStudentView ? (
                // Stats mode: show correct/total with color
                (() => {
                  const stats = getStatsBadge(
                    homeworkCounts.correct,
                    homeworkCounts.totalAssigned,
                  );
                  return stats ? (
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${stats.colorClass}`}
                      title={`${homeworkCounts.correct} đúng / ${homeworkCounts.totalAssigned} tổng (${Math.round(stats.ratio * 100)}%)`}
                    >
                      {stats.label}
                    </span>
                  ) : null;
                })()
              ) : (
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                    hasPendingHomework
                      ? "bg-red-500 text-white"
                      : "bg-green-100 text-green-700"
                  }`}
                  title={`${homeworkCounts.pending} pending / ${homeworkCounts.totalAssigned} total`}
                >
                  {hasPendingHomework ? `${homeworkCounts.pending}` : "✓"}
                </span>
              ))}
          </div>

          {/* Delete button */}
          {node.type !== LessonNodeType.course && isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
              disabled={isDeleting || isPending}
              className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-3 h-3 text-red-500 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3 text-red-500" />
              )}
            </button>
          )}
        </div>

        {/* Render children - ĐƠN GIẢN */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ===== DERIVED: Homework nodes =====
  const homeworkNodes = useMemo(() => {
    if (selectedNode && selectedNode.type === LessonNodeType.lesson) {
      return (selectedNode.children || []).filter(
        (child) => child.type === LessonNodeType.homework,
      );
    }
    return [];
  }, [selectedNode]);

  const canAddToSelected =
    selectedNode && selectedNode.type !== LessonNodeType.lesson;
  const isAddingModule = loadingAction === "add-MODULE";
  const isAddingLesson = loadingAction === "add-LESSON";

  const Editor = useMemo(
    () =>
      dynamic(() => import("@/components/course-structure/Editor"), {
        ssr: false,
      }),
    [],
  );

  // ===== Auto-save content handler =====
  const handleSaveContent = useCallback(
    async (content: any[]) => {
      if (!selectedNode) return;
      await handleUpdateNode(selectedNode.id, { content });
    },
    [selectedNode, handleUpdateNode],
  );

  // ===== JSX =====
  return (
    <div className="flex h-screen bg-muted/50">
      {/* ===== TREE SIDEBAR ===== */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Course Structure
            </h2>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-foreground">{course.name}</span>
          </div>
          {isTeacher && classId && (
            <Link
              href={`/dashboard/class/${classId}/members`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors mb-2"
            >
              <Users className="w-4 h-4" />
              Manage Members
            </Link>
          )}
          {isOwner && classId && (
            <Dialog
              open={memberManagerOpen}
              onOpenChange={setMemberManagerOpen}
            >
              <DialogTrigger asChild>
                <Button className="w-full justify-start bg-muted hover:bg-muted/80 text-foreground mb-2">
                  <Users className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Manage Members</span>
                  <span className="sm:hidden">Members</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Manage Members</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Class Members</h3>
                    {isLoadingClassData ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <ClassMembersTable members={classData?.members || []} />
                    )}
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium mb-2">Add Members</h3>
                    <ClassSearchUser />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {(isAdmin || isMember) && (
            <div className="flex gap-2 w-full flex-col">
              <div>
                <Dialog
                  open={classManagerOpen}
                  onOpenChange={setClassManagerOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Class Manager</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Class Manager</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <CreateClassForm
                        courseId={course.id}
                        organizationId={course.organizationId}
                        onSuccess={() => {
                          void refetchOwnedClasses();
                        }}
                      />

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Classes you own in this course
                        </p>

                        {isLoadingOwnedClasses ? (
                          <p className="text-sm text-muted-foreground">
                            Loading classes...
                          </p>
                        ) : ownedClasses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            You have not created any class in this course yet.
                          </p>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {ownedClasses.map((ownedClass) => (
                              <Link
                                key={ownedClass.id}
                                href={`/dashboard/class/${ownedClass.id}`}
                                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                              >
                                <span className="truncate font-medium">
                                  {ownedClass.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Open
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddNode(LessonNodeType.module)}
                    disabled={!canAddToSelected || isPending}
                    className="flex-1 flex items-center justify-center p-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed"
                    title="Add Module"
                  >
                    {isAddingModule ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Module</span>
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => handleAddNode(LessonNodeType.lesson)}
                    disabled={!canAddToSelected || isPending}
                    className="flex-1 flex items-center justify-center p-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-muted disabled:cursor-not-allowed"
                    title="Add Lesson"
                  >
                    {isAddingLesson ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Lesson</span>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Student: Do homework button + Stats toggle */}
          {isStudent && (
            <div className="flex flex-col gap-2 mt-2">
              <StudentDoAllHomeworkDialog />
              <button
                onClick={() => setShowStats((prev) => !prev)}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  showStats
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                {showStats ? "Hide Statistics" : "View Statistics"}
              </button>
            </div>
          )}

          {/* Teacher: View student stats */}
          {isTeacher && classStudents.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  if (isTeacherStudentView) {
                    setSelectedStudentId(null);
                  } else {
                    setShowStudentDialog(true);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isTeacherStudentView
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                {isTeacherStudentView
                  ? "Hide statistics"
                  : "View student statistics"}
              </button>

              {/* Student pick dialog */}
              <Dialog
                open={showStudentDialog}
                onOpenChange={setShowStudentDialog}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Student</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-80">
                    <div className="py-1">
                      {classStudents.map((s) => {
                        const stats = classStudentStats.get(s.id);
                        const isSelected = selectedStudentId === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedStudentId(s.id);
                              setShowStudentDialog(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-md ${
                              isSelected
                                ? "bg-indigo-50 border-l-2 border-indigo-500"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            {s.image ? (
                              <img
                                src={s.image}
                                alt={s.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="flex-1 text-left truncate font-medium text-foreground">
                              {s.name}
                            </span>
                            {stats && stats.totalAssigned > 0 ? (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                                  stats.correct / stats.totalAssigned >= 0.7
                                    ? "bg-green-100 text-green-700"
                                    : stats.correct / stats.totalAssigned >= 0.4
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                                title={`${stats.correct} correct / ${stats.totalAssigned} total (${Math.round((stats.correct / stats.totalAssigned) * 100)}%)`}
                              >
                                {stats.correct}/{stats.totalAssigned}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                0/0
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {/* Student stats summary */}
              {isTeacherStudentView && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-indigo-700">
                      {selectedStudentName}
                    </div>
                    <button
                      onClick={() => setShowStudentDialog(true)}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                      title="Đổi học sinh"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Switch
                    </button>
                  </div>
                  {isLoadingStudentView ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                      <span className="text-xs text-indigo-500">
                        Loading...
                      </span>
                    </div>
                  ) : (
                    (() => {
                      const rootCounts = getHomeworkCounts(
                        course.rootLessonNodeId || "",
                      );
                      return (
                        <div className="text-xs text-indigo-600 mt-1">
                          {rootCounts.correct}/{rootCounts.totalAssigned}{" "}
                          correct • {rootCounts.pending} pending
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {isInitialLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading course...
              </span>
            </div>
          ) : course.rootLessonNode ? (
            renderNode(course.rootLessonNode)
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Nothing here
            </div>
          )}
        </div>
      </div>

      {/* ===== DETAIL PANEL ===== */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedNode ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-lg shadow-sm p-6">
              {/* Node Header */}
              <div className="mb-4">
                <div className="inline-block px-3 py-1 bg-muted text-foreground text-xs font-medium rounded-full mb-2">
                  {selectedNode.type}
                </div>
                {isAdmin ? (
                  <EditableTitle
                    initialTitle={selectedNode.title}
                    onSave={(newTitle) =>
                      handleUpdateNode(selectedNode.id, { title: newTitle })
                    }
                    isUpdating={isUpdatingNode === selectedNode.id}
                    className="text-2xl font-bold text-foreground block"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {selectedNode.title}
                  </h1>
                )}
              </div>

              {/* Content */}
              <Editor
                key={selectedNode.id}
                initialContent={
                  selectedNode.content
                    ? (selectedNode.content as any[])
                    : undefined
                }
                editable={isAdmin}
                onSave={handleSaveContent}
              />

              {/* Homework Section (Lesson only) */}
              {selectedNode.type === LessonNodeType.lesson && (
                <div className="border-t border-border mt-4 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Homework
                    </h3>
                    {isAdmin && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600">
                            <Plus className="w-2 h-2" />
                            <span className="hidden sm:inline">
                              Add Homework
                            </span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[90vw]! h-[95vh]! max-w-none! p-1! flex! flex-col! min-h-0!">
                          <DialogHeader className="px-6 py-4 border-b shrink-0">
                            <DialogTitle>Widget Marketplace</DialogTitle>
                          </DialogHeader>
                          <WidgetMarketplaceDialog />
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  {homeworkNodes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No assignments yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {homeworkNodes.map((hw) => {
                        const hwImplCount =
                          classLessonNodeCounts.get(hw.id)?.homework_imp || 0;
                        const hwClassLessonNodes = getClassLessonNodesByType(
                          hw.id,
                          "homework_imp",
                        );
                        const isHwExpanded = expandedClassLessonNodes.has(
                          hw.id,
                        );

                        // Get homework counts (student or teacher-student-view)
                        const homeworkCounts =
                          isStudent || isTeacherStudentView
                            ? getHomeworkCounts(hw.id)
                            : null;
                        const hasPendingHomework =
                          homeworkCounts && homeworkCounts.pending > 0;

                        return (
                          <div key={hw.id}>
                            {/* Homework header */}
                            <div className="flex items-center gap-2 p-2 bg-orange-50 rounded group">
                              <File className="w-4 h-4 text-orange-500" />

                              {/* Title */}
                              {isAdmin ? (
                                <div
                                  className="flex-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <EditableTitle
                                    initialTitle={hw.title}
                                    onSave={(newTitle) =>
                                      handleUpdateNode(hw.id, {
                                        title: newTitle,
                                      })
                                    }
                                    isUpdating={isUpdatingNode === hw.id}
                                    className="text-sm"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm flex-1">
                                  {hw.title}
                                </span>
                              )}

                              {/* Count badges */}
                              <div className="flex items-center gap-1">
                                {/* Total assignments count */}
                                {(isTeacher || isStudent) &&
                                  hwImplCount > 0 && (
                                    <span className="text-xs text-muted-foreground bg-orange-100 px-2 py-0.5 rounded">
                                      {hwImplCount}
                                    </span>
                                  )}

                                {/* Pending count (student or teacher-student-view) */}
                                {(isStudent || isTeacherStudentView) &&
                                  homeworkCounts &&
                                  homeworkCounts.totalAssigned > 0 &&
                                  (showStats || isTeacherStudentView ? (
                                    (() => {
                                      const stats = getStatsBadge(
                                        homeworkCounts.correct,
                                        homeworkCounts.totalAssigned,
                                      );
                                      return stats ? (
                                        <span
                                          className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${stats.colorClass}`}
                                          title={`${homeworkCounts.correct} correct / ${homeworkCounts.totalAssigned} total (${Math.round(stats.ratio * 100)}%)`}
                                        >
                                          {stats.label}
                                        </span>
                                      ) : null;
                                    })()
                                  ) : (
                                    <span
                                      className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                                        hasPendingHomework
                                          ? "bg-red-500 text-white"
                                          : "bg-green-100 text-green-700"
                                      }`}
                                      title={`${homeworkCounts.pending} not done / ${homeworkCounts.totalAssigned} tổng`}
                                    >
                                      {hasPendingHomework
                                        ? `${homeworkCounts.pending}`
                                        : "✓"}
                                    </span>
                                  ))}
                              </div>

                              {/* Expand button */}
                              {(isTeacher || isStudent) && (
                                <button
                                  onClick={() =>
                                    handleToggleClassLessonNodes(hw.id)
                                  }
                                  className="p-1 hover:bg-orange-200 rounded"
                                >
                                  {loadingClassLessonNodeIds.has(hw.id) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : isHwExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              )}

                              {/* Delete button */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteNode(hw.id)}
                                  className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              )}
                            </div>

                            {/* Expanded: Show assignments */}
                            {(isTeacher || isStudent) && isHwExpanded && (
                              <div className="ml-6 mt-2 space-y-1">
                                {/* Add button for teacher */}
                                {isTeacher && (
                                  <div className="mb-2">
                                    <TeacherAssignmentDialog hwId={hw.id} />
                                  </div>
                                )}

                                {/* List assignments */}
                                {hwClassLessonNodes.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic py-2">
                                    No assignments yet.
                                  </div>
                                ) : isTeacherStudentView ? (
                                  /* ===== TEACHER STUDENT VIEW: Split assigned/unassigned ===== */
                                  (() => {
                                    const assignedNodes =
                                      hwClassLessonNodes.filter((cln) =>
                                        studentSubmissionStatus.has(cln.id),
                                      );
                                    const unassignedNodes =
                                      hwClassLessonNodes.filter(
                                        (cln) =>
                                          !studentSubmissionStatus.has(cln.id),
                                      );

                                    return (
                                      <>
                                        {/* Assigned section */}
                                        {assignedNodes.length > 0 && (
                                          <>
                                            <div className="text-xs font-semibold text-green-700 py-1 border-b border-green-200">
                                              Assigned {selectedStudentName} (
                                              {assignedNodes.length})
                                            </div>
                                            {assignedNodes.map(
                                              (classLessonNode, index) => {
                                                const submissionStatus =
                                                  studentSubmissionStatus.get(
                                                    classLessonNode.id,
                                                  );
                                                const isPendingForStudent =
                                                  !submissionStatus ||
                                                  !submissionStatus.hasSubmitted;

                                                return (
                                                  <div
                                                    key={classLessonNode.id}
                                                    className={`flex items-center gap-2 p-2 rounded text-xs group transition-colors ${
                                                      isPendingForStudent
                                                        ? "bg-yellow-50 border border-yellow-200"
                                                        : "bg-green-50 border border-green-200"
                                                    }`}
                                                  >
                                                    <span className="font-semibold text-orange-700 min-w-fit">
                                                      Assignment{" "}
                                                      {hwImplCount -
                                                        hwClassLessonNodes.indexOf(
                                                          classLessonNode,
                                                        )}
                                                    </span>

                                                    {/* Assignment stats */}
                                                    {(() => {
                                                      const aStats =
                                                        assignmentStats.get(
                                                          classLessonNode.id,
                                                        );
                                                      if (!aStats) return null;
                                                      return (
                                                        <span
                                                          className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
                                                          title={`Assigned ${aStats.assigned}/${aStats.total} · Submited ${aStats.submitted}/${aStats.assigned}`}
                                                        >
                                                          <Users className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                                                          {aStats.assigned}/
                                                          {aStats.total}
                                                        </span>
                                                      );
                                                    })()}

                                                    {/* Status & Evaluation */}
                                                    <div className="flex items-center gap-2">
                                                      <span
                                                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                          isPendingForStudent
                                                            ? "bg-yellow-500 text-white"
                                                            : "bg-green-500 text-white"
                                                        }`}
                                                      >
                                                        {isPendingForStudent
                                                          ? "Not done"
                                                          : "Done"}
                                                      </span>

                                                      {!isPendingForStudent &&
                                                        submissionStatus?.evaluation && (
                                                          <div className="flex items-center gap-1">
                                                            {submissionStatus
                                                              .evaluation
                                                              .isCorrect ? (
                                                              <CheckCircle className="w-4 h-4 text-green-600" />
                                                            ) : (
                                                              <XCircle className="w-4 h-4 text-red-600" />
                                                            )}
                                                            <span className="font-semibold text-foreground">
                                                              {
                                                                submissionStatus
                                                                  .evaluation
                                                                  .score
                                                              }
                                                              /
                                                              {
                                                                submissionStatus
                                                                  .evaluation
                                                                  .maxScore
                                                              }
                                                            </span>
                                                          </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1" />

                                                    {/* Show student's assignment (read-only) */}
                                                    <TeacherStudentAssignmentViewDialog
                                                      assignmentId={
                                                        classLessonNode.id
                                                      }
                                                      studentId={
                                                        selectedStudentId!
                                                      }
                                                      studentName={
                                                        selectedStudentName
                                                      }
                                                    />

                                                    {/* Delete button */}
                                                    {isTeacher && (
                                                      <button
                                                        onClick={() =>
                                                          handleDeleteClassLessonNode(
                                                            hw.id,
                                                            classLessonNode.id,
                                                            "homework_imp",
                                                          )
                                                        }
                                                        className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100"
                                                      >
                                                        <Trash2 className="w-3 h-3 text-red-500" />
                                                      </button>
                                                    )}
                                                  </div>
                                                );
                                              },
                                            )}
                                          </>
                                        )}

                                        {/* Unassigned section */}
                                        {unassignedNodes.length > 0 && (
                                          <>
                                            <div className="text-xs font-semibold text-muted-foreground py-1 border-b border-border mt-2">
                                              Unassigned {selectedStudentName} (
                                              {unassignedNodes.length})
                                            </div>
                                            {unassignedNodes.map(
                                              (classLessonNode, index) => (
                                                <div
                                                  key={classLessonNode.id}
                                                  className="flex items-center gap-2 p-2 rounded text-xs group transition-colors bg-muted/50 border border-border"
                                                >
                                                  <span className="font-semibold text-orange-700 min-w-fit">
                                                    Bài{" "}
                                                    {hwImplCount -
                                                      hwClassLessonNodes.indexOf(
                                                        classLessonNode,
                                                      )}
                                                  </span>

                                                  {/* Assignment stats */}
                                                  {(() => {
                                                    const aStats =
                                                      assignmentStats.get(
                                                        classLessonNode.id,
                                                      );
                                                    if (!aStats) return null;
                                                    return (
                                                      <span
                                                        className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
                                                        title={`Đã giao ${aStats.assigned}/${aStats.total} · Đã nộp ${aStats.submitted}/${aStats.assigned}`}
                                                      >
                                                        <Users className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                                                        {aStats.assigned}/
                                                        {aStats.total}
                                                      </span>
                                                    );
                                                  })()}

                                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-muted-foreground text-background">
                                                    Unassigned
                                                  </span>

                                                  <div className="flex-1" />

                                                  {/* Show Assignment with direct assign to student */}
                                                  <TeacherViewAssignmentDialog
                                                    assignmentId={
                                                      classLessonNode.id
                                                    }
                                                    targetStudentId={
                                                      selectedStudentId
                                                    }
                                                    targetStudentName={
                                                      selectedStudentName
                                                    }
                                                  />

                                                  {/* Delete button */}
                                                  {isTeacher && (
                                                    <button
                                                      onClick={() =>
                                                        handleDeleteClassLessonNode(
                                                          hw.id,
                                                          classLessonNode.id,
                                                          "homework_imp",
                                                        )
                                                      }
                                                      className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100"
                                                    >
                                                      <Trash2 className="w-3 h-3 text-red-500" />
                                                    </button>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </>
                                        )}
                                      </>
                                    );
                                  })()
                                ) : (
                                  /* ===== ORIGINAL RENDERING ===== */
                                  hwClassLessonNodes.map(
                                    (classLessonNode, index) => {
                                      // Check submission status
                                      const submissionStatus =
                                        studentSubmissionStatus.get(
                                          classLessonNode.id,
                                        );
                                      const isPending =
                                        isStudent &&
                                        (!submissionStatus ||
                                          !submissionStatus.hasSubmitted);

                                      return (
                                        <div
                                          key={classLessonNode.id}
                                          className={`flex items-center gap-2 p-2 rounded text-xs group transition-colors ${
                                            isPending
                                              ? "bg-yellow-50 border border-yellow-200"
                                              : "bg-green-50 border border-green-200"
                                          }`}
                                        >
                                          {/* Assignment number */}
                                          <span className="font-semibold text-orange-700 min-w-fit">
                                            Assignment {hwImplCount - index}
                                          </span>

                                          {/* Assignment stats (teacher) */}
                                          {isTeacher &&
                                            (() => {
                                              const aStats =
                                                assignmentStats.get(
                                                  classLessonNode.id,
                                                );
                                              if (!aStats) return null;
                                              return (
                                                <div className="flex items-center gap-1.5">
                                                  <span
                                                    className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
                                                    title={`Đã giao ${aStats.assigned}/${aStats.total}`}
                                                  >
                                                    <Users className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                                                    {aStats.assigned}/
                                                    {aStats.total}
                                                  </span>
                                                  <span
                                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                                      aStats.submitted ===
                                                        aStats.assigned &&
                                                      aStats.assigned > 0
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-yellow-100 text-yellow-700"
                                                    }`}
                                                    title={`Đã nộp ${aStats.submitted}/${aStats.assigned}`}
                                                  >
                                                    <CheckCircle className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                                                    {aStats.submitted}/
                                                    {aStats.assigned}
                                                  </span>
                                                </div>
                                              );
                                            })()}

                                          {/* Status & Evaluation */}
                                          {isStudent && (
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                  isPending
                                                    ? "bg-yellow-500 text-white"
                                                    : "bg-green-500 text-white"
                                                }`}
                                              >
                                                {isPending
                                                  ? "Not done"
                                                  : "Done"}
                                              </span>

                                              {/* Evaluation result (if submitted) */}
                                              {!isPending &&
                                                submissionStatus?.evaluation && (
                                                  <div className="flex items-center gap-1">
                                                    {submissionStatus.evaluation
                                                      .isCorrect ? (
                                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                                    ) : (
                                                      <XCircle className="w-4 h-4 text-red-600" />
                                                    )}
                                                    <span className="font-semibold text-foreground">
                                                      {
                                                        submissionStatus
                                                          .evaluation.score
                                                      }
                                                      /
                                                      {
                                                        submissionStatus
                                                          .evaluation.maxScore
                                                      }
                                                    </span>
                                                  </div>
                                                )}
                                            </div>
                                          )}

                                          {/* Spacer */}
                                          <div className="flex-1" />

                                          {/* View/Do button (on the right) */}
                                          {isTeacher && (
                                            <TeacherViewAssignmentDialog
                                              assignmentId={classLessonNode.id}
                                            />
                                          )}
                                          {isStudent && (
                                            <StudentViewAssignmentDialog
                                              assignmentId={classLessonNode.id}
                                            />
                                          )}

                                          {/* Delete button (teacher only) */}
                                          {isTeacher && (
                                            <button
                                              onClick={() =>
                                                handleDeleteClassLessonNode(
                                                  hw.id,
                                                  classLessonNode.id,
                                                  "homework_imp",
                                                )
                                              }
                                              className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100"
                                            >
                                              <Trash2 className="w-3 h-3 text-red-500" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    },
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Lesson Notes (Class view only) */}
                  {(isTeacher || isStudent) && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          Notes
                          {(classLessonNodeCounts.get(selectedNode.id)
                            ?.lesson_note || 0) > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground bg-blue-100 px-2 py-0.5 rounded">
                              {
                                classLessonNodeCounts.get(selectedNode.id)
                                  ?.lesson_note
                              }
                            </span>
                          )}
                        </h3>
                        <div className="flex gap-2">
                          {isTeacher && (
                            <button
                              onClick={() =>
                                handleAddClassLessonNode(
                                  selectedNode.id,
                                  "lesson_note",
                                )
                              }
                              disabled={isPending}
                              className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:bg-muted"
                            >
                              + Add Note
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleToggleClassLessonNodes(selectedNode.id)
                            }
                            className="p-1 hover:bg-muted/80 rounded"
                          >
                            {loadingClassLessonNodeIds.has(selectedNode.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : expandedClassLessonNodes.has(
                                selectedNode.id,
                              ) ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {expandedClassLessonNodes.has(selectedNode.id) && (
                        <div className="space-y-2">
                          {getClassLessonNodesByType(
                            selectedNode.id,
                            "lesson_note",
                          ).map((note) => (
                            <div
                              key={note.id}
                              className="flex items-center gap-2 p-2 bg-blue-50 rounded group"
                            >
                              <span className="text-sm flex-1">
                                📝 {note.content?.text || "Note"}
                              </span>
                              {isTeacher && (
                                <button
                                  onClick={() =>
                                    handleDeleteClassLessonNode(
                                      selectedNode.id,
                                      note.id,
                                      "lesson_note",
                                    )
                                  }
                                  className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Select a node to view details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== WRAPPER WITH PROVIDER =====
const CourseStructureManager: React.FC<CourseStructureManagerProps> = ({
  initialCourse,
  classId,
  userRole,
}) => {
  return (
    <CourseStructureProvider
      initialCourse={initialCourse}
      classId={classId}
      userRole={userRole}
    >
      <CourseStructureRoleContent />
    </CourseStructureProvider>
  );
};

export default CourseStructureManager;
