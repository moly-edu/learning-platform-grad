"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { Submission, WidgetDefinition } from "../core/types";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "../core/HostTtsClient";

interface StudentAssignmentViewProps {
  assignmentId: string;
  onCompleted?: (assignmentId: string) => void; // NEW: Callback when assignment is completed
  onEvaluationUpdate?: (assignmentId: string, isCorrect: boolean) => void; // NEW: Callback to notify parent about evaluation
}

interface AssignmentData {
  assignmentId: string;
  classId: string;
  lessonNodeId: string;
  assignmentConfig: Record<string, any>; // Config từ teacher
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

export default function StudentAssignmentView({
  assignmentId,
  onCompleted,
  onEvaluationUpdate,
}: StudentAssignmentViewProps) {
  const { updateAssignmentStatus } = useCourseStructure();
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(
    null,
  );
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Helper to send messages
  const sendMessage = (message: any) => {
    const iframe = iframeRef.current;

    if (iframe?.contentWindow) {
      try {
        console.log("📤 Sending to widget:", message.type, message.payload);
        iframe.contentWindow.postMessage(message, "*");
      } catch (err) {
        console.error("❌ Failed to send message:", err);
      }
    } else {
      console.log("⏳ Queuing message (iframe not ready):", message.type);
      messageQueueRef.current.push(message);
    }
  };

  // 1️⃣ Load assignment data
  useEffect(() => {
    const loadAssignment = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load assignment info
        const assignmentRes = await fetch(
          `/api/class/assignment/${assignmentId}/student`,
        );

        if (!assignmentRes.ok) {
          const errorData = await assignmentRes.json();
          throw new Error(errorData.error || "Không thể tải bài tập");
        }

        const data: AssignmentData = await assignmentRes.json();
        console.log("📦 Assignment data:", data);

        setAssignmentData(data);

        // Load widget HTML
        const widgetRes = await fetch(
          `/api/widgets/${data.widgetId}/preview?buildRunId=${data.buildRunId}`,
        );

        if (!widgetRes.ok) {
          throw new Error("Không thể tải widget");
        }

        const widgetData: { html: string } = await widgetRes.json();
        setWidgetHtml(widgetData.html);
      } catch (err) {
        console.error("❌ Load assignment error:", err);
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [assignmentId]);

  // 2️⃣ Load widget HTML into iframe
  useEffect(() => {
    if (!widgetHtml) return;

    const loadWidget = async () => {
      setIframeReady(false);

      try {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = widgetHtml;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error(err);
      }
    };

    loadWidget();
  }, [widgetHtml]);

  // 3️⃣ Handle iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("🎬 Iframe loaded successfully");

      setTimeout(() => {
        setIframeReady(true);

        if (messageQueueRef.current.length > 0) {
          console.log(
            `📨 Flushing ${messageQueueRef.current.length} queued messages`,
          );
          messageQueueRef.current.forEach((msg) => {
            sendMessage(msg);
          });
          messageQueueRef.current = [];
        }
      }, 300);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [widgetHtml]);

  // 4️⃣ Listen to widget messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;
        console.log("📦 Widget definition received:", def);
        setWidgetDef(def);
      }

      // Handle submission - LƯU VÀO DATABASE
      if (event.data.type === "SUBMIT") {
        const submissionData: Submission = event.data.payload;
        console.log("✅ Submission received:", submissionData);

        // Gọi API để lưu vào database
        handleSubmitToDatabase(submissionData);
      }

      if (event.data.type === "EVENT") {
        console.log("📣 Widget event:", event.data.event, event.data.payload);
      }

      if (event.data.type === "TTS_SYNTHESIZE") {
        const requestId = event.data?.payload?.requestId;
        const text = String(event.data?.payload?.text || "");
        if (!requestId) return;
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }
        const targetWindow = event.source as Window | null;
        if (!targetWindow) return;
        (async () => {
          const result = await synthesizeWithHostTts(text);
          targetWindow.postMessage(
            {
              type: "TTS_SYNTHESIZE_RESULT",
              payload: {
                requestId,
                ...result,
              },
            },
            "*",
          );
        })();
      }
      if (event.data.type === "TTS_STOP") {
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }
        stopHostTtsPlayback();
      }

      if (event.data.type === "ERROR") {
        console.error("❌ Widget error:", event.data.payload);
        setError(event.data.payload?.message || "Widget error");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [assignmentData]);

  // 5️⃣ Submit to database
  const handleSubmitToDatabase = async (submission: Submission) => {
    if (!assignmentData) return;

    setSubmitting(true);

    try {
      console.log("💾 Saving submission to database...");

      const response = await fetch(
        `/api/class/assignment/${assignmentId}/student/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer: submission.answer,
            evaluation: submission.evaluation,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể lưu bài làm");
      }

      const result = await response.json();
      console.log("✅ Submission saved:", result);

      // Cập nhật local state
      setAssignmentData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          hasSubmitted: true,
          submissionData: {
            answer: submission.answer,
            evaluation: submission.evaluation,
          },
          submittedAt: new Date().toISOString(),
        };
      });

      // TỰ ĐỘNG hiển thị kết quả
      setTimeout(() => {
        console.log("📤 Sending answer back to widget for display");
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: {
            ...assignmentData.assignmentConfig,
            __answer: submission.answer,
          },
        });
      }, 100);

      // 🎯 Update provider state (update UI everywhere)
      await updateAssignmentStatus(assignmentId);

      // 🎯 Notify evaluation update (for color indication in parent dialog)
      if (onEvaluationUpdate) {
        onEvaluationUpdate(assignmentId, submission.evaluation.isCorrect);
      }

      // 🎯 Call callback to notify parent (for auto-next assignment)
      if (onCompleted) {
        setTimeout(() => {
          onCompleted(assignmentId);
        }, 1000);
      }
    } catch (err) {
      console.error("❌ Submit error:", err);
      alert(
        "Không thể lưu bài làm: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 6️⃣ Send config to widget when ready
  useEffect(() => {
    console.log("Hey i test ", iframeReady, widgetDef, assignmentData);
    if (!iframeReady || !widgetDef || !assignmentData) return;

    console.log("📤 Sending config to widget");

    // Nếu ĐÃ LÀM RỒI → Gửi config + __answer để hiển thị kết quả
    if (assignmentData.hasSubmitted && assignmentData.submissionData) {
      console.log("✅ Student đã làm → Hiển thị kết quả");
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: {
          ...assignmentData.assignmentConfig,
          __answer: assignmentData.submissionData.answer,
        },
      });
    } else {
      // Nếu CHƯA LÀM → Gửi config bình thường
      console.log("⏳ Student chưa làm → Chế độ làm bài");
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: assignmentData.assignmentConfig,
      });
    }
  }, [iframeReady, widgetDef, assignmentData]);

  // LOADING STATE
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="text-lg text-muted-foreground">
          Loading assignment...
        </span>
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
        <p className="text-sm text-muted-foreground">
          Vui lòng liên hệ giáo viên hoặc thử lại sau
        </p>
      </div>
    );
  }

  // NO DATA STATE
  if (!assignmentData || !widgetHtml) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Không có dữ liệu bài tập
      </div>
    );
  }

  return (
    <div className="bg-background h-full min-h-0 flex flex-col">
      {/* Header với thông tin submission */}
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
                  You have completed this assignment
                </div>
                <div className="text-sm text-muted-foreground">
                  Score:{" "}
                  <strong>
                    {assignmentData.submissionData.evaluation.score}/
                    {assignmentData.submissionData.evaluation.maxScore}
                  </strong>{" "}
                  •{" "}
                  {new Date(assignmentData.submittedAt!).toLocaleString(
                    "vi-VN",
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
                ? "Đúng"
                : "Sai"}
            </div>
          </div>
        </div>
      )}

      {/* Widget iframe */}
      <div className="flex-1 p-4 min-h-0 relative">
        <div className="h-full max-w-6xl mx-auto bg-card rounded-4xl shadow-2xl overflow-hidden border border-border/50">
          <iframe
            ref={iframeRef}
            className="w-full h-full min-h-100 min-w-[320px] border-0"
            title="Widget"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {/* Submitting overlay */}
        {submitting && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="bg-card rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-lg font-semibold text-foreground">
                Saving...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
