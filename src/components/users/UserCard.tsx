"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { capitalize, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { User } from "@/types";

interface UserCardProps {
  user: User;
  disabled?: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

const ROLE_BADGE: Record<User["role"], string> = {
  admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  member: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  guest: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/**
 * Displays a single user with edit/delete actions.
 */
export function UserCard({ user, disabled, onEdit, onDelete }: UserCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-50">
            {user.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            ROLE_BADGE[user.role],
          )}
        >
          {capitalize(user.role)}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        Joined {formatDate(user.createdAt)}
      </p>

      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onEdit(user)}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={disabled}
          onClick={() => onDelete(user)}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}
