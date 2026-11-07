import { Database } from "lucide-react";
import { Tag } from "@/components/ui/badge";

/** designPRD 10 / 11.6: demo data is always labelled. The store is in memory until Supabase. */
export function DemoNotice({ extra }: { extra?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
      <Tag>
        <Database aria-hidden className="size-3.5" />
        Demo data
      </Tag>
      <span>
        Fictional records kept in server memory; changes reset when the server restarts.
        {extra ? ` ${extra}` : ""}
      </span>
    </p>
  );
}
