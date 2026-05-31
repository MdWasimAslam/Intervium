import { desc, eq } from "drizzle-orm";
import { accessCodes, db, users } from "@db";
import { requireAdmin } from "@/lib/session";
import { CodesAdmin } from "@/components/admin/CodesAdmin";

export default async function AdminCodesPage() {
  await requireAdmin();
  const rows = await db
    .select({
      id: accessCodes.id,
      code: accessCodes.code,
      isUsed: accessCodes.isUsed,
      usedByEmail: users.email,
      expiresAt: accessCodes.expiresAt,
    })
    .from(accessCodes)
    .leftJoin(users, eq(users.id, accessCodes.usedBy))
    .orderBy(desc(accessCodes.createdAt));

  return (
    <CodesAdmin
      codes={rows.map((r) => ({
        id: r.id,
        code: r.code,
        isUsed: r.isUsed,
        usedByEmail: r.usedByEmail,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      }))}
    />
  );
}
