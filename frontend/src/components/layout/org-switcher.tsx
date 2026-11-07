"use client";

import { Building2 } from "lucide-react";
import { useId, useRef } from "react";
import { switchOrgAction } from "@/lib/actions/auth";
import type { Organization } from "@/lib/domain";

/**
 * Current company. A plain label for people in one company; a switcher for people in several
 * (e.g. an agency working for two brands, DataBasePRD decision 3).
 */
export function OrgSwitcher({ orgs, currentOrgId }: { orgs: Organization[]; currentOrgId: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const current = orgs.find((o) => o.id === currentOrgId);

  if (orgs.length <= 1) {
    return (
      <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
        <Building2 aria-hidden className="size-4 shrink-0 text-accent" />
        <span className="truncate">{current?.name}</span>
      </p>
    );
  }

  return (
    <form ref={formRef} action={switchOrgAction} className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Company
      </label>
      <Building2 aria-hidden className="size-4 shrink-0 text-accent" />
      <select
        id={id}
        name="orgId"
        defaultValue={currentOrgId}
        onChange={() => formRef.current?.requestSubmit()}
        className="min-h-10 min-w-0 max-w-48 cursor-pointer truncate rounded-control border border-border bg-surface/90 px-2 text-[15px] font-semibold"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
