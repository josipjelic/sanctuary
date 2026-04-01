import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

/** Remote push + auto token registration are unavailable in Expo Go on Android (SDK 53+). */
const isExpoGoAndroid = isRunningInExpoGo() && Platform.OS === "android";

type NotificationsModule = typeof import("expo-notifications");

let notificationsLoad: Promise<NotificationsModule | null> | null = null;

/**
 * Loads expo-notifications and registers the foreground handler. Skipped on
 * Expo Go Android so the module (and its side effects) are never imported there.
 */
function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (isExpoGoAndroid) return Promise.resolve(null);
  if (!notificationsLoad) {
    notificationsLoad = import("expo-notifications").then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      return Notifications;
    });
  }
  return notificationsLoad;
}

/** Register foreground notification behavior; call once from root layout (not at module scope — Jest cannot load dynamic import there). */
export function prefetchNotificationHandler(): void {
  if (!isExpoGoAndroid) void loadNotificationsModule();
}

/** Request notification permission from the OS. Returns true when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule a local notification.
 * @returns Expo notification identifier — persist this to cancel/reschedule.
 */
export async function scheduleReminder(params: {
  title: string;
  body: string;
  fireDate: Date;
}): Promise<string> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    throw new Error(
      "Local notifications are not available in Expo Go on Android. Use a development build.",
    );
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.fireDate,
    },
  });
  return id;
}

/** Cancel a previously scheduled notification by its identifier. */
export async function cancelReminder(notificationId: string): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export type LeadTime = "at_time" | "15min" | "30min" | "1hour" | "morning";

/**
 * Compute the local Date at which a notification should fire.
 *
 * - "at_time" -> fire exactly at scheduled_at
 * - "15min"   -> fire 15 minutes before scheduled_at
 * - "30min"   -> fire 30 minutes before scheduled_at
 * - "1hour"   -> fire 1 hour before scheduled_at
 * - "morning" -> fire at morningTime on the calendar day of scheduled_at.
 *                If scheduled_at is earlier in the day than morningTime, fire
 *                at morningTime on the day BEFORE so the user gets advance warning.
 */
export function computeFireDate(params: {
  scheduledAt: Date;
  leadTime: LeadTime;
  morningTime?: string; // "HH:MM", defaults to "07:30"
}): Date {
  const { scheduledAt, leadTime, morningTime = "07:30" } = params;

  switch (leadTime) {
    case "at_time":
      return new Date(scheduledAt);

    case "15min": {
      const d = new Date(scheduledAt);
      d.setMinutes(d.getMinutes() - 15);
      return d;
    }

    case "30min": {
      const d = new Date(scheduledAt);
      d.setMinutes(d.getMinutes() - 30);
      return d;
    }

    case "1hour": {
      const d = new Date(scheduledAt);
      d.setHours(d.getHours() - 1);
      return d;
    }

    case "morning": {
      const [hourStr, minuteStr] = morningTime.split(":");
      const hour = Number.parseInt(hourStr, 10);
      const minute = Number.parseInt(minuteStr, 10);

      // Start with morning time on the same calendar day as scheduledAt
      const candidate = new Date(scheduledAt);
      candidate.setHours(hour, minute, 0, 0);

      // If scheduledAt is before morningTime on that day, move to day-before morning
      if (scheduledAt <= candidate) {
        candidate.setDate(candidate.getDate() - 1);
      }
      return candidate;
    }

    default:
      return new Date(scheduledAt);
  }
}

/** Labels for the lead-time options shown in Settings. */
export const LEAD_TIME_OPTIONS: { value: LeadTime; label: string }[] = [
  { value: "at_time", label: "At the time" },
  { value: "15min", label: "15 minutes before" },
  { value: "30min", label: "30 minutes before" },
  { value: "1hour", label: "1 hour before" },
  { value: "morning", label: "In the morning" },
];

export function labelForLeadTime(value: LeadTime): string {
  return (
    LEAD_TIME_OPTIONS.find((o) => o.value === value)?.label ??
    "15 minutes before"
  );
}
