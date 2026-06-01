"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkDelete,
  bulkSetActive,
  toggleQuestion,
} from "@/lib/actions/admin/questions";

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Filter by ${label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  ...props
}: {
  checked: boolean;
  onChange: () => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-[var(--border)] accent-[var(--primary)]"
      {...props}
    />
  );
}

function ToggleActive({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={isActive}
      disabled={pending}
      aria-label="Toggle active"
      onCheckedChange={(v) =>
        start(async () => {
          try {
            const res = await toggleQuestion({ id, isActive: v });
            if (!res.ok) {
              window.alert(res.error ?? "Could not update the question.");
              return;
            }
            router.refresh();
          } catch {
            window.alert("Could not update the question.");
          }
        })
      }
    />
  );
}

function BulkBar({ ids, onCleared }: { ids: string[]; onCleared: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(undefined);
    start(async () => {
      const res = await fn();
      if (res.error) setMessage(res.error);
      if (res.ok) {
        if (!res.error) onCleared();
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
      <span className="text-sm font-medium">{ids.length} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => bulkSetActive({ ids, isActive: true }))}
        >
          Activate
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => bulkSetActive({ ids, isActive: false }))}
        >
          Deactivate
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          disabled={pending}
          onClick={() => run(() => bulkDelete({ ids }))}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      {message && (
        <p className="w-full text-xs text-[var(--muted-foreground)]">
          {message}
        </p>
      )}
    </div>
  );
}

export { FilterSelect, CheckBox, ToggleActive, BulkBar };
