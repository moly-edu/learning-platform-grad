"use client";

import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";
import {
  ArrowLeft,
  AlertCircle,
  Link,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { SchemaProcessor } from "@/components/widget/core/SchemaProcessor";
import { TweakpaneBuilder } from "@/components/widget/core/TweakpaneBuilder";
import {
  DifficultyLevel,
  Submission,
  WidgetDefinition,
} from "@/components/widget/core/types";
import { useLocale } from "next-intl";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "@/components/widget/core/HostTtsClient";
import {
  listenWithHostStt,
  stopHostSttListening,
} from "@/components/widget/core/HostSttClient";

function getSchemaFieldByPath(schema: Record<string, any>, path: string): any {
  const parts = path.split(".").filter((part) => part.length > 0);
  let current: any = schema;

  for (const part of parts) {
    if (!current) return null;

    if (current[part]) {
      current = current[part];
    } else if (current.fields && current.fields[part]) {
      current = current.fields[part];
    } else {
      return null;
    }
  }

  return current;
}

function setValueByPath(
  target: Record<string, any>,
  path: string,
  value: any,
): boolean {
  const parts = path.split(".").filter((part) => part.length > 0);
  if (parts.length < 1) {
    return false;
  }

  let container = target;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    const current = container[part];

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      container[part] = {};
    }

    container = container[part] as Record<string, any>;
  }

  container[parts[parts.length - 1]] = value;
  return true;
}

function applyInitialDifficultyToConfig(
  initialConfig: Record<string, any>,
  widgetDef: WidgetDefinition,
  initialDifficulty: DifficultyLevel,
) {
  const difficultyPath =
    widgetDef.difficultySync?.difficultyPath || "difficulty";
  const difficultyField = getSchemaFieldByPath(
    widgetDef.schema,
    difficultyPath,
  );

  let normalizedDifficulty: string = initialDifficulty;
  if (
    difficultyField?.type === "select" &&
    Array.isArray(difficultyField.options) &&
    difficultyField.options.length > 0
  ) {
    const options = difficultyField.options as string[];
    if (!options.includes(normalizedDifficulty)) {
      normalizedDifficulty = options.includes("medium") ? "medium" : options[0];
    }
  }

  const applied = setValueByPath(
    initialConfig,
    difficultyPath,
    normalizedDifficulty,
  );
  if (
    !applied &&
    Object.prototype.hasOwnProperty.call(initialConfig, "difficulty")
  ) {
    initialConfig.difficulty = normalizedDifficulty;
  }
}

// ============================================================
// WIDGET VALIDATOR - CHỈ SỬA HÀM NÀY
// ============================================================
async function validateWidget(url: string): Promise<{
  valid: boolean;
  errorType?: "cors" | "network" | "timeout" | "invalid";
}> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");

    let timeout: NodeJS.Timeout;
    let messageListener: (event: MessageEvent) => void;

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", messageListener);
      document.body.removeChild(iframe);
    };

    messageListener = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        console.log("✅ Widget validation successful");
        cleanup();
        resolve({ valid: true });
      }
    };

    timeout = setTimeout(() => {
      console.log("❌ Widget validation timeout");
      cleanup();
      resolve({
        valid: false,
        errorType: "timeout",
      });
    }, 2000);

    // Listen for load errors
    iframe.onerror = () => {
      cleanup();
      resolve({
        valid: false,
        errorType: "network",
      });
    };

    window.addEventListener("message", messageListener);
    document.body.appendChild(iframe);

    // SỬA: Load URL trực tiếp thay vì fetch HTML
    iframe.src = url;
  });
}

export default function WidgetPreviewPage() {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [widgetUrl, setWidgetUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");
  const [inputDifficulty, setInputDifficulty] =
    useState<DifficultyLevel>("medium");
  const [error, setError] = useState<string>("");
  const [validating, setValidating] = useState(false);

  const getValidateErrorMessage = (
    errorType?: "cors" | "network" | "timeout" | "invalid",
  ) => {
    if (errorType === "timeout") {
      return isVi
        ? "Widget không phản hồi trong 2 giây. Hãy kiểm tra xem widget có gửi sự kiện WIDGET_READY không."
        : "Widget did not respond within 2 seconds. Please make sure it emits WIDGET_READY.";
    }

    if (errorType === "network") {
      return isVi
        ? "Không thể tải widget từ URL này"
        : "Unable to load widget from this URL";
    }

    return isVi ? "Widget không hợp lệ" : "Invalid widget";
  };

  const handleLoadWidget = async () => {
    setError("");

    // Validate URL format
    if (!inputUrl.trim()) {
      setError(
        isVi ? "Vui lòng nhập URL của widget" : "Please enter widget URL",
      );
      return;
    }

    try {
      new URL(inputUrl);
    } catch (err) {
      setError(isVi ? "URL không hợp lệ." : "Invalid URL.");
      return;
    }

    // Validate widget
    setValidating(true);
    const result = await validateWidget(inputUrl);
    setValidating(false);

    if (!result.valid) {
      setError(getValidateErrorMessage(result.errorType));
      return;
    }

    // All good, load widget
    setWidgetUrl(inputUrl);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !validating) {
      handleLoadWidget();
    }
  };

  if (widgetUrl) {
    return (
      <WidgetHost
        widgetUrl={widgetUrl}
        initialDifficulty={inputDifficulty}
        onExit={() => setWidgetUrl("")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex justify-center p-6">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-10 mt-20">
          <h1 className="text-5xl font-black text-foreground mb-4 tracking-tight">
            Widget Studio
          </h1>
        </header>

        <div className="bg-card p-10 rounded-[2.5rem] shadow-xl border border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Link className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {isVi ? "Nhập URL Widget" : "Enter Widget URL"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isVi
                  ? "Dán link widget để bắt đầu"
                  : "Paste widget link to start"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="http://localhost:5173"
              className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none transition-colors text-foreground"
              disabled={validating}
            />

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                {isVi
                  ? "Độ khó đầu vào (giao tự động)"
                  : "Initial difficulty (auto assignment)"}
              </label>
              <select
                value={inputDifficulty}
                onChange={(e) =>
                  setInputDifficulty(e.target.value as DifficultyLevel)
                }
                className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none transition-colors text-foreground bg-card"
                disabled={validating}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {isVi
                  ? "Giá trị này sẽ được áp vào cấu hình ban đầu trước lần gửi tham số đầu tiên."
                  : "This value is applied to the initial widget config before the first parameter sync."}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle
                  className="text-red-500 shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleLoadWidget}
              disabled={validating}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-xl transition-colors disabled:bg-muted disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {validating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  {isVi ? "Đang kiểm tra widget..." : "Checking widget..."}
                </>
              ) : isVi ? (
                "Tải Widget"
              ) : (
                "Load Widget"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WIDGET HOST - CHỈ SỬA COMPONENT NÀY
// ============================================================
function WidgetHost({
  widgetUrl,
  initialDifficulty,
  onExit,
}: {
  widgetUrl: string;
  initialDifficulty: DifficultyLevel;
  onExit: () => void;
}) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  // NEW: Submission state
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);
  const messageQueueRef = useRef<any[]>([]);

  useEffect(() => {
    if (!iframeRef.current) return;

    console.log(`📥 Loading widget from: ${widgetUrl}`);
    setLoading(true);
    setError(null);
    setIframeReady(false);

    iframeRef.current.src = widgetUrl;
  }, [widgetUrl]);

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
            iframe.contentWindow?.postMessage(msg, "*");
          });
          messageQueueRef.current = [];
        }
      }, 300);
    };

    const handleError = () => {
      console.error("❌ Iframe failed to load");
      setError("Không thể tải widget từ URL này");
      setLoading(false);
    };

    iframe.addEventListener("load", handleLoad);
    iframe.addEventListener("error", handleError);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;
        console.log("📦 Widget definition received:", def);
        setWidgetDef(def);
        setLoading(false);
        setError(null);
      }

      // NEW: Handle submission
      if (event.data.type === "SUBMIT") {
        const submissionData: Submission = event.data.payload;
        console.log("✅ Submission received:", submissionData);

        setSubmission(submissionData);

        // In production: save to database
        // For demo: show in console and alert
        console.log(
          "💾 SAVE TO DATABASE:",
          JSON.stringify(submissionData, null, 2),
        );
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

      if (event.data.type === "STT_LISTEN") {
        const requestId = event.data?.payload?.requestId;
        const lang = event.data?.payload?.lang;
        const timeoutMs = event.data?.payload?.timeoutMs;
        const mode = event.data?.payload?.mode;
        if (!requestId) return;
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }
        const targetWindow = event.source as Window | null;
        if (!targetWindow) return;
        (async () => {
          const result = await listenWithHostStt({
            lang,
            timeoutMs,
            mode,
          });
          targetWindow.postMessage(
            {
              type: "STT_LISTEN_RESULT",
              payload: {
                requestId,
                ...result,
              },
            },
            "*",
          );
        })();
      }

      if (event.data.type === "STT_STOP") {
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }
        stopHostSttListening();
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
  }, []);

  const sendMessage = (message: any) => {
    if (iframeRef.current?.contentWindow && iframeReady) {
      console.log("📤 Sending to widget:", message.type);
      iframeRef.current.contentWindow.postMessage(message, "*");
    } else {
      console.log("⏳ Queuing message (iframe not ready):", message.type);
      messageQueueRef.current.push(message);
    }
  };

  // NEW: Enter review mode
  const enterReviewMode = () => {
    if (!submission || !config) return;

    console.log("🔍 Entering review mode with:", { config, submission });

    setIsReviewMode(true);

    // Gửi config + answer (không gửi evaluation!)
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: {
        ...config,
        __answer: submission.answer, // Chỉ gửi answer
      },
    });
  };

  // NEW: Exit review mode
  const exitReviewMode = () => {
    console.log("🔙 Exiting review mode");
    setIsReviewMode(false);

    // Chỉ cần gửi lại config KHÔNG CÓ __answer
    // Widget sẽ tự reset về practice mode
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: config, // Config gốc, không có __answer
    });

    // Clear submission để có thể submit lại
    setSubmission(null);
  };

  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      const pane = new Pane({
        container: paneRef.current,
        title: isVi ? "Tham số widget" : "Widget Parameters",
      });

      pane.registerPlugin(TweakpaneImagePlugin);
      paneInstanceRef.current = pane;

      const initialConfig =
        widgetDef.resolvedDefaults ??
        SchemaProcessor.extractDefaultsFromSchema(widgetDef.schema);

      applyInitialDifficultyToConfig(
        initialConfig,
        widgetDef,
        initialDifficulty,
      );

      console.log("🎯 Initial config extracted:", initialConfig);

      const handleConfigChange = (newConfig: Record<string, any>) => {
        console.log("🔄 Config changed, sending to widget");
        setConfig(newConfig);
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: newConfig,
        });
      };

      const builder = new TweakpaneBuilder(
        pane,
        initialConfig,
        widgetDef.schema,
        widgetDef.difficultySync,
        handleConfigChange,
      );

      builder.build();

      setTimeout(async () => {
        const serializedConfig = await builder.serializeConfig(initialConfig);
        handleConfigChange(serializedConfig);
      }, 100);
    } catch (err) {
      console.error("❌ Tweakpane setup error:", err);
      setError(
        err instanceof Error
          ? err.message
          : isVi
            ? "Thiết lập thất bại"
            : "Setup failed",
      );
    }

    return () => {
      if (paneInstanceRef.current) {
        paneInstanceRef.current.dispose();
        paneInstanceRef.current = null;
      }
    };
  }, [widgetDef, iframeReady, isVi, initialDifficulty]);

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 px-12 py-2">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full 
                 text-sm font-medium text-muted-foreground 
                 bg-card shadow hover:text-foreground hover:shadow-md transition"
          >
            <ArrowLeft size={18} />
            {isVi ? "Quay lại" : "Back"}
          </button>

          {/* Widget Card */}
          <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
            <div className="h-155">
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                title="Widget"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>

        {loading && !error && (
          <div className="mt-6 flex items-center justify-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
            <span className="text-sm">
              {isVi ? "Đang tải widget..." : "Widget Loading..."}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="text-red-500 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-700">
                {isVi ? "Lỗi" : "Error"}
              </div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-100 bg-card border-l border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            {isVi ? "Cấu hình và kết quả" : "Config & Result"}
          </h3>
        </div>

        <div
          ref={paneRef}
          className="tp-host-panel flex-1 overflow-y-auto p-4 text-sm text-muted-foreground"
        />

        {/* NEW: Submission Info */}
        {submission && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {isVi ? "📊 Kết quả" : "📊 Result"}
            </div>

            <div
              className={`p-3 rounded-lg ${
                submission.evaluation.isCorrect
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {submission.evaluation.isCorrect ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <XCircle className="text-red-600" size={18} />
                )}
                <span
                  className={`font-semibold ${
                    submission.evaluation.isCorrect
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {submission.evaluation.isCorrect
                    ? isVi
                      ? "Đúng"
                      : "Correct"
                    : isVi
                      ? "Sai"
                      : "Incorrect"}
                </span>
              </div>

              <div className="text-sm space-y-1">
                <div className="text-foreground">
                  {isVi ? "Điểm" : "Score"}:{" "}
                  <strong>
                    {submission.evaluation.score}/
                    {submission.evaluation.maxScore}
                  </strong>
                </div>
              </div>
            </div>

            {/* Review Mode Toggle */}
            {!isReviewMode ? (
              <button
                onClick={enterReviewMode}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                {isVi ? "🔍 Xem lại đáp án" : "🔍 Review your answers"}
              </button>
            ) : (
              <button
                onClick={exitReviewMode}
                className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                {isVi ? "← Quay lại chế độ làm bài" : "← Return to test mode"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
