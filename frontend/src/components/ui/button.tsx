import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  // White on accent is 5.7:1 (designPRD's #8b5cf6 would be 4.2:1).
  primary: "bg-accent text-white shadow-[0_6px_16px_rgb(124_58_237/0.25)] hover:bg-accent-hover",
  secondary: "glass text-text hover:bg-surface",
  danger: "bg-danger-ink text-white hover:bg-[#9d3237]",
  ghost: "text-text hover:bg-surface-muted",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-[14px]",
  sm: "min-h-9 px-3.5 text-[13px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold no-underline",
    "transition-colors duration-150 select-none",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A link styled as a button. Use for navigation; use Button for actions. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}
