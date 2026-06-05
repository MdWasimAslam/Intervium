"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormError } from "@/components/auth/FormError";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateQuestion } from "@/lib/actions/admin/questions";
import type {
  QuestionRow,
  RoleRef,
  Taxon,
} from "@/components/admin/QuestionsAdmin";
import { QuestionFields, type QuestionFormValue } from "./QuestionFields";

/** The editable form fields for a question row. */
function formFrom(question: QuestionRow): QuestionFormValue {
  return {
    roleId: question.roleId,
    techStackId: question.techStackId,
    category: question.category,
    modality: question.modality,
    questionText: question.questionText,
    idealAnswer: question.idealAnswer,
  };
}

function EditQuestionDialog({
  question,
  roles,
  techStacks,
}: {
  question: QuestionRow;
  roles: RoleRef[];
  techStacks: Taxon[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [isActive, setIsActive] = useState(question.isActive);
  const [value, setValue] = useState<QuestionFormValue>(() => formFrom(question));

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Re-sync to the current question (and clear stale errors) on each open, so
    // uncommitted edits from a cancelled session don't linger and the form
    // reflects the latest saved values after a refresh.
    if (next) {
      setValue(formFrom(question));
      setIsActive(question.isActive);
      setError(undefined);
    }
  }

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await updateQuestion({ id: question.id, ...value, isActive });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <QuestionFields
          roles={roles}
          techStacks={techStacks}
          value={value}
          onChange={setValue}
        />
        <div className="mt-3 flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">Active</span>
        </div>
        {error && <FormError message={error} />}
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !value.techStackId}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EditQuestionDialog };
