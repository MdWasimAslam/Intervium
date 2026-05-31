"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/layout/Container";
import { LogoMark } from "@/components/brand/Logo";
import { AuthField } from "@/components/auth/AuthField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormError } from "@/components/auth/FormError";
import { registerAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoMark className="mb-2 h-12 w-12" />
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Registration requires a valid access code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <FormError message={state.error} />
            <AuthField
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <AuthField
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <div className="space-y-1">
              <AuthField
                id="code"
                name="code"
                type="text"
                label="Access code"
                placeholder="INTV-XXXXX"
                autoComplete="off"
                aria-describedby="code-help"
                required
              />
              <p id="code-help" className="text-xs text-[var(--muted-foreground)]">
                Don&apos;t have a code? Ask your administrator.
              </p>
            </div>
            <SubmitButton>Create account</SubmitButton>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--primary)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
