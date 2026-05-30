"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { userService } from "@/services/userService";
import type { CreateUserInput, UpdateUserInput, User } from "@/types";

/**
 * Value returned by the {@link useUsers} hook.
 */
interface UseUsersResult {
  users: User[];
  isLoading: boolean;
  error: string | null;
  /** Whether a create/update/delete mutation is in flight. */
  isMutating: boolean;
  refetch: () => Promise<void>;
  addUser: (input: CreateUserInput) => Promise<boolean>;
  editUser: (id: string, input: UpdateUserInput) => Promise<boolean>;
  removeUser: (id: string) => Promise<boolean>;
}

/**
 * Encapsulates all user data fetching and mutations for the UI.
 *
 * Owns loading + error state and fires toast notifications so that
 * components stay focused on rendering. Mutations optimistically refetch
 * the list on success and return a boolean indicating success/failure.
 */
export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Load the full list of users. */
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      const message = getMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch once on mount. We load directly here (rather than calling
  // `refetch`) so that no state is updated synchronously inside the effect;
  // the `cancelled` flag prevents setting state after unmount.
  useEffect(() => {
    let cancelled = false;

    userService
      .getUsers()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = getMessage(err);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Create a user, then refresh the list. */
  const addUser = useCallback(
    async (input: CreateUserInput): Promise<boolean> => {
      setIsMutating(true);
      try {
        await userService.createUser(input);
        toast.success("User created.");
        await refetch();
        return true;
      } catch (err) {
        toast.error(getMessage(err));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  /** Update a user, then refresh the list. */
  const editUser = useCallback(
    async (id: string, input: UpdateUserInput): Promise<boolean> => {
      setIsMutating(true);
      try {
        await userService.updateUser(id, input);
        toast.success("User updated.");
        await refetch();
        return true;
      } catch (err) {
        toast.error(getMessage(err));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  /** Delete a user, then refresh the list. */
  const removeUser = useCallback(
    async (id: string): Promise<boolean> => {
      setIsMutating(true);
      try {
        await userService.deleteUser(id);
        toast.success("User deleted.");
        await refetch();
        return true;
      } catch (err) {
        toast.error(getMessage(err));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  return {
    users,
    isLoading,
    error,
    isMutating,
    refetch,
    addUser,
    editUser,
    removeUser,
  };
}

/** Safely extract a message from an unknown thrown value. */
function getMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
