/**
 * Unit tests for computeFireDate — pure date arithmetic, no mocks required.
 * Each test case is grounded in the lead-time semantics documented in notifications.ts
 * and in the Reminders Subsystem spec (ARCHITECTURE.md / ADR-004).
 */

import { type LeadTime, computeFireDate } from "./notifications";

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
