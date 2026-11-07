import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Glass card: translucent warm white, 18px radius, very soft shadow (designPRD 2.1). */
export const cardClass = "glass rounded-card p-5 sm:p-6";

/** For clickable cards (or links styled as cards). */
export const cardInteractiveClass =
  "block no-underline transition-shadow duration-150 hover:shadow-[0_12px_32px_rgb(52_37_23/0.09)]";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  return <div className={cn(cardClass, interactive && cardInteractiveClass, className)} {...props} />;
}

/**
 * KPI card (designPRD 2.3 MetricCard). `value` may be null: shows an honest dash and the reason,
 * never a made-up number (designPRD 4.11).
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number | null;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-text-muted">{label}</p>
        {icon ? (
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-purple-soft text-accent">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="font-serif text-4xl leading-none">{value ?? "—"}</p>
      {hint ? <p className="text-[13px] text-text-muted">{hint}</p> : null}
    </Card>
  );
}

/** The gold gradient brand banner (designPRD 2.1; gradients are reserved for this). */
export function GradientHeroCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-card p-6 shadow-[var(--shadow-card)] sm:p-8",
        "bg-[linear-gradient(120deg,#fbe3b0_0%,#f4ba58_45%,#f6cf8a_75%,#efe0ff_100%)]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/30 blur-2xl" />
      {eyebrow ? <p className="relative text-[13px] font-semibold text-text">{eyebrow}</p> : null}
      <h2 className="relative mt-2 max-w-2xl font-serif text-4xl italic leading-tight text-text sm:text-5xl">{title}</h2>
      {children ? <div className="relative mt-4 max-w-2xl text-[15px] text-text">{children}</div> : null}
    </section>
  );
}
