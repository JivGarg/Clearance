"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";

/**
 * Submit without React's automatic form reset: a <form action> clears every field after each
 * submission, so a rejected form (validation or rule error) would lose what the person typed.
 */
export function submitKeepingValues(e: FormEvent<HTMLFormElement>, formAction: (fd: FormData) => void) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => formAction(fd));
}
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionState, FormAction } from "@/lib/actions/types";

/**
 * A button that opens a modal form bound to a server action. On success the modal closes and a
 * toast confirms; on a rule error the message stays in the dialog. Fields reset each time it opens.
 */
export function FormDialog({
  triggerLabel,
  triggerIcon,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerAriaLabel,
  title,
  description,
  submitLabel = "Save",
  action,
  hidden,
  children,
}: {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerAriaLabel?: string;
  title: string;
  description?: string;
  submitLabel?: string;
  action: FormAction;
  hidden: Record<string, string>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        aria-label={triggerAriaLabel}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        {triggerIcon}
        {triggerLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {open ? (
          <DialogForm key={session} action={action} hidden={hidden} submitLabel={submitLabel} description={description} onDone={() => setOpen(false)}>
            {children}
          </DialogForm>
        ) : null}
      </Modal>
    </>
  );
}

function DialogForm({
  action,
  hidden,
  submitLabel,
  description,
  onDone,
  children,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  submitLabel: string;
  description?: string;
  onDone: () => void;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const toast = useToast();
  useEffect(() => {
    if (state.ok) {
      toast(state.message ?? "Saved.", "success");
      onDone();
    }
  }, [state, toast, onDone]);

  return (
    <form onSubmit={(e) => submitKeepingValues(e, formAction)} className="flex flex-col gap-4" noValidate>
      {description ? <p className="text-[14px] text-text-muted">{description}</p> : null}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[14px] font-medium text-danger-ink">
          {state.error}
        </p>
      ) : null}
      {children}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
