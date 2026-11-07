"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modal and Drawer on the native <dialog> (showModal): real focus trap, Escape to close, inert
 * background and correct screen-reader semantics.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return {
    ref,
    onClose,
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
  };
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
    >
      <X aria-hidden className="size-5" />
    </button>
  );
}

export function Modal({ open, onClose, title, children }: DialogProps) {
  const titleId = useId();
  const dialogProps = useDialog(open, onClose);
  return (
    <dialog {...dialogProps} aria-labelledby={titleId} className="glass-dialog glass-strong m-auto w-[32rem] rounded-card">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-2xl">
            {title}
          </h2>
          <CloseButton onClick={onClose} label="Close dialog" />
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Drawer({ open, onClose, title, side = "right", children }: DialogProps & { side?: "left" | "right" }) {
  const titleId = useId();
  const dialogProps = useDialog(open, onClose);
  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className={cn(
        "glass-dialog glass-strong fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(22rem,calc(100vw-2rem))]",
        side === "left" ? "left-0 right-auto rounded-r-card" : "left-auto right-0 rounded-l-card",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id={titleId} className="font-serif text-2xl">
            {title}
          </h2>
          <CloseButton onClick={onClose} label={`Close ${title}`} />
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
