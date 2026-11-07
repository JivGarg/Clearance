"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Switch. The state is also exposed as text for assistive tech (role="switch" + aria-checked). */
export function Toggle({
  label,
  defaultChecked = false,
  checked: checkedProp,
  onChange,
  disabled,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const [inner, setInner] = useState(defaultChecked);
  const checked = checkedProp ?? inner;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        setInner(!checked);
        onChange?.(!checked);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-[#d9d1c8]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
