/**
 * Unit tests for notifications.ts utilities:
 *  - computeFireDate: pure date arithmetic, no mocks required
 *  - scheduleEveningJournalReminder / cancelEveningJournalReminder /
 *    rescheduleEveningJournalReminder: mock expo-notifications module
 *
 * Test cases are grounded in the lead-time semantics documented in
 * notifications.ts, ADR-004, and the ADR-006 evening reminder spec.
 */

// ---------------------------------------------------------------------------
// Module mock for expo-notifications — must be at file top (Jest hoists it)
// The dynamic import() in loadNotificationsModule() is intercepted here.
// ---------------------------------------------------------------------------

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    DATE: "date",
    DAILY: "daily",
  },
  scheduleNotificationAsync: jest.fn().mockResolvedValue("test-notification-id"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
}));

import {
  type LeadTime,
  cancelEveningJournalReminder,
  computeFireDate,
  rescheduleEveningJournalReminder,
  scheduleEveningJournalReminder,
} from "./notifications";

// Helper: create a Date from a local-style ISO string without timezone shift.
// new Date("2026-04-06T14:00:00") is parsed as local time by V8 when no Z/offset is given.
function local(isoNoTz: string): Date {
  return new Date(isoNoTz);
}

describe("computeFireDate", () => {
  // ---------------------------------------------------------------------------
  // at_time — fire exactly at scheduledAt
  // ---------------------------------------------------------------------------

  it("at_time returns scheduledAt unchanged", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "at_time" });
    expect(result.getTime()).toBe(scheduledAt.getTime());
  });

  it("at_time returns a new Date instance (not the same reference)", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "at_time" });
    expect(result).not.toBe(scheduledAt);
  });

  // ---------------------------------------------------------------------------
  // 15min — 15 minutes before scheduledAt
  // ---------------------------------------------------------------------------

  it("15min returns 15 minutes before scheduledAt", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "15min" });
    const expected = local("2026-04-06T13:45:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("15min handles scheduling that crosses hour boundary", () => {
    const scheduledAt = local("2026-04-06T09:10:00");
    const result = computeFireDate({ scheduledAt, leadTime: "15min" });
    const expected = local("2026-04-06T08:55:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  // ---------------------------------------------------------------------------
  // 30min — 30 minutes before scheduledAt
  // ---------------------------------------------------------------------------

  it("30min returns 30 minutes before scheduledAt", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "30min" });
    const expected = local("2026-04-06T13:30:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("30min handles scheduling that crosses midnight", () => {
    const scheduledAt = local("2026-04-07T00:20:00");
    const result = computeFireDate({ scheduledAt, leadTime: "30min" });
    const expected = local("2026-04-06T23:50:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  // ---------------------------------------------------------------------------
  // 1hour — 60 minutes before scheduledAt
  // ---------------------------------------------------------------------------

  it("1hour returns 60 minutes before scheduledAt", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "1hour" });
    const expected = local("2026-04-06T13:00:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("1hour handles scheduling that crosses day boundary", () => {
    const scheduledAt = local("2026-04-07T00:30:00");
    const result = computeFireDate({ scheduledAt, leadTime: "1hour" });
    const expected = local("2026-04-06T23:30:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  // ---------------------------------------------------------------------------
  // morning — morningTime on the day of scheduledAt
  // (or the day before if scheduledAt is at or before morningTime that day)
  // ---------------------------------------------------------------------------

  it("morning returns morningTime on the same day as scheduledAt", () => {
    // scheduledAt 14:00 is after morning window 07:30 → fire that morning
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({
      scheduledAt,
      leadTime: "morning",
      morningTime: "07:30",
    });
    // Expected: 2026-04-06T07:30:00 local
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // April = 3 (0-indexed)
    expect(result.getDate()).toBe(6);
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });

  it("morning returns morningTime on the previous day when scheduledAt is before morning window", () => {
    // scheduledAt 06:00 is before morning window 07:30 on the same day
    // → fire at morningTime the day before (2026-04-05T07:30)
    const scheduledAt = local("2026-04-06T06:00:00");
    const result = computeFireDate({
      scheduledAt,
      leadTime: "morning",
      morningTime: "07:30",
    });
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(5); // day before
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(30);
  });

  it("morning uses default morningTime of 07:30 when not supplied", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({ scheduledAt, leadTime: "morning" });
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(30);
    expect(result.getDate()).toBe(6);
  });

  it("morning with scheduledAt exactly equal to morningTime uses the previous day", () => {
    // Edge case: scheduledAt IS morning time — should notify the morning before
    const scheduledAt = local("2026-04-06T07:30:00");
    const result = computeFireDate({
      scheduledAt,
      leadTime: "morning",
      morningTime: "07:30",
    });
    expect(result.getDate()).toBe(5); // previous day
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(30);
  });

  it("morning with custom morningTime (08:00) fires at 08:00 same day for afternoon event", () => {
    const scheduledAt = local("2026-04-06T15:00:00");
    const result = computeFireDate({
      scheduledAt,
      leadTime: "morning",
      morningTime: "08:00",
    });
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(6);
  });

  // ---------------------------------------------------------------------------
  // Unknown lead time — graceful fallback to scheduledAt
  // ---------------------------------------------------------------------------

  it("unknown lead time falls back to scheduledAt", () => {
    const scheduledAt = local("2026-04-06T14:00:00");
    const result = computeFireDate({
      scheduledAt,
      // Exercise `default` branch — value is not a valid stored preference
      leadTime: "unknown" as LeadTime,
    });
    expect(result.getTime()).toBe(scheduledAt.getTime());
  });
});

// ---------------------------------------------------------------------------
// scheduleEveningJournalReminder
// ---------------------------------------------------------------------------

describe("scheduleEveningJournalReminder", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls scheduleNotificationAsync with DAILY trigger and correct hour/minute", async () => {
    const id = await scheduleEveningJournalReminder("21:00");

    const { scheduleNotificationAsync, SchedulableTriggerInputTypes } =
      jest.requireMock<{
        scheduleNotificationAsync: jest.Mock;
        SchedulableTriggerInputTypes: { DAILY: string };
      }>("expo-notifications");

    expect(id).toBe("test-notification-id");
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: 21,
          minute: 0,
        },
      }),
    );
  });

  it("returns the notification id from scheduleNotificationAsync", async () => {
    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");
    scheduleNotificationAsync.mockResolvedValueOnce("evening-notif-abc");

    const id = await scheduleEveningJournalReminder("20:30");
    expect(id).toBe("evening-notif-abc");
  });

  it("parses '09:05' correctly → hour 9, minute 5 (no octal parseInt bug)", async () => {
    await scheduleEveningJournalReminder("09:05");

    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    const callArg = scheduleNotificationAsync.mock.calls[0][0] as {
      trigger: { hour: number; minute: number };
    };
    expect(callArg.trigger.hour).toBe(9);
    expect(callArg.trigger.minute).toBe(5);
  });

  it("parses '21:00' correctly → hour 21, minute 0", async () => {
    await scheduleEveningJournalReminder("21:00");

    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    const callArg = scheduleNotificationAsync.mock.calls[0][0] as {
      trigger: { hour: number; minute: number };
    };
    expect(callArg.trigger.hour).toBe(21);
    expect(callArg.trigger.minute).toBe(0);
  });

  it("uses the correct notification title and body", async () => {
    await scheduleEveningJournalReminder("21:00");

    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    const callArg = scheduleNotificationAsync.mock.calls[0][0] as {
      content: { title: string; body: string };
    };
    expect(callArg.content.title).toBe("Time to reflect ✨");
    expect(callArg.content.body).toContain("journal");
  });
});

// ---------------------------------------------------------------------------
// cancelEveningJournalReminder
// ---------------------------------------------------------------------------

describe("cancelEveningJournalReminder", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls cancelScheduledNotificationAsync with the provided id", async () => {
    await cancelEveningJournalReminder("notif-id-xyz");

    const { cancelScheduledNotificationAsync } = jest.requireMock<{
      cancelScheduledNotificationAsync: jest.Mock;
    }>("expo-notifications");

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-id-xyz");
  });

  it("calls cancelScheduledNotificationAsync with the exact id passed", async () => {
    await cancelEveningJournalReminder("specific-id-42");

    const { cancelScheduledNotificationAsync } = jest.requireMock<{
      cancelScheduledNotificationAsync: jest.Mock;
    }>("expo-notifications");

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("specific-id-42");
  });
});

// ---------------------------------------------------------------------------
// rescheduleEveningJournalReminder
// ---------------------------------------------------------------------------

describe("rescheduleEveningJournalReminder", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cancels the old notification and schedules a new one", async () => {
    const newId = await rescheduleEveningJournalReminder("old-notif-id", "22:00");

    const {
      cancelScheduledNotificationAsync,
      scheduleNotificationAsync,
    } = jest.requireMock<{
      cancelScheduledNotificationAsync: jest.Mock;
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-notif-id");
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(newId).toBe("test-notification-id");
  });

  it("schedules the new notification at the correct time", async () => {
    await rescheduleEveningJournalReminder("old-id", "08:15");

    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    const callArg = scheduleNotificationAsync.mock.calls[0][0] as {
      trigger: { hour: number; minute: number };
    };
    expect(callArg.trigger.hour).toBe(8);
    expect(callArg.trigger.minute).toBe(15);
  });

  it("skips cancel when oldId is null and still schedules new notification", async () => {
    const newId = await rescheduleEveningJournalReminder(null, "21:00");

    const {
      cancelScheduledNotificationAsync,
      scheduleNotificationAsync,
    } = jest.requireMock<{
      cancelScheduledNotificationAsync: jest.Mock;
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");

    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(newId).toBe("test-notification-id");
  });

  it("returns the new notification id", async () => {
    const { scheduleNotificationAsync } = jest.requireMock<{
      scheduleNotificationAsync: jest.Mock;
    }>("expo-notifications");
    scheduleNotificationAsync.mockResolvedValueOnce("new-evening-id-99");

    const id = await rescheduleEveningJournalReminder("old-id", "21:00");
    expect(id).toBe("new-evening-id-99");
  });
});
