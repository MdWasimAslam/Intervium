import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { APP_DESCRIPTION, APP_NAME } from "@/constants";

const FEATURES = [
  {
    title: "App Router + TypeScript",
    description:
      "Modern Next.js App Router with strict TypeScript and a scalable folder structure.",
  },
  {
    title: "Tailwind CSS",
    description:
      "Utility-first styling with dark mode support and reusable UI components.",
  },
  {
    title: "API + Service Layer",
    description:
      "Route Handlers backed by mock data and a typed Axios service layer with interceptors.",
  },
];

/**
 * Home / landing page.
 */
export default function HomePage() {
  return (
    <Container>
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-16 text-center">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Next.js · TypeScript · Tailwind
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="max-w-xl text-lg text-gray-600 dark:text-gray-300">
          {APP_DESCRIPTION}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg">Open Dashboard</Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline">
              Learn more
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>{feature.description}</CardContent>
          </Card>
        ))}
      </section>
    </Container>
  );
}
