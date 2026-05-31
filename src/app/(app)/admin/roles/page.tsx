import { asc } from "drizzle-orm";
import { db, jobRoles } from "@db";
import { requireAdmin } from "@/lib/session";
import { RolesAdmin } from "@/components/admin/RolesAdmin";

export default async function AdminRolesPage() {
  await requireAdmin();
  const roles = await db
    .select()
    .from(jobRoles)
    .orderBy(asc(jobRoles.sortOrder), asc(jobRoles.name));
  return <RolesAdmin roles={roles} />;
}
