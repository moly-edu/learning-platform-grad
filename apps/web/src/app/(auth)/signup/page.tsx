"use client";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import z from "zod";
import { SignUpSchema } from "@repo/api-contract";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const Signup = () => {
  const router = useRouter();
  const t = useTranslations("auth.signup");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof SignUpSchema>>({
    mode: "onChange",
    resolver: standardSchemaResolver(SignUpSchema),
    defaultValues: { email: "", password: "", fullname: "" },
  });

  /**
   * React Query Mutation
   */
  // const signupMutation = client.auth.signup.useMutation({
  //   onSuccess: () => {
  //     queryClient.invalidateQueries();
  //   },
  //   onError: (error: any) => {
  //     setSubmitError(error.message);
  //     form.reset();
  //   },
  // });

  const onSubmit: SubmitHandler<z.infer<typeof SignUpSchema>> = async (
    formData,
  ) => {
    setSubmitError(null);
    // signupMutation.mutate({ body: formData });
    const { error } = await authClient.signUp.email({
      email: formData.email,
      password: formData.password,
      name: formData.fullname,
    });

    if (error) {
      setSubmitError(error.message || t("fallbackError"));
    } else {
      toast.success(t("success"));
      router.push("/dashboard/classes");
    }
  };

  useEffect(() => {
    console.log("errors", form.formState.errors);
  }, [form.formState.errors]);

  const isLoading = form.formState.isSubmitting;

  return (
    <Card className="w-full sm:max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="form-rhf" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* Fullname */}
            <Controller
              name="fullname"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-fullname">
                    {t("fullName")}
                  </FieldLabel>
                  <Input
                    type="text"
                    {...field}
                    id="form-rhf-fullname"
                    placeholder={t("fullNamePlaceholder")}
                    disabled={isLoading}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Email */}
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
                    placeholder={t("emailPlaceholder")}
                    disabled={isLoading}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Password */}
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
            {!isLoading ? t("submit") : <Loader className="animate-spin" />}
          </Button>
          <span className="self-container">
            {t("hasAccount")}{" "}
            <Link href="/signin" className="text-primary">
              {t("signIn")}
            </Link>
          </span>
        </Field>
      </CardFooter>
    </Card>
  );
};

export default Signup;
