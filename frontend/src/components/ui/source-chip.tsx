"use client";

import { FileText } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Evidence citation chip (designPRD 2.3 EvidenceCitation): opens the cited source version. */
export function SourceChip({
  label,
  className,
  ...props
}: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5",
        "text-[12px] font-medium text-text transition-colors hover:border-accent/40 hover:bg-purple-soft",
        className,
      )}
      {...props}
    >
      <FileText aria-hidden className="size-3.5 shrink-0 text-accent" strokeWidth={2.25} />
      <span className="truncate">{label}</span>
    </button>
  );
}
