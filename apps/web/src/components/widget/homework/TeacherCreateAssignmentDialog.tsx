"use client";

import { Loader2, Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import TeacherCreateAssignment, {
  TeacherCreateAssignmentRef,
} from "./TeacherCreateAssignment";
import { useLocale } from "next-intl";
import { attachGeneratorMeta } from "@/lib/widget-assignment-generator";

export default function TeacherAssignmentDialog({ hwId }: { hwId: string }) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const {
    handleAddClassLessonNode: handleAddClassAddon,
    selectedStudentId,
    classStudents,
    isTeacherStudentView,
  } = useCourseStructure();

  const selectedStudentName = classStudents.find(
    (s) => s.id === selectedStudentId,
  )?.name;

  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [buildRunId, setBuildRunId] = useState<string | null>(null);
  const [widgetHtmlCache, setWidgetHtmlCache] = useState<
    Record<string, string>
  >({});
  const [savedConfig, setSavedConfig] = useState<Record<string, any> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);

  const fetchedAssignmentRef = useRef(false);
  const widgetPreviewRef = useRef<TeacherCreateAssignmentRef>(null);

  // 1️⃣ Load widget info + saved config
  useEffect(() => {
    if (!hwId || fetchedAssignmentRef.current) return;

    fetchedAssignmentRef.current = true;

    const loadWidgetInfo = async () => {
      try {
        setLoading(true);

        const res = await fetch(`/api/class/assignment?lessonNodeId=${hwId}`);
        const data: {
          widgetId: string | null;
          buildRunId: string | null;
          savedConfig?: Record<string, any> | null;
        } = await res.json();

        setWidgetId(data.widgetId);
        setBuildRunId(data.buildRunId);

        // Load saved config if exists
        if (data.savedConfig) {
          setSavedConfig(data.savedConfig);
        }
      } catch (error) {
        console.error(error);
        setWidgetId(null);
        setBuildRunId(null);
      }
    };

    loadWidgetInfo();
  }, [hwId]);

  // 2️⃣ Load widget HTML (with cache)
  useEffect(() => {
    if (!widgetId || !buildRunId) return;
    if (widgetHtmlCache[widgetId]) return;

    const loadWidgetHtml = async () => {
      try {
        const res = await fetch(
          `/api/widgets/${widgetId}/preview?buildRunId=${buildRunId}`,
        );

        const data: { html: string } = await res.json();

        setWidgetHtmlCache((prev) => ({
          ...prev,
          [widgetId]: data.html,
        }));
      } catch (error) {
        console.error("Failed to load widget preview:", error);
      } finally {
        setLoading(false);
      }
    };

    loadWidgetHtml();
  }, [widgetId, buildRunId, widgetHtmlCache]);

  // 3️⃣ Handle Save
  const handleSaveConfig = async () => {
    if (!widgetPreviewRef.current) {
      alert(isVi ? "Bài tập chưa sẵn sàng" : "Widget is not ready");
      return;
    }

    const currentConfig =
      await widgetPreviewRef.current!.getCurrentConfigWithUploadedImages();
    const generatorMeta = widgetPreviewRef.current.getGeneratorMeta();
    const contentForSave = attachGeneratorMeta(currentConfig, generatorMeta);

    if (!currentConfig || Object.keys(currentConfig).length === 0) {
      alert(isVi ? "Không có cấu hình để lưu" : "No config to save");
      return;
    }

    try {
      setSaving(true);

      const createdId = await handleAddClassAddon(
        hwId,
        "homework_imp",
        contentForSave,
      );

      if (createdId) {
        // Show assignment panel instead of closing
        setAssignmentId(createdId);
      } else {
        // Fallback: close dialog if no ID returned
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert(isVi ? "Lưu thất bại" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setAssignmentId(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full px-2! py-1! bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200">
          <Plus className="w-2 h-2" />
          <span className="hidden sm:inline">
            {isVi ? "Thêm bài tập" : "Add Assignment"}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw]! h-[95vh]! max-w-none! p-1! flex! flex-col! min-h-0!">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle>
            {assignmentId
              ? isVi
                ? "Giao bài tập"
                : "Assign Homework"
              : isVi
                ? "Thiết lập tham số bài tập"
                : "Set config for Widget"}
          </DialogTitle>

          {widgetId && widgetHtmlCache[widgetId] && !assignmentId && (
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground mr-4"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isVi ? "Đang lưu..." : "Saving..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isVi ? "Lưu" : "Save"}
                </>
              )}
            </Button>
          )}
        </DialogHeader>

        {/* BODY */}
        {loading ? (
          <div className="flex justify-center pt-15 w-full h-full gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="text-lg">
              {isVi ? "Đang tải..." : "Loading..."}
            </span>
          </div>
        ) : widgetId && widgetHtmlCache[widgetId] ? (
          <div className="flex-1 overflow-auto min-h-0">
            <TeacherCreateAssignment
              ref={widgetPreviewRef}
              html={widgetHtmlCache[widgetId]}
              assignmentId={assignmentId}
              targetStudentId={
                isTeacherStudentView ? selectedStudentId : undefined
              }
              targetStudentName={
                isTeacherStudentView ? selectedStudentName : undefined
              }
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {isVi ? "Không có bản xem trước" : "No preview available"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
