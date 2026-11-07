"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/ui/dialog";
import { NavLinks } from "@/components/layout/nav-links";
import type { NavGroup } from "@/lib/roles";

/** Below the lg breakpoint the sidebar collapses into this drawer (designPRD 2.3 responsive). */
export function MobileNav({ orgId, groups }: { orgId: string; groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        className="glass grid size-10 shrink-0 place-items-center rounded-control lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Clearance" side="left">
        <nav aria-label="Main">
          <NavLinks orgId={orgId} groups={groups} onNavigate={() => setOpen(false)} />
        </nav>
      </Drawer>
    </>
  );
}
