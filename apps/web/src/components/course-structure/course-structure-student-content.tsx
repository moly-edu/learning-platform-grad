import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  XCircle,
} from "lucide-react";

import { LessonNodeType, LessonNodeUI } from "@/types/course";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import StudentDoAllHomeworkDialog from "./StudentDoAllHomeworkDialog";
import StudentViewAssignmentDialog from "../widget/homework/StudentViewAssignmentDialog";

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
      };
    }

    if (ratio >= 0.4) {
      return {
        label: `${correct}/${total}`,
        colorClass: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: `${correct}/${total}`,
      colorClass: "bg-rose-100 text-rose-700",
    };
  };

  const getNodeIcon = (node: LessonNodeUI, isExpanded: boolean) => {
    switch (node.type) {
      case LessonNodeType.lesson:
        return <File className="w-5 h-5 text-blue-500" />;
      case LessonNodeType.course:
        return <BookOpen className="w-5 h-5 text-indigo-500" />;
      default:
        return isExpanded ? (
          <FolderOpen className="w-5 h-5 text-amber-500" />
        ) : (
          <Folder className="w-5 h-5 text-amber-500" />
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
    const canToggle = hasChildren && node.type !== LessonNodeType.lesson;

    const homeworkCounts = getHomeworkCounts(node.id);
    const hasPendingHomework =
      homeworkCounts.totalAssigned > 0 && homeworkCounts.pending > 0;

    const handleNodeClick = () => {
      setSelectedNodeId(node.id);
      if (canToggle) {
        toggleNodeExpanded(node);
      }
    };

    return (
      <div key={node.id} className="group">
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors border ${
            isSelected
              ? "bg-indigo-100 border-indigo-300 shadow-sm"
              : "border-transparent hover:bg-muted"
          }`}
          style={{ marginLeft: `${level * 14}px` }}
          onClick={handleNodeClick}
        >
          {getNodeIcon(node, isExpanded)}
          <span className="text-lg font-semibold text-foreground">
            {node.title}
          </span>

          {canToggle && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
              {isExpanded ? "Đang mở" : "Chạm để mở"}
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
                    className={`ml-auto text-sm px-3 py-1 rounded-full font-bold ${stats.colorClass}`}
                    title={`${homeworkCounts.correct} correct / ${homeworkCounts.totalAssigned} total`}
                  >
                    {stats.label}
                  </span>
                ) : null;
              })()
            ) : (
              <span
                className={`ml-auto text-sm px-3 py-1 rounded-full font-bold ${
                  hasPendingHomework
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-100 text-emerald-700"
                }`}
                title={`${homeworkCounts.pending} pending / ${homeworkCounts.totalAssigned} total`}
              >
                {hasPendingHomework
                  ? `${homeworkCounts.pending}`
                  : "Hoàn thành"}
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
    <div className="flex h-screen bg-linear-to-b from-indigo-100/80 via-background to-sky-100/60">
      <div className="w-96 border-r border-border bg-card/95 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div className="rounded-3xl bg-linear-to-r from-indigo-500 to-sky-500 text-white p-5 shadow-sm">
            <p className="text-sm font-semibold tracking-wide text-white/90">
              Hành trình học tập
            </p>
            <h2 className="text-2xl font-extrabold leading-snug mt-1">
              {course.name}
            </h2>
            <p className="text-base text-white/95 mt-2">
              Đúng: {rootCounts.correct}/{rootCounts.totalAssigned} • Chưa làm:{" "}
              {rootCounts.pending}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <StudentDoAllHomeworkDialog />
            <button
              onClick={() => setShowStats((prev) => !prev)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-bold rounded-2xl border transition-colors ${
                showStats
                  ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {showStats ? "Ẩn điểm số" : "Xem điểm số"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isInitialLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-lg text-muted-foreground">
                Đang tải bài học...
              </span>
            </div>
          ) : course.rootLessonNode ? (
            <div className="space-y-1">
              {renderStudentNode(course.rootLessonNode)}
            </div>
          ) : (
            <div className="p-4 text-lg text-muted-foreground">
              Chưa có nội dung.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {selectedNode ? (
          <div className="max-w-6xl mx-auto">
            <div className="bg-card rounded-3xl shadow-sm border border-border p-8">
              <div className="mb-6">
                <div className="inline-block px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-full mb-2">
                  {selectedNode.type}
                </div>
                <h1 className="text-4xl font-extrabold text-foreground leading-tight">
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
                <div className="border-t border-border mt-8 pt-8 space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">
                    Bài tập
                  </h3>

                  {homeworkNodes.length === 0 ? (
                    <div className="text-lg text-muted-foreground">
                      Chưa có bài tập.
                    </div>
                  ) : (
                    <div className="space-y-4">
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
                            className="rounded-2xl border border-border bg-muted/30"
                          >
                            <div className="flex items-center gap-2 p-4">
                              <File className="w-4 h-4 text-orange-500" />
                              <span className="text-lg font-bold flex-1">
                                {hw.title}
                              </span>

                              {hwImplCount > 0 && (
                                <span className="text-sm text-muted-foreground bg-orange-100 px-2.5 py-1 rounded-full font-semibold">
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
                                        className={`text-sm px-3 py-1 rounded-full font-bold ${stats.colorClass}`}
                                      >
                                        {stats.label}
                                      </span>
                                    ) : null;
                                  })()
                                ) : (
                                  <span
                                    className={`text-sm px-3 py-1 rounded-full font-bold ${
                                      hasPendingHomework
                                        ? "bg-rose-500 text-white"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {hasPendingHomework
                                      ? `${homeworkCounts.pending} chưa làm`
                                      : "Hoàn thành"}
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
                                  <div className="text-base text-muted-foreground italic py-1">
                                    Chưa có bài tập.
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
                                          className={`flex items-center gap-2 p-3 rounded-xl text-base ${
                                            isPending
                                              ? "bg-amber-50 border border-amber-200"
                                              : "bg-emerald-50 border border-emerald-200"
                                          }`}
                                        >
                                          <span className="font-semibold text-orange-700 min-w-fit">
                                            Assignment {hwImplCount - index}
                                          </span>

                                          <span
                                            className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                                              isPending
                                                ? "bg-amber-500 text-white"
                                                : "bg-emerald-500 text-white"
                                            }`}
                                          >
                                            {isPending ? "Chưa làm" : "Đã làm"}
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

                  <div className="pt-5 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        Notes
                        {(classLessonNodeCounts.get(selectedNode.id)
                          ?.lesson_note || 0) > 0 && (
                          <span className="ml-2 text-sm text-muted-foreground bg-blue-100 px-2.5 py-1 rounded-full font-semibold">
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
                            className="flex items-center gap-2 p-4 rounded-xl bg-blue-50"
                          >
                            <span className="text-lg">
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
            <p className="text-xl text-muted-foreground">
              Chọn bài học để xem nội dung.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCourseStructureContent;
