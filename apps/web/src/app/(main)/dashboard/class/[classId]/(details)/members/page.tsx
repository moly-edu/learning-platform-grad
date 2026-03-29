"use client";

import ClassMembersTable from "@/components/class/ClassMembersTable";
import ClassSearchUser from "@/components/class/ClassSearchUser";
import { useClass } from "@/components/providers/class-context";
import { useTranslations } from "next-intl";

export default function ClassMembersPage() {
  const t = useTranslations("classes.details");
  const { classCourse } = useClass();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bold text-2xl">{t("members")}</h1>
      <ClassMembersTable members={classCourse.members || []} />
      <ClassSearchUser />
    </div>
  );
}
