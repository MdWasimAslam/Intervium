import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@db";
import { authConfig } from "@/auth.config";

/**
 * Full Auth.js setup (Node runtime).
 *
 * Adds the Credentials provider — whose `authorize` reads the database and
 * verifies the password hash — on top of the edge-safe `authConfig`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (!user) return null;
        if (!user.isActive) return null; // deactivated users can't log in

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // The returned object becomes the `user` in the jwt callback.
        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
});
