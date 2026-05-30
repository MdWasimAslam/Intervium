"use client";

import { Toaster } from "react-hot-toast";

/**
 * Mounts the global toast container.
 * Rendered once in the root layout so any client component can call
 * `toast.success(...)` / `toast.error(...)`.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
        },
      }}
    />
  );
}
