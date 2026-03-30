/**
 * Create native calendar events for approved reminders (iOS Calendar / Google Calendar).
 * Notification lead-time preferences do not apply here — the event uses the reminder's scheduled time.
 */
import * as Calendar from "expo-calendar";
import { PermissionStatus } from "expo-calendar";
import { Platform } from "react-native";

import { getIanaTimeZone } from "@/lib/reminderTimeContext";

/** Default event length when the user only has a single point in time (not an interval). */
const EVENT_DURATION_MS = 30 * 60 * 1000;

export type AddReminderToDeviceCalendarResult =
  | { ok: true; eventId: string }
  | {
      ok: false;
      code: "web" | "denied" | "unavailable" | "error";
      message: string;
    };

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

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== PermissionStatus.GRANTED) {
    return {
      ok: false,
      code: "denied",
      message: "Calendar access was not granted.",
    };
  }

  let calendarId: string;
  try {
    calendarId = await resolveWritableEventCalendarId();
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "No calendar available to add events.",
    };
  }

  const startDate = new Date(params.scheduledAt);
  const endDate = new Date(startDate.getTime() + EVENT_DURATION_MS);
  const title = params.title.trim() || "Reminder";
  const timeZone = getIanaTimeZone();

  try {
    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate,
      endDate,
      notes: params.notes ?? "",
      timeZone,
      alarms: [{ relativeOffset: 0 }],
    });
    return { ok: true, eventId };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create calendar event.";
    return { ok: false, code: "error", message };
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
      // Fall through to enumerating calendars (e.g. unexpected native errors).
    }
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const writable = calendars.find((c) => c.allowsModifications);
  if (!writable) {
    throw new Error("No writable calendar");
  }
  return writable.id;
}
