import { asc } from "drizzle-orm";
import { db, jobRoles, techStacks } from "@db";
import { requireAdmin } from "@/lib/session";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminTechStacksPage() {
  await requireAdmin();
  const [roles, items] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: techStacks.id,
        jobRoleId: techStacks.jobRoleId,
        name: techStacks.name,
        isActive: techStacks.isActive,
      })
      .from(techStacks)
      .orderBy(asc(techStacks.name)),
  ]);

  return (
    <TaxonomyAdmin
      kind="tech"
      title="Tech Stacks"
      description="Technologies within a role. Inactive ones are hidden from setup."
      roles={roles}
      items={items}
    />
  );
}
