import { AlertCircle, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { CheckStatus } from "@/lib/qa/types";

const MAP: Record<
  CheckStatus,
  { tone: "success" | "warning" | "danger" | "neutral"; label: string; Icon: typeof CheckCircle2 }
> = {
  pass: { tone: "success", label: "PASS", Icon: CheckCircle2 },
  warning: { tone: "warning", label: "WARN", Icon: AlertTriangle },
  fail: { tone: "danger", label: "FAIL", Icon: AlertCircle },
  skip: { tone: "neutral", label: "SKIP", Icon: Circle },
};

/** Status badge used across the QA dashboard (PASS / WARN / FAIL / SKIP). */
export function QaStatusChip({
  status,
  label,
}: {
  status: CheckStatus;
  label?: string;
}) {
  const { tone, label: defaultLabel, Icon } = MAP[status];
  return (
    <Chip tone={tone}>
      <Icon aria-hidden />
      {label ?? defaultLabel}
    </Chip>
  );
}
