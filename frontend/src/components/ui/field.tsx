"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Form fields with labels, hints and errors. Errors are announced to screen readers
 * (role="alert" + aria-describedby + aria-invalid), and use text, not colour alone.
 */

const controlClass = cn(
  "block w-full min-h-11 rounded-control border border-border bg-surface/90 px-3.5 py-2 text-[15px] text-text",
  "placeholder:text-text-muted transition-colors hover:border-[#d9d1c8]",
  "disabled:cursor-not-allowed disabled:bg-surface-muted",
);
const errorControlClass = "border-danger-ink";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type SharedProps = { label: string; hint?: string; error?: string };

export function TextField({ label, hint, error, className, id: idProp, ...props }: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClass, error && errorControlClass, className)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, className, id: idProp, ...props }: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={5}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClass, "resize-y", error && errorControlClass, className)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, className, id: idProp, children, ...props }: SharedProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClass, "cursor-pointer", error && errorControlClass, className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
