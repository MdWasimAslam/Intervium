import "server-only";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CheckResult, SectionOutput } from "../types";

/**
 * §7 Component Health. Verifies the critical UI primitives resolve and export
 * the expected symbols (catches renames / broken barrels — a common build
 * breaker). A React component is a function or a forwardRef/memo object, so we
 * accept either. Full render/hydration is exercised by the §6 live probe.
 */

type Renderable = unknown;

function isComponent(value: Renderable): boolean {
  return (
    value != null && (typeof value === "function" || typeof value === "object")
  );
}

const PRIMITIVES: { label: string; exports: Record<string, Renderable> }[] = [
  { label: "Button", exports: { Button } },
  { label: "Card", exports: { Card, CardHeader, CardTitle, CardContent } },
  { label: "Chip (status badge)", exports: { Chip } },
  {
    label: "Table",
    exports: { Table, TableHeader, TableBody, TableRow, TableHead, TableCell },
  },
  { label: "Dialog (modal)", exports: { Dialog, DialogContent } },
  { label: "Form inputs", exports: { Input, Select } },
];

export function checkComponents(): SectionOutput {
  const checks: CheckResult[] = PRIMITIVES.map((p) => {
    const missing = Object.entries(p.exports)
      .filter(([, value]) => !isComponent(value))
      .map(([name]) => name);
    return {
      id: `component-${p.label}`,
      label: p.label,
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length === 0
          ? `${Object.keys(p.exports).length} export(s) resolve`
          : `Unresolved: ${missing.join(", ")}`,
      recommendation:
        missing.length === 0
          ? undefined
          : "A UI export is missing — the build will break where it's used.",
    };
  });

  return {
    note: "Verifies component exports resolve; live render is covered by the route probe.",
    checks,
  };
}
