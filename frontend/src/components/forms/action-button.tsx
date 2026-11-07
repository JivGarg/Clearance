"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionState, FormAction } from "@/lib/actions/types";

/**
 * One-click server action (release, expire, suspend...). With `confirm`, asks first in a modal.
 * Results are announced as toasts; rule errors as error toasts.
 */
export function ActionButton({
  action,
  hidden,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  confirmLabel,
  ariaLabel,
  silent,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Question shown before running, e.g. "Suspend Rohan? They lose access at once." */
  confirm?: { title: string; body: string };
  confirmLabel?: string;
  ariaLabel?: string;
  /** Don't toast on success (e.g. mark one notification read). */
  silent?: boolean;
}) {
  const toast = useToast();
  // Toast from the action result itself, not an effect: a successful action often removes this
  // button (Expire, Lift now, Release), and an unmounted component's effect never runs.
  const [, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.error) toast(result.error, "error");
    else if (!silent && result.message) toast(result.message, "success");
    return result;
  }, {});
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="inline">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {confirm ? (
        <>
          <Button variant={variant} size={size} disabled={pending} aria-label={ariaLabel} onClick={() => setAsking(true)}>
            {children}
          </Button>
          <Modal open={asking} onClose={() => setAsking(false)} title={confirm.title}>
            <p className="text-[15px]">{confirm.body}</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setAsking(false)}>
                Cancel
              </Button>
              <Button
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={() => {
                  setAsking(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </Modal>
        </>
      ) : (
        <Button type="submit" variant={variant} size={size} disabled={pending} aria-label={ariaLabel}>
          {children}
        </Button>
      )}
    </form>
  );
}
