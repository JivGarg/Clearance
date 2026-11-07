import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AutonomyControl } from "@/components/ui/autonomy-control";
import { RiskBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, GradientHeroCard, MetricCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SourceChip } from "@/components/ui/source-chip";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { RISKS, STATUSES } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { ShowcaseActions } from "./showcase-actions";

export const metadata: Metadata = { title: "Design System" };

const SWATCHES = [
  ["Canvas", "#f3ede5", "bg-canvas"],
  ["Sidebar", "#eee3d6", "bg-sidebar"],
  ["Surface", "#fffdfb", "bg-surface"],
  ["Purple (decor)", "#8b5cf6", "bg-purple"],
  ["Accent (action)", "#7c3aed", "bg-accent"],
  ["Gold", "#f4ba58", "bg-gold"],
  ["Success ink", "#2b7249", "bg-success-ink"],
  ["Warning ink", "#8a5d12", "bg-warning-ink"],
  ["Danger ink", "#b23c42", "bg-danger-ink"],
  ["Text", "#211f20", "bg-text"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-serif text-3xl">{title}</h2>
      {children}
    </section>
  );
}

// Reference page for the team. Signed-in users only; reads the session inside Suspense.
async function Guard({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

export default function DesignSystemPage() {
  return (
    <Suspense fallback={null}>
      <Guard>
        <main className="mx-auto w-full max-w-content px-4 py-10 lg:px-8">
          <PageHeader title="Design System" description="Warm ivory, gold and purple with glass surfaces (designPRD 2). Tokens live in globals.css." />

          <Section title="Colour">
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {SWATCHES.map(([name, hex, cls]) => (
                <li key={name} className="glass overflow-hidden rounded-control">
                  <div className={`h-14 ${cls}`} />
                  <div className="p-3">
                    <p className="text-[14px] font-semibold">{name}</p>
                    <p className="text-[12px] text-text-muted">{hex}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Type and hero">
            <GradientHeroCard eyebrow="Sonic X Audio" title="Nothing goes live without clearance.">
              Instrument Serif for headings, DM Sans for everything else.
            </GradientHeroCard>
          </Section>

          <Section title="Buttons and badges">
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {RISKS.map((r) => <RiskBadge key={r} risk={r} />)}
              <Tag>Demo data</Tag>
              <SourceChip label="Fact: battery life is 50 hours" />
            </div>
          </Section>

          <Section title="Cards">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Submissions" value={null} hint="No data yet: shown honestly" />
              <MetricCard label="Example value" value="12" hint="Real numbers only" />
              <Card className="sm:col-span-2">
                <h3 className="font-serif text-2xl">Glass card</h3>
                <p className="mt-1 text-[15px] text-text-muted">Translucent warm white, 18px radius, very soft shadow.</p>
              </Card>
            </div>
          </Section>

          <Section title="Forms">
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Title" placeholder="Summer Sound teaser" hint="Shown in lists and the audit log." />
              <TextField label="Email" defaultValue="not-an-email" error="Enter a valid email address." />
              <SelectField label="Channel" defaultValue="instagram">
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="blog">Blog</option>
              </SelectField>
              <TextAreaField label="Change summary" placeholder="What changed in this revision" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-[14px] font-medium">
                <Toggle label="Local-only processing" /> Local-only processing
              </label>
              <div className="w-full max-w-xl">
                <AutonomyControl legend="Autonomy for medium risk" name="demo" defaultValue="ask_first" />
              </div>
            </div>
          </Section>

          <Section title="Tabs and table">
            <Tabs
              tabs={[
                { id: "a", label: "Guidelines", content: <p className="text-[15px] text-text-muted">Guidelines panel</p> },
                { id: "b", label: "Approved facts", content: <p className="text-[15px] text-text-muted">Facts panel</p> },
                { id: "c", label: "Assets", content: <p className="text-[15px] text-text-muted">Assets panel</p> },
              ]}
            />
            <div className="mt-6">
              <Table caption="Example facts table">
                <thead>
                  <tr><Th>Fact</Th><Th>Source</Th><Th>Valid until</Th><Th>Status</Th></tr>
                </thead>
                <tbody>
                  <Tr><Td className="font-medium">Battery life is 50 hours</Td><Td>Spec sheet v3</Td><Td>No expiry</Td><Td><StatusBadge status="approved" /></Td></Tr>
                  <Tr><Td className="font-medium">Student discount is 20%</Td><Td>Campus Beats brief</Td><Td>2027-03-07</Td><Td><StatusBadge status="in_review" /></Td></Tr>
                </tbody>
              </Table>
            </div>
          </Section>

          <Section title="Empty state, toast and modal">
            <EmptyState title="No embargoes" description="Add a restricted item to hold any draft that mentions it until its release date." action={<Button>Add embargo</Button>} />
            <div className="mt-6">
              <ShowcaseActions />
            </div>
          </Section>
        </main>
      </Guard>
    </Suspense>
  );
}
