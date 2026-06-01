import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = { title: "Admin" };

/**
 * Admin shell. `requireAdmin()` guards every admin page server-side (in
 * addition to middleware). Each admin server action re-checks too.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
