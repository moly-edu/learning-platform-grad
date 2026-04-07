"use client";

import { Loader2, Rocket, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import TeacherCreateAssignment, {
  TeacherCreateAssignmentRef,
} from "./TeacherCreateAssignment";
import { useLocale } from "next-intl";
import {
  applyDifficultyToConfig,
  attachGeneratorMeta,
  buildDifficultySequence,
} from "@/lib/widget-assignment-generator";

const MAX_QUICK_ASSIGN = 50;
const GENERATOR_TIMEOUT_MS = 20000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TeacherQuickAssignDialog({ hwId }: { hwId: string }) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const { handleAddClassLessonNode: handleAddClassAddon, classStudents } =
    useCourseStructure();

  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [buildRunId, setBuildRunId] = useState<string | null>(null);
  const [widgetHtmlCache, setWidgetHtmlCache] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(10);
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [generatorKey, setGeneratorKey] = useState(0);
  const [showHiddenGenerator, setShowHiddenGenerator] = useState(true);

  const fetchedAssignmentRef = useRef(false);
  const widgetPreviewRef = useRef<TeacherCreateAssignmentRef>(null);
  const hiddenGeneratorRef = useRef<TeacherCreateAssignmentRef>(null);

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
        } = await res.json();

        setWidgetId(data.widgetId);
        setBuildRunId(data.buildRunId);
      } catch (error) {
        console.error(error);
        setWidgetId(null);
        setBuildRunId(null);
      }
    };

    loadWidgetInfo();
  }, [hwId]);

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

  const createRandomizedConfigFromHiddenGenerator = async () => {
    setShowHiddenGenerator(false);
    await sleep(10);

    setGeneratorKey((prev) => prev + 1);
    setShowHiddenGenerator(true);

    const startedAt = Date.now();
    while (Date.now() - startedAt < GENERATOR_TIMEOUT_MS) {
      const currentRef = hiddenGeneratorRef.current;
      const currentConfig = currentRef?.getCurrentConfig();

      if (
        currentRef &&
        currentConfig &&
        Object.keys(currentConfig).length > 0
      ) {
        return currentRef.getCurrentConfigWithUploadedImages();
      }

      await sleep(200);
    }

    throw new Error("Hidden generator timeout");
  };

  const handleQuickAssign = async () => {
    if (!widgetPreviewRef.current) {
      alert(isVi ? "Widget chưa sẵn sàng" : "Widget is not ready");
      return;
    }

    const classStudentIds = classStudents.map((student) => student.id);
    if (classStudentIds.length === 0) {
      alert(
        isVi
          ? "Không có học sinh nào trong lớp để giao bài"
          : "No students found in class for assignment",
      );
      return;
    }

    const normalizedQuantity = Math.max(
      1,
      Math.min(MAX_QUICK_ASSIGN, quantity),
    );
    const difficultySequence = buildDifficultySequence(normalizedQuantity);

    try {
      setProcessing(true);
      setProcessedCount(0);
      setSuccessCount(0);

      let localSuccessCount = 0;

      for (let index = 0; index < normalizedQuantity; index++) {
        const desiredDifficulty = difficultySequence[index] ?? "easy";
        const randomizedConfig =
          await createRandomizedConfigFromHiddenGenerator();
        const generatorMeta =
          hiddenGeneratorRef.current?.getGeneratorMeta() ??
          widgetPreviewRef.current?.getGeneratorMeta() ??
          null;

        const difficultyAdjustedConfig = applyDifficultyToConfig(
          randomizedConfig,
          generatorMeta,
          desiredDifficulty,
        );

        const contentForSave = attachGeneratorMeta(
          difficultyAdjustedConfig,
          generatorMeta,
        );

        if (!randomizedConfig || Object.keys(randomizedConfig).length === 0) {
          setProcessedCount(index + 1);
          continue;
        }

        const createdId = await handleAddClassAddon(
          hwId,
          "homework_imp",
          contentForSave,
        );

        if (!createdId) {
          setProcessedCount(index + 1);
          continue;
        }

        const assignRes = await fetch(
          `/api/class/assignment/${createdId}/assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentIds: classStudentIds }),
          },
        );

        if (assignRes.ok) {
          localSuccessCount += 1;
          setSuccessCount(localSuccessCount);
        }

        setProcessedCount(index + 1);
      }

      if (localSuccessCount === normalizedQuantity) {
        alert(
          isVi
            ? `Đã tạo và giao nhanh ${localSuccessCount} bài tập cho cả lớp.`
            : `Created and assigned ${localSuccessCount} assignments to the entire class.`,
        );
      } else {
        const failedCount = normalizedQuantity - localSuccessCount;
        alert(
          isVi
            ? `Hoàn tất một phần: thành công ${localSuccessCount}, thất bại ${failedCount}.`
            : `Partially completed: ${localSuccessCount} succeeded, ${failedCount} failed.`,
        );
      }
    } catch (err) {
      console.error(err);
      alert(isVi ? "Giao nhanh thất bại" : "Quick assign failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setProcessedCount(0);
          setSuccessCount(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="px-2! py-1! bg-indigo-100 text-indigo-700 text-xs rounded hover:bg-indigo-200">
          <Rocket className="w-3 h-3" />
          <span className="hidden sm:inline">
            {isVi ? "Giao nhanh" : "Quick Assign"}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw]! h-[95vh]! max-w-none! p-1! flex! flex-col! min-h-0!">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle>
            {isVi ? "Giao nhanh bài tập" : "Quick Assign Homework"}
          </DialogTitle>

          {widgetId && widgetHtmlCache[widgetId] && (
            <div className="mr-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isVi ? "Số lượng" : "Quantity"}
              </span>
              <Input
                type="number"
                min={1}
                max={MAX_QUICK_ASSIGN}
                value={quantity}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isNaN(value)) {
                    setQuantity(1);
                    return;
                  }
                  setQuantity(Math.max(1, Math.min(MAX_QUICK_ASSIGN, value)));
                }}
                disabled={processing}
                className="h-8 w-20"
              />

              <Button
                onClick={handleQuickAssign}
                disabled={processing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isVi
                      ? `Đang xử lý ${processedCount}/${Math.max(1, Math.min(MAX_QUICK_ASSIGN, quantity))}`
                      : `Processing ${processedCount}/${Math.max(1, Math.min(MAX_QUICK_ASSIGN, quantity))}`}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isVi ? "Tạo và giao" : "Create & Assign"}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogHeader>

        {processedCount > 0 && (
          <div className="px-6 py-2 text-xs border-b bg-indigo-50 text-indigo-700">
            {isVi
              ? `Tiến độ: ${processedCount} đã xử lý, ${successCount} giao thành công.`
              : `Progress: ${processedCount} processed, ${successCount} assigned successfully.`}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-15 w-full h-full gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="text-lg">
              {isVi ? "Đang tải..." : "Loading..."}
            </span>
          </div>
        ) : widgetId && widgetHtmlCache[widgetId] ? (
          <div className="flex-1 overflow-auto min-h-0 relative">
            <TeacherCreateAssignment
              ref={widgetPreviewRef}
              html={widgetHtmlCache[widgetId]}
            />

            {/* Hidden generator for fresh random config on each quick assignment */}
            {showHiddenGenerator && (
              <div
                className="absolute top-0 h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
                style={{ left: "-9999px" }}
              >
                <TeacherCreateAssignment
                  key={`hidden-generator-${generatorKey}`}
                  ref={hiddenGeneratorRef}
                  html={widgetHtmlCache[widgetId]}
                />
              </div>
            )}
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
