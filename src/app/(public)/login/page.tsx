"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormError } from "@/components/auth/FormError";
import { loginAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to Intervium.">
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

      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        Forgot your password? Contact your administrator to reset it.
      </p>

      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Register
        </Link>
      </p>
    </AuthShell>
  );
}
