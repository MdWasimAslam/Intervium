import type { CreateUserInput, UpdateUserInput, User } from "@/types";

/**
 * In-memory mock data store.
 *
 * This replaces a real database so the template runs with zero setup.
 * The data lives in module scope, so changes persist for the lifetime of
 * the server process but reset on restart. Swap this file out for a real
 * database client (Prisma, Drizzle, etc.) when you are ready.
 */
let users: User[] = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
    createdAt: "2024-01-15T09:00:00.000Z",
  },
  {
    id: "2",
    name: "Alan Turing",
    email: "alan@example.com",
    role: "member",
    createdAt: "2024-02-20T14:30:00.000Z",
  },
  {
    id: "3",
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "member",
    createdAt: "2024-03-05T11:15:00.000Z",
  },
];

/** Return all users. */
export function getAllUsers(): User[] {
  return users;
}

/** Return a single user by id, or `undefined` if not found. */
export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}

/** Create and persist a new user, returning the created record. */
export function createUser(input: CreateUserInput): User {
  const newUser: User = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  users = [...users, newUser];
  return newUser;
}

/**
 * Update an existing user.
 * Returns the updated record, or `undefined` if the id does not exist.
 */
export function updateUser(
  id: string,
  input: UpdateUserInput,
): User | undefined {
  const existing = getUserById(id);
  if (!existing) return undefined;

  const updated: User = { ...existing, ...input };
  users = users.map((user) => (user.id === id ? updated : user));
  return updated;
}

/**
 * Delete a user by id.
 * Returns `true` if a record was removed, `false` otherwise.
 */
export function deleteUser(id: string): boolean {
  const exists = Boolean(getUserById(id));
  if (!exists) return false;

  users = users.filter((user) => user.id !== id);
  return true;
}

/** Generate a simple unique-ish id for the mock store. */
function generateId(): string {
  const maxId = users.reduce((max, user) => {
    const numeric = Number(user.id);
    return Number.isNaN(numeric) ? max : Math.max(max, numeric);
  }, 0);
  return String(maxId + 1);
}
