import type { Membership, Organization, User } from "@/lib/domain";

/**
 * DEMO accounts. Ids, emails and memberships MUST match supabase/seed.sql, so moving from the demo
 * cookie session to Supabase Auth changes no identifiers. All data is fictional (designPRD 10).
 */
export const DEMO_PASSWORD = "clearance-demo";

export const ORGS: readonly Organization[] = [
  { id: "0a000000-0000-4000-8000-000000000001", name: "Sonic X Audio" },
  { id: "0a000000-0000-4000-8000-000000000002", name: "Northwind Drinks" },
];

const SONIC = ORGS[0].id;
const NORTHWIND = ORGS[1].id;

const m = (orgId: string, role: Membership["role"]): Membership => ({ orgId, role, status: "active" });

export const DEMO_USERS: readonly User[] = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Aarav Mehta", email: "admin@sonicx.test", memberships: [m(SONIC, "admin")] },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Meera Kapoor", email: "manager@sonicx.test", memberships: [m(SONIC, "manager")] },
  { id: "a0000000-0000-4000-8000-000000000003", name: "Rohan Iyer", email: "reviewer@sonicx.test", memberships: [m(SONIC, "reviewer")] },
  { id: "a0000000-0000-4000-8000-000000000004", name: "Sana Qureshi", email: "creator@sonicx.test", memberships: [m(SONIC, "creator")] },
  {
    // Agency creator working for both companies: one person, a membership in each.
    id: "a0000000-0000-4000-8000-000000000005",
    name: "Tara D'Souza",
    email: "agency@sonicx.test",
    memberships: [m(SONIC, "creator"), m(NORTHWIND, "creator")],
  },
  { id: "a0000000-0000-4000-8000-000000000006", name: "Lena Park", email: "admin@northwind.test", memberships: [m(NORTHWIND, "admin")] },
];

export function findDemoUserById(id: string): User | undefined {
  return DEMO_USERS.find((u) => u.id === id);
}

export function findDemoUserByEmail(email: string): User | undefined {
  const needle = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === needle);
}

export function orgName(orgId: string): string {
  return ORGS.find((o) => o.id === orgId)?.name ?? "Unknown company";
}
