"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { USER_ROLES } from "@/constants";
import type { CreateUserInput, User, UserRole } from "@/types";

interface UserFormProps {
  /** When provided, the form acts as an "edit" form pre-filled with this user. */
  initialUser?: User | null;
  /** Disables the form while a mutation is in flight. */
  isSubmitting?: boolean;
  onSubmit: (input: CreateUserInput) => void;
  onCancel?: () => void;
}

const EMPTY: CreateUserInput = { name: "", email: "", role: "member" };

/**
 * Controlled form used both to create and to edit a user.
 *
 * State is initialised once from `initialUser`. To reset the form when the
 * edited user changes, remount it from the parent with a `key` prop
 * (e.g. `key={editing?.id ?? "new"}`) — the React-recommended alternative
 * to syncing props into state inside an effect.
 */
export function UserForm({
  initialUser,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [values, setValues] = useState<CreateUserInput>(() =>
    initialUser
      ? {
          name: initialUser.name,
          email: initialUser.email,
          role: initialUser.role,
        }
      : EMPTY,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="user-name" className={labelClass}>
            Name
          </label>
          <input
            id="user-name"
            type="text"
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Jane Doe"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="user-email" className={labelClass}>
            Email
          </label>
          <input
            id="user-email"
            type="email"
            required
            value={values.email}
            onChange={(e) =>
              setValues((v) => ({ ...v, email: e.target.value }))
            }
            placeholder="jane@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="user-role" className={labelClass}>
          Role
        </label>
        <select
          id="user-role"
          value={values.role}
          onChange={(e) =>
            setValues((v) => ({ ...v, role: e.target.value as UserRole }))
          }
          className={inputClass}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {initialUser ? "Save changes" : "Create user"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-200";
const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-950";
