import { ClassCard } from "@/components/class/class-card";
import { apiServer } from "@/lib/api-server-client";
import { getTranslations } from "next-intl/server";

export default async function ClassesPage() {
  const t = await getTranslations("classes.page");

  const classesRes = await apiServer.classes.getUserClasses();
  const classes =
    classesRes.status === 200
      ? classesRes.body
      : { owner: [] as any[], teacher: [] as any[], student: [] as any[] };

  // Load pending assignments cho tất cả student classes
  const studentClassIds = classes.student.map((c: any) => c.id);
  const pendingRes =
    studentClassIds.length > 0
      ? await apiServer.classes.getPendingAssignmentsBatch({
          body: { classIds: studentClassIds },
        })
      : {
          status: 200 as const,
          body: {
            success: true,
            data: {} as Record<string, { pending: number; total: number }>,
          },
        };

  const pendingAssignments =
    pendingRes.status === 200 && pendingRes.body.success
      ? pendingRes.body.data
      : {};

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

      {/* Owner Classes */}
      {classes.owner.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-semibold">{t("created")}</h2>
            <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
              {classes.owner.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.owner.map((classItem) => (
              <ClassCard key={classItem.id} classData={classItem} />
            ))}
          </div>
        </section>
      )}

      {/* Teacher Classes */}
      {classes.teacher.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-semibold">{t("teacher")}</h2>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {classes.teacher.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.teacher.map((classItem) => (
              <ClassCard key={classItem.id} classData={classItem} />
            ))}
          </div>
        </section>
      )}

      {/* Student Classes */}
      {classes.student.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-semibold">{t("student")}</h2>
            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
              {classes.student.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.student.map((classItem) => (
              <ClassCard
                key={classItem.id}
                classData={classItem}
                pendingAssignments={pendingAssignments![classItem.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {classes.owner.length === 0 &&
        classes.teacher.length === 0 &&
        classes.student.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-4">{t("empty")}</p>
          </div>
        )}
    </div>
  );
}
