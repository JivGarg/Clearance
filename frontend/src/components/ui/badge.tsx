import {
  Building2,
  Globe,
  HardDrive,
  Lock,
  CircleCheck,
  CircleX,
  Eye,
  FilePenLine,
  OctagonAlert,
  RotateCcw,
  Send,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Risk, SubmissionStatus, VisibilityClass } from "@/lib/domain";
import { RISK_LABEL, STATUS_LABEL, VISIBILITY_LABEL } from "@/lib/domain";
import { cn } from "@/lib/cn";

/**
 * designPRD 2.2: never use a pastel fill as the only signal. Every badge pairs a soft fill with an
 * AA-contrast text colour, an icon and a text label.
 */

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5 whitespace-nowrap ring-1 ring-inset";

const STATUS_STYLE: Record<SubmissionStatus, { cls: string; icon: LucideIcon }> = {
  draft: { cls: "bg-surface-muted text-text-muted ring-border", icon: FilePenLine },
  in_review: { cls: "bg-purple-soft text-accent ring-accent/20", icon: Eye },
  changes_requested: { cls: "bg-warning-soft text-warning-ink ring-warning-ink/20", icon: RotateCcw },
  approved: { cls: "bg-success-soft text-success-ink ring-success-ink/20", icon: CircleCheck },
  rejected: { cls: "bg-danger-soft text-danger-ink ring-danger-ink/20", icon: CircleX },
  released: { cls: "bg-info-soft text-info-ink ring-info-ink/20", icon: Send },
};

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const { cls, icon: Icon } = STATUS_STYLE[status];
  return (
    <span className={cn(base, cls, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const RISK_STYLE: Record<Risk, { cls: string; icon: LucideIcon }> = {
  low: { cls: "bg-success-soft text-success-ink ring-success-ink/20", icon: ShieldCheck },
  medium: { cls: "bg-warning-soft text-warning-ink ring-warning-ink/20", icon: TriangleAlert },
  high: { cls: "bg-danger-soft text-danger-ink ring-danger-ink/20", icon: OctagonAlert },
};

export function RiskBadge({ risk, className }: { risk: Risk; className?: string }) {
  const { cls, icon: Icon } = RISK_STYLE[risk];
  return (
    <span className={cn(base, cls, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
      {RISK_LABEL[risk]} risk
    </span>
  );
}

const VIS_STYLE: Record<VisibilityClass, { cls: string; icon: LucideIcon }> = {
  public_to_creators: { cls: "bg-success-soft text-success-ink ring-success-ink/20", icon: Globe },
  internal: { cls: "bg-info-soft text-info-ink ring-info-ink/20", icon: Building2 },
  confidential: { cls: "bg-danger-soft text-danger-ink ring-danger-ink/20", icon: Lock },
  local_only: { cls: "bg-surface-muted text-text ring-border", icon: HardDrive },
};

/** designPRD 4.2 visibility class, always icon + text. */
export function VisibilityBadge({ value, className }: { value: VisibilityClass; className?: string }) {
  const { cls, icon: Icon } = VIS_STYLE[value];
  return (
    <span className={cn(base, cls, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
      {VISIBILITY_LABEL[value]}
    </span>
  );
}

/** Small neutral tag, e.g. "Demo data" or "Not built yet". */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(base, "bg-gold-soft text-warning-ink ring-warning-ink/20", className)}>{children}</span>;
}
