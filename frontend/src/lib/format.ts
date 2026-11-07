/** Dates in the company's timezone (designPRD 4.1). Pure; safe on server and client. */

/**
 * The request's clock. Server components render once per request (pages here are dynamic: they
 * read the session cookie first), so reading the time during render is intended there.
 */
export function requestTime(): number {
  return Date.now();
}

export function formatDate(iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** "in 3 days", "2 hours ago". */
export function relative(iso: string, nowMs: number = Date.now()): string {
  const diff = Date.parse(iso) - nowMs;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  return "just now";
}

/** Value for <input type="datetime-local"> in a timezone. */
export function toLocalInput(iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Offset of a timezone at a moment, in minutes (positive east of UTC). */
function offsetMinutes(timeZone: string, at: Date): number {
  const local = toLocalInput(at.toISOString(), timeZone);
  return Math.round((Date.parse(`${local}:00Z`) - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** A datetime-local value typed in `timeZone` -> ISO (UTC). */
export function fromLocalInput(value: string, timeZone = "UTC"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = Date.parse(`${value}:00Z`);
  const offset = offsetMinutes(timeZone, new Date(asUtc));
  return new Date(asUtc - offset * 60_000).toISOString();
}

export function percent(ratio: number | null): string {
  return ratio === null ? "N/A" : `${Math.round(ratio * 100)}%`;
}

export function hours(h: number | null): string {
  if (h === null) return "N/A";
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`;
}
