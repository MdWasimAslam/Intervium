import { asc } from "drizzle-orm";
import { db, focusAreas, jobRoles } from "@db";
import { requireAdmin } from "@/lib/session";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminFocusAreasPage() {
  await requireAdmin();
  const [roles, items] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: focusAreas.id,
        jobRoleId: focusAreas.jobRoleId,
        name: focusAreas.name,
        isActive: focusAreas.isActive,
      })
      .from(focusAreas)
      .orderBy(asc(focusAreas.name)),
  ]);

  return (
    <TaxonomyAdmin
      kind="focus"
      title="Focus Areas"
      description="Sub-topics within a role. Inactive ones are hidden from setup."
      roles={roles}
      items={items}
    />
  );
}
