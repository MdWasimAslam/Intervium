import type { DefaultSession } from "next-auth";

type UserRole = "user" | "admin";

declare module "next-auth" {
  /** Shape of `session.user` returned by `auth()` / `useSession()`. */
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  /** The object returned from the Credentials `authorize` callback. */
  interface User {
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
