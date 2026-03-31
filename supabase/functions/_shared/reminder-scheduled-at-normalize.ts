/**
 * Models often return the user's intended *local* wall time with a Z or ±00:00 suffix
 * (e.g. "2pm tomorrow" → `2026-03-31T14:00:00Z`), which Postgres stores as 14:00 UTC
 * instead of 14:00 in Europe/Zagreb. When we have IANA tz, reinterpret those as civil
 * time in that zone. Non-zero offsets are left as-is (instant already anchored).
 */
import { DateTime } from "https://esm.sh/luxon@3.5.0";

/** Z, +00:00, -00:00, +0000, etc. — model used UTC while meaning local wall time. */
const UTC_STYLE_OFFSET =
  /^(?<wall>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?<frac>\.\d+)?(?<off>Z|[+-](?:00:?00|0000))$/i;

export function normalizeReminderScheduledAt(
  scheduledAt: string,
  ianaTimezone: string | undefined,
): string {
  const trimmed = scheduledAt.trim();
  if (!ianaTimezone) return trimmed;

  const m = trimmed.match(UTC_STYLE_OFFSET);
  if (!m?.groups?.wall) return trimmed;

  const wall = m.groups.wall + (m.groups.frac ?? "");
  const dt = DateTime.fromISO(wall, { zone: ianaTimezone });
  if (!dt.isValid) return trimmed;

  const utcIso = dt.toUTC().toISO();
  return utcIso ?? trimmed;
}
