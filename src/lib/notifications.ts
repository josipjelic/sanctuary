/**
 * Client-side notification scheduling utilities (ADR-004).
 * Wraps expo-notifications and provides fire-date computation for reminders.
 */

export interface ComputeFireDateParams {
  /** The reminder datetime as resolved by the AI and stored in the DB. */
  scheduledAt: Date;
  /**
   * Lead time preference key matching user_preferences `notification_lead_time`.
   * Valid values: '15min' | '30min' | '1hour' | 'morning' | 'at_time'
   */
  leadTime: string;
  /**
   * HH:MM string for morning digest time (from user_preferences `morning_time`).
   * Only used when leadTime === 'morning'. Defaults to '07:30'.
   */
  morningTime?: string;
}

/**
 * Pure function — computes the notification fire time for a given reminder.
 *
 * Lead time semantics:
 * - 'at_time'   → fire at scheduledAt exactly
 * - '15min'     → 15 minutes before scheduledAt
 * - '30min'     → 30 minutes before scheduledAt
 * - '1hour'     → 60 minutes before scheduledAt
 * - 'morning'   → morningTime on the day of scheduledAt;
 *                  if scheduledAt is on or before morningTime that same day,
 *                  use morningTime on the previous day.
 *
 * All date arithmetic treats scheduledAt as a local Date object (no timezone conversion).
 * The caller is responsible for constructing scheduledAt in the appropriate timezone.
 */
export function computeFireDate(params: ComputeFireDateParams): Date {
  const { scheduledAt, leadTime, morningTime = "07:30" } = params;

  if (leadTime === "at_time") {
    return new Date(scheduledAt.getTime());
  }

  if (leadTime === "15min") {
    return new Date(scheduledAt.getTime() - 15 * 60 * 1000);
  }

  if (leadTime === "30min") {
    return new Date(scheduledAt.getTime() - 30 * 60 * 1000);
  }

  if (leadTime === "1hour") {
    return new Date(scheduledAt.getTime() - 60 * 60 * 1000);
  }

  if (leadTime === "morning") {
    const [hourStr, minuteStr] = morningTime.split(":");
    const morningHour = parseInt(hourStr, 10);
    const morningMinute = parseInt(minuteStr, 10);

    // Build a candidate morning Date on the same calendar day as scheduledAt
    const candidate = new Date(scheduledAt.getTime());
    candidate.setHours(morningHour, morningMinute, 0, 0);

    // If scheduledAt is at or before the morning window on the same day,
    // use the morning of the previous day instead.
    if (scheduledAt.getTime() <= candidate.getTime()) {
      candidate.setDate(candidate.getDate() - 1);
    }

    return candidate;
  }

  // Unknown lead time — fall back to scheduledAt
  return new Date(scheduledAt.getTime());
}
