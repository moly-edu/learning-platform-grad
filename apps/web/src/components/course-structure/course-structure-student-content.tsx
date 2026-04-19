import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PartialBlock } from "@blocknote/core";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import StudentDoAllHomeworkDialog from "./StudentDoAllHomeworkDialog";
import StudentViewAssignmentDialog from "../widget/homework/StudentViewAssignmentDialog";
import { useLocale } from "next-intl";

type StudentViewMode = "structure" | "timeline";

const LESSON_CARD_STYLES = [
  "bg-cyan-400",
  "bg-rose-400",
  "bg-amber-300",
  "bg-sky-500",
];

const StudentCourseStructureContent: React.FC = () => {
  const locale = useLocale();
  const isVi = locale === "vi";

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
  const [viewMode, setViewMode] = useState<StudentViewMode>("timeline");
  const [isLessonSheetOpen, setIsLessonSheetOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const t = {
    journey: isVi ? "Hành trình học tập" : "Learning journey",
    correct: isVi ? "Đúng" : "Correct",
    pending: isVi ? "Chưa làm" : "Pending",
    noHomework: isVi ? "Chưa có bài tập." : "No homework yet.",
    done: isVi ? "Hoàn thành" : "Completed",
    pendingShort: isVi ? "chưa làm" : "pending",
    openNode: isVi ? "Đang mở" : "Open",
    tapToOpen: isVi ? "Chạm để mở" : "Tap to open",
    loadLessons: isVi ? "Đang tải bài học..." : "Loading lessons...",
    noContent: isVi ? "Chưa có nội dung." : "No content yet.",
    noLesson: isVi ? "Chưa có lesson" : "No lessons yet",
    pickLesson: isVi
      ? "Chọn bài học để xem nội dung."
      : "Select a lesson to view details.",
    showScores: isVi ? "Xem điểm số" : "Show scores",
    hideScores: isVi ? "Ẩn điểm số" : "Hide scores",
    courseStructure: isVi ? "Cấu trúc khóa học" : "Course Structure",
    lesson3d: isVi ? "Bài học 3D" : "3D Lessons",
    switchTo3d: isVi ? "Chế độ 3D" : "3D Mode",
    switchToStructure: isVi ? "Chế độ cũ" : "Classic mode",
    assignments: isVi ? "Bài tập" : "Homework",
    homeworkList: isVi ? "Danh sách homework" : "Homework list",
    notes: isVi ? "Ghi chú" : "Notes",
    assignmentWord: isVi ? "Bài" : "Assignment",
    notDone: isVi ? "Chưa làm" : "Not done",
    doneWord: isVi ? "Đã làm" : "Done",
    highest: isVi ? "Cao nhất" : "Highest",
    scoreWord: isVi ? "Điểm" : "Score",
    lessonFallback: isVi ? "Bài học" : "Lesson",
    toggleAssignments: isVi
      ? "Mở/rút danh sách assignment"
      : "Toggle assignments",
    toggleNotes: isVi ? "Mở/rút ghi chú" : "Toggle notes",
  };

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
        return <File className="h-5 w-5 text-blue-500" />;
      case LessonNodeType.course:
        return <BookOpen className="h-5 w-5 text-indigo-500" />;
      default:
        return isExpanded ? (
          <FolderOpen className="h-5 w-5 text-amber-500" />
        ) : (
          <Folder className="h-5 w-5 text-amber-500" />
        );
    }
  };

  const lessonNodes = useMemo(() => {
    if (!course.rootLessonNode) return [];

    const lessons: LessonNodeUI[] = [];
    const walk = (node: LessonNodeUI) => {
      if (node.type === LessonNodeType.lesson) {
        lessons.push(node);
      }
      for (const child of node.children || []) {
        walk(child);
      }
    };

    walk(course.rootLessonNode);
    return lessons;
  }, [course.rootLessonNode]);

  const activeLesson = useMemo(
    () => lessonNodes.find((lesson) => lesson.id === activeLessonId) ?? null,
    [lessonNodes, activeLessonId],
  );

  const lessonHomeworkNodes = useMemo(() => {
    if (!activeLesson) return [];
    return (activeLesson.children || []).filter(
      (child) => child.type === LessonNodeType.homework,
    );
  }, [activeLesson]);

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

  const openLessonSheet = (lesson: LessonNodeUI) => {
    setActiveLessonId(lesson.id);
    setSelectedNodeId(lesson.id);
    setIsLessonSheetOpen(true);
  };

  const renderHomeworkList = (
    nodes: LessonNodeUI[],
    containerClassName = "space-y-4",
    useScoreBadge = showStats,
    expandOnCardClick = false,
    showExpandButton = true,
  ) => {
    if (nodes.length === 0) {
      return (
        <div className="text-lg text-muted-foreground">{t.noHomework}</div>
      );
    }

    return (
      <div className={containerClassName}>
        {nodes.map((hw) => {
          const hwImplCount =
            classLessonNodeCounts.get(hw.id)?.homework_imp || 0;
          const hwClassLessonNodes = getClassLessonNodesByType(
            hw.id,
            "homework_imp",
          );
          const isHwExpanded = expandedClassLessonNodes.has(hw.id);
          const toggleHomeworkExpand = () =>
            handleToggleClassLessonNodes(hw.id);

          const counts = getHomeworkCounts(hw.id);
          const hasPendingHomework = counts.pending > 0;

          return (
            <div
              key={hw.id}
              className="rounded-2xl border-2 border-slate-800 bg-card shadow-[0_6px_0_0_rgba(15,23,42,0.25)]"
            >
              <div
                className={`flex items-center gap-2 p-4 ${expandOnCardClick ? "cursor-pointer hover:bg-muted/30" : ""}`}
                onClick={expandOnCardClick ? toggleHomeworkExpand : undefined}
              >
                <File className="h-4 w-4 text-orange-500" />
                <span className="flex-1 text-lg font-bold">{hw.title}</span>

                {hwImplCount > 0 && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-sm font-semibold text-muted-foreground">
                    {hwImplCount}
                  </span>
                )}

                {counts.totalAssigned > 0 &&
                  (useScoreBadge ? (
                    (() => {
                      const stats = getStatsBadge(
                        counts.correct,
                        counts.totalAssigned,
                      );
                      return stats ? (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-bold ${stats.colorClass}`}
                        >
                          {stats.label}
                        </span>
                      ) : null;
                    })()
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        hasPendingHomework
                          ? "bg-rose-500 text-white"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {hasPendingHomework
                        ? `${counts.pending} ${t.pendingShort}`
                        : t.done}
                    </span>
                  ))}

                {showExpandButton && (
                  <button
                    onClick={toggleHomeworkExpand}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label={t.toggleAssignments}
                  >
                    {loadingClassLessonNodeIds.has(hw.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isHwExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {isHwExpanded && (
                <div className="space-y-2 px-3 pb-3">
                  {hwClassLessonNodes.length === 0 ? (
                    <div className="py-1 text-base italic text-muted-foreground">
                      {t.noHomework}
                    </div>
                  ) : (
                    hwClassLessonNodes.map((classLessonNode, index) => {
                      const submissionStatus = studentSubmissionStatus.get(
                        classLessonNode.id,
                      );
                      const isPending =
                        !submissionStatus || !submissionStatus.hasSubmitted;
                      const attemptCount = submissionStatus?.attemptCount ?? 0;
                      const correctAttemptCount =
                        submissionStatus?.correctAttemptCount ?? 0;
                      const maxScore =
                        submissionStatus?.evaluation?.maxScore ?? 100;
                      const highestScore =
                        submissionStatus?.highestScore ??
                        submissionStatus?.evaluation?.score ??
                        0;

                      return (
                        <div
                          key={classLessonNode.id}
                          className={`flex items-center gap-2 rounded-xl p-3 text-base ${
                            isPending
                              ? "border border-amber-200 bg-amber-50"
                              : "border border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <span className="min-w-fit font-semibold text-orange-700">
                            {t.assignmentWord}{" "}
                            {Math.max(hwImplCount - index, 1)}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                              isPending
                                ? "bg-amber-500 text-white"
                                : "bg-emerald-500 text-white"
                            }`}
                          >
                            {isPending ? t.notDone : t.doneWord}
                          </span>

                          {!isPending && submissionStatus?.evaluation && (
                            <div className="flex items-center gap-1">
                              {submissionStatus.evaluation.isCorrect ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-rose-600" />
                              )}
                              <span className="font-semibold">
                                {submissionStatus.evaluation.score}/
                                {submissionStatus.evaluation.maxScore}
                              </span>
                            </div>
                          )}

                          {!isPending && submissionStatus && (
                            <div className="text-xs text-muted-foreground">
                              {t.correct}: {correctAttemptCount}/
                              {Math.max(attemptCount, 1)} • {t.highest}:{" "}
                              {highestScore}/{maxScore}
                            </div>
                          )}

                          <div className="flex-1" />
                          <StudentViewAssignmentDialog
                            assignmentId={classLessonNode.id}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStudentNode = (
    node: LessonNodeUI,
    level = 0,
  ): React.ReactNode => {
    if (node.type === LessonNodeType.homework) return null;

    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node._count.children > 0;
    const canToggle = hasChildren && node.type !== LessonNodeType.lesson;

    const counts = getHomeworkCounts(node.id);
    const hasPendingHomework = counts.totalAssigned > 0 && counts.pending > 0;

    const handleNodeClick = () => {
      setSelectedNodeId(node.id);
      if (canToggle) {
        toggleNodeExpanded(node);
      }
    };

    return (
      <div key={node.id} className="group">
        <div
          className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3.5 transition-colors ${
            isSelected
              ? "border-indigo-300 bg-indigo-100 shadow-sm"
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
              {isExpanded ? t.openNode : t.tapToOpen}
            </span>
          )}

          {counts.totalAssigned > 0 &&
            (showStats ? (
              (() => {
                const stats = getStatsBadge(
                  counts.correct,
                  counts.totalAssigned,
                );
                return stats ? (
                  <span
                    className={`ml-auto rounded-full px-3 py-1 text-sm font-bold ${stats.colorClass}`}
                    title={`${counts.correct} correct / ${counts.totalAssigned} total`}
                  >
                    {stats.label}
                  </span>
                ) : null;
              })()
            ) : (
              <span
                className={`ml-auto rounded-full px-3 py-1 text-sm font-bold ${
                  hasPendingHomework
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-100 text-emerald-700"
                }`}
                title={`${counts.pending} pending / ${counts.totalAssigned} total`}
              >
                {hasPendingHomework ? `${counts.pending}` : t.done}
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

  return (
    <>
      {viewMode === "structure" ? (
        <div className="relative flex h-screen bg-linear-to-b from-indigo-100/80 via-background to-sky-100/60">
          <button
            onClick={() => setViewMode("timeline")}
            className="absolute top-4 right-4 z-20 rounded-xl border-2 border-slate-900 bg-amber-200 px-3 py-2 text-xs font-extrabold text-slate-900 shadow-[0_4px_0_0_rgba(15,23,42,0.25)]"
          >
            {t.switchTo3d}
          </button>

          <div className="flex w-96 flex-col border-r border-border bg-card/95 backdrop-blur-sm">
            <div className="space-y-2 border-b border-border p-3">
              <div className="rounded-2xl bg-linear-to-r from-indigo-500 to-sky-500 p-4 text-white shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-white/80">
                  {t.journey}
                </p>
                <h2 className="mt-0.5 text-xl leading-tight font-bold">
                  {course.name}
                </h2>
                <p className="mt-1 text-sm text-white/90">
                  {t.correct}: {rootCounts.correct}/{rootCounts.totalAssigned} •{" "}
                  {t.pending}: {rootCounts.pending}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <StudentDoAllHomeworkDialog variant="classic" />
                <button
                  onClick={() => setShowStats((prev) => !prev)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    showStats
                      ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  {showStats ? t.hideScores : t.showScores}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {isInitialLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-lg text-muted-foreground">
                    {t.loadLessons}
                  </span>
                </div>
              ) : course.rootLessonNode ? (
                <div className="space-y-1">
                  {renderStudentNode(course.rootLessonNode)}
                </div>
              ) : (
                <div className="p-4 text-lg text-muted-foreground">
                  {t.noContent}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {selectedNode ? (
              <div className="mx-auto max-w-6xl">
                <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                  <div className="mb-6">
                    <div className="mb-2 inline-block rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-bold text-indigo-700">
                      {selectedNode.type}
                    </div>
                    <h1 className="text-4xl leading-tight font-extrabold text-foreground">
                      {selectedNode.title}
                    </h1>
                  </div>

                  <Editor
                    key={selectedNode.id}
                    initialContent={
                      selectedNode.content
                        ? (selectedNode.content as PartialBlock[])
                        : undefined
                    }
                    editable={false}
                    onSave={async () => {}}
                  />

                  {selectedNode.type === LessonNodeType.lesson && (
                    <div className="mt-8 space-y-4 border-t border-border pt-8">
                      <h3 className="text-2xl font-bold text-foreground">
                        {t.assignments}
                      </h3>

                      {renderHomeworkList(homeworkNodes)}

                      <div className="border-border pt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-foreground">
                            {t.notes}
                            {(classLessonNodeCounts.get(selectedNode.id)
                              ?.lesson_note || 0) > 0 && (
                              <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-semibold text-muted-foreground">
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
                            className="rounded p-1.5 hover:bg-muted"
                            aria-label={t.toggleNotes}
                          >
                            {loadingClassLessonNodeIds.has(selectedNode.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : expandedClassLessonNodes.has(
                                selectedNode.id,
                              ) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
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
                                className="flex items-center gap-2 rounded-xl bg-blue-50 p-4"
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
              <div className="flex h-full items-center justify-center">
                <p className="text-xl text-muted-foreground">{t.pickLesson}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-screen flex-col bg-linear-to-b from-emerald-50 via-sky-50 to-indigo-100">
          <div className="border-b border-slate-200/90 bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="rounded-xl border border-slate-300 bg-white px-3 py-1.5">
                <p className="text-sm font-bold text-slate-800">
                  {course.name}
                </p>
                <p className="text-xs text-slate-600">
                  {t.correct}: {rootCounts.correct}/{rootCounts.totalAssigned} •{" "}
                  {t.pending}: {rootCounts.pending}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-42 [&>button]:h-9 [&>button]:px-3 [&>button]:text-xs [&>button_svg]:mr-1 [&>button_svg]:h-3.5 [&>button_svg]:w-3.5">
                  <StudentDoAllHomeworkDialog variant="threeD" />
                </div>
                <button
                  onClick={() => setViewMode("structure")}
                  className="rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-[0_3px_0_0_rgba(15,23,42,0.2)]"
                >
                  {t.switchToStructure}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6">
              {isInitialLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-lg text-muted-foreground">
                    {t.loadLessons}
                  </span>
                </div>
              ) : lessonNodes.length === 0 ? (
                <div className="rounded-3xl border-2 border-slate-800 bg-white p-8 text-center shadow-[0_8px_0_0_rgba(15,23,42,0.22)]">
                  <p className="text-2xl font-extrabold text-slate-700">
                    {t.noLesson}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-1/2 top-0 bottom-14 hidden -translate-x-1/2 border-l-3 border-dashed border-slate-300 md:block" />

                  <div className="space-y-6">
                    {lessonNodes.map((lesson, index) => {
                      const counts = getHomeworkCounts(lesson.id);
                      const done = Math.max(
                        0,
                        counts.totalAssigned - counts.pending,
                      );
                      const isPerfect =
                        counts.totalAssigned > 0 &&
                        done === counts.totalAssigned;
                      const alignLeft = index % 2 === 0;
                      const cardBg =
                        LESSON_CARD_STYLES[index % LESSON_CARD_STYLES.length];

                      return (
                        <div key={lesson.id} className="relative min-h-32.5">
                          <div className="absolute top-1/2 left-1/2 z-10 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-3 border-slate-900 bg-white text-lg font-black text-slate-900 shadow-[0_4px_0_0_rgba(15,23,42,0.22)] md:flex">
                            {isPerfect ? "🏆" : index + 1}
                          </div>

                          <div
                            className={
                              alignLeft ? "md:mr-[52%]" : "md:ml-[52%]"
                            }
                          >
                            <button
                              onClick={() => openLessonSheet(lesson)}
                              className={`w-full rounded-3xl border-2 border-slate-900 px-4 py-4 text-left shadow-[0_8px_0_0_rgba(15,23,42,0.24)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${cardBg}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl leading-6 font-black text-white drop-shadow-[0_1px_0_rgba(15,23,42,0.25)]">
                                  {lesson.title}
                                </h3>
                                <span className="rounded-xl border border-slate-800 bg-white/90 px-3 py-1.5 text-sm font-extrabold text-slate-800">
                                  ⭐ {done}/{counts.totalAssigned}
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Sheet open={isLessonSheetOpen} onOpenChange={setIsLessonSheetOpen}>
        <SheetContent className="w-full overflow-y-auto rounded-l-2xl border-l-2 border-slate-800 px-5 sm:w-190 sm:max-w-none sm:px-7">
          <SheetHeader>
            <SheetTitle className="text-left text-2xl font-extrabold text-slate-900">
              {activeLesson?.title || t.lessonFallback}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-8 space-y-5 pb-6">
            {activeLesson ? (
              <div className="rounded-2xl border-2 border-slate-800 bg-linear-to-r from-sky-100 to-indigo-100 p-4 shadow-[0_6px_0_0_rgba(15,23,42,0.22)]">
                <p className="text-base text-slate-700">
                  {t.correct}: {getHomeworkCounts(activeLesson.id).correct}/
                  {getHomeworkCounts(activeLesson.id).totalAssigned} •{" "}
                  {t.pending}: {getHomeworkCounts(activeLesson.id).pending}
                </p>
              </div>
            ) : null}

            <h3 className="text-xl font-black text-slate-900">
              {t.homeworkList}
            </h3>
            {renderHomeworkList(
              lessonHomeworkNodes,
              "space-y-3",
              false,
              true,
              false,
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default StudentCourseStructureContent;
