import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** DataTable shell. Scrolls inside its own box on narrow screens so the page never does. */
export function Table({ caption, className, children, ...props }: { caption: string } & HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="glass overflow-x-auto rounded-card">
      <table className={cn("w-full border-collapse text-left text-[14px]", className)} {...props}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, scope = "col", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn("whitespace-nowrap border-b border-border px-4 py-3 text-[12px] font-semibold text-text-muted", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border/70 last:border-0 hover:bg-surface/60", className)} {...props} />;
}
