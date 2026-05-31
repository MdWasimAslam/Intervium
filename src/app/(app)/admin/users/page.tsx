import { asc, eq } from "drizzle-orm";
import { db, jobRoles, profiles, users } from "@db";
import { requireAdmin } from "@/lib/session";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

const PAGE_SIZE = 25;

/** First value of a possibly-array search param, trimmed. */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(pick(sp, "page")) || 1);

  // Paginate users instead of loading the entire table. Sessions are no longer
  // eagerly loaded here — the history dialog fetches them lazily per user via
  // getUserSessions().
  const total = await db.$count(users);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      displayName: profiles.displayName,
      yearsExperience: profiles.yearsExperience,
      primaryRole: jobRoles.name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(jobRoles, eq(jobRoles.id, profiles.primaryRole))
    .orderBy(asc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  return (
    <UsersAdmin
      users={userRows}
      page={safePage}
      totalPages={totalPages}
      total={total}
    />
  );
}
