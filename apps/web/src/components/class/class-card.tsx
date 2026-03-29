import { ClassRole } from "@repo/db";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getDateTimeLocale } from "@/i18n/config";

interface ClassCardProps {
  classData: {
    id: string;
    name: string;
    role: ClassRole;
    course: {
      name: string;
    };
    _count: {
      members: number;
    };
    joinedAt: Date;
  };
  pendingAssignments?: {
    pending: number;
    total: number;
  };
}

export async function ClassCard({
  classData,
  pendingAssignments,
}: ClassCardProps) {
  const t = await getTranslations("classes.card");
  const locale = await getLocale();

  const getRoleBadge = (role: ClassRole) => {
    const badges = {
      owner: "bg-purple-100 text-purple-800",
      teacher: "bg-blue-100 text-blue-800",
      student: "bg-green-100 text-green-800",
    };

    const labels = {
      owner: t("owner"),
      teacher: t("teacher"),
      student: t("student"),
    };

    return (
      <span
        className={`text-xs font-medium px-2.5 py-0.5 rounded ${badges[role]}`}
      >
        {labels[role]}
      </span>
    );
  };

  return (
    <Link href={`/dashboard/class/${classData.id}`}>
      <div className="border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer bg-card relative">
        {/* Badge chưa làm bài (chỉ hiển thị cho student) */}
        {classData.role === "student" &&
          pendingAssignments &&
          pendingAssignments.pending > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
              <AlertCircle size={12} />
              {pendingAssignments.pending} {t("pending")}
            </div>
          )}

        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold line-clamp-1">
            {classData.name}
          </h3>
          {getRoleBadge(classData.role)}
        </div>

        <p className="text-muted-foreground text-sm mb-4">
          {classData.course.name}
        </p>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {classData._count.members} {t("members")}
          </span>
          <span>
            {new Date(classData.joinedAt).toLocaleDateString(
              getDateTimeLocale(locale),
            )}
          </span>
        </div>

        {/* Thông tin bài tập (chỉ cho student) */}
        {classData.role === "student" && pendingAssignments && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("assignment")}:</span>
              <div className="flex items-center gap-2">
                {pendingAssignments.pending > 0 ? (
                  <span className="text-red-600 font-semibold">
                    {pendingAssignments.pending}/{pendingAssignments.total}{" "}
                    {t("pending")}
                  </span>
                ) : pendingAssignments.total > 0 ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t("done")}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {t("noAssignments")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
