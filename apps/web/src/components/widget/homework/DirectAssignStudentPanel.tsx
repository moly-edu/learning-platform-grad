"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";

interface DirectAssignStudentPanelProps {
  assignmentId: string;
  studentId: string;
  studentName: string;
  onAssigned?: () => void;
}

export default function DirectAssignStudentPanel({
  assignmentId,
  studentId,
  studentName,
  onAssigned,
}: DirectAssignStudentPanelProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/class/assignment/${assignmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || (isVi ? "Không thể giao bài" : "Unable to assign"),
        );
      }
      setAssigned(true);
      onAssigned?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isVi
            ? "Có lỗi xảy ra"
            : "Something went wrong",
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          {isVi ? "Giao bài" : "Assign"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {isVi
            ? "Giao trực tiếp cho học sinh hiện tại"
            : "Assign directly to the current student"}
        </p>
      </div>

      <div className="p-4 flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-orange-600">
              {studentName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="font-medium text-foreground">{studentName}</div>
        </div>

        {assigned ? (
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle size={20} />
            {isVi ? "Đã giao bài thành công!" : "Assigned successfully!"}
          </div>
        ) : (
          <Button
            onClick={handleAssign}
            disabled={assigning}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {assigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isVi ? "Đang giao..." : "Assigning..."}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {isVi ? `Giao cho ${studentName}` : `Assign for ${studentName}`}
              </>
            )}
          </Button>
        )}

        {error && <div className="text-sm text-red-500">{error}</div>}
      </div>
    </div>
  );
}
