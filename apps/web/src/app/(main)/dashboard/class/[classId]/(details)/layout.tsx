"use client";
import ClassNav from "@/components/class/ClassNav";
import { useClass } from "@/components/providers/class-context";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, redirect } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ClassDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("classes.details");
  const { classCourse, role } = useClass();
  const params = useParams();
  const classId = params.classId as string;

  // Only teachers and owners can access members/groups pages
  if (role === "class_student") {
    redirect(`/dashboard/class/${classId}`);
  }

  return (
    <div className="flex flex-col gap-4 py-6 px-4 max-w-4xl mx-auto w-full">
      <Link
        href={`/dashboard/class/${classId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backToCourse")}
      </Link>
      <h1 className="font-bold text-2xl">{classCourse.name}</h1>
      <ClassNav />
      <div className="mt-2">{children}</div>
    </div>
  );
}
