import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config.
 *
 * This file is imported by `middleware.ts` (Edge runtime), so it must NOT
 * pull in the database client, bcrypt, or any Node-only code. The Credentials
 * provider (which needs those) is added separately in `auth.ts`.
 */
export const authConfig = {
  // Trust the deploy host (Vercel sets the URL; required for the Edge
  // middleware instance to read the session without AUTH_URL).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    /** Persist the user's id and role onto the JWT at sign-in. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    /** Expose id and role on the session object. */
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
