import { buildTreeFromFlatList } from "@/components/course-structure/utils/course-structure-utiles";
import { ClassProvider } from "@/components/providers/class-provider";
import { apiServer } from "@/lib/api-server-client";
import { redirect } from "next/navigation";

type Params = Promise<{ classId: string }>;

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { classId } = await params;
  let res;
  try {
    res = await apiServer.classes.getClassWithCourse({ params: { classId } });
  } catch {
    redirect("/dashboard/classes");
  }

  if (res.status !== 200 || !res.body.data) {
    redirect("/dashboard/classes");
  }

  const role = `class_${res.body.role}` as
    | "class_owner"
    | "class_teacher"
    | "class_student";

  const { classData, nodes } = res.body.data;
  const rootNode = buildTreeFromFlatList(nodes);

  if (!rootNode) {
    console.error("Failed to build tree");
    redirect("/dashboard/classes");
  }

  const courseUI = {
    ...classData.course,
    rootLessonNode: rootNode,
  };

  const classCourse = {
    ...classData,
    courseUI,
  };

  return (
    <ClassProvider classCourse={classCourse} role={role}>
      <div className="">
        <div className="mt-2">{children}</div>
      </div>
    </ClassProvider>
  );
}
