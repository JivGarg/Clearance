import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { changeRoleAction, inviteMemberAction, setMemberStatusAction } from "@/lib/actions/admin";
import { listMembers, type MemberView } from "@/lib/data/queries";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/domain";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Users & Roles" };

const ROLE_HELP: Record<Role, string> = {
  admin: "Runs the account: members, knowledge, settings. Cannot approve content.",
  manager: "Campaigns, embargoes and reviewer assignments. Cannot approve content.",
  creator: "Creates and revises their own submissions. Same access whether in-house or agency.",
  reviewer: "Approves, rejects or requests changes on submissions assigned to them.",
};

const STATUS_STYLE: Record<MemberView["status"], string> = {
  active: "bg-success-soft text-success-ink ring-success-ink/20",
  invited: "bg-info-soft text-info-ink ring-info-ink/20",
  suspended: "bg-surface-muted text-text-muted ring-border",
};

function RoleSelect({ defaultValue }: { defaultValue: Role }) {
  return (
    <>
      <SelectField label="Role" name="role" defaultValue={defaultValue} hint="Applies to this company only.">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </SelectField>
      <ul className="flex flex-col gap-1 text-[13px] text-text-muted">
        {ROLES.map((r) => (
          <li key={r}>
            <span className="font-semibold text-text">{ROLE_LABEL[r]}:</span> {ROLE_HELP[r]}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Members, roles and invitations (designPRD 2.4 frame 6, 4.1). Admin only. */
export default async function UsersPage({ params }: PageProps<"/org/[orgId]/users">) {
  const { orgId } = await params;
  const { user, actor } = await requireOrg(orgId, PAGE_ROLES.users);
  const members = listMembers(actor);
  const active = members.filter((m) => m.status === "active");
  const hidden = { orgId };

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Who can do what in this company. Suspending someone revokes access at once; their past work stays attributed to them."
        actions={
          <FormDialog
            triggerLabel="Invite member"
            triggerIcon={<UserPlus aria-hidden className="size-4" />}
            title="Invite member"
            description="They join when they accept. In this demo, an invited person signing in with the demo password accepts the invitation."
            action={inviteMemberAction}
            hidden={hidden}
            submitLabel="Send invitation"
          >
            <TextField label="Name" name="name" required maxLength={120} autoComplete="off" />
            <TextField label="Email" name="email" type="email" required maxLength={254} autoComplete="off" />
            <RoleSelect defaultValue="creator" />
          </FormDialog>
        }
      />
      <div className="mb-6">
        <DemoNotice extra="Invitation emails are not sent." />
      </div>

      <section aria-labelledby="totals" className="mb-6">
        <h2 id="totals" className="sr-only">
          Active members by role
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => (
            <MetricCard key={r} label={`${ROLE_LABEL[r]}s`} value={active.filter((m) => m.role === r).length} hint="Active" />
          ))}
        </div>
      </section>

      <Table caption="Company members">
        <thead>
          <tr>
            <Th>Member</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th className="hidden md:table-cell">Open reviews</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const self = m.userId === user.id;
            return (
              <Tr key={m.membershipId}>
                <Td className="min-w-48">
                  <p className="font-semibold">
                    {m.name}
                    {self ? <span className="font-normal text-text-muted"> (you)</span> : null}
                  </p>
                  <p className="break-all text-[13px] text-text-muted">{m.email}</p>
                </Td>
                <Td>{ROLE_LABEL[m.role]}</Td>
                <Td>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset ${STATUS_STYLE[m.status]}`}>
                    {m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : "Suspended"}
                  </span>
                </Td>
                <Td className="hidden md:table-cell">{m.role === "reviewer" ? m.openAssignments : "—"}</Td>
                <Td>
                  {self ? (
                    <Tag>Ask another admin</Tag>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <FormDialog
                        triggerLabel="Change role"
                        triggerVariant="ghost"
                        triggerSize="sm"
                        triggerAriaLabel={`Change role for ${m.name}`}
                        title={`Change role for ${m.name}`}
                        action={changeRoleAction}
                        hidden={{ ...hidden, membershipId: m.membershipId }}
                      >
                        <RoleSelect defaultValue={m.role} />
                      </FormDialog>
                      {m.status === "suspended" ? (
                        <ActionButton action={setMemberStatusAction} hidden={{ ...hidden, membershipId: m.membershipId, status: "active" }} variant="ghost" ariaLabel={`Restore access for ${m.name}`}>
                          Restore
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={setMemberStatusAction}
                          hidden={{ ...hidden, membershipId: m.membershipId, status: "suspended" }}
                          variant="danger"
                          ariaLabel={`${m.status === "invited" ? "Revoke invitation for" : "Suspend"} ${m.name}`}
                          confirm={{
                            title: m.status === "invited" ? `Revoke ${m.name}'s invitation?` : `Suspend ${m.name}?`,
                            body:
                              m.status === "invited"
                                ? "They will not be able to join with this invitation."
                                : `They lose access to this company immediately. Their submissions, reviews and decisions stay on record under their name.${m.openAssignments ? ` They have ${m.openAssignments} open review(s) that a manager will need to reassign.` : ""}`,
                          }}
                          confirmLabel={m.status === "invited" ? "Revoke" : "Suspend"}
                        >
                          {m.status === "invited" ? "Revoke" : "Suspend"}
                        </ActionButton>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
