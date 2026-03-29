"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Submission, WidgetDefinition } from "../core/types";
import { useLocale } from "next-intl";
import {
  stopHostTtsPlayback,
  synthesizeWithHostTts,
} from "../core/HostTtsClient";

interface TeacherViewAssignmentProps {
  html: string;
  initialConfig: Record<string, any>;
}

export default function TeacherViewAssignment({
  html,
  initialConfig,
}: TeacherViewAssignmentProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config] = useState<Record<string, any>>(initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Helper to send messages - FIXED VERSION
  const sendMessage = (message: any) => {
    const iframe = iframeRef.current;

    // Kiểm tra trực tiếp contentWindow thay vì dựa vào state
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

  // Load widget HTML and communicate with iframe
  useEffect(() => {
    const loadWidget = async () => {
      setLoading(true);
      setError(null);
      setIframeReady(false);

      try {
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

      // Handle submission - TỰ ĐỘNG gửi answer về widget
      if (event.data.type === "SUBMIT") {
        const submissionData: Submission = event.data.payload;
        console.log("✅ Submission received:", submissionData);

        // TỰ ĐỘNG gửi answer về widget để hiển thị kết quả BÊN TRONG iframe
        console.log("📤 Preparing to send answer back to widget");

        // Gửi ngay lập tức, không cần setTimeout
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: {
            ...config,
            __answer: submissionData.answer,
          },
        });
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
  }, [config, isVi]);

  // Send initial config when iframe ready
  useEffect(() => {
    console.log("Hey i test ", iframeReady, widgetDef);
    if (!iframeReady || !widgetDef) return;

    console.log("📤 Sending initial config to widget:", config);

    sendMessage({
      type: "PARAMS_UPDATE",
      payload: config,
    });
  }, [iframeReady, widgetDef, config]);

  return (
    <div className="bg-background h-full min-h-0 p-4">
      {/* FULL WIDTH iframe - không có sidebar */}
      <div className="h-full max-w-6xl mx-auto bg-card rounded-4xl shadow-2xl overflow-hidden border border-border/50">
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
          {isVi ? "Đang tải widget..." : "Loading widget..."}
        </div>
      )}

      {error && (
        <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
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
  );
}
