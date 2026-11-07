import "server-only";
import { buildSeed, type DemoDb } from "@/lib/data/seed";

/**
 * DEMO STORE: an in-memory copy of the database, seeded from seed.ts, living for as long as the
 * server process. Changes are lost on restart. It exists so the admin screens work before
 * Supabase is connected; lib/data/queries.ts and mutations.ts are the only callers, and the
 * Supabase data layer replaces this file. Kept on globalThis so dev hot reloads keep the data.
 */

const KEY = Symbol.for("clearance.demoDb");
type GlobalWithDb = typeof globalThis & { [KEY]?: DemoDb };

export function db(): DemoDb {
  const g = globalThis as GlobalWithDb;
  g[KEY] ??= buildSeed();
  return g[KEY];
}

/** Test helper: start again from the seed. */
export function resetDb(nowMs?: number): DemoDb {
  const g = globalThis as GlobalWithDb;
  g[KEY] = buildSeed(nowMs);
  return g[KEY];
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
