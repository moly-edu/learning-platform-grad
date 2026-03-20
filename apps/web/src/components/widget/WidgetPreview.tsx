"use client";

import { useEffect, useRef, useState } from "react";
import { Submission, WidgetDefinition } from "./core/types";
import { SchemaProcessor } from "./core/SchemaProcessor";
import { TweakpaneBuilder } from "./core/TweakpaneBuilder";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "./core/HostTtsClient";

export default function WidgetPreview({ html }: { html: string }) {
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Load widget HTML and communicate with iframe
  useEffect(() => {
    const loadWidget = async () => {
      setLoading(true);
      setError(null);
      setIframeReady(false);

      try {
        // Set srcdoc to load HTML directly
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
        console.error(err);
      }
    };

    loadWidget();
  }, [html]);

  // Handle iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("🎬 Iframe loaded successfully");

      setTimeout(() => {
        setIframeReady(true);

        // Flush message queue
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

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, []);

  // Listen to widget messages
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

      if (event.data.type === "ERROR") {
        console.error("❌ Widget error:", event.data.payload);
        setError(event.data.payload?.message || "Widget error");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Helper to send messages
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

  // Setup Tweakpane when widget definition is ready
  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      const pane = new Pane({
        container: paneRef.current,
        title: "Widget Parameters",
      });

      pane.registerPlugin(TweakpaneImagePlugin);
      paneInstanceRef.current = pane;

      const initialConfig =
        widgetDef.resolvedDefaults ??
        SchemaProcessor.extractDefaultsFromSchema(widgetDef.schema);

      console.log("🎯 Initial config extracted:", initialConfig);

      const handleConfigChange = (newConfig: Record<string, any>) => {
        console.log("Config changed:", newConfig);
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
        handleConfigChange,
      );

      builder.build();

      setTimeout(async () => {
        const serializedConfig = await builder.serializeConfig(initialConfig);
        handleConfigChange(serializedConfig);
      }, 100);
    } catch (err) {
      console.error("❌ Tweakpane setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    }

    return () => {
      if (paneInstanceRef.current) {
        paneInstanceRef.current.dispose();
        paneInstanceRef.current = null;
      }
    };
  }, [widgetDef, iframeReady]);

  return (
    <div className="bg-background flex h-full min-h-0">
      <div className="flex-1 p-2 min-h-0">
        <div className="h-full max-w-2xl mx-auto bg-card rounded-4xl shadow-2xl overflow-hidden border border-border/50">
          <iframe
            ref={iframeRef}
            className="w-full h-full min-h-100 min-w-[320px] border-0"
            title="Widget"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {loading && !error && (
          <div className="text-center mt-8 text-muted-foreground flex items-center justify-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full" />
            Loading widget...
          </div>
        )}

        {error && (
          <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-bold text-red-800">Lỗi</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      <div className="w-80 bg-card border-l border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Cấu hình & Kết quả
          </h3>
        </div>

        <div
          ref={paneRef}
          className="flex-1 overflow-y-auto p-4 text-sm text-muted-foreground"
        />

        {/* NEW: Submission Info */}
        {submission && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              📊 Kết quả nộp bài
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
                  {submission.evaluation.isCorrect ? "Đúng" : "Sai"}
                </span>
              </div>

              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">
                  Điểm:{" "}
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
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                🔍 Review your answers
              </button>
            ) : (
              <button
                onClick={exitReviewMode}
                className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                ← Return to test mode
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
