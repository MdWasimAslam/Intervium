"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

/**
 * Logs the user out by calling the logout endpoint, then refreshes the
 * route so server components re-read the (now empty) session.
 */
export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed.");
      toast.success("Logged out.");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not log out. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      isLoading={isLoading}
    >
      Log out
    </Button>
  );
}
