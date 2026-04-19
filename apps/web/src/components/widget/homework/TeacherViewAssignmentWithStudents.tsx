"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { WidgetDefinition } from "../core/types";
import { Button } from "@/components/ui/button";
import AssignmentStudentsPanel from "./AssignmentStudentsPanel";
import DirectAssignStudentPanel from "./DirectAssignStudentPanel";
import { useLocale } from "next-intl";

interface TeacherViewAssignmentWithStudentsProps {
  assignmentId: string;
  html: string;
  initialConfig: Record<string, any>;
  targetStudentId?: string | null;
  targetStudentName?: string;
}

interface ReviewSubmissionPayload {
  studentId: string;
  studentName: string;
  answer: any;
  attemptNumber: number;
  submittedAt: string | null;
  evaluation: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  } | null;
}

export default function TeacherViewAssignmentWithStudents({
  assignmentId,
  html,
  initialConfig,
  targetStudentId,
  targetStudentName,
}: TeacherViewAssignmentWithStudentsProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config] = useState<Record<string, any>>(initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeSessionKey, setIframeSessionKey] = useState(0);
  const [viewingSubmission, setViewingSubmission] =
    useState<ReviewSubmissionPayload | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messageQueueRef = useRef<any[]>([]);

  const resetWidgetSession = () => {
    setIframeReady(false);
    setWidgetDef(null);
    messageQueueRef.current = [];
    setIframeSessionKey((value) => value + 1);
  };

  // Helper to send messages
  const sendMessage = (message: any) => {
    const iframe = iframeRef.current;

    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage(message, "*");
      } catch (err) {
        console.error("❌ Failed to send message:", err);
      }
    } else {
      console.log("⏳ Queuing message (iframe not ready):", message.type);
      messageQueueRef.current.push(message);
    }
  };

  // View student answer
  const handleViewAnswer = (payload: ReviewSubmissionPayload) => {
    const shouldResetSession =
      viewingSubmission?.studentId !== payload.studentId ||
      viewingSubmission?.attemptNumber !== payload.attemptNumber;

    setViewingSubmission(payload);

    if (shouldResetSession) {
      resetWidgetSession();
      return;
    }

    sendMessage({
      type: "PARAMS_UPDATE",
      payload: { ...config, __answer: payload.answer },
    });
  };

  // Reset to default view
  const handleResetView = () => {
    setViewingSubmission(null);
    sendMessage({ type: "PARAMS_UPDATE", payload: config });
  };

  // Load widget HTML into iframe
  useEffect(() => {
    if (!html) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    setIframeReady(false);

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
    iframe.srcdoc = html;

    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [html, iframeSessionKey]);

  // Listen to widget messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        setWidgetDef(event.data.payload);
      }
      if (event.data.type === "ERROR") {
        console.error("❌ Widget error:", event.data.payload);
        setError(
          event.data.payload?.message || (isVi ? "Lỗi widget" : "Widget error"),
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isVi]);

  // Send initial config when iframe ready
  useEffect(() => {
    if (!iframeReady || !widgetDef) return;

    if (viewingSubmission) {
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: { ...config, __answer: viewingSubmission.answer },
      });
      return;
    }

    sendMessage({ type: "PARAMS_UPDATE", payload: config });
  }, [iframeReady, widgetDef, config, viewingSubmission]);

  const activeReviewSubmission = viewingSubmission
    ? {
        studentId: viewingSubmission.studentId,
        attemptNumber: viewingSubmission.attemptNumber,
      }
    : null;

  return (
    <div className="flex h-full min-h-0">
      {/* LEFT: Widget iframe */}
      <div className="flex-1 p-4 min-h-0 bg-muted/50">
        {viewingSubmission && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-blue-700">
              <strong>
                {isVi
                  ? "Đang xem bài nộp của học sinh"
                  : "Reviewing student submission"}
              </strong>
              <div className="text-xs text-blue-700 mt-1">
                {viewingSubmission.studentName} • {isVi ? "Lần" : "Attempt"} #
                {viewingSubmission.attemptNumber}
                {viewingSubmission.evaluation && (
                  <>
                    {" • "}
                    {isVi ? "Điểm" : "Score"}:{" "}
                    {viewingSubmission.evaluation.score}/
                    {viewingSubmission.evaluation.maxScore}
                  </>
                )}
                {viewingSubmission.submittedAt && (
                  <>
                    {" • "}
                    {new Date(viewingSubmission.submittedAt).toLocaleString(
                      isVi ? "vi-VN" : "en-US",
                    )}
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetView}
              className="text-xs"
            >
              {isVi ? "← Quay lại" : "← Back"}
            </Button>
          </div>
        )}

        <div className="h-full bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
          <iframe
            key={`teacher-review-${assignmentId}-${iframeSessionKey}`}
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Widget"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-bold text-red-800">
                {isVi ? "Lỗi" : "Error"}
              </div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Assignment Students Panel */}
      <div className="w-96 bg-card border-l border-border flex flex-col">
        {targetStudentId && targetStudentName ? (
          <DirectAssignStudentPanel
            assignmentId={assignmentId}
            studentId={targetStudentId}
            studentName={targetStudentName}
          />
        ) : (
          <AssignmentStudentsPanel
            assignmentId={assignmentId}
            onViewAnswer={handleViewAnswer}
            onExitReview={handleResetView}
            activeReviewSubmission={activeReviewSubmission}
          />
        )}
      </div>
    </div>
  );
}
