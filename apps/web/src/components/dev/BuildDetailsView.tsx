"use client";

import { parseAnsiToStyledSegments } from "@/lib/github/ansi-parser";
import { useEffect, useState } from "react";
import WidgetPreviewDialog from "../widget/WidgetPreviewDialog";
import { useLocale } from "next-intl";

interface Widget {
  id: string;
  name: string;
  repoFullName: string;
  branch: string;
}

interface Build {
  id: string;
  version: number;
  status: string;
  buildRunId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
}

interface LogSection {
  type: "group" | "line";
  title?: string;
  lines: string[];
  collapsed?: boolean;
}

interface ParsedStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration: number | null;
  logs: LogSection[];
}

interface Props {
  widget: Widget;
  build: Build;
  widgetHtml: string | null;
}

export default function BuildDetailsView({ widget, build, widgetHtml }: Props) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1])); // Expand first step by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const response = await fetch(`/api/widgets/${build.id}/logs`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || (isVi ? "Không thể tải log" : "Failed to fetch logs"),
        );
      }

      setSteps(data.steps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(stepNumber: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  }

  function toggleGroup(stepNumber: number, groupTitle: string) {
    const key = `${stepNumber}-${groupTitle}`;
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedSteps(new Set(steps.map((s) => s.number)));
    const allGroups = steps.flatMap((step) =>
      step.logs
        .filter((log) => log.type === "group")
        .map((log) => `${step.number}-${log.title}`),
    );
    setExpandedGroups(new Set(allGroups));
  }

  function collapseAll() {
    setExpandedSteps(new Set());
    setExpandedGroups(new Set());
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <a
                href={`/dev/deploy/${widget.id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← {isVi ? "Quay lại" : "Back to"} {widget.name}
              </a>
              <span className="text-muted-foreground">|</span>
              <h1 className="text-lg font-semibold text-foreground">
                Build v{build.version}
              </h1>
            </div>
            <StatusBadge status={build.status} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Build Summary */}
        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-4">
            {isVi ? "Thông tin build" : "Build Information"}
          </h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">
                {isVi ? "Phiên bản" : "Version"}
              </span>
              <p className="font-mono text-lg font-semibold text-foreground">
                v{build.version}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {isVi ? "Trạng thái" : "Status"}
              </span>
              <p className="font-medium text-foreground">{build.status}</p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {isVi ? "Thời lượng" : "Duration"}
              </span>
              <p className="font-medium text-foreground">
                {build.duration ? `${build.duration}s` : "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {isVi ? "Hoàn tất" : "Completed"}
              </span>
              <p className="font-medium text-foreground">
                {build.completedAt
                  ? new Date(build.completedAt).toLocaleDateString(
                      isVi ? "vi-VN" : "en-US",
                    )
                  : isVi
                    ? "Đang xử lý"
                    : "In progress"}
              </p>
            </div>
          </div>
        </div>

        {widgetHtml && <WidgetPreviewDialog html={widgetHtml} />}

        {/* Build Steps */}
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {isVi ? "Các bước build" : "Build Steps"}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isVi ? "Mở tất cả" : "Expand All"}
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={collapseAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isVi ? "Thu gọn tất cả" : "Collapse All"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-muted-foreground">
                {isVi ? "Đang tải log..." : "Loading logs..."}
              </span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isVi ? "Không có bước nào" : "No steps found"}
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <StepView
                  key={step.number}
                  step={step}
                  expanded={expandedSteps.has(step.number)}
                  expandedGroups={expandedGroups}
                  onToggle={() => toggleStep(step.number)}
                  onToggleGroup={(groupTitle) =>
                    toggleGroup(step.number, groupTitle)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepView({
  step,
  expanded,
  expandedGroups,
  onToggle,
  onToggleGroup,
}: {
  step: ParsedStep;
  expanded: boolean;
  expandedGroups: Set<string>;
  onToggle: () => void;
  onToggleGroup: (title: string) => void;
}) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const conclusionIcon =
    {
      success: "✅",
      failure: "❌",
      cancelled: "🚫",
      skipped: "⏭️",
    }[step.conclusion || ""] || "⏳";

  const conclusionColor =
    {
      success: "text-green-600",
      failure: "text-red-600",
      cancelled: "text-muted-foreground",
      skipped: "text-muted-foreground",
    }[step.conclusion || ""] || "text-blue-600";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Step Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xl ${conclusionColor}`}>{conclusionIcon}</span>
          <span className="font-medium text-foreground">{step.name}</span>
          {step.duration !== null && (
            <span className="text-sm text-muted-foreground">
              ({step.duration}s)
            </span>
          )}
        </div>
        <span className="text-muted-foreground">{expanded ? "▼" : "▶"}</span>
      </button>

      {/* Step Logs */}
      {expanded && (
        <div className="border-t border-border bg-gray-900 p-4">
          {step.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {isVi ? "Không có log cho bước này" : "No logs for this step"}
            </p>
          ) : (
            <div className="space-y-2">
              {step.logs.map((section, idx) => (
                <LogSectionView
                  key={idx}
                  section={section}
                  stepNumber={step.number}
                  expanded={expandedGroups.has(
                    `${step.number}-${section.title}`,
                  )}
                  onToggle={() => section.title && onToggleGroup(section.title)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StyledLogLine({ text }: { text: string }) {
  const segments = parseAnsiToStyledSegments(text);

  return (
    <div className="leading-relaxed">
      {segments.map((segment, idx) => (
        <span key={idx} className={segment.classes.join(" ")}>
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function LogSectionView({
  section,
  stepNumber,
  expanded,
  onToggle,
}: {
  section: LogSection;
  stepNumber: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (section.type === "line") {
    // ✅ UPDATE: Use StyledLogLine instead of plain div
    return (
      <div className="font-mono text-xs text-gray-300">
        {section.lines.map((line, idx) => (
          <StyledLogLine key={idx} text={line} />
        ))}
      </div>
    );
  }

  // Group
  return (
    <div className="border border-gray-700 rounded">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-gray-400 text-xs">{expanded ? "▼" : "▶"}</span>
        <span className="font-mono text-xs text-purple-400">
          {section.title}
        </span>
      </button>

      {expanded && (
        <div className="p-2 pt-0 font-mono text-xs text-gray-300 space-y-0.5">
          {section.lines.map((line, idx) => (
            // ✅ UPDATE: Use StyledLogLine
            <div key={idx} className="pl-4">
              <StyledLogLine text={line} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const colors = {
    pending: "bg-muted text-muted-foreground",
    building: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  const labels = {
    pending: isVi ? "ĐANG CHỜ" : "PENDING",
    building: isVi ? "ĐANG BUILD" : "BUILDING",
    success: isVi ? "THÀNH CÔNG" : "SUCCESS",
    failed: isVi ? "THẤT BẠI" : "FAILED",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status as keyof typeof colors] || colors.pending}`}
    >
      {labels[status as keyof typeof labels] || labels.pending}
    </span>
  );
}
