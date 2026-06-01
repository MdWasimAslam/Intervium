"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormError } from "@/components/auth/FormError";
import { registerAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <AuthShell
      title="Create your account"
      subtitle="Registration requires a valid access code."
    >
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

      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
