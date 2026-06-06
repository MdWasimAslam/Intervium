import { desc, eq } from "drizzle-orm";
import { accessCodes, db, users } from "@db";
import { requireAdmin } from "@/lib/session";
import { CodesAdmin } from "@/components/admin/CodesAdmin";

const PAGE_SIZE = 25;

/** First value of a possibly-array search param, trimmed. */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
}

export default async function AdminCodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(pick(sp, "page")) || 1);

  // Paginate — codes accumulate over time (generated in bulk, never bulk-purged),
  // so the table must not load the whole history at once.
  const total = await db.$count(accessCodes);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

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
    .orderBy(desc(accessCodes.createdAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  return (
    <CodesAdmin
      codes={rows.map((r) => ({
        id: r.id,
        code: r.code,
        isUsed: r.isUsed,
        usedByEmail: r.usedByEmail,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      }))}
      page={safePage}
      totalPages={totalPages}
      total={total}
    />
  );
}
