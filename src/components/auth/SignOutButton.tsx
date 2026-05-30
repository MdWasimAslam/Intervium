import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

/**
 * Sign-out control. Uses an inline server action so it works without any
 * client-side JavaScript.
 */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
