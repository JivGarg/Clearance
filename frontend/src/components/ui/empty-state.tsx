import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Honest empty state (designPRD 4.11, A14): say there is nothing, never fake data. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-card border border-dashed border-[#d9d1c8] bg-surface/50 p-6 sm:p-8",
        className,
      )}
    >
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="max-w-prose text-[15px] text-text-muted">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
