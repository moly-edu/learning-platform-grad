"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useTranslations } from "next-intl";

const formSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(2, t("nameMin")).max(50),
    slug: z
      .string()
      .min(2, t("slugMin"))
      .max(50)
      .regex(/^[a-z0-9-]+$/, t("slugFormat")),
    description: z.string().max(200).optional(),
  });

type FormValues = z.infer<ReturnType<typeof formSchema>>;

type CreateCourseFormProps = {
  organizationId?: string;
  onSuccess?: () => void;
};

export function CreateCourseForm({
  organizationId,
  onSuccess,
}: CreateCourseFormProps) {
  const t = useTranslations("forms.createCourse");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: standardSchemaResolver(formSchema(t)),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  const { watch, setValue } = form;
  const watchName = watch("name");

  // Tự động tạo slug khi name thay đổi (nếu slug chưa được chạm vào nhiều)
  useEffect(() => {
    const slug = watchName
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");
    setValue("slug", slug, { shouldValidate: true });
  }, [watchName, setValue]);

  const isLoading = form.formState.isSubmitting;

  const onSubmit: SubmitHandler<FormValues> = async (formData) => {
    setSubmitError(null);
    try {
      if (!organizationId) {
        const message = t("orgNotFound");
        setSubmitError(message);
        toast.error(message);
        return;
      }

      const res = await api.courses.createCourse({
        body: {
          name: formData.name,
          slug: formData.slug,
          organizationId,
          description: formData.description,
        },
      });
      if (res.status !== 201) {
        throw new Error((res.body as any).error || t("createError"));
      }
      toast.success(t("createSuccess"));
      form.reset();
      onSuccess?.();
      await queryClient.invalidateQueries({
        queryKey: ["courses", organizationId],
      });
    } catch (err: any) {
      const errorMessage = err.message || t("unexpectedError");
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full sm:max-w-md">
      <CardContent>
        <form id="create-course-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* Name Field */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
                  <Input {...field} id="name" disabled={isLoading} />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Slug Field */}
            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="slug">{t("slug")}</FieldLabel>
                  <Input
                    {...field}
                    id="slug"
                    placeholder={t("slugPlaceholder")}
                    disabled={isLoading}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Description Field */}
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="description">
                    {t("description")}
                  </FieldLabel>
                  <Input {...field} id="description" disabled={isLoading} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Field orientation="vertical" className="w-full">
          {submitError && <FieldError>{submitError}</FieldError>}
          <Button
            type="submit"
            className="w-full"
            form="create-course-form"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              t("submit")
            )}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}
