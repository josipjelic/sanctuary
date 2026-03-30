/**
 * Values sent with capture / assign-topics / transcribe so reminder extraction
 * uses the user's actual timezone (edge functions run in UTC).
 */

/** `YYYY-MM-DDTHH:mm:ss±HH:mm` in the device's local timezone. */
export function formatLocalIsoWithOffset(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

export function getIanaTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

export function getReminderTimeContext(): {
  ianaTimezone: string;
  currentLocalIso: string;
} {
  const now = new Date();
  return {
    ianaTimezone: getIanaTimeZone(),
    currentLocalIso: formatLocalIsoWithOffset(now),
  };
}
