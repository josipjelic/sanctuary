/**
 * Create native calendar events for approved reminders (iOS Calendar / Google Calendar).
 * Notification lead-time preferences do not apply here — the event uses the reminder's scheduled time.
 *
 * Uses the system “new event” UI (`createEventInCalendarAsync`) so the user taps Save in their
 * calendar app. Silent `createEventAsync` was unreliable: iOS 17+ can grant write-only calendar
 * access while Expo still reports permission as denied, and some Android devices fail silent inserts.
 */
import * as Calendar from "expo-calendar";
import { PermissionStatus } from "expo-calendar";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";
import { getIanaTimeZone } from "@/lib/reminderTimeContext";

/** Default event length when the user only has a single point in time (not an interval). */
const EVENT_DURATION_MS = 30 * 60 * 1000;

export type AddReminderToDeviceCalendarResult =
  | {
      ok: true;
      /** Set when the OS reports a concrete event id (iOS after Save). */
      eventId: string | null;
      /**
       * True when we cannot know if the user saved (Android system limitation).
       * Show copy that asks them to confirm they tapped Save.
       */
      saveOutcomeUnknown: boolean;
    }
  | {
      ok: false;
      code: "web" | "denied" | "error";
      message: string;
    };

/** User-facing strings after a successful handoff to the system calendar editor. */
export function addToCalendarSuccessCopy(result: {
  saveOutcomeUnknown: boolean;
}): { title: string; message: string } {
  if (result.saveOutcomeUnknown) {
    return {
      title: "Check your calendar",
      message:
        "If you tapped Save in the calendar screen, the event was added. If you dismissed it without saving, tap Add to calendar again.",
    };
  }
  return {
    title: "Added to calendar",
    message: "You can edit the event anytime in your calendar app.",
  };
}

export async function addReminderToDeviceCalendar(params: {
  title: string;
  scheduledAt: Date;
  notes?: string;
}): Promise<AddReminderToDeviceCalendarResult> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      code: "web",
      message: "Calendar is not available on web.",
    };
  }

  await Calendar.requestCalendarPermissionsAsync();
  const { status } = await Calendar.getCalendarPermissionsAsync();

  const startDate = new Date(params.scheduledAt);
  const endDate = new Date(startDate.getTime() + EVENT_DURATION_MS);
  const title = params.title.trim() || "Reminder";
  const timeZone = getIanaTimeZone();

  const eventData: Omit<Partial<Calendar.Event>, "id" | "organizer"> = {
    title,
    startDate,
    endDate,
    notes: params.notes ?? "",
    timeZone,
  };

  // Pre-select default calendar when Expo reports full access (listing calendars works).
  if (status === PermissionStatus.GRANTED) {
    try {
      eventData.calendarId = await resolveWritableEventCalendarId();
    } catch {
      // Editor still opens; user picks a calendar.
    }
  }

  try {
    const result = await Calendar.createEventInCalendarAsync(
      eventData,
      Platform.OS === "android" ? { startNewActivityTask: false } : undefined,
    );

    if (Platform.OS === "ios") {
      if (result.action === "canceled" || result.action === "deleted") {
        return {
          ok: false,
          code: "error",
          message: "Calendar event was not saved.",
        };
      }
      if (result.action === "saved") {
        return {
          ok: true,
          eventId: result.id,
          saveOutcomeUnknown: false,
        };
      }
    }

    // Android: action is always "done"; the OS does not report save vs cancel reliably.
    return {
      ok: true,
      eventId: result.id,
      saveOutcomeUnknown: Platform.OS === "android",
    };
  } catch (e) {
    logger.warn(
      "addReminderToDeviceCalendar failed",
      e instanceof Error ? e.message : String(e),
    );
    const msg = e instanceof Error ? e.message : "Could not open calendar.";
    const lower = msg.toLowerCase();
    if (
      status !== PermissionStatus.GRANTED &&
      (lower.includes("permission") || lower.includes("calendar"))
    ) {
      return {
        ok: false,
        code: "denied",
        message:
          "Allow calendar access in Settings to add this reminder, or choose full calendar access if your device asks.",
      };
    }
    return { ok: false, code: "error", message: msg };
  }
}

async function resolveWritableEventCalendarId(): Promise<string> {
  if (Platform.OS === "ios") {
    try {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      if (defaultCal.allowsModifications) {
        return defaultCal.id;
      }
    } catch {
      // Fall through to enumerating calendars.
    }
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const primaryWritable = calendars.find(
    (c) => c.allowsModifications && c.isPrimary,
  );
  const writable =
    primaryWritable ?? calendars.find((c) => c.allowsModifications);
  if (!writable) {
    throw new Error("No writable calendar");
  }
  return writable.id;
}
