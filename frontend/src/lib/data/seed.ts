import type {
  AdminEventRow,
  AgentActionRow,
  AgentSettingsRow,
  AssetRow,
  AssignmentRow,
  CampaignRow,
  CheckRow,
  DecisionRow,
  EmbargoRow,
  FactRow,
  GuidelineRow,
  IssueRow,
  MembershipRow,
  NotificationRow,
  OrganizationRow,
  OrgSettingsRow,
  RevisionRow,
  SubmissionRow,
  UserRow,
} from "@/lib/data/types";

/**
 * Demo data. Same ids and rows as supabase/seed.sql (fictional, designPRD 10). Timestamps are
 * spread over the last two weeks so dashboards have a timeline; seed.sql uses now() throughout.
 * Shown in the UI with a "Demo data" label (designPRD 4.11: never present demo as real).
 */

export interface DemoDb {
  organizations: OrganizationRow[];
  users: UserRow[];
  memberships: MembershipRow[];
  guidelines: GuidelineRow[];
  assets: AssetRow[];
  facts: FactRow[];
  embargoes: EmbargoRow[];
  campaigns: CampaignRow[];
  submissions: SubmissionRow[];
  revisions: RevisionRow[];
  assignments: AssignmentRow[];
  decisions: DecisionRow[];
  checks: CheckRow[];
  issues: IssueRow[];
  agentActions: AgentActionRow[];
  notifications: NotificationRow[];
  agentSettings: AgentSettingsRow[];
  orgSettings: OrgSettingsRow[];
  adminEvents: AdminEventRow[];
}

const SONIC = "0a000000-0000-4000-8000-000000000001";
const NORTH = "0a000000-0000-4000-8000-000000000002";
const u = (n: number) => `a0000000-0000-4000-8000-00000000000${n}`;
const s = (n: number) => `50000000-0000-4000-8000-00000000000${n}`;

export function buildSeed(nowMs: number = Date.now()): DemoDb {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const at = (offsetMs: number) => new Date(nowMs + offsetMs).toISOString();
  const day = (offsetDays: number) => new Date(nowMs + offsetDays * DAY).toISOString().slice(0, 10);
  const t0 = at(-20 * DAY);

  const organizations: OrganizationRow[] = [
    { organizationId: SONIC, companyName: "Sonic X Audio", createdAt: t0, updatedAt: t0 },
    { organizationId: NORTH, companyName: "Northwind Drinks", createdAt: t0, updatedAt: t0 },
  ];

  const users: UserRow[] = [
    [1, "Aarav Mehta", "admin@sonicx.test"],
    [2, "Meera Kapoor", "manager@sonicx.test"],
    [3, "Rohan Iyer", "reviewer@sonicx.test"],
    [4, "Sana Qureshi", "creator@sonicx.test"],
    [5, "Tara D'Souza", "agency@sonicx.test"],
    [6, "Lena Park", "admin@northwind.test"],
    [7, "Dev Malhotra", "former@sonicx.test"],
  ].map(([n, name, email]) => ({ userId: u(n as number), name: name as string, email: email as string, createdAt: t0 }));

  let mId = 0;
  const membership = (org: string, user: number, role: MembershipRow["role"], status: MembershipRow["status"] = "active"): MembershipRow => ({
    membershipId: `b0000000-0000-4000-8000-00000000000${++mId}`,
    organizationId: org,
    userId: u(user),
    role,
    status,
    createdAt: t0,
    updatedAt: t0,
  });
  const memberships: MembershipRow[] = [
    membership(SONIC, 1, "admin"),
    membership(SONIC, 2, "manager"),
    membership(SONIC, 3, "reviewer"),
    membership(SONIC, 4, "creator"),
    membership(SONIC, 5, "creator"),
    membership(SONIC, 7, "reviewer", "suspended"),
    membership(NORTH, 6, "admin"),
    membership(NORTH, 5, "creator"),
  ];

  const guidelines: GuidelineRow[] = [
    ["61000000-0000-4000-8000-000000000001", SONIC, 'Write the product name as "Sonic X1", never "SonicX 1" or "Sonic-X1".', "terminology", 2],
    ["61000000-0000-4000-8000-000000000002", SONIC, "Paid or gifted content must carry #ad at the start of the caption.", "disclosure", 1],
    ["61000000-0000-4000-8000-000000000003", SONIC, "No health or medical claims about listening, hearing or sleep.", "claims", 1],
    ["61000000-0000-4000-8000-000000000004", SONIC, "Images need alt text; videos need captions.", "accessibility", 1],
    ["61000000-0000-4000-8000-000000000005", NORTH, "Northwind is always written in one word.", "terminology", 1],
    ["61000000-0000-4000-8000-000000000006", SONIC, 'Never call the product "cheap"; say "affordable".', "terminology", 1],
    ["61000000-0000-4000-8000-000000000007", SONIC, "Summer Sound posts use the hashtag #SummerSound.", "campaign", 1],
    ["61000000-0000-4000-8000-000000000008", SONIC, 'Sound confident and clear, not hyped: no "OMG", "insane" or "you guys".', "voice", 1],
  ].map(([guidelineId, organizationId, rule, category, version]) => ({
    guidelineId: guidelineId as string,
    organizationId: organizationId as string,
    rule: rule as string,
    category: category as string,
    version: version as number,
    createdAt: t0,
    updatedAt: t0,
  }));

  const assets: AssetRow[] = (
    [
      ["62000000-0000-4000-8000-000000000001", SONIC, "assets/sonicx/logo-2026.svg", "logo", "public_to_creators"],
      ["62000000-0000-4000-8000-000000000002", SONIC, "assets/sonicx/logo-2022-old.svg", "logo", "internal"],
      ["62000000-0000-4000-8000-000000000003", SONIC, "assets/sonicx/nova-render.png", "image", "confidential"],
      ["62000000-0000-4000-8000-000000000004", NORTH, "assets/northwind/logo.svg", "logo", "public_to_creators"],
    ] as const
  ).map(([assetId, organizationId, storagePath, assetType, visibility]) => ({
    assetId,
    organizationId,
    storagePath,
    assetType,
    visibility,
    createdAt: t0,
    updatedAt: t0,
  }));

  const facts: FactRow[] = (
    [
      ["f1000000-0000-4000-8000-000000000001", SONIC, "Sonic X1 battery life is 50 hours.", "Spec sheet v3", null, "public_to_creators"],
      ["f1000000-0000-4000-8000-000000000002", SONIC, "Student discount is 20%.", "Campus Beats brief", at(120 * DAY), "internal"],
      ["f1000000-0000-4000-8000-000000000003", SONIC, "Nova launch price is USD 249.", "Pricing committee", at(60 * DAY), "confidential"],
      ["f1000000-0000-4000-8000-000000000004", SONIC, "Spring promo code is SPRING15.", "Spring campaign brief", at(-30 * DAY), "public_to_creators"],
      ["f1000000-0000-4000-8000-000000000005", NORTH, "Northwind Calm costs USD 2.49.", "Price list", null, "internal"],
    ] as const
  ).map(([factId, organizationId, fact, source, validUntil, confidentialityLevel]) => ({
    factId,
    organizationId,
    fact,
    source,
    validUntil,
    confidentialityLevel,
    createdAt: t0,
    updatedAt: t0,
  }));

  const embargoes: EmbargoRow[] = [
    {
      embargoId: "f2000000-0000-4000-8000-000000000001",
      organizationId: SONIC,
      restrictedItem: "Project Nova (unreleased headphones)",
      releaseAt: at(25 * DAY),
      visibility: "confidential",
      createdAt: t0,
      updatedAt: t0,
    },
    {
      embargoId: "f2000000-0000-4000-8000-000000000002",
      organizationId: SONIC,
      restrictedItem: "Sonic X1 Pro colourways",
      releaseAt: at(-3 * DAY),
      visibility: "internal",
      createdAt: t0,
      updatedAt: t0,
    },
  ];

  const campaigns: CampaignRow[] = [
    ["c0000000-0000-4000-8000-000000000001", SONIC, "Summer Sound", day(-10), day(50)],
    ["c0000000-0000-4000-8000-000000000002", SONIC, "Campus Beats", day(-5), day(80)],
    ["c0000000-0000-4000-8000-000000000003", NORTH, "Calm Launch", day(0), day(30)],
  ].map(([campaignId, organizationId, campaignName, startDate, endDate]) => ({
    campaignId: campaignId as string,
    organizationId: organizationId as string,
    campaignName: campaignName as string,
    startDate: startDate as string,
    endDate: endDate as string,
    createdAt: t0,
    updatedAt: t0,
  }));

  // n, org, campaign, creator, path, type, channel, intent, created (days ago), final status
  const SUBS = [
    [1, SONIC, 1, 4, "submissions/s1/v1.txt", "text", "instagram", "Tease the summer range to existing followers.", 1, "draft"],
    [2, SONIC, 1, 4, "submissions/s2/v2.mp4", "video", "youtube", "Show the X1 lasting a full festival weekend.", 9, "in_review"],
    [3, SONIC, 2, 5, "submissions/s3/v1.txt", "text", "instagram", "Promote the student offer to campus followers.", 12, "changes_requested"],
    [4, SONIC, 1, 4, "submissions/s4/v1.txt", "text", "blog", "Explain how to care for the X1.", 6, "approved"],
    [5, SONIC, 2, 5, "submissions/s5/v1.png", "image", "instagram", "Sell the X1 as a sleep aid.", 10, "rejected"],
    [6, SONIC, 1, 4, "submissions/s6/v1.txt", "text", "linkedin", "Announce the summer partner programme.", 13, "released"],
    [7, SONIC, 1, 4, "submissions/s7/v1.txt", "text", "instagram", "Build hype for what is next.", 3, "in_review"],
    [8, NORTH, 3, 5, "submissions/s8/v1.txt", "text", "instagram", "Northwind Calm launch post.", 2, "draft"],
  ] as const;
  const createdAt = (n: number) => at(-SUBS[n - 1][8] * DAY);
  const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

  const submissions: SubmissionRow[] = SUBS.map(([n, org, c, creator, path, type, channel, intent, , status]) => ({
    submissionId: s(n),
    organizationId: org,
    campaignId: `c0000000-0000-4000-8000-00000000000${c}`,
    createdByUserId: u(creator),
    contentPath: path,
    type,
    channel,
    status,
    intentSummary: intent,
    intent: null,
    intentConfirmed: status !== "draft",
    createdAt: createdAt(n),
    updatedAt: createdAt(n),
  }));

  // Demo text of each version (storage stand-in), consistent with the seeded findings.
  const TEXT: Record<number, string> = {
    1: "Summer is here. The Sonic X1 keeps the music going all day. Link in bio.",
    2: "OMG, the SonicX 1 gives you 60 hours of battery for a whole festival weekend!",
    3: "Back to campus? Use code STUDENT20 for the student discount on the Sonic X1.",
    4: "How to care for your Sonic X1: wipe the ear cushions once a week. [image]",
    5: "The Sonic X1 helps you fall asleep faster. Sweet dreams. [image]",
    6: "We are launching the Sonic X1 summer partner programme. Learn more on our site.",
    7: "Something big is coming. Sneak peek of Project Nova soon.",
    8: "Northwind Calm: a quiet moment in every can.",
  };
  const rev = (n: number, v: number) => `d0000000-0000-4000-8000-0000000000${n}${v}`;
  const revisions: RevisionRow[] = SUBS.map(([n, , , creator, path]) => ({
    revisionId: rev(n, 1),
    submissionId: s(n),
    editedByUserId: u(creator),
    version: 1,
    contentPath: path.replace(/v2/, "v1"),
    changeSummary: "First version",
    content: n === 2 ? "OMG you guys, the SonicX 1 gives you 60 hours of battery for a whole festival weekend!" : TEXT[n],
    createdAt: plus(createdAt(n), 10 * 60_000),
  }));
  revisions.push({
    revisionId: rev(2, 2),
    submissionId: s(2),
    editedByUserId: u(4),
    version: 2,
    contentPath: "submissions/s2/v2.mp4",
    changeSummary: "Recut intro, product name fixed",
    content: TEXT[2],
    createdAt: at(-8 * DAY),
  });
  const latestRev = (n: number) => (n === 2 ? rev(2, 2) : rev(n, 1));

  // Sent to review an hour after creation; Rohan assigned. Decided ones are "done".
  const decidedAfterDays: Record<number, number> = { 3: 1, 4: 1, 5: 1, 6: 1 };
  const assignments: AssignmentRow[] = [2, 3, 4, 5, 6, 7].map((n) => {
    const assigned = plus(createdAt(n), HOUR);
    const done = n in decidedAfterDays;
    return {
      assignmentId: `ab000000-0000-4000-8000-00000000000${n}`,
      submissionId: s(n),
      reviewerUserId: u(3),
      deadline: done ? plus(assigned, DAY) : at(n === 2 ? DAY : 2 * DAY),
      status: done ? "done" : "pending",
      createdAt: assigned,
      updatedAt: assigned,
    };
  });

  const decisionAt = (n: number) => plus(createdAt(n), HOUR + decidedAfterDays[n] * DAY - 3 * HOUR);
  const decisions: DecisionRow[] = (
    [
      [3, "changes_requested", "Add #ad at the start of the caption."],
      [4, "approved", null],
      [5, "rejected", "Health claims cannot be used."],
      [6, "approved", "Clear to go."],
    ] as const
  ).map(([n, decision, comments]) => ({
    decisionId: `de000000-0000-4000-8000-00000000000${n}`,
    submissionId: s(n),
    revisionId: latestRev(n),
    reviewerUserId: u(3),
    decision,
    comments,
    decidedAt: decisionAt(n),
  }));

  const checks: CheckRow[] = (
    [
      [2, "high", "Battery claim does not match approved fact"],
      [3, "medium", "Ad disclosure missing"],
      [4, "low", "Alt text missing on one image"],
      [5, "high", "Health claim"],
      [6, "low", "No issues found"],
      [7, "high", "Mentions an embargoed product"],
    ] as const
  ).map(([n, riskLevel, summary]) => ({
    checkId: `cc000000-0000-4000-8000-00000000000${n}`,
    submissionId: s(n),
    revisionId: latestRev(n),
    riskLevel,
    checkedAt: plus(createdAt(n), 30 * 60_000),
    serviceUsed: "mock-rules-v1",
    result: { mock: true, summary },
  }));
  const checkAt = (n: number) => checks.find((c) => c.submissionId === s(n))!.checkedAt;

  const issues: IssueRow[] = (
    [
      [1, 2, "Incorrect fact", 'The video says "60 hours of battery". The approved figure is 50 hours.', "fact", "f1000000-0000-4000-8000-000000000001", "high", 'Say "up to 50 hours of battery".'],
      [2, 2, "Terminology", '"SonicX 1" is not the approved product name.', "guideline", "61000000-0000-4000-8000-000000000001", "low", "Sonic X1"],
      [3, 3, "Missing ad disclosure", "The post promotes a discount code but has no #ad label.", "guideline", "61000000-0000-4000-8000-000000000002", "medium", "Start the caption with #ad."],
      [4, 4, "Accessibility", "One image has no alt text.", "guideline", "61000000-0000-4000-8000-000000000004", "low", "Add a short description of the image."],
      [5, 5, "Health claim", "Saying the X1 helps you fall asleep faster is a health claim, which is not allowed.", "guideline", "61000000-0000-4000-8000-000000000003", "high", "Remove the sleep claim."],
      [6, 7, "Embargoed item", "The caption names Project Nova, which is under embargo.", "embargo", "f2000000-0000-4000-8000-000000000001", "high", null],
    ] as const
  ).map(([i, n, issueType, explanation, sourceType, sourceId, riskLevel, suggestedFix]) => ({
    issueId: `e0000000-0000-4000-8000-00000000000${i}`,
    checkId: `cc000000-0000-4000-8000-00000000000${n}`,
    issueType,
    explanation,
    sourceType,
    sourceId,
    riskLevel,
    suggestedFix,
    createdAt: checkAt(n),
  }));

  const agentActions: AgentActionRow[] = [
    { n: 1, sub: 2, action: "run_check", reason: "New revision uploaded", undo: null, when: plus(checkAt(2), -60_000) },
    {
      n: 2,
      sub: 2,
      action: "auto_fix_applied",
      reason: "Low-risk terminology fix: SonicX 1 to Sonic X1",
      undo: { field: "caption", before: "SonicX 1", after: "Sonic X1" },
      when: checkAt(2),
    },
    { n: 3, sub: 7, action: "hold", reason: "Embargoed item found; routed to authorised reviewer", undo: null, when: checkAt(7) },
  ].map((a) => ({
    actionId: `aa000000-0000-4000-8000-00000000000${a.n}`,
    submissionId: s(a.sub),
    action: a.action,
    reason: a.reason,
    undoData: a.undo,
    createdAt: a.when,
  }));

  // seed.sql's three, plus the creator notifications its decision trigger writes.
  const notifications: NotificationRow[] = [
    [3, 2, "You have a review due tomorrow.", at(-HOUR)],
    [3, 7, "Embargo hold needs your review.", checkAt(7)],
    [2, 7, "A submission is on embargo hold.", checkAt(7)],
    [5, 3, "Changes requested on your submission.", decisionAt(3)],
    [4, 4, "Your submission was approved.", decisionAt(4)],
    [5, 5, "Your submission was rejected.", decisionAt(5)],
    [4, 6, "Your submission was approved.", decisionAt(6)],
    [1, 7, "Embargo hold: a submission cites an active embargo.", checkAt(7)],
  ].map(([user, sub, message, when], i) => ({
    notificationId: `0b000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
    recipientUserId: u(user as number),
    submissionId: s(sub as number),
    message: message as string,
    readAt: null,
    createdAt: when as string,
  }));

  const agentSettings: AgentSettingsRow[] = [SONIC, NORTH].map((organizationId) => ({
    organizationId,
    lowRisk: "auto_fix",
    mediumRisk: "ask_first",
    maxCheckAttempts: 3,
    reviewDeadlineHours: 24,
    updatedAt: t0,
  }));

  const orgSettings: OrgSettingsRow[] = [
    { organizationId: SONIC, timezone: "Asia/Kolkata" },
    { organizationId: NORTH, timezone: "Europe/London" },
  ];

  return {
    organizations,
    users,
    memberships,
    guidelines,
    assets,
    facts,
    embargoes,
    campaigns,
    submissions,
    revisions,
    assignments,
    decisions,
    checks,
    issues,
    agentActions,
    notifications,
    agentSettings,
    orgSettings,
    adminEvents: [],
  };
}
