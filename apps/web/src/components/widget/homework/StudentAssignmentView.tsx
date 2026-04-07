"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Submission, WidgetDefinition } from "../core/types";
import { useCourseStructure } from "@/components/providers/course-structure-provider";
import { useLocale } from "next-intl";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "../core/HostTtsClient";

interface StudentAssignmentViewProps {
  assignmentId: string;
  onCompleted?: (assignmentId: string) => void; // NEW: Callback when assignment is completed
  onEvaluationUpdate?: (assignmentId: string, isCorrect: boolean) => void; // NEW: Callback to notify parent about evaluation
}

interface AssignmentEvaluation {
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

interface AssignmentSubmissionData {
  answer: any;
  evaluation: AssignmentEvaluation;
}

interface AssignmentAttempt {
  id: string;
  attemptNumber: number;
  submissionData: AssignmentSubmissionData | null;
  answer: any;
  evaluation: AssignmentEvaluation | null;
  isCorrect: boolean;
  submittedAt: string | null;
}

interface AssignmentData {
  assignmentId: string;
  classId: string;
  lessonNodeId: string;
  assignmentConfig: Record<string, any>; // Config từ teacher
  widgetId: string;
  buildRunId: string;
  hasSubmitted: boolean;
  submissionData: AssignmentSubmissionData | null;
  submittedAt: string | null;
  latestSubmissionData: AssignmentSubmissionData | null;
  latestSubmittedAt: string | null;
  attemptCount: number;
  correctAttemptCount: number;
  attempts: AssignmentAttempt[];
}

export default function StudentAssignmentView({
  assignmentId,
  onCompleted,
  onEvaluationUpdate,
}: StudentAssignmentViewProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

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
  const [isRetryMode, setIsRetryMode] = useState(false);
  const [selectedAttemptNumber, setSelectedAttemptNumber] = useState<
    number | null
  >(null);

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
          throw new Error(
            errorData.error ||
              (isVi ? "Không thể tải bài tập" : "Unable to load assignment"),
          );
        }

        const data: AssignmentData = await assignmentRes.json();
        const normalizedAttempts: AssignmentAttempt[] = (data.attempts ?? [])
          .map((attempt) => {
            const parsedSubmission =
              (attempt.submissionData as Record<string, any> | null) ?? null;
            const evaluation =
              attempt.evaluation ??
              (parsedSubmission?.evaluation as any) ??
              null;
            const answer =
              typeof attempt.answer === "undefined"
                ? parsedSubmission?.answer
                : attempt.answer;

            if (!evaluation) {
              return null;
            }

            return {
              ...attempt,
              submissionData: attempt.submissionData ?? {
                answer: answer ?? null,
                evaluation,
              },
              answer: answer ?? null,
              evaluation,
              isCorrect:
                typeof attempt.isCorrect === "boolean"
                  ? attempt.isCorrect
                  : evaluation.isCorrect,
              submittedAt: attempt.submittedAt ?? null,
            } as AssignmentAttempt;
          })
          .filter((attempt): attempt is AssignmentAttempt => attempt !== null);

        if (
          normalizedAttempts.length === 0 &&
          data.submissionData?.evaluation
        ) {
          normalizedAttempts.push({
            id: `first-${data.assignmentId}`,
            attemptNumber: 1,
            submissionData: data.submissionData,
            answer: data.submissionData.answer,
            evaluation: data.submissionData.evaluation,
            isCorrect: data.submissionData.evaluation.isCorrect,
            submittedAt: data.submittedAt,
          });
        }

        const normalizedData: AssignmentData = {
          ...data,
          latestSubmissionData:
            data.latestSubmissionData ?? data.submissionData ?? null,
          latestSubmittedAt: data.latestSubmittedAt ?? data.submittedAt ?? null,
          attemptCount: data.attemptCount ?? (data.hasSubmitted ? 1 : 0),
          correctAttemptCount:
            data.correctAttemptCount ??
            (data.submissionData?.evaluation?.isCorrect ? 1 : 0),
          attempts: normalizedAttempts,
        };
        console.log("📦 Assignment data:", normalizedData);

        setAssignmentData(normalizedData);
        setIsRetryMode(false);
        setSelectedAttemptNumber(
          normalizedData.attempts[0]?.attemptNumber ?? null,
        );

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
  }, [assignmentId, isVi]);

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
        setError(
          event.data.payload?.message || (isVi ? "Lỗi widget" : "Widget error"),
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [assignmentData, isVi]);

  useEffect(() => {
    if (!assignmentData?.attempts?.length) {
      setSelectedAttemptNumber(null);
      return;
    }

    const selectedAttemptExists = assignmentData.attempts.some(
      (attempt) => attempt.attemptNumber === selectedAttemptNumber,
    );

    if (selectedAttemptNumber === null || !selectedAttemptExists) {
      setSelectedAttemptNumber(assignmentData.attempts[0].attemptNumber);
    }
  }, [assignmentData?.attempts, selectedAttemptNumber]);

  const selectedAttempt = useMemo(() => {
    if (!assignmentData?.attempts?.length) {
      return null;
    }

    if (selectedAttemptNumber === null) {
      return assignmentData.attempts[0];
    }

    return (
      assignmentData.attempts.find(
        (attempt) => attempt.attemptNumber === selectedAttemptNumber,
      ) ?? assignmentData.attempts[0]
    );
  }, [assignmentData?.attempts, selectedAttemptNumber]);

  const selectedEvaluation =
    selectedAttempt?.evaluation ??
    selectedAttempt?.submissionData?.evaluation ??
    assignmentData?.submissionData?.evaluation ??
    null;
  const selectedAnswer =
    selectedAttempt?.answer ??
    selectedAttempt?.submissionData?.answer ??
    assignmentData?.submissionData?.answer ??
    null;
  const selectedSubmittedAt =
    selectedAttempt?.submittedAt ?? assignmentData?.submittedAt ?? null;
  const selectedAttemptLabel = selectedAttempt?.attemptNumber ?? 1;

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
        throw new Error(
          errorData.error ||
            (isVi ? "Không thể lưu bài làm" : "Unable to save submission"),
        );
      }

      const result = await response.json();
      console.log("✅ Submission saved:", result);

      const apiSubmission = result?.submission;
      const latestSubmittedAt =
        apiSubmission?.latestSubmittedAt ?? new Date().toISOString();
      const isFirstAttempt = Boolean(result?.isFirstAttempt);
      const nextAttemptCount =
        typeof apiSubmission?.attemptCount === "number"
          ? apiSubmission.attemptCount
          : (assignmentData.attemptCount || 0) + 1;
      const nextCorrectAttemptCount =
        typeof apiSubmission?.correctAttemptCount === "number"
          ? apiSubmission.correctAttemptCount
          : (assignmentData.correctAttemptCount || 0) +
            (submission.evaluation.isCorrect ? 1 : 0);

      // Cập nhật local state
      setAssignmentData((prev) => {
        if (!prev) return prev;

        const hasFirstSubmission = prev.hasSubmitted && !!prev.submissionData;
        const newAttempt: AssignmentAttempt = {
          id: `attempt-${nextAttemptCount}-${Date.now()}`,
          attemptNumber: nextAttemptCount,
          submissionData: {
            answer: submission.answer,
            evaluation: submission.evaluation,
          },
          answer: submission.answer,
          evaluation: submission.evaluation,
          isCorrect: submission.evaluation.isCorrect,
          submittedAt: latestSubmittedAt,
        };

        const nextAttempts = [
          ...prev.attempts.filter(
            (attempt) => attempt.attemptNumber !== nextAttemptCount,
          ),
          newAttempt,
        ].sort((a, b) => a.attemptNumber - b.attemptNumber);

        return {
          ...prev,
          hasSubmitted: true,
          submissionData: hasFirstSubmission
            ? prev.submissionData
            : {
                answer: submission.answer,
                evaluation: submission.evaluation,
              },
          submittedAt: hasFirstSubmission
            ? prev.submittedAt
            : latestSubmittedAt,
          latestSubmissionData: {
            answer: submission.answer,
            evaluation: submission.evaluation,
          },
          latestSubmittedAt,
          attemptCount: nextAttemptCount,
          correctAttemptCount: nextCorrectAttemptCount,
          attempts: nextAttempts,
        };
      });

      setIsRetryMode(false);
      setSelectedAttemptNumber(nextAttemptCount);

      // 🎯 Update provider state (update UI everywhere)
      await updateAssignmentStatus(assignmentId, {
        submittedAt: isFirstAttempt
          ? latestSubmittedAt
          : assignmentData.submittedAt,
        evaluation: submission.evaluation,
        attemptCount: nextAttemptCount,
        correctAttemptCount: nextCorrectAttemptCount,
        isFirstAttempt,
      });

      // 🎯 Notify evaluation update (for color indication in parent dialog)
      if (onEvaluationUpdate) {
        const firstAttemptCorrect =
          assignmentData.submissionData?.evaluation.isCorrect ??
          submission.evaluation.isCorrect;
        onEvaluationUpdate(assignmentId, firstAttemptCorrect);
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
        (isVi ? "Không thể lưu bài làm: " : "Unable to save submission: ") +
          (err instanceof Error
            ? err.message
            : isVi
              ? "Lỗi không xác định"
              : "Unknown error"),
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

    // Nếu ĐÃ LÀM RỒI và không ở chế độ làm lại -> hiển thị kết quả lần đầu.
    if (
      assignmentData.hasSubmitted &&
      assignmentData.submissionData &&
      !isRetryMode
    ) {
      console.log("✅ Student đã làm → Hiển thị kết quả");
      sendMessage({
        type: "PARAMS_UPDATE",
        payload: {
          ...assignmentData.assignmentConfig,
          __answer: selectedAnswer,
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
  }, [iframeReady, widgetDef, assignmentData, isRetryMode, selectedAnswer]);

  // LOADING STATE
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="text-lg text-muted-foreground">
          {isVi ? "Đang tải bài tập..." : "Loading assignment..."}
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
          {isVi
            ? "Vui lòng liên hệ giáo viên hoặc thử lại sau"
            : "Please contact your teacher or try again later"}
        </p>
      </div>
    );
  }

  // NO DATA STATE
  if (!assignmentData || !widgetHtml) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {isVi ? "Không có dữ liệu bài tập" : "No assignment data"}
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
              {selectedEvaluation?.isCorrect ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <XCircle className="text-red-600" size={24} />
              )}
              <div>
                <div className="font-semibold text-foreground">
                  {isVi
                    ? "Bạn đã hoàn thành bài tập này"
                    : "You have completed this assignment"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isVi ? "Số lần làm" : "Attempts"}:{" "}
                  <strong>{assignmentData.attemptCount}</strong>
                  {" • "}
                  {isVi ? "Đúng" : "Correct"}:{" "}
                  <strong>
                    {assignmentData.correctAttemptCount}/
                    {Math.max(assignmentData.attemptCount, 1)}
                  </strong>
                </div>
                {assignmentData.attempts.length > 0 && !isRetryMode && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <label htmlFor={`student-attempt-select-${assignmentId}`}>
                      {isVi ? "Chọn lần làm" : "Select attempt"}
                    </label>
                    <select
                      id={`student-attempt-select-${assignmentId}`}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      value={selectedAttemptNumber ?? ""}
                      onChange={(event) =>
                        setSelectedAttemptNumber(Number(event.target.value))
                      }
                    >
                      {assignmentData.attempts.map((attempt) => {
                        const evaluation =
                          attempt.evaluation ??
                          attempt.submissionData?.evaluation;
                        const status = evaluation?.isCorrect
                          ? isVi
                            ? "Đúng"
                            : "Correct"
                          : isVi
                            ? "Sai"
                            : "Incorrect";
                        const scoreText = evaluation
                          ? ` ${evaluation.score}/${evaluation.maxScore}`
                          : "";

                        return (
                          <option
                            key={attempt.id}
                            value={attempt.attemptNumber}
                          >
                            {`${isVi ? "Lần" : "Attempt"} ${attempt.attemptNumber} • ${status}${scoreText}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRetryMode((prev) => !prev)}
                disabled={submitting}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-sm transition-all disabled:opacity-50 ${
                  isRetryMode
                    ? "border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 ring-2 ring-orange-200 animate-pulse"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isRetryMode
                  ? isVi
                    ? "Xem kết quả lần đầu"
                    : "View first result"
                  : isVi
                    ? "Làm lại"
                    : "Retry"}
              </button>
              <div
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  selectedEvaluation?.isCorrect
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {selectedEvaluation?.isCorrect
                  ? isVi
                    ? `Lần ${selectedAttemptLabel}: Đúng`
                    : `Attempt ${selectedAttemptLabel}: Correct`
                  : isVi
                    ? `Lần ${selectedAttemptLabel}: Sai`
                    : `Attempt ${selectedAttemptLabel}: Incorrect`}
              </div>
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
                {isVi ? "Đang lưu..." : "Saving..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
