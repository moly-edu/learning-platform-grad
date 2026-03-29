"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TeacherViewAssignmentWithStudents from "./TeacherViewAssignmentWithStudents";
import { useLocale } from "next-intl";

interface TeacherViewAssignmentDialogProps {
  assignmentId: string; // ClassLessonNode.id
  targetStudentId?: string | null;
  targetStudentName?: string;
}

export default function TeacherViewAssignmentDialog({
  assignmentId,
  targetStudentId,
  targetStudentName,
}: TeacherViewAssignmentDialogProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [open, setOpen] = useState(false);
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<Record<string, any> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load assignment data only when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadAssignment = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1️⃣ Load assignment info (ClassLessonNode) + widget info (LessonNode)
        const assignmentRes = await fetch(
          `/api/class/assignment/${assignmentId}`,
        );

        if (!assignmentRes.ok) {
          const errorData = await assignmentRes.json();
          throw new Error(
            errorData.error ||
              (isVi ? "Không thể tải bài tập" : "Unable to load assignment"),
          );
        }

        const assignmentData: {
          assignmentId: string;
          classId: string;
          lessonNodeId: string;
          savedConfig: Record<string, any> | null;
          widgetId: string;
          buildRunId: string;
        } = await assignmentRes.json();

        // Kiểm tra có config chưa
        if (!assignmentData.savedConfig) {
          throw new Error(
            isVi
              ? "Bài tập chưa được cấu hình bởi giáo viên"
              : "Assignment has not been configured by teacher",
          );
        }

        setSavedConfig(assignmentData.savedConfig);

        // 2️⃣ Load widget HTML
        const widgetRes = await fetch(
          `/api/widgets/${assignmentData.widgetId}/preview?buildRunId=${assignmentData.buildRunId}`,
        );

        if (!widgetRes.ok) {
          throw new Error(
            isVi ? "Không thể tải widget" : "Unable to load widget",
          );
        }

        const widgetData: { html: string } = await widgetRes.json();
        setWidgetHtml(widgetData.html);
      } catch (err) {
        console.error("❌ Load assignment error:", err);
        setError(
          err instanceof Error
            ? err.message
            : isVi
              ? "Có lỗi xảy ra"
              : "Something went wrong",
        );
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [open, assignmentId, isVi]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="px-2! py-1! bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200">
          <span className="hidden sm:inline">
            {isVi ? "Xem bài tập" : "Show Assignment"}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw]! h-[95vh]! max-w-none! p-0! flex! flex-col! min-h-0!">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            {isVi ? "Quản lý bài tập" : "Manage Assignment"}
          </DialogTitle>
        </DialogHeader>

        {/* BODY */}
        {loading ? (
          <div className="flex justify-center items-center w-full h-full gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="text-lg">
              {isVi ? "Đang tải..." : "Loading..."}
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {isVi ? "Vui lòng thử lại sau" : "Please try again later"}
            </p>
          </div>
        ) : widgetHtml && savedConfig ? (
          <div className="flex-1 overflow-hidden min-h-0">
            <TeacherViewAssignmentWithStudents
              assignmentId={assignmentId}
              html={widgetHtml}
              initialConfig={savedConfig}
              targetStudentId={targetStudentId}
              targetStudentName={targetStudentName}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {isVi ? "Không có dữ liệu" : "No data"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
