import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag, VisibilityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { expireFactAction, saveAssetAction, saveFactAction, saveGuidelineAction } from "@/lib/actions/admin";
import { capitalise, isCurrentFact, listAssets, listFacts, listGuidelines, orgSettings } from "@/lib/data/queries";
import type { AssetRow, FactRow, GuidelineRow } from "@/lib/data/types";
import { VISIBILITY_CLASSES, VISIBILITY_LABEL, type VisibilityClass } from "@/lib/domain";
import { formatDate, requestTime, toLocalInput } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Knowledge Base" };

const ASSET_TYPES = ["logo", "image", "document", "video", "font", "other"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function VisibilitySelect({ name, defaultValue }: { name: string; defaultValue: VisibilityClass }) {
  return (
    <SelectField label="Visibility" name={name} defaultValue={defaultValue} hint="Creators can read public and internal items, never confidential or local-only.">
      {VISIBILITY_CLASSES.map((v) => (
        <option key={v} value={v}>
          {VISIBILITY_LABEL[v]}
        </option>
      ))}
    </SelectField>
  );
}

function GuidelineFields({ g }: { g?: GuidelineRow }) {
  return (
    <>
      <TextAreaField label="Rule" name="rule" defaultValue={g?.rule} required maxLength={1000} hint="One clear, checkable rule." rows={3} />
      <TextField label="Category" name="category" defaultValue={g?.category} required maxLength={60} placeholder="terminology, claims, disclosure…" />
    </>
  );
}

function FactFields({ f, tz }: { f?: FactRow; tz: string }) {
  return (
    <>
      <TextAreaField label="Fact" name="fact" defaultValue={f?.fact} required maxLength={1000} rows={3} />
      <TextField label="Source" name="source" defaultValue={f?.source} required maxLength={200} hint="Where this fact is approved, e.g. a spec sheet or brief." />
      <TextField
        label="Valid until (optional)"
        name="validUntil"
        type="date"
        defaultValue={f?.validUntil ? toLocalInput(f.validUntil, tz).slice(0, 10) : ""}
        hint={`End of that day, ${tz}. Leave empty if it does not expire. Checks never use expired facts.`}
      />
      <VisibilitySelect name="level" defaultValue={f?.confidentialityLevel ?? "internal"} />
    </>
  );
}

function AssetFields({ x }: { x?: AssetRow }) {
  return (
    <>
      {x ? (
        <p className="break-all text-[14px]">
          <span className="font-semibold">File: </span>
          {x.storagePath}
        </p>
      ) : (
        <TextField label="File name" name="fileName" required placeholder="logo-2026.svg" hint="Uploading the file itself arrives with Supabase Storage; this records the asset." />
      )}
      <SelectField label="Type" name="assetType" defaultValue={x?.assetType ?? "logo"}>
        {ASSET_TYPES.map((t) => (
          <option key={t} value={t}>
            {capitalise(t)}
          </option>
        ))}
      </SelectField>
      <VisibilitySelect name="visibility" defaultValue={x?.visibility ?? "internal"} />
    </>
  );
}

const editIcon = <Pencil aria-hidden className="size-3.5" />;

/** Brand knowledge (designPRD 2.4 frame 5, 4.2). Admins edit; everyone else reads what they may see. */
export default async function KnowledgePage({ params, searchParams }: PageProps<"/org/[orgId]/knowledge">) {
  const { orgId } = await params;
  const { membership, actor } = await requireOrg(orgId, PAGE_ROLES.knowledge);
  const sp = await searchParams;
  const q = one(sp.q).trim().toLowerCase();
  const tab = ["guidelines", "facts", "assets"].includes(one(sp.tab)) ? one(sp.tab) : "guidelines";
  const isAdmin = membership.role === "admin";
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const hidden = { orgId };
  const match = (...v: (string | null)[]) => !q || v.some((x) => x?.toLowerCase().includes(q));
  const now = requestTime();

  const guidelines = listGuidelines(actor).filter((g) => match(g.rule, g.category));
  const facts = listFacts(actor).filter((f) => match(f.fact, f.source));
  const assets = listAssets(actor).filter((x) => match(x.storagePath, x.assetType));
  const noun = q ? "matches" : "items";

  const guidelinesTab = (
    <div className="flex flex-col gap-4">
      {isAdmin ? (
        <div>
          <FormDialog triggerLabel="Add guideline" triggerIcon={<Plus aria-hidden className="size-4" />} title="Add guideline" action={saveGuidelineAction} hidden={hidden} submitLabel="Add guideline">
            <GuidelineFields />
          </FormDialog>
        </div>
      ) : null}
      {guidelines.length ? (
        <Table caption="Brand guidelines">
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Category</Th>
              <Th>Version</Th>
              <Th className="hidden sm:table-cell">Updated</Th>
              {isAdmin ? <Th>
                <span className="sr-only">Actions</span>
              </Th> : null}
            </tr>
          </thead>
          <tbody>
            {guidelines.map((g) => (
              <Tr key={g.guidelineId}>
                <Td className="min-w-64">
                  <Link href={orgPath(orgId, `knowledge/${g.guidelineId}`)} className="text-text underline-offset-2 hover:underline">
                    {g.rule}
                  </Link>
                </Td>
                <Td>{capitalise(g.category)}</Td>
                <Td>v{g.version}</Td>
                <Td className="hidden whitespace-nowrap sm:table-cell">{formatDate(g.updatedAt, tz)}</Td>
                {isAdmin ? (
                  <Td>
                    <FormDialog triggerLabel="Edit" triggerIcon={editIcon} triggerVariant="ghost" triggerSize="sm" triggerAriaLabel={`Edit guideline: ${g.rule}`} title="Edit guideline" description="Changing the rule saves a new version." action={saveGuidelineAction} hidden={{ ...hidden, id: g.guidelineId }}>
                      <GuidelineFields g={g} />
                    </FormDialog>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={`No guidelines ${q ? "match" : "yet"}`} description="Versioned brand rules that every check measures content against." />
      )}
    </div>
  );

  const factsTab = (
    <div className="flex flex-col gap-4">
      {isAdmin ? (
        <div>
          <FormDialog triggerLabel="Add fact" triggerIcon={<Plus aria-hidden className="size-4" />} title="Add approved fact" action={saveFactAction} hidden={hidden} submitLabel="Add fact">
            <FactFields tz={tz} />
          </FormDialog>
        </div>
      ) : null}
      {facts.length ? (
        <Table caption="Approved facts">
          <thead>
            <tr>
              <Th>Fact</Th>
              <Th className="hidden md:table-cell">Source</Th>
              <Th>Visibility</Th>
              <Th>Valid until</Th>
              {isAdmin ? <Th>
                <span className="sr-only">Actions</span>
              </Th> : null}
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => {
              const current = isCurrentFact(f, now);
              return (
                <Tr key={f.factId}>
                  <Td className="min-w-56">
                    <Link href={orgPath(orgId, `knowledge/${f.factId}`)} className="text-text underline-offset-2 hover:underline">
                      {f.fact}
                    </Link>
                  </Td>
                  <Td className="hidden md:table-cell">{f.source}</Td>
                  <Td>
                    <VisibilityBadge value={f.confidentialityLevel} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {f.validUntil ? formatDate(f.validUntil, tz) : "No expiry"}
                    {!current ? <Tag className="ml-2">Expired</Tag> : null}
                  </Td>
                  {isAdmin ? (
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <FormDialog triggerLabel="Edit" triggerIcon={editIcon} triggerVariant="ghost" triggerSize="sm" triggerAriaLabel={`Edit fact: ${f.fact}`} title="Edit approved fact" description="Owners of pending submissions that cite this fact are alerted." action={saveFactAction} hidden={{ ...hidden, id: f.factId }}>
                          <FactFields f={f} tz={tz} />
                        </FormDialog>
                        {current ? (
                          <ActionButton
                            action={expireFactAction}
                            hidden={{ ...hidden, id: f.factId }}
                            variant="ghost"
                            ariaLabel={`Expire fact: ${f.fact}`}
                            confirm={{ title: "Expire this fact now?", body: `"${f.fact}" stops being used by checks immediately. It stays in the record.` }}
                            confirmLabel="Expire now"
                          >
                            Expire
                          </ActionButton>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={`No approved facts ${q ? "match" : "yet"}`} description="Facts with a source, expiry and confidentiality. Expired facts are never used by checks." />
      )}
    </div>
  );

  const assetsTab = (
    <div className="flex flex-col gap-4">
      {isAdmin ? (
        <div>
          <FormDialog triggerLabel="Add asset" triggerIcon={<Plus aria-hidden className="size-4" />} title="Add asset" action={saveAssetAction} hidden={hidden} submitLabel="Add asset">
            <AssetFields />
          </FormDialog>
        </div>
      ) : null}
      {assets.length ? (
        <Table caption="Brand assets">
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Type</Th>
              <Th>Visibility</Th>
              <Th className="hidden sm:table-cell">Updated</Th>
              {isAdmin ? <Th>
                <span className="sr-only">Actions</span>
              </Th> : null}
            </tr>
          </thead>
          <tbody>
            {assets.map((x) => (
              <Tr key={x.assetId}>
                <Td className="min-w-48 break-all">
                  <Link href={orgPath(orgId, `knowledge/${x.assetId}`)} className="text-text underline-offset-2 hover:underline">
                    {x.storagePath.split("/").pop()}
                  </Link>
                </Td>
                <Td>{capitalise(x.assetType)}</Td>
                <Td>
                  <VisibilityBadge value={x.visibility} />
                </Td>
                <Td className="hidden whitespace-nowrap sm:table-cell">{formatDate(x.updatedAt, tz)}</Td>
                {isAdmin ? (
                  <Td>
                    <FormDialog triggerLabel="Edit" triggerIcon={editIcon} triggerVariant="ghost" triggerSize="sm" triggerAriaLabel={`Edit asset ${x.storagePath}`} title="Edit asset" action={saveAssetAction} hidden={{ ...hidden, id: x.assetId }}>
                      <AssetFields x={x} />
                    </FormDialog>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={`No assets ${q ? "match" : "yet"}`} description="Logos and images with their visibility class. Files stay in private storage." />
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description={
          membership.role === "creator"
            ? "Brand rules and facts you are allowed to see. Confidential items are not shown to creators."
            : "Everything checks are measured against: guidelines, approved facts and assets."
        }
      />
      <div className="mb-6 flex flex-col gap-4">
        <DemoNotice />
        <form method="get" role="search" aria-label="Search knowledge" className="flex max-w-xl flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <div className="min-w-0 flex-1">
            <TextField label="Search knowledge" name="q" type="search" defaultValue={one(sp.q)} placeholder="Rule, fact, source or file" />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>
      <Tabs
        initialTabId={tab}
        tabs={[
          { id: "guidelines", label: `Guidelines (${guidelines.length})`, content: guidelinesTab },
          { id: "facts", label: `Approved facts (${facts.length})`, content: factsTab },
          { id: "assets", label: `Assets (${assets.length})`, content: assetsTab },
        ]}
      />
      <p className="sr-only" role="status">
        {guidelines.length + facts.length + assets.length} {noun}
      </p>
    </>
  );
}
