"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Send, User, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "next-intl";

interface StudentWithStatus {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  isAssigned: boolean;
  hasSubmitted: boolean;
  submission: {
    id: string;
    submittedAt: string | null;
    evaluation: {
      isCorrect: boolean;
      score: number;
      maxScore: number;
    };
    answer: any;
  } | null;
}

interface GroupWithStatus {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
  totalMembers: number;
  assignedMembers: number;
  allAssigned: boolean;
}

type TabType = "groups" | "individual";

interface AssignmentStudentsPanelProps {
  assignmentId: string;
  onViewAnswer?: (answer: any) => void;
}

export default function AssignmentStudentsPanel({
  assignmentId,
  onViewAnswer,
}: AssignmentStudentsPanelProps) {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [groups, setGroups] = useState<GroupWithStatus[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    pending: 0,
    assigned: 0,
  });
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [assigningGroup, setAssigningGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("groups");

  // Load students list
  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await fetch(`/api/class/assignment/${assignmentId}/students`);
      if (!res.ok) {
        throw new Error(
          isVi
            ? "Không thể tải danh sách học sinh"
            : "Unable to load student list",
        );
      }
      const data = await res.json();
      setStudents(data.students);
      setGroups(data.groups || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Load students error:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [assignmentId, isVi]);

  // Assign to student (single)
  const handleAssignToStudent = async (studentId: string) => {
    setAssigningTo(studentId);
    try {
      const res = await fetch(`/api/class/assignment/${assignmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || (isVi ? "Không thể giao bài" : "Unable to assign"),
        );
      }
      await loadStudents();
    } catch (err) {
      console.error("Assign error:", err);
      alert(
        "❌ " +
          (err instanceof Error
            ? err.message
            : isVi
              ? "Không thể giao bài"
              : "Unable to assign"),
      );
    } finally {
      setAssigningTo(null);
    }
  };

  // Assign to group (bulk)
  const handleAssignToGroup = async (groupId: string, memberIds: string[]) => {
    setAssigningGroup(groupId);
    try {
      const unassignedIds = memberIds.filter(
        (id) => !students.find((s) => s.id === id)?.isAssigned,
      );
      if (unassignedIds.length === 0) {
        await loadStudents();
        return;
      }
      const res = await fetch(`/api/class/assignment/${assignmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: unassignedIds }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || (isVi ? "Không thể giao bài" : "Unable to assign"),
        );
      }
      await loadStudents();
    } catch (err) {
      console.error("Assign group error:", err);
      alert(
        "❌ " +
          (err instanceof Error
            ? err.message
            : isVi
              ? "Không thể giao bài"
              : "Unable to assign"),
      );
    } finally {
      setAssigningGroup(null);
    }
  };

  // Assign to all students
  const handleAssignToAll = async () => {
    setAssigningGroup("__all__");
    try {
      const unassignedIds = students
        .filter((s) => !s.isAssigned)
        .map((s) => s.id);
      if (unassignedIds.length === 0) {
        await loadStudents();
        return;
      }
      const res = await fetch(`/api/class/assignment/${assignmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: unassignedIds }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || (isVi ? "Không thể giao bài" : "Unable to assign"),
        );
      }
      await loadStudents();
    } catch (err) {
      console.error("Assign all error:", err);
      alert(
        "❌ " +
          (err instanceof Error
            ? err.message
            : isVi
              ? "Không thể giao bài"
              : "Unable to assign"),
      );
    } finally {
      setAssigningGroup(null);
    }
  };

  const allAssigned =
    students.length > 0 && students.every((s) => s.isAssigned);

  return (
    <div className="flex flex-col h-full">
      {/* Stats header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          {isVi ? "Giao bài tập" : "Assignment Delivery"}
        </h3>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <div>
            {isVi ? "Đã giao" : "Assigned"}: {stats.assigned}/{stats.total}
          </div>
          <div>
            {isVi ? "Đã nộp" : "Submitted"}: {stats.submitted}/
            {stats.assigned || stats.total}
          </div>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="inline-block w-4 h-4 mr-1.5 -mt-0.5" />
          {isVi ? "Nhóm" : "Groups"}
        </button>
        <button
          onClick={() => setActiveTab("individual")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "individual"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="inline-block w-4 h-4 mr-1.5 -mt-0.5" />
          {isVi ? "Cá nhân" : "Individual"}
        </button>
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        {loadingStudents ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "groups" ? (
          /* ===== GROUPS TAB ===== */
          <div className="p-3 space-y-2">
            {/* Special: Assign to all */}
            <div
              className={`p-3 rounded-lg border ${
                allAssigned
                  ? "bg-green-50 border-green-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                  <Users size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">
                    {isVi ? "Cả lớp" : "Whole class"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.total} {isVi ? "học sinh" : "students"} ·{" "}
                    {stats.assigned} {isVi ? "đã giao" : "assigned"}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                {allAssigned ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle size={14} />
                    {isVi ? "Đã giao cho tất cả" : "Assigned to everyone"}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={handleAssignToAll}
                    disabled={assigningGroup === "__all__"}
                  >
                    {assigningGroup === "__all__" ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        {isVi ? "Đang giao..." : "Assigning..."}
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 mr-1" />
                        {isVi ? "Giao cho cả lớp" : "Assign to class"} ({" "}
                        {stats.total - stats.assigned}{" "}
                        {isVi ? "chưa giao" : "Unassigned"})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Group list */}
            {groups.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {isVi
                  ? "Chưa có nhóm nào trong lớp"
                  : "No groups in this class"}
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className={`p-3 rounded-lg border ${
                    group.allAssigned
                      ? "bg-green-50 border-green-200"
                      : "bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold text-sm">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {group.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.totalMembers} {isVi ? "thành viên" : "members"} ·{" "}
                        {group.assignedMembers} {isVi ? "đã giao" : "assigned"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    {group.allAssigned ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                        <CheckCircle size={14} />
                        {isVi ? "Đã giao tất cả" : "Assigned to all"}
                      </div>
                    ) : group.totalMembers === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {isVi
                          ? "Nhóm chưa có thành viên"
                          : "Group has no members"}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full text-xs bg-orange-500 hover:bg-orange-600"
                        onClick={() =>
                          handleAssignToGroup(group.id, group.memberIds)
                        }
                        disabled={assigningGroup === group.id}
                      >
                        {assigningGroup === group.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            {isVi ? "Đang giao..." : "Assigning..."}
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3 mr-1" />
                            {isVi ? "Giao cho nhóm" : "Assign to group"} (
                            {group.totalMembers - group.assignedMembers}{" "}
                            {isVi ? "chưa giao" : "Unassigned"})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ===== INDIVIDUAL TAB ===== */
          <div>
            {students.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {isVi
                  ? "Chưa có học sinh trong lớp"
                  : "No students in this class"}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3 rounded-lg border ${
                      student.hasSubmitted
                        ? "bg-green-50 border-green-200"
                        : student.isAssigned
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={student.imageUrl || undefined} />
                        <AvatarFallback>
                          <User size={18} />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">
                          {student.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {student.email}
                        </div>

                        {/* CASE 1: Đã làm bài */}
                        {student.hasSubmitted && student.submission ? (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              {student.submission.evaluation?.isCorrect ? (
                                <CheckCircle
                                  className="text-green-600"
                                  size={16}
                                />
                              ) : (
                                <XCircle className="text-red-600" size={16} />
                              )}
                              <span className="text-xs font-semibold">
                                {student.submission.evaluation?.score || 0}/
                                {student.submission.evaluation?.maxScore || 100}
                              </span>
                            </div>

                            {onViewAnswer && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs"
                                onClick={() =>
                                  onViewAnswer(student.submission!.answer)
                                }
                              >
                                {isVi ? "👁️ Xem bài làm" : "👁️ Review answer"}
                              </Button>
                            )}

                            <div className="text-xs text-muted-foreground">
                              {student.submission.submittedAt &&
                                new Date(
                                  student.submission.submittedAt,
                                ).toLocaleString(isVi ? "vi-VN" : "en-US")}
                            </div>
                          </div>
                        ) : student.isAssigned ? (
                          /* CASE 2: Đã giao bài nhưng chưa làm */
                          <div className="mt-2">
                            <div className="text-xs text-amber-600 font-medium mb-1">
                              {isVi
                                ? "⏳ Đã giao - Chưa nộp"
                                : "⏳ Assigned - Not Done"}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-xs"
                              disabled
                            >
                              {isVi
                                ? "Đang chờ học sinh nộp bài..."
                                : "Awaiting student submissions..."}
                            </Button>
                          </div>
                        ) : (
                          /* CASE 3: Chưa giao bài */
                          <Button
                            size="sm"
                            className="w-full mt-2 text-xs bg-orange-500 hover:bg-orange-600"
                            onClick={() => handleAssignToStudent(student.id)}
                            disabled={assigningTo === student.id}
                          >
                            {assigningTo === student.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                {isVi ? "Đang giao..." : "Assigning..."}
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3 mr-1" />
                                {isVi ? "Giao bài" : "Assign"}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
