"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import StudentAssignmentView from "@/components/widget/homework/StudentAssignmentView";
import { CheckCircle, Circle, Loader2, Play, XCircle } from "lucide-react";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import { useLocale } from "next-intl";

interface PendingAssignment {
  classLessonNodeId: string;
  index: number;
  isCompleted: boolean;
  isCorrect?: boolean; // NEW: Track if the submission is correct
}

type StudentDoAllHomeworkDialogProps = {
  variant?: "classic" | "threeD";
};

export default function StudentDoAllHomeworkDialog({
  variant = "classic",
}: StudentDoAllHomeworkDialogProps) {
  const isVi = useLocale() === "vi";
  const { studentSubmissionStatus, isStudent } = useCourseStructure();
  const isThreeD = variant === "threeD";

  const [open, setOpen] = useState(false);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string>();
  // 🔍 Track which assignments were pending when dialog opened (để không bị ảnh hưởng bởi reload)
  const [pendingWhenOpened, setPendingWhenOpened] = useState<string[]>([]);
  // 📊 Track evaluation (isCorrect) for each assignment
  const [evaluationMap, setEvaluationMap] = useState<
    Map<string, { isCorrect: boolean }>
  >(new Map());

  // 📊 Get current pending assignments from studentSubmissionStatus
  const pendingAssignments = useMemo(() => {
    const items: PendingAssignment[] = [];
    let index = 1;

    studentSubmissionStatus.forEach((status, assignmentId) => {
      if (!status.hasSubmitted) {
        items.push({
          classLessonNodeId: assignmentId,
          index: index++,
          isCompleted: false,
        });
      }
    });

    return items;
  }, [studentSubmissionStatus]);

  // Nếu chưa track pending khi mở dialog thì track ngay
  useEffect(() => {
    if (
      open &&
      pendingWhenOpened.length === 0 &&
      pendingAssignments.length > 0
    ) {
      const ids = pendingAssignments.map((a) => a.classLessonNodeId);
      setPendingWhenOpened(ids);
      if (!currentAssignmentId) {
        setCurrentAssignmentId(ids[0]);
      }
    }
  }, [open, pendingAssignments, pendingWhenOpened.length, currentAssignmentId]);

  // Set first assignment as current when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset khi đóng dialog
      setCurrentAssignmentId(undefined);
      setPendingWhenOpened([]);
      setEvaluationMap(new Map()); // Reset evaluation map
    }
  };

  // Handle assignment completed
  const handleAssignmentCompleted = (assignmentId: string) => {
    // Find current index dalam pendingWhenOpened (list ban đầu)
    const currentIdx = pendingWhenOpened.indexOf(assignmentId);

    // Move to next
    if (currentIdx < pendingWhenOpened.length - 1) {
      setTimeout(() => {
        setCurrentAssignmentId(pendingWhenOpened[currentIdx + 1]);
      }, 500);
    }
  };
  // Handle evaluation update from StudentAssignmentView
  const handleEvaluationUpdate = (assignmentId: string, isCorrect: boolean) => {
    setEvaluationMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(assignmentId, { isCorrect });
      return newMap;
    });
  };
  if (!isStudent) {
    return null;
  }

  // Check nếu tất cả bài tập ban đầu đều đã hoàn thành
  const allCompleted =
    pendingWhenOpened.length > 0 &&
    pendingWhenOpened.every((id) => {
      const status = studentSubmissionStatus.get(id);
      return status && status.hasSubmitted;
    });

  // Render assignment list dựa trên pendingWhenOpened (không thay đổi)
  const displayedAssignments = pendingWhenOpened.map((assignmentId, idx) => ({
    classLessonNodeId: assignmentId,
    index: idx + 1,
    isCompleted:
      studentSubmissionStatus.get(assignmentId)?.hasSubmitted || false,
  }));

  const completedCount = displayedAssignments.filter(
    (assignment) => assignment.isCompleted,
  ).length;
  const totalCount = displayedAssignments.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentAssignment = displayedAssignments.find(
    (a) => a.classLessonNodeId === currentAssignmentId,
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className={`w-full ${
            isThreeD
              ? "rounded-xl border-2 border-slate-900 bg-amber-300 font-extrabold text-slate-900 shadow-[0_4px_0_0_rgba(15,23,42,0.25)] transition-transform hover:bg-amber-200 active:translate-y-px active:shadow-[0_2px_0_0_rgba(15,23,42,0.25)]"
              : "bg-purple-500 text-white hover:bg-purple-600"
          } ${
            pendingAssignments.length === 0
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
          disabled={pendingAssignments.length === 0}
        >
          <Play className="w-4 h-4 mr-2" />
          {isVi ? "Làm bài tập" : "Do assignment"} ({pendingAssignments.length})
        </Button>
      </DialogTrigger>

      <DialogContent
        className={`w-[95vw]! h-[95vh]! max-w-none! p-0! flex! min-h-0! flex-col! ${
          isThreeD
            ? "rounded-2xl! border-2! border-slate-900! bg-linear-to-b from-amber-50 via-sky-50 to-white shadow-[0_10px_0_0_rgba(15,23,42,0.24)]"
            : ""
        }`}
      >
        <DialogHeader
          className={`shrink-0 border-b px-6 py-4 ${
            isThreeD ? "border-slate-900 bg-white/80" : "border-border"
          }`}
        >
          <div className="flex flex-row items-center justify-between">
            <DialogTitle className={isThreeD ? "text-slate-900" : ""}>
              {isVi ? "Làm bài tập" : "Do homework"}
            </DialogTitle>
            <div
              className={`text-sm ${
                isThreeD
                  ? "font-semibold text-slate-700"
                  : "text-muted-foreground"
              }`}
            >
              {allCompleted ? (
                <span className="font-semibold text-green-600">
                  ✅ {isVi ? "Hoàn tất!" : "Done!"}
                </span>
              ) : currentAssignment ? (
                <span>
                  {displayedAssignments.findIndex(
                    (a) => a.classLessonNodeId === currentAssignmentId,
                  ) + 1}
                  /{displayedAssignments.length}
                </span>
              ) : (
                <span>0/{displayedAssignments.length}</span>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div
              className={`h-2.5 overflow-hidden rounded-full border ${
                isThreeD
                  ? "border-slate-900 bg-amber-100"
                  : "border-border bg-muted"
              }`}
            >
              <div
                className={`h-full transition-all duration-300 ${
                  isThreeD ? "bg-sky-500" : "bg-purple-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {completedCount}/{totalCount} {isVi ? "bài" : "assignments"} •{" "}
              {progressPercent}%
            </div>
          </div>
        </DialogHeader>

        {/* Main content */}
        {allCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-bold text-foreground">
              {isVi ? "Hoàn tất!" : "Done!"}
            </h2>
            <p className="text-lg text-muted-foreground text-center">
              {isVi
                ? `Bạn đã hoàn thành ${displayedAssignments.length} bài tập`
                : `You have done ${displayedAssignments.length} assignment`}
            </p>
            <Button
              onClick={() => setOpen(false)}
              className="mt-4 bg-blue-600 hover:bg-blue-700"
            >
              {isVi ? "Đóng" : "Close"}
            </Button>
          </div>
        ) : currentAssignment ? (
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
            {/* LEFT: Assignment list */}
            <div
              className={`w-80 shrink-0 rounded-lg border bg-card ${
                isThreeD
                  ? "border-slate-900 shadow-[0_6px_0_0_rgba(15,23,42,0.2)]"
                  : "border-border"
              } flex flex-col`}
            >
              <div
                className={`border-b px-4 py-3 ${
                  isThreeD ? "border-slate-900" : "border-border"
                }`}
              >
                <h3 className="font-semibold text-foreground">
                  {isVi ? "📋 Danh sách bài tập" : "📋 Assignment list"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {displayedAssignments.length}{" "}
                  {isVi ? "bài tập" : "assignment"}
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {displayedAssignments.map((assignment) => {
                    const isCurrent =
                      assignment.classLessonNodeId === currentAssignmentId;
                    const evaluation = evaluationMap.get(
                      assignment.classLessonNodeId,
                    );
                    const isCorrect = evaluation?.isCorrect;
                    return (
                      <button
                        key={assignment.classLessonNodeId}
                        onClick={() =>
                          setCurrentAssignmentId(assignment.classLessonNodeId)
                        }
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          isCurrent
                            ? "border-blue-500 bg-blue-50"
                            : assignment.isCompleted
                              ? isCorrect === false
                                ? "border-red-200 bg-red-50"
                                : isCorrect === true
                                  ? "border-green-200 bg-green-50"
                                  : "border-border bg-card"
                              : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {assignment.isCompleted ? (
                            isCorrect === undefined ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
                            ) : isCorrect === false ? (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                            )
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-semibold truncate ${
                                isCurrent
                                  ? "text-blue-700"
                                  : assignment.isCompleted
                                    ? isCorrect === false
                                      ? "text-red-700 line-through"
                                      : isCorrect === true
                                        ? "text-green-700 line-through"
                                        : "text-foreground"
                                    : "text-foreground"
                              }`}
                            >
                              {isVi ? "Bài" : "Assignment"} {assignment.index}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT: Assignment view */}
            <div
              className={`min-h-0 flex-1 overflow-hidden rounded-lg border bg-card ${
                isThreeD
                  ? "border-slate-900 shadow-[0_6px_0_0_rgba(15,23,42,0.2)]"
                  : "border-border"
              }`}
            >
              <StudentAssignmentView
                key={currentAssignmentId}
                assignmentId={currentAssignmentId!}
                onCompleted={() =>
                  handleAssignmentCompleted(currentAssignmentId || "")
                }
                onEvaluationUpdate={handleEvaluationUpdate}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
