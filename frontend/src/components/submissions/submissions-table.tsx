import Link from "next/link";
import { Lock } from "lucide-react";
import { RiskBadge, StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { SubmissionListItem } from "@/lib/data/queries";
import { CHANNEL_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { orgPath } from "@/lib/roles";

/** DataTable of submissions (designPRD 2.3). Columns collapse on narrow screens inside the table box. */
export function SubmissionsTable({ orgId, rows, timeZone, caption }: { orgId: string; rows: SubmissionListItem[]; timeZone: string; caption: string }) {
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <Th>Submission</Th>
          <Th>Status</Th>
          <Th>Risk</Th>
          <Th className="hidden md:table-cell">Channel</Th>
          <Th className="hidden lg:table-cell">Creator</Th>
          <Th className="hidden sm:table-cell">Created</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <Tr key={s.submissionId}>
            <Td className="min-w-48">
              <Link href={orgPath(orgId, `submissions/${s.submissionId}`)} className="font-semibold text-text underline-offset-2 hover:underline">
                {s.intentSummary ?? "Untitled submission"}
              </Link>
              <p className="text-[12px] text-text-muted">
                {s.campaignName ?? "No campaign"} · v{s.version}
              </p>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={s.status} />
                {s.embargoHold ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger-ink">
                    <Lock aria-hidden className="size-3.5" />
                    Embargo hold
                  </span>
                ) : null}
              </div>
            </Td>
            <Td>{s.risk ? <RiskBadge risk={s.risk} /> : <span className="text-[13px] text-text-muted">Not checked</span>}</Td>
            <Td className="hidden md:table-cell">{CHANNEL_LABEL[s.channel]}</Td>
            <Td className="hidden lg:table-cell">{s.creatorName}</Td>
            <Td className="hidden whitespace-nowrap sm:table-cell">{formatDate(s.createdAt, timeZone)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
