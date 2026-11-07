import type { ReactNode } from "react";

/** PageHeader (designPRD 2.3): serif title, muted description, actions on the right. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-4xl leading-tight break-words md:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-[15px] text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
