import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "About",
  description: "Learn more about this Next.js starter template.",
};

const STACK = [
  "Next.js (App Router)",
  "TypeScript (strict mode)",
  "Tailwind CSS",
  "Axios with interceptors",
  "ESLint + Prettier",
  "Vercel-ready",
];

/**
 * About page — static marketing/info content.
 */
export default function AboutPage() {
  return (
    <Container className="max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold">About</h1>
      <p className="mb-8 text-gray-600 dark:text-gray-300">
        This project is a production-ready starter template for building
        full-stack applications with Next.js. It ships with a clean, scalable
        folder structure, a typed API layer, and reusable UI components so you
        can focus on your product instead of boilerplate.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s included</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {STACK.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-blue-600">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Container>
  );
}
