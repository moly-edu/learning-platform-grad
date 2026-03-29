"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";

const formSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(2, t("nameMin")).max(50),
    slug: z.string().min(2, t("slugMin")).max(50),
  });

type FormValues = z.infer<ReturnType<typeof formSchema>>;

type CreateOrganizationFormProps = {
  onSuccess?: () => void;
};

export function CreateOrganizationForm({
  onSuccess,
}: CreateOrganizationFormProps) {
  const t = useTranslations("forms.createOrganization");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: standardSchemaResolver(formSchema(t)),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit: SubmitHandler<FormValues> = async (formData) => {
    setSubmitError(null);
    try {
      const { error } = await authClient.organization.create({
        name: formData.name,
        slug: formData.slug,
      });

      if (error) {
        setSubmitError(error.message || t("createError"));
        toast.error(error.message || t("createError"));
      } else {
        toast.success(t("createSuccess"));
        form.reset();
        onSuccess?.();
        router.refresh();
      }
    } catch (err) {
      setSubmitError(t("unexpectedError"));
      toast.error(t("unexpectedError"));
      console.error(err);
    }
  };

  return (
    <Card className="w-full sm:max-w-md">
      <CardContent>
        <form id="create-org-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-name">{t("name")}</FieldLabel>
                  <Input
                    {...field}
                    id="org-name"
                    placeholder={t("namePlaceholder")}
                    disabled={isLoading}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-slug">{t("slug")}</FieldLabel>
                  <Input
                    {...field}
                    id="org-slug"
                    placeholder={t("slugPlaceholder")}
                    disabled={isLoading}
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
      <CardFooter>
        <Field orientation="vertical" className="w-full">
          {submitError && <FieldError>{submitError}</FieldError>}
          <Button
            type="submit"
            className="w-full"
            form="create-org-form"
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
