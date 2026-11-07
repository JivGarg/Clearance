import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Small, dependency-free charts (designPRD 2.3 ChartCard; 4.11). Every value is printed as text
 * beside its mark, each mark has a native tooltip, and the two-series chart has a table view, so
 * nothing depends on colour alone. Bars: thin, 4px rounded ends, 2px gaps between adjacent marks.
 */

export interface BarDatum {
  label: string;
  value: number;
  href?: string;
  /** Rendered before the label (e.g. a RiskBadge instead of plain text). */
  labelNode?: ReactNode;
  /** Tailwind bg class for the bar; defaults to the accent (single series = single hue). */
  barClass?: string;
}

export function BarList({ data, unit = "", emptyText = "Nothing to show yet." }: { data: BarDatum[]; unit?: string; emptyText?: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max === 0) return <p className="text-[14px] text-text-muted">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const label = d.labelNode ?? <span className="truncate">{d.label}</span>;
        return (
          <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="flex min-w-0 items-center gap-2 text-[14px]">
              {d.href ? (
                <Link href={d.href} className="min-w-0 truncate text-text underline-offset-2 hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </span>
            <span className="text-right text-[14px] font-semibold tabular-nums">
              {d.value}
              {unit}
            </span>
            <span className="col-span-2 h-2 rounded-full bg-surface-muted" title={`${d.label}: ${d.value}${unit}`}>
              <span
                className={cn("block h-2 rounded-full", d.barClass ?? "bg-accent")}
                style={{ width: `${Math.max(pct, d.value > 0 ? 2 : 0)}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface SeriesPoint {
  label: string;
  values: number[];
}

/** Grouped columns for two series over time, with legend and a table view. */
export function GroupedColumns({
  series,
  points,
  caption,
}: {
  series: { name: string; barClass: string; swatchClass: string }[];
  points: SeriesPoint[];
  caption: string;
}) {
  const max = Math.max(0, ...points.flatMap((p) => p.values));
  const height = 160;
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-4 text-[13px]" aria-label="Legend">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-3 rounded-[3px]", s.swatchClass)} />
            {s.name}
          </li>
        ))}
      </ul>
      {max === 0 ? (
        <p className="text-[14px] text-text-muted">No submissions in this period.</p>
      ) : (
        <div aria-hidden className="grid items-end gap-2 border-b border-border" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, height }}>
          {points.map((p) => (
            <div key={p.label} className="flex h-full items-end justify-center gap-[2px]">
              {p.values.map((v, i) => (
                <div key={series[i].name} className="flex h-full w-full max-w-6 flex-col justify-end" title={`${p.label} · ${series[i].name}: ${v}`}>
                  {v > 0 ? <span className="mb-1 text-center text-[11px] font-semibold tabular-nums">{v}</span> : null}
                  <div className={cn("w-full rounded-t-[4px]", series[i].barClass)} style={{ height: `${(v / max) * (height - 24)}px` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div aria-hidden className="grid gap-2 text-center text-[12px] text-text-muted" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((p) => (
          <span key={p.label} className="truncate">
            {p.label}
          </span>
        ))}
      </div>
      <details className="text-[14px]">
        <summary className="cursor-pointer font-medium text-accent">Show as table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4 font-semibold">
                  Week starting
                </th>
                {series.map((s) => (
                  <th key={s.name} scope="col" className="py-1 pr-4 font-semibold">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label} className="border-t border-border/70">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {p.label}
                  </th>
                  {p.values.map((v, i) => (
                    <td key={series[i].name} className="py-1 pr-4 tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ChartCard({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glass flex flex-col gap-4 rounded-card p-5 sm:p-6", className)}>
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
