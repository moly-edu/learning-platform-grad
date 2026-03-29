"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";

interface TeacherStudentAssignmentViewDialogProps {
  assignmentId: string;
  studentId: string;
  studentName: string;
}

interface AssignmentData {
  assignmentId: string;
  assignmentConfig: Record<string, any>;
  widgetId: string;
  buildRunId: string;
  hasSubmitted: boolean;
  submissionData: {
    answer: any;
    evaluation: {
      isCorrect: boolean;
      score: number;
      maxScore: number;
    };
  } | null;
  submittedAt: string | null;
}

export default function TeacherStudentAssignmentViewDialog({
  assignmentId,
  studentId,
  studentName,
}: TeacherStudentAssignmentViewDialogProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(
    null,
  );
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [open, setOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messageQueueRef = useRef<any[]>([]);

  const sendMessage = (message: any) => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage(message, "*");
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    } else {
      messageQueueRef.current.push(message);
    }
  };

  // Load assignment data when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadAssignment = async () => {
      try {
        setLoading(true);
        setError(null);
        setAssignmentData(null);
        setWidgetHtml(null);
        setIframeReady(false);

        const res = await fetch(
          `/api/class/assignment/${assignmentId}/teacher-student-view?studentId=${studentId}`,
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(
            data.error ||
              (isVi ? "Không thể tải bài tập" : "Unable to load assignment"),
          );
        }

        const data: AssignmentData = await res.json();
        setAssignmentData(data);

        // Load widget HTML
        const widgetRes = await fetch(
          `/api/widgets/${data.widgetId}/preview?buildRunId=${data.buildRunId}`,
        );
        if (!widgetRes.ok) {
          throw new Error(
            isVi ? "Không thể tải widget" : "Unable to load widget",
          );
        }

        const widgetData: { html: string } = await widgetRes.json();
        setWidgetHtml(widgetData.html);
      } catch (err) {
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
  }, [open, assignmentId, studentId, isVi]);

  // Load widget into iframe
  useEffect(() => {
    if (!widgetHtml || !iframeRef.current) return;
    setIframeReady(false);

    const iframe = iframeRef.current;
    const handleLoad = () => {
      setTimeout(() => {
        setIframeReady(true);
        if (messageQueueRef.current.length > 0) {
          messageQueueRef.current.forEach((msg) => sendMessage(msg));
          messageQueueRef.current = [];
        }
      }, 300);
    };

    iframe.addEventListener("load", handleLoad);
    iframe.srcdoc = widgetHtml;
    return () => iframe.removeEventListener("load", handleLoad);
  }, [widgetHtml]);

  // Listen to widget messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        // Widget ready
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send config when ready
  useEffect(() => {
    if (!iframeReady || !assignmentData) return;

    if (assignmentData.hasSubmitted && assignmentData.submissionData) {
      // Show with student's answer (read-only view)
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: {
          ...assignmentData.assignmentConfig,
          __answer: assignmentData.submissionData.answer,
        },
      });
    } else {
      // Student hasn't answered yet - show config only
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: assignmentData.assignmentConfig,
      });
    }
  }, [iframeReady, assignmentData]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="px-2! py-1! bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200">
          <span className="hidden sm:inline">
            {isVi ? "Xem bài tập" : "Show Assignment"}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw]! h-[95vh]! max-w-none! p-1! flex! flex-col! min-h-0!">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            {isVi
              ? `Bài nộp của ${studentName}`
              : `Submission of ${studentName}`}
          </DialogTitle>
        </DialogHeader>

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
          </div>
        ) : assignmentData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Submission header */}
            {assignmentData.hasSubmitted && assignmentData.submissionData && (
              <div className="shrink-0 border-b border-border bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-6 py-3">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                  <div className="flex items-center gap-3">
                    {assignmentData.submissionData.evaluation.isCorrect ? (
                      <CheckCircle className="text-green-600" size={24} />
                    ) : (
                      <XCircle className="text-red-600" size={24} />
                    )}
                    <div>
                      <div className="font-semibold text-foreground">
                        {isVi
                          ? `${studentName} đã hoàn thành bài tập`
                          : `${studentName} has completed this assignment`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isVi ? "Điểm" : "Score"}:{" "}
                        <strong>
                          {assignmentData.submissionData.evaluation.score}/
                          {assignmentData.submissionData.evaluation.maxScore}
                        </strong>
                        {assignmentData.submittedAt && (
                          <>
                            {" • "}
                            {new Date(
                              assignmentData.submittedAt,
                            ).toLocaleString(isVi ? "vi-VN" : "en-US")}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      assignmentData.submissionData.evaluation.isCorrect
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {assignmentData.submissionData.evaluation.isCorrect
                      ? isVi
                        ? "Đúng"
                        : "Correct"
                      : isVi
                        ? "Sai"
                        : "Incorrect"}
                  </div>
                </div>
              </div>
            )}

            {!assignmentData.hasSubmitted && (
              <div className="shrink-0 border-b border-border bg-yellow-50 dark:bg-yellow-950/30 px-6 py-3">
                <div className="text-sm text-yellow-700 font-medium">
                  {isVi
                    ? `⏳ ${studentName} chưa hoàn thành`
                    : `⏳ ${studentName} not done`}
                </div>
              </div>
            )}

            {/* Widget iframe (read-only) */}
            <div className="flex-1 p-4 min-h-0">
              <div className="h-full max-w-6xl mx-auto bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  title="Widget"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
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
