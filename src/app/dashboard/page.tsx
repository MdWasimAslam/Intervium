"use client";

import { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserForm } from "@/components/users/UserForm";
import { UserCard } from "@/components/users/UserCard";
import { useUsers } from "@/hooks/useUsers";
import type { CreateUserInput, User } from "@/types";

/**
 * Dashboard page.
 * End-to-end demo of the API layer: fetch, create, update and delete users,
 * complete with loading / error / empty states and toast notifications.
 */
export default function DashboardPage() {
  const {
    users,
    isLoading,
    error,
    isMutating,
    refetch,
    addUser,
    editUser,
    removeUser,
  } = useUsers();

  // `null`  -> creating a new user
  // a User  -> editing that user
  const [editing, setEditing] = useState<User | null>(null);

  const handleSubmit = async (input: CreateUserInput) => {
    const success = editing
      ? await editUser(editing.id, input)
      : await addUser(input);

    // Reset the form back to "create" mode after a successful edit.
    if (success && editing) setEditing(null);
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(`Delete ${user.name}?`);
    if (!confirmed) return;

    await removeUser(user.id);
    if (editing?.id === user.id) setEditing(null);
  };

  return (
    <Container>
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Manage users via the mock API. Try creating, editing and deleting.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Create / edit form */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{editing ? "Edit user" : "Create user"}</CardTitle>
            <CardDescription>
              {editing
                ? `Updating "${editing.name}".`
                : "Add a new user to the list."}
            </CardDescription>
          </CardHeader>
          <UserForm
            key={editing?.id ?? "new"}
            initialUser={editing}
            isSubmitting={isMutating}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </Card>

        {/* User list */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Users{" "}
              {!isLoading && !error && (
                <span className="text-sm font-normal text-gray-400">
                  ({users.length})
                </span>
              )}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <LoadingState message="Loading users…" />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void refetch()} />
          ) : users.length === 0 ? (
            <EmptyState
              title="No users yet"
              description="Create your first user using the form on the left."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  disabled={isMutating}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
