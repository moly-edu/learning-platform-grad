"use client";

import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateCourseForm } from "@/components/forms/create-course-form";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useOrganization } from "@/components/providers/org-context";
import { useTranslations } from "next-intl";

export default function OrganizationPage() {
  const t = useTranslations("organization.page");
  const organization = useOrganization();
  const [hasPermission, setHasPermission] = useState(false);
  const [createCourseDialogOpen, setCreateCourseDialogOpen] = useState(false);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", organization?.id],
    enabled: Boolean(organization?.id),
    queryFn: async () => {
      if (!organization?.id) return [];

      const res = await api.courses.getCourses({
        query: { organizationId: organization?.id },
      });
      return res.status === 200 ? res.body : [];
    },
  });

  useEffect(() => {
    async function check() {
      if (!organization?.id) {
        setHasPermission(false);
        return;
      }

      const res = await api.courses.canCreateCourse({
        query: { orgId: organization?.id },
      });
      setHasPermission(res.status === 200 && res.body.success);
    }
    check();
  }, [organization?.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t("title")}</h1>
        {hasPermission && (
          <Dialog
            open={createCourseDialogOpen}
            onOpenChange={setCreateCourseDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                {t("createCourse")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createCourseTitle")}</DialogTitle>
                <DialogDescription>
                  {t("createCourseDescription")}
                </DialogDescription>
              </DialogHeader>
              <CreateCourseForm
                organizationId={organization?.id}
                onSuccess={() => setCreateCourseDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!isLoading && (courses?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          courses?.map((course) => (
            <Button asChild key={course.id} variant="outline">
              <Link
                href={`/dashboard/course/${organization?.slug}/${course.slug}`}
              >
                {course.name}
              </Link>
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
