import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "@/components/widget/core/HostTtsClient";
import {
  listenWithHostStt,
  stopHostSttListening,
} from "@/components/widget/core/HostSttClient";
import { useTranslation } from "react-i18next";

interface AssignmentData {
  assignmentId: string;
  classId: string;
  lessonNodeId: string;
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
  latestSubmissionData?: {
    answer: any;
    evaluation: {
      isCorrect: boolean;
      score: number;
      maxScore: number;
    };
  } | null;
  latestSubmittedAt?: string | null;
  attemptCount?: number;
  correctAttemptCount?: number;
  attempts?: AssignmentAttempt[];
}

interface AssignmentAttempt {
  id: string;
  attemptNumber: number;
  answer: any;
  evaluation: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  } | null;
  isCorrect: boolean;
  submittedAt: string | null;
}

interface AssignmentWidgetState {
  hasSubmitted: boolean;
  attemptCount: number;
  correctAttemptCount: number;
  attempts: AssignmentAttempt[];
}

interface Submission {
  answer: any;
  evaluation: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  };
}

interface AssignmentWidgetProps {
  assignmentId: string;
  retryMode?: boolean;
  selectedAttemptNumber?: number | null;
  onRetryModeChange?: (retryMode: boolean) => void;
  onSelectedAttemptChange?: (attemptNumber: number | null) => void;
  onAssignmentStateLoaded?: (state: AssignmentWidgetState) => void;
  onCompleted?: (submission: Submission) => void;
  onEvaluationUpdate?: (assignmentId: string, isCorrect: boolean) => void; // NEW: Callback to notify parent about evaluation
  onError?: (error: string) => void;
}

// Inject code to setup bridge before content loads
const INJECTED_JS_BEFORE_CONTENT = `
(function() {
  // 1. Override window.parent.postMessage to redirect to ReactNativeWebView
  // Widgets use window.parent.postMessage() in iframe context
  var parentProxy = {
    postMessage: function(data, targetOrigin) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        var message = typeof data === 'string' ? data : JSON.stringify(data);
        window.ReactNativeWebView.postMessage(message);
      }
    }
  };
  
  // Override window.parent
  try {
    Object.defineProperty(window, 'parent', {
      get: function() { return parentProxy; },
      configurable: true
    });
  } catch(e) {
    window.parent = parentProxy;
  }
  
  // 2. Also override window.postMessage as backup
  window.postMessage = function(data, targetOrigin) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      var message = typeof data === 'string' ? data : JSON.stringify(data);
      window.ReactNativeWebView.postMessage(message);
    }
  };

  window.__RN_HOST_MESSAGE_QUEUE__ = window.__RN_HOST_MESSAGE_QUEUE__ || [];

  function dispatchHostMessage(messageJson) {
    try {
      var message = JSON.parse(messageJson);
      var event = new MessageEvent('message', { data: message });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('Failed to handle native message:', error);
      return false;
    }
  }
  
  // 3. Setup handler for messages FROM React Native
  window.handleMessageFromNative = function(messageJson) {
    dispatchHostMessage(messageJson);
  };

  // Flush any queued host messages that were injected before handler readiness.
  if (window.__RN_HOST_MESSAGE_QUEUE__.length > 0) {
    var pending = window.__RN_HOST_MESSAGE_QUEUE__.slice();
    window.__RN_HOST_MESSAGE_QUEUE__.length = 0;
    for (var i = 0; i < pending.length; i++) {
      dispatchHostMessage(pending[i]);
    }
  }
})();
true;
`;

export default function AssignmentWidget({
  assignmentId,
  retryMode = false,
  selectedAttemptNumber,
  onRetryModeChange,
  onSelectedAttemptChange,
  onAssignmentStateLoaded,
  onCompleted,
  onEvaluationUpdate,
  onError,
}: AssignmentWidgetProps) {
  const { t, i18n } = useTranslation();
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(
    null,
  );
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [attemptPickerVisible, setAttemptPickerVisible] = useState(false);

  const webViewRef = useRef<WebView>(null);

  const normalizeAttempts = (data: AssignmentData): AssignmentAttempt[] => {
    if (Array.isArray(data.attempts) && data.attempts.length > 0) {
      return [...data.attempts].sort(
        (a, b) => a.attemptNumber - b.attemptNumber,
      );
    }

    if (data.submissionData) {
      return [
        {
          id: `${data.assignmentId}-fallback-attempt`,
          attemptNumber: 1,
          answer: data.submissionData.answer,
          evaluation: data.submissionData.evaluation,
          isCorrect: Boolean(data.submissionData.evaluation?.isCorrect),
          submittedAt: data.submittedAt,
        },
      ];
    }

    return [];
  };

  const notifyAssignmentState = (data: AssignmentData) => {
    const attempts = normalizeAttempts(data);

    onAssignmentStateLoaded?.({
      hasSubmitted: data.hasSubmitted,
      attemptCount: data.attemptCount ?? attempts.length,
      correctAttemptCount:
        data.correctAttemptCount ??
        attempts.filter((attempt) => attempt.isCorrect).length,
      attempts,
    });
  };

  // Reset when assignmentId changes
  useEffect(() => {
    setWebViewLoading(true);
    setError(null);
    setWidgetReady(false);
  }, [assignmentId]);

  // Send message to WebView using injectJavaScript
  const sendMessage = (message: any) => {
    const messageJson = JSON.stringify(message);
    console.log("📤 Sending to widget:", message.type);

    const script = `
      (function() {
        var messageJson = ${JSON.stringify(messageJson)};

        if (typeof window.handleMessageFromNative === 'function') {
          window.handleMessageFromNative(messageJson);
          return;
        }

        window.__RN_HOST_MESSAGE_QUEUE__ = window.__RN_HOST_MESSAGE_QUEUE__ || [];
        window.__RN_HOST_MESSAGE_QUEUE__.push(messageJson);
      })();
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  };

  // Load assignment data
  useEffect(() => {
    const loadAssignment = async () => {
      if (!assignmentId) {
        setError(t("assignmentWidget.noAssignmentId"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: session } = await authClient.getSession();
        if (!session?.session.token) {
          throw new Error(t("assignmentWidget.noSessionToken"));
        }

        // Load assignment info
        const assignmentRes = await fetch(
          `${API_BASE_URL}/api/class/assignment/${assignmentId}/student`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.token}`,
            },
          },
        );

        if (!assignmentRes.ok) {
          const errorData = await assignmentRes.json();
          throw new Error(
            errorData.error || t("assignmentWidget.loadAssignmentFailed"),
          );
        }

        const data: AssignmentData = await assignmentRes.json();
        console.log("📦 Assignment data loaded:", data.assignmentId);
        setAssignmentData(data);
        notifyAssignmentState(data);

        // Load widget HTML
        const widgetRes = await fetch(
          `${API_BASE_URL}/api/widgets/${data.widgetId}/preview?buildRunId=${data.buildRunId}`,
          {
            headers: {
              Authorization: `Bearer ${session.session.token}`,
            },
          },
        );

        if (!widgetRes.ok) {
          throw new Error(t("assignmentWidget.loadWidgetFailed"));
        }

        const widgetData: { html: string } = await widgetRes.json();
        setWidgetHtml(widgetData.html);
      } catch (err) {
        console.error("❌ Load assignment error:", err);
        const errorMessage =
          err instanceof Error ? err.message : t("classDetail.unknownError");
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [assignmentId, onAssignmentStateLoaded, onError, t]);

  // Handle messages from WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log("📥 Received from widget:", message.type);

      if (message.type === "WIDGET_READY") {
        const def = message.payload;

        // Ignore WIDGET_READY if no schema
        if (!def || !def.schema) {
          console.log("⚠️ WIDGET_READY without schema, ignoring...");
          return;
        }

        console.log("📦 Widget definition received with schema");
        setWebViewLoading(false);
        setWidgetReady(true);
        setError(null);
      }

      if (message.type === "SUBMIT") {
        const submissionData: Submission = message.payload;
        console.log("✅ Submission received:", submissionData);
        handleSubmitToDatabase(submissionData);
      }

      if (message.type === "TTS_SYNTHESIZE") {
        const requestId = message?.payload?.requestId;
        const text = String(message?.payload?.text || "");
        if (!requestId) return;

        (async () => {
          const result = await synthesizeWithHostTts(text);
          sendMessage({
            type: "TTS_SYNTHESIZE_RESULT",
            payload: {
              requestId,
              ...result,
            },
          });
        })();
      }

      if (message.type === "TTS_STOP") {
        stopHostTtsPlayback();
      }

      if (message.type === "STT_LISTEN") {
        const requestId = message?.payload?.requestId;
        const lang = message?.payload?.lang;
        const timeoutMs = message?.payload?.timeoutMs;
        const mode = message?.payload?.mode;
        if (!requestId) return;

        (async () => {
          const result = await listenWithHostStt({
            lang,
            timeoutMs,
            mode,
          });
          sendMessage({
            type: "STT_LISTEN_RESULT",
            payload: {
              requestId,
              ...result,
            },
          });
        })();
      }

      if (message.type === "STT_STOP") {
        stopHostSttListening();
      }

      if (message.type === "ERROR") {
        console.error("❌ Widget error:", message.payload);
        const errorMessage =
          message.payload?.message || t("assignmentWidget.failedToLoadWidget");
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  };

  useEffect(() => {
    if (!widgetReady || !assignmentData) {
      return;
    }

    const attempts = normalizeAttempts(assignmentData);
    const selectedAttempt =
      typeof selectedAttemptNumber === "number"
        ? attempts.find(
            (attempt) => attempt.attemptNumber === selectedAttemptNumber,
          )
        : attempts[attempts.length - 1];

    if (assignmentData.hasSubmitted && !retryMode) {
      const reviewAnswer =
        selectedAttempt?.answer ??
        assignmentData.latestSubmissionData?.answer ??
        assignmentData.submissionData?.answer;

      if (typeof reviewAnswer !== "undefined") {
        console.log("📤 Sending config with answer (review mode)");
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: {
            ...assignmentData.assignmentConfig,
            __answer: reviewAnswer,
          },
        });
        return;
      }
    }

    console.log("📤 Sending config (assignment mode)");
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: assignmentData.assignmentConfig,
    });
  }, [assignmentData, retryMode, selectedAttemptNumber, widgetReady]);

  // Submit to database
  const handleSubmitToDatabase = async (submission: Submission) => {
    if (!assignmentData) return;

    setSubmitting(true);

    try {
      const { data: session } = await authClient.getSession();
      if (!session?.session.token) {
        throw new Error(t("assignmentWidget.noSessionToken"));
      }

      console.log("💾 Saving submission...");

      const response = await fetch(
        `${API_BASE_URL}/api/class/assignment/${assignmentId}/student/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.token}`,
          },
          body: JSON.stringify({
            answer: submission.answer,
            evaluation: submission.evaluation,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("assignmentWidget.saveFailed"));
      }

      const result = await response.json();
      console.log("✅ Submission saved");

      // Update local state
      setAssignmentData((prev) => {
        if (!prev) return prev;

        const nowIso = new Date().toISOString();
        const nextAttemptNumber =
          result?.submission?.attemptCount ??
          Math.max(prev.attemptCount ?? 0, normalizeAttempts(prev).length) + 1;

        const newAttempt: AssignmentAttempt = {
          id: `local-${assignmentId}-${nextAttemptNumber}-${Date.now()}`,
          attemptNumber: nextAttemptNumber,
          answer: submission.answer,
          evaluation: submission.evaluation,
          isCorrect: submission.evaluation.isCorrect,
          submittedAt: nowIso,
        };

        const previousAttempts = normalizeAttempts(prev).filter(
          (attempt) => attempt.attemptNumber !== nextAttemptNumber,
        );
        const nextAttempts = [...previousAttempts, newAttempt].sort(
          (a, b) => a.attemptNumber - b.attemptNumber,
        );

        const nextState: AssignmentData = {
          ...prev,
          hasSubmitted: true,
          submissionData: prev.submissionData ?? {
            answer: submission.answer,
            evaluation: submission.evaluation,
          },
          submittedAt: prev.submittedAt ?? nowIso,
          latestSubmissionData: {
            answer: submission.answer,
            evaluation: submission.evaluation,
          },
          latestSubmittedAt: nowIso,
          attemptCount: nextAttemptNumber,
          correctAttemptCount:
            result?.submission?.correctAttemptCount ??
            nextAttempts.filter((attempt) => attempt.isCorrect).length,
          attempts: nextAttempts,
        };

        notifyAssignmentState(nextState);
        return nextState;
      });

      // Notify evaluation update (for color indication in parent screen)
      onEvaluationUpdate?.(assignmentId, submission.evaluation.isCorrect);

      // Notify parent
      onCompleted?.(submission);
    } catch (err) {
      console.error("❌ Submit error:", err);
      const errorMessage =
        err instanceof Error ? err.message : t("assignmentWidget.submitFailed");
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // LOADING STATE
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>
          {t("assignmentWidget.loadingAssignment")}
        </Text>
      </View>
    );
  }

  // ERROR STATE
  if (error && !widgetHtml) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // NO DATA STATE
  if (!assignmentData || !widgetHtml) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          {t("assignmentWidget.noAssignmentData")}
        </Text>
      </View>
    );
  }

  const attempts = normalizeAttempts(assignmentData);
  const selectedAttempt =
    typeof selectedAttemptNumber === "number"
      ? attempts.find(
          (attempt) => attempt.attemptNumber === selectedAttemptNumber,
        )
      : attempts[attempts.length - 1];

  const selectedEvaluation =
    selectedAttempt?.evaluation ??
    assignmentData.latestSubmissionData?.evaluation ??
    assignmentData.submissionData?.evaluation ??
    null;

  const isSelectedAttemptCorrect = Boolean(selectedEvaluation?.isCorrect);
  const selectedAttemptNumberLabel =
    selectedAttempt?.attemptNumber ??
    attempts[attempts.length - 1]?.attemptNumber;
  const attemptCount = assignmentData.attemptCount ?? attempts.length;
  const correctAttemptCount =
    assignmentData.correctAttemptCount ??
    attempts.filter((attempt) => attempt.isCorrect).length;
  const isVietnamese = i18n.resolvedLanguage?.toLowerCase().startsWith("vi");
  const attemptsButtonLabel = isVietnamese
    ? `Bài làm (${attemptCount})`
    : `Attempts (${attemptCount})`;
  const attemptsModalTitle = isVietnamese ? "Danh sách bài làm" : "Attempts";

  const handleToggleRetryMode = () => {
    const nextRetryMode = !retryMode;
    onRetryModeChange?.(nextRetryMode);

    if (nextRetryMode) {
      onSelectedAttemptChange?.(null);
      setAttemptPickerVisible(false);
    }
  };

  const handleSelectAttempt = (attemptNumber: number) => {
    onSelectedAttemptChange?.(attemptNumber);
    onRetryModeChange?.(false);
    setAttemptPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Header with submission status */}
      {assignmentData.hasSubmitted && (
        <View
          style={[
            styles.statusHeader,
            {
              backgroundColor: retryMode
                ? "#e2e8f0"
                : isSelectedAttemptCorrect
                  ? "#dcfce7"
                  : "#fee2e2",
            },
          ]}
        >
          <View style={styles.statusContentRow}>
            <Text style={styles.statusIcon}>
              {retryMode ? "↺" : isSelectedAttemptCorrect ? "✓" : "✗"}
            </Text>
            <Text numberOfLines={1} style={styles.statusInlineText}>
              {retryMode
                ? t("assignmentDetail.retryNow")
                : `${t("assignmentDetail.attemptLabel", {
                    number: selectedAttemptNumberLabel ?? 1,
                  })}${selectedEvaluation ? ` • ${selectedEvaluation.score}/${selectedEvaluation.maxScore}` : ""}`}
            </Text>

            {!retryMode && selectedEvaluation && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isSelectedAttemptCorrect
                      ? "#22c55e"
                      : "#ef4444",
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isSelectedAttemptCorrect
                    ? t("assignmentWidget.correct")
                    : t("assignmentWidget.incorrect")}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statusActionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.statusActionButton,
                styles.attemptsActionButton,
                pressed && styles.cardPressed,
              ]}
              onPress={() => setAttemptPickerVisible(true)}
            >
              <Text numberOfLines={1} style={styles.attemptsActionText}>
                {attemptsButtonLabel}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.statusActionButton,
                styles.retryActionButton,
                retryMode && styles.retryActionButtonActive,
                pressed && styles.cardPressed,
              ]}
              onPress={handleToggleRetryMode}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.retryActionText,
                  retryMode && styles.retryActionTextActive,
                ]}
              >
                {retryMode
                  ? t("assignmentDetail.exitRetryMode")
                  : t("assignmentDetail.retryNow")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* WebView */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: widgetHtml }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE_CONTENT}
          onLoadStart={() => {
            console.log("🎬 WebView loading...");
            setWebViewLoading(true);
          }}
          onLoadEnd={() => {
            console.log("✅ WebView loaded, waiting for WIDGET_READY...");
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("❌ WebView error:", nativeEvent);
            setError(t("assignmentWidget.failedToLoadWidget"));
            setWebViewLoading(false);
          }}
        />

        {/* WebView loading overlay */}
        {webViewLoading && (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>
              {t("assignmentWidget.loadingWidget")}
            </Text>
          </View>
        )}
      </View>

      {/* Submitting overlay */}
      {submitting && (
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.overlayText}>
              {t("assignmentWidget.savingAnswer")}
            </Text>
          </View>
        </View>
      )}

      {assignmentData.hasSubmitted && (
        <Modal
          visible={attemptPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAttemptPickerVisible(false)}
        >
          <View style={styles.attemptModalOverlay}>
            <View style={styles.attemptModalCard}>
              <View style={styles.attemptModalHeader}>
                <Text style={styles.attemptModalTitle}>
                  {attemptsModalTitle}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.attemptModalClose,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => setAttemptPickerVisible(false)}
                >
                  <Text style={styles.attemptModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.attemptModalSummary}>
                {t("assignmentDetail.attemptsSummary", {
                  count: attemptCount,
                  correct: correctAttemptCount,
                })}
              </Text>

              <ScrollView contentContainerStyle={styles.attemptList}>
                {attempts.map((attempt) => {
                  const isSelected =
                    !retryMode &&
                    selectedAttempt?.attemptNumber === attempt.attemptNumber;
                  const evaluation = attempt.evaluation;

                  return (
                    <Pressable
                      key={attempt.id}
                      style={({ pressed }) => [
                        styles.attemptRow,
                        isSelected && styles.attemptRowSelected,
                        pressed && styles.cardPressed,
                      ]}
                      onPress={() => handleSelectAttempt(attempt.attemptNumber)}
                    >
                      <Text
                        style={[
                          styles.attemptRowTitle,
                          isSelected && styles.attemptRowTitleSelected,
                        ]}
                      >
                        {t("assignmentDetail.attemptLabel", {
                          number: attempt.attemptNumber,
                        })}
                      </Text>

                      <Text
                        style={[
                          styles.attemptRowMeta,
                          isSelected && styles.attemptRowMetaSelected,
                        ]}
                      >
                        {evaluation
                          ? `${evaluation.isCorrect ? t("assignmentWidget.correct") : t("assignmentWidget.incorrect")} • ${evaluation.score}/${evaluation.maxScore}`
                          : t("assignmentModal.statusPending")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefce8",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fefce8",
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
    fontWeight: "600",
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#334155",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderColor: "#334155",
    gap: 8,
  },
  statusContentRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  statusIcon: {
    fontSize: 18,
    marginRight: 6,
    fontWeight: "bold",
  },
  statusInlineText: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "800",
    color: "#475569",
  },
  statusBadge: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  statusActionRow: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  statusActionButton: {
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  attemptsActionButton: {
    borderColor: "#92400e",
    backgroundColor: "#fff7ed",
  },
  attemptsActionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400e",
  },
  retryActionButton: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfeff",
  },
  retryActionButtonActive: {
    borderColor: "#042f2e",
    backgroundColor: "#0f766e",
  },
  retryActionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f766e",
  },
  retryActionTextActive: {
    color: "#ffffff",
  },
  cardPressed: {
    transform: [{ translateY: 1 }],
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#334155",
    borderRadius: 16,
    overflow: "hidden",
    margin: 8,
    shadowColor: "#334155",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: "white",
  },
  webViewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.94)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContent: {
    backgroundColor: "#fff7ed",
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#9a3412",
    shadowColor: "#9a3412",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
    elevation: 8,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  attemptModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  attemptModalCard: {
    width: "92%",
    maxWidth: 560,
    maxHeight: "76%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#854d0e",
    padding: 12,
    shadowColor: "#7c2d12",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 10,
  },
  attemptModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  attemptModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#7c2d12",
  },
  attemptModalClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#92400e",
    backgroundColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
  },
  attemptModalCloseText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#78350f",
  },
  attemptModalSummary: {
    fontSize: 13,
    color: "#57534e",
    marginBottom: 10,
  },
  attemptList: {
    gap: 8,
    paddingBottom: 4,
  },
  attemptRow: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d97706",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attemptRowSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ccfbf1",
  },
  attemptRowTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 2,
  },
  attemptRowTitleSelected: {
    color: "#0f766e",
  },
  attemptRowMeta: {
    fontSize: 16,
    color: "#57534e",
  },
  attemptRowMetaSelected: {
    color: "#0f766e",
  },
});
