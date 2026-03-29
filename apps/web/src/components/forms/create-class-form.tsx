"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader, Plus } from "lucide-react";
import { useState } from "react";
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

interface CreateClassFormProps {
  courseId: string;
  organizationId: string;
  onSuccess?: () => void;
}

type FormValues = z.infer<typeof formSchema>;

export function CreateClassForm({
  courseId,
  organizationId,
  onSuccess,
}: CreateClassFormProps) {
  const t = useTranslations("forms.createClass");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: standardSchemaResolver(
      z.object({
        className: z.string().min(2, t("nameMin")).max(50, t("nameMax")),
      }),
    ),
    defaultValues: {
      className: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit: SubmitHandler<FormValues> = async (formData) => {
    setSubmitError(null);
    try {
      const res = await api.classes.createClass({
        body: { name: formData.className, courseId, organizationId },
      });
      if (res.status !== 201) {
        throw new Error((res.body as any).error || t("createError"));
      }

      toast.success(t("createSuccess"));
      form.reset();

      if (onSuccess) onSuccess();
    } catch (err: any) {
      const errorMessage = err.message || t("unexpectedError");
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full border-none shadow-none sm:max-w-md text-left">
      <CardContent className="px-0">
        <form id="create-class-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="className"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="class-name">{t("name")}</FieldLabel>
                  <Input
                    {...field}
                    id="class-name"
                    placeholder={t("namePlaceholder")}
                    disabled={isLoading}
                    autoFocus
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="px-0 pb-0">
        <Field orientation="vertical" className="w-full">
          {submitError && <FieldError>{submitError}</FieldError>}
          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            form="create-class-form"
            disabled={isLoading || !form.formState.isValid}
          >
            {isLoading ? (
              <Loader className="size-4 animate-spin mr-2" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            {t("submit")}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}
