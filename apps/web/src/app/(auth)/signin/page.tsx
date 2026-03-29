"use client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import * as z from "zod";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { SignInSchema } from "@repo/api-contract";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export const dynamic = "force-dynamic";

const SigninPage = () => {
  const router = useRouter();
  const t = useTranslations("auth.signin");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof SignInSchema>>({
    mode: "onChange",
    resolver: standardSchemaResolver(SignInSchema),
    defaultValues: { email: "", password: "" },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit: SubmitHandler<z.infer<typeof SignInSchema>> = async (
    formData,
  ) => {
    setSubmitError(null);
    const { error } = await authClient.signIn.email({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setSubmitError(error.message || t("fallbackError"));
    } else {
      toast.success(t("success"));
      router.push("/dashboard/classes");
    }
  };

  return (
    <Card className="w-full sm:max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="form-rhf" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-email">{t("email")}</FieldLabel>
                  <Input
                    type="email"
                    {...field}
                    id="form-rhf-email"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("emailPlaceholder")}
                    disabled={isLoading}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-password">
                    {t("password")}
                  </FieldLabel>
                  <Input
                    type="password"
                    {...field}
                    id="form-rhf-password"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("passwordPlaceholder")}
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
        <Field orientation="vertical">
          {submitError && <FieldError>{submitError}</FieldError>}
          <Button
            type="submit"
            className="w-full p-6"
            size="lg"
            form="form-rhf"
            disabled={isLoading}
          >
            {!isLoading ? t("submit") : <Loader />}
          </Button>
          <span className="self-container">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-primary">
              {t("signUp")}
            </Link>
          </span>
        </Field>
      </CardFooter>
    </Card>
  );
};

export default SigninPage;
