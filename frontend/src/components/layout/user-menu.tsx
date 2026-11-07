import { ChevronDown, LogOut } from "lucide-react";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABEL, type Membership, type User } from "@/lib/domain";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** UserMenu (designPRD 2.3). Native <details>, so it works without client JS. */
export function UserMenu({ user, membership }: { user: User; membership: Membership }) {
  return (
    <details className="group relative">
      <summary className="glass flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full py-1 pl-1 pr-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-purple-soft text-[13px] font-semibold text-accent">
          {initials(user.name)}
        </span>
        <span className="sr-only sm:not-sr-only sm:max-w-36 sm:truncate sm:text-[14px] sm:font-medium">{user.name}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-text-muted group-open:rotate-180" />
      </summary>
      <div className="glass-strong absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card p-4">
        <p className="font-semibold">{user.name}</p>
        <p className="break-all text-[13px] text-text-muted">{user.email}</p>
        <p className="mt-2 text-[13px]">
          {ROLE_LABEL[membership.role]}
        </p>
        <RoleSwitcher currentUserId={user.id} className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 md:hidden" />
        <form action={logoutAction} className="mt-4 border-t border-border pt-4">
          <button
            type="submit"
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-control text-[14px] font-medium hover:bg-surface-muted"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
