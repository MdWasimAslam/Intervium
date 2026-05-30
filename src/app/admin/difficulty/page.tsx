import { asc } from "drizzle-orm";
import { db, difficultyBands, jobRoles } from "@db";
import { requireAdmin } from "@/lib/session";
import { DifficultyAdmin } from "@/components/admin/DifficultyAdmin";

export default async function AdminDifficultyPage() {
  await requireAdmin();
  const [roles, bands] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .orderBy(asc(jobRoles.sortOrder)),
    db.select().from(difficultyBands),
  ]);

  return (
    <DifficultyAdmin
      roles={roles}
      bands={bands.map((b) => ({
        id: b.id,
        jobRoleId: b.jobRoleId,
        label: b.label,
        minYears: b.minYears,
        maxYears: b.maxYears,
      }))}
    />
  );
}
