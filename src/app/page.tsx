import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { getSession } from "@/lib/session";
import { APP_DESCRIPTION, APP_NAME } from "@/constants";

/**
 * Public landing page. Sends the visitor to the dashboard if already
 * authenticated, otherwise to the login page.
 */
export default async function HomePage() {
  const session = await getSession();

  return (
    <Container className="flex flex-col items-center gap-6 py-24 text-center">
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        Secure · JWT Auth
      </span>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="max-w-md text-lg text-gray-600 dark:text-gray-300">
        {APP_DESCRIPTION}
      </p>

      {session ? (
        <Link href="/dashboard">
          <Button size="lg">Go to dashboard</Button>
        </Link>
      ) : (
        <Link href="/login">
          <Button size="lg">Log in</Button>
        </Link>
      )}
    </Container>
  );
}
