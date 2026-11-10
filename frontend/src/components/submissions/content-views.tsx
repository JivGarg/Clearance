import { Card } from "@/components/ui/card";
import type { Intent } from "@/lib/data/types";
import { diffWords } from "@/lib/diff";

/** The current text of a submission (storage stand-in in the demo). */
export function ContentCard({ version, content }: { version: number; content: string }) {
  return (
    <Card>
      <h2 className="font-serif text-2xl">Content</h2>
      <p className="mt-1 text-[13px] text-text-muted">Version {version}</p>
      <p className="mt-3 whitespace-pre-wrap break-words rounded-control border border-border bg-surface/80 p-4 text-[15px]">{content}</p>
    </Card>
  );
}

/**
 * Side-by-side comparison of two versions (designPRD 4.7). Changes are marked with <del>/<ins>
 * (announced by screen readers) plus colour and strike/underline, never colour alone.
 */
export function DiffCard({ fromVersion, toVersion, before, after }: { fromVersion: number; toVersion: number; before: string; after: string }) {
  const parts = diffWords(before, after);
  const changed = parts.some((p) => p.kind !== "same");
  return (
    <Card>
      <h2 className="font-serif text-2xl">What changed</h2>
      <p className="mt-1 text-[13px] text-text-muted">
        Version {fromVersion} compared with version {toVersion}
      </p>
      {!changed ? (
        <p className="mt-3 text-[14px] text-text-muted">The text is identical.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[13px] font-semibold">Before (v{fromVersion})</p>
            <p className="whitespace-pre-wrap break-words rounded-control border border-border bg-surface/80 p-3 text-[14px]">
              {parts
                .filter((p) => p.kind !== "added")
                .map((p, i) =>
                  p.kind === "removed" ? (
                    <del key={i} className="rounded bg-danger-soft px-0.5 text-danger-ink">
                      {p.text}
                    </del>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold">After (v{toVersion})</p>
            <p className="whitespace-pre-wrap break-words rounded-control border border-border bg-surface/80 p-3 text-[14px]">
              {parts
                .filter((p) => p.kind !== "removed")
                .map((p, i) =>
                  p.kind === "added" ? (
                    <ins key={i} className="rounded bg-success-soft px-0.5 text-success-ink underline">
                      {p.text}
                    </ins>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function IntentView({ intent }: { intent: Intent }) {
  const rows: [string, string][] = [
    ["Goal", intent.goal],
    ["Audience", intent.audience],
    ["Key message", intent.keyMessage],
    ["Call to action", intent.callToAction],
  ];
  return (
    <dl className="mt-3 grid gap-2 text-[14px] sm:grid-cols-[9rem_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
