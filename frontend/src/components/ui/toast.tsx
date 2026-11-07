"use client";

import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Toasts: bottom-right, glass, auto-dismiss after 5 seconds, announced politely. */
export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const STYLE: Record<ToastType, { icon: LucideIcon; color: string; label: string }> = {
  success: { icon: CircleCheck, color: "text-success-ink", label: "Success" },
  error: { icon: CircleX, color: "text-danger-ink", label: "Error" },
  info: { icon: Info, color: "text-info-ink", label: "Info" },
  warning: { icon: TriangleAlert, color: "text-warning-ink", label: "Warning" },
};

type Notify = (message: string, type?: ToastType) => void;
const ToastContext = createContext<Notify | null>(null);

export function useToast(): Notify {
  const notify = use(ToastContext);
  if (!notify) throw new Error("useToast must be used inside <ToastProvider>");
  return notify;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const notify = useCallback<Notify>((message, type = "info") => {
    const id = nextId.current++;
    setToasts((all) => [...all, { id, type, message }]);
  }, []);

  return (
    <ToastContext value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { icon: Icon, color, label } = STYLE[toast.type];
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className="glass-strong pointer-events-auto flex w-full items-start gap-3 rounded-control p-3.5"
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", color)} />
      <p className="flex-1 text-[14px] font-medium">
        <span className="sr-only">{label}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-muted"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
