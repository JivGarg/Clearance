"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { submitKeepingValues } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionState, FormAction } from "@/lib/actions/types";

/** A settings form on the page itself, bound to a server action. Errors inline; success as a toast. */
export function InlineForm({
  action,
  hidden,
  submitLabel = "Save changes",
  children,
  ariaLabel,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  submitLabel?: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const toast = useToast();
  const lastAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.at || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) toast(state.message ?? "Saved.", "success");
  }, [state, toast]);

  return (
    <form onSubmit={(e) => submitKeepingValues(e, formAction)} aria-label={ariaLabel} className="flex flex-col gap-6" noValidate>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[14px] font-medium text-danger-ink">
          {state.error}
        </p>
      ) : null}
      {children}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
