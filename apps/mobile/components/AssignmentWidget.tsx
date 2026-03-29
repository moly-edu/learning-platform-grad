import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { API_BASE_URL } from "@/lib/config/api";
import { authClient } from "@/lib/auth-client";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "@/components/widget/core/HostTtsClient";

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
  
  // 3. Setup handler for messages FROM React Native
  window.handleMessageFromNative = function(messageJson) {
    try {
      var message = JSON.parse(messageJson);
      var event = new MessageEvent('message', { data: message });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to handle native message:', error);
    }
  };
})();
true;
`;

export default function AssignmentWidget({
  assignmentId,
  onCompleted,
  onEvaluationUpdate,
  onError,
}: AssignmentWidgetProps) {
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(
    null,
  );
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webViewRef = useRef<WebView>(null);
  const configSentRef = useRef(false);

  // Reset when assignmentId changes
  useEffect(() => {
    configSentRef.current = false;
    setWebViewLoading(true);
    setError(null);
  }, [assignmentId]);

  // Send message to WebView using injectJavaScript
  const sendMessage = (message: any) => {
    const messageJson = JSON.stringify(message);
    console.log("📤 Sending to widget:", message.type);

    const script = `
      if (typeof window.handleMessageFromNative === 'function') {
        window.handleMessageFromNative('${messageJson.replace(/'/g, "\\'")}');
      }
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  };

  // Load assignment data
  useEffect(() => {
    const loadAssignment = async () => {
      if (!assignmentId) {
        setError("No assignment ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: session } = await authClient.getSession();
        if (!session?.session.token) {
          throw new Error("No session token");
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
          throw new Error(errorData.error || "Failed to load assignment");
        }

        const data: AssignmentData = await assignmentRes.json();
        console.log("📦 Assignment data loaded:", data.assignmentId);
        setAssignmentData(data);

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
          throw new Error("Failed to load widget");
        }

        const widgetData: { html: string } = await widgetRes.json();
        setWidgetHtml(widgetData.html);
      } catch (err) {
        console.error("❌ Load assignment error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [assignmentId, onError]);

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
        setError(null);

        // Send config immediately after widget ready
        if (!configSentRef.current && assignmentData) {
          configSentRef.current = true;

          setTimeout(() => {
            if (assignmentData.hasSubmitted && assignmentData.submissionData) {
              // Already submitted → Send config + answer for review
              console.log("📤 Sending config with answer (review mode)");
              sendMessage({
                type: "PARAMS_UPDATE",
                payload: {
                  ...assignmentData.assignmentConfig,
                  __answer: assignmentData.submissionData.answer,
                },
              });
            } else {
              // Not submitted → Send config normally
              console.log("📤 Sending config (assignment mode)");
              sendMessage({
                type: "PARAMS_UPDATE",
                payload: assignmentData.assignmentConfig,
              });
            }
          }, 100);
        }
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

      if (message.type === "ERROR") {
        console.error("❌ Widget error:", message.payload);
        const errorMessage = message.payload?.message || "Widget error";
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  };

  // Submit to database
  const handleSubmitToDatabase = async (submission: Submission) => {
    if (!assignmentData) return;

    setSubmitting(true);

    try {
      const { data: session } = await authClient.getSession();
      if (!session?.session.token) {
        throw new Error("No session");
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
        throw new Error(errorData.error || "Failed to save submission");
      }

      console.log("✅ Submission saved");

      // Update local state
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

      // Send answer back to widget for display
      setTimeout(() => {
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: {
            ...assignmentData.assignmentConfig,
            __answer: submission.answer,
          },
        });
      }, 100);

      // Notify evaluation update (for color indication in parent screen)
      onEvaluationUpdate?.(assignmentId, submission.evaluation.isCorrect);

      // Notify parent
      onCompleted?.(submission);
    } catch (err) {
      console.error("❌ Submit error:", err);
      const errorMessage = err instanceof Error ? err.message : "Submit failed";
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
        <Text style={styles.loadingText}>Loading assignment...</Text>
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
        <Text style={styles.emptyText}>No assignment data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with submission status */}
      {assignmentData.hasSubmitted && assignmentData.submissionData && (
        <View
          style={[
            styles.statusHeader,
            {
              backgroundColor: assignmentData.submissionData.evaluation
                .isCorrect
                ? "#dcfce7"
                : "#fee2e2",
            },
          ]}
        >
          <View style={styles.statusContent}>
            <Text style={styles.statusIcon}>
              {assignmentData.submissionData.evaluation.isCorrect ? "✓" : "✗"}
            </Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Completed</Text>
              <Text style={styles.statusScore}>
                Score: {assignmentData.submissionData.evaluation.score}/
                {assignmentData.submissionData.evaluation.maxScore}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: assignmentData.submissionData.evaluation
                  .isCorrect
                  ? "#22c55e"
                  : "#ef4444",
              },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {assignmentData.submissionData.evaluation.isCorrect
                ? "Correct"
                : "Incorrect"}
            </Text>
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
            setError("Failed to load widget");
            setWebViewLoading(false);
          }}
        />

        {/* WebView loading overlay */}
        {webViewLoading && (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading widget...</Text>
          </View>
        )}
      </View>

      {/* Submitting overlay */}
      {submitting && (
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.overlayText}>Saving your answer...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusIcon: {
    fontSize: 22,
    marginRight: 8,
    fontWeight: "bold",
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },
  statusScore: {
    fontSize: 13,
    color: "#475569",
  },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "white",
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
    backgroundColor: "#ffffff",
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
    backgroundColor: "white",
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
});
