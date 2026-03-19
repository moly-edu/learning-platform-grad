import { CourseNav } from "@/components/course/course-nav";
import { CourseProvider } from "@/components/providers/course-provider";
import { apiServer } from "@/lib/api-server-client";
import { redirect } from "next/navigation";
import { buildTreeFromFlatList } from "@/components/course-structure/utils/course-structure-utiles";

interface PageProps {
  params: Promise<{
    orgSlug: string;
    courseSlug: string;
  }>;
  children?: React.ReactNode;
}

export default async function CourseLayout({ children, params }: PageProps) {
  const { orgSlug, courseSlug } = await params;

  // Load course với FULL TREE một lần duy nhất
  let res;
  try {
    res = await apiServer.courses.getCourseBySlug({
      params: { orgSlug, courseSlug },
    });
  } catch (error) {
    console.error("Error loading course:", error);
    redirect("/dashboard/classes");
  }

  if (res.status !== 200 || !res.body.data) {
    redirect("/dashboard/classes");
  }

  const { course, nodes } = res.body.data;
  const role = res.body.role === "member" ? "org_member" : "org_admin";

  // Build tree từ flat nodes
  const rootNode = buildTreeFromFlatList(nodes);

  if (!rootNode) {
    console.error("Failed to build tree");
    redirect("/dashboard/classes");
  }

  // Tạo CourseUI object
  const courseUI = {
    ...course,
    rootLessonNode: rootNode,
  };
  // console.log("course info: ", courseUI);

  return (
    <CourseProvider course={courseUI} role={role}>
      <div className="">
        {/* <h1 className="font-bold text-2xl">{course.name}</h1>
        <CourseNav /> */}
        <div className="mt-2">{children}</div>
      </div>
    </CourseProvider>
  );
}
