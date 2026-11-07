"use client";

import { useId, useRef } from "react";
import { switchUserAction } from "@/lib/actions/auth";
import { DEMO_USERS, orgName } from "@/lib/demo-users";
import { ROLE_LABEL } from "@/lib/domain";

const selectClass =
  "min-h-10 max-w-60 cursor-pointer rounded-control border border-border bg-surface/90 px-3 text-[14px] font-medium";

/** DEMO ONLY: swap between the seeded accounts. Remove when real auth lands. */
export function RoleSwitcher({ currentUserId, className }: { currentUserId: string; className?: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    // Layout is owned by the caller so responsive show/hide classes never fight a built-in display.
    <form ref={formRef} action={switchUserAction} className={className}>
      <label htmlFor={id} className="text-[12px] font-semibold text-text-muted">
        Demo account
      </label>
      <select
        id={id}
        name="userId"
        defaultValue={currentUserId}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClass}
      >
        {DEMO_USERS.map((u) => {
          const first = u.memberships[0];
          return (
            <option key={u.id} value={u.id}>
              {u.name}: {ROLE_LABEL[first.role]}, {orgName(first.orgId)}
            </option>
          );
        })}
      </select>
      <noscript>
        <button type="submit" className="rounded-control bg-accent px-3 py-1 text-[13px] font-semibold text-white">
          Switch
        </button>
      </noscript>
    </form>
  );
}
