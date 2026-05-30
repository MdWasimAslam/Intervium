import { APP_NAME } from "@/constants";

/**
 * Minimal site footer with a dynamic copyright year.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        © {year} {APP_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
