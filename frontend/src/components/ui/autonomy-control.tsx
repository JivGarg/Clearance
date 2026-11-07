"use client";

import { useState } from "react";
import { AUTONOMY_LABEL, AUTONOMY_LEVELS, type AutonomyLevel } from "@/lib/domain";
import { cn } from "@/lib/cn";

/** Segmented control for agent autonomy per risk level, built on native radios. */
export function AutonomyControl({
  legend,
  name,
  defaultValue,
  value: valueProp,
  onChange,
  levels = AUTONOMY_LEVELS,
}: {
  legend: string;
  name: string;
  defaultValue?: AutonomyLevel;
  value?: AutonomyLevel;
  onChange?: (value: AutonomyLevel) => void;
  /** Which choices to offer (e.g. medium risk never offers auto-fix). */
  levels?: readonly AutonomyLevel[];
}) {
  const [inner, setInner] = useState<AutonomyLevel>(defaultValue ?? "ask_first");
  const value = valueProp ?? inner;

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="glass flex flex-col gap-1 rounded-control p-1 sm:flex-row">
        {levels.map((level) => (
          <label key={level} className="relative flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={level}
              checked={value === level}
              onChange={() => {
                setInner(level);
                onChange?.(level);
              }}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-10 items-center justify-center rounded-[9px] px-3 text-[14px] font-medium text-text-muted",
                "transition-colors hover:text-text peer-checked:bg-accent peer-checked:text-white",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              )}
            >
              {AUTONOMY_LABEL[level]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
