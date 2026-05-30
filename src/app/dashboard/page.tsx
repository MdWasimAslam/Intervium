import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Protected dashboard (Server Component).
 *
 * Middleware already guards this route; we re-check the session here as a
 * second layer and to read the username for display.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <Container className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            You are signed in.
          </p>
        </div>
        <LogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome, {session.username} 👋</CardTitle>
          <CardDescription>
            This page is only visible to authenticated users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Your session is backed by a JWT stored in a secure, httpOnly cookie
            and verified on every request. Build your features here.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
