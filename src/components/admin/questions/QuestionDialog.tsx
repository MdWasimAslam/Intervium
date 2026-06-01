"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/FormError";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createQuestion } from "@/lib/actions/admin/questions";
import type { RoleRef, Taxon } from "@/components/admin/QuestionsAdmin";
import { QuestionFields, type QuestionFormValue } from "./QuestionFields";

function QuestionDialog({
  roles,
  techStacks,
  trigger,
}: {
  roles: RoleRef[];
  techStacks: Taxon[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [value, setValue] = useState<QuestionFormValue>(() => ({
    roleId: roles[0]?.id ?? "",
    techStackId: techStacks.find((t) => t.jobRoleId === roles[0]?.id)?.id ?? "",
    category: "technical",
    modality: "text",
    questionText: "",
    idealAnswer: "",
  }));

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await createQuestion(value);
      if (res.ok) {
        setOpen(false);
        setValue((v) => ({ ...v, questionText: "", idealAnswer: "" }));
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add question</DialogTitle>
        </DialogHeader>
        <QuestionFields
          roles={roles}
          techStacks={techStacks}
          value={value}
          onChange={setValue}
        />
        {error && <FormError message={error} />}
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !value.techStackId}>
            Create question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { QuestionDialog };
