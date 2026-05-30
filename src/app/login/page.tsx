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
import { loginAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoMark className="mb-2 h-12 w-12" />
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue to Intervium.</CardDescription>
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
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <SubmitButton>Sign in</SubmitButton>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-[var(--primary)] hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
