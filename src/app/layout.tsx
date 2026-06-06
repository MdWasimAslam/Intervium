import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { APP_DESCRIPTION, APP_NAME } from "@/constants";

/**
 * Self-hosted CV fonts. Embedding them (rather than relying on the OS's serif/
 * sans defaults) gives the CV deterministic, identical metrics in the on-screen
 * preview and the printed PDF across machines. `latin-ext` covers accented
 * names; `swap` avoids invisible text. Bound to `.cv-doc` in globals.css, so
 * only the CV is reskinned — the rest of the app is untouched.
 */
const cvSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-cv-sans",
});
const cvSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-cv-serif",
});

/**
 * Brand/logo typeface — a geometric display face used for the "Intervium"
 * wordmark so the logo reads distinctly from the UI sans. Exposed as
 * `--font-brand` and consumed by the Logo component.
 */
const brandFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700"],
  variable: "--font-brand",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — AI-powered mock interviews`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — AI-powered mock interviews`,
    description: APP_DESCRIPTION,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — AI-powered mock interviews`,
    description: APP_DESCRIPTION,
  },
};

/**
 * Root layout: the app shell.
 *
 * `suppressHydrationWarning` on <html> is required by next-themes, which sets
 * the theme class before React hydrates. A small inline script prevents a
 * flash of the wrong theme on first paint.
 *
 * The header and <main> wrapper live in the per-group layouts ((public) and
 * (app)) rather than here, so reading the session for the auth-aware header
 * never forces the public routes out of static rendering.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cvSans.variable} ${cvSerif.variable} ${brandFont.variable}`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          `cz-shortcut-listen`, Grammarly) inject attributes onto <body> before
          React hydrates; this silences those benign attribute mismatches. */}
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--background)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--foreground)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
