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

const Signup = () => {
  const router = useRouter();
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
      setSubmitError(error.message || "Something went wrong");
    } else {
      toast.success("Signed up successfully");
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
        <CardTitle>Sign Up</CardTitle>
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
                  <FieldLabel htmlFor="form-rhf-fullname">Fullname</FieldLabel>
                  <Input
                    type="text"
                    {...field}
                    id="form-rhf-fullname"
                    placeholder="Full name here"
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
                  <FieldLabel htmlFor="form-rhf-email">Email</FieldLabel>
                  <Input
                    type="email"
                    {...field}
                    id="form-rhf-email"
                    placeholder="Email here"
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
                  <FieldLabel htmlFor="form-rhf-password">Password</FieldLabel>
                  <Input
                    type="password"
                    {...field}
                    id="form-rhf-password"
                    placeholder="Password here"
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
            {!isLoading ? "Signup" : <Loader className="animate-spin" />}
          </Button>
          <span className="self-container">
            Already have an account?{" "}
            <Link href="/signin" className="text-primary">
              Sign In
            </Link>
          </span>
        </Field>
      </CardFooter>
    </Card>
  );
};

export default Signup;
