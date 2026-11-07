import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Stand-in for a screen designPRD specifies but that is not built yet. Clearly labelled, so a
 * placeholder is never mistaken for working functionality (designPRD 11.6). Lists what it needs.
 */
export function PlaceholderPage({
  title,
  description,
  specRef,
  contents,
}: {
  title: string;
  description: string;
  /** e.g. "designPRD 4.3" */
  specRef: string;
  contents: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Tag>Not built yet</Tag>
          <span className="text-[13px] text-text-muted">{specRef}</span>
        </div>
        <h2 className="mt-4 font-serif text-2xl">This screen will contain</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">
          {contents.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
