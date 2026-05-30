import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your Intervium account.",
};

/**
 * Login page. The form is wrapped in Suspense because it reads search
 * params (the post-login redirect target) on the client.
 */
export default function LoginPage() {
  return (
    <Container className="flex justify-center py-20">
      <Suspense>
        <LoginForm />
      </Suspense>
    </Container>
  );
}
