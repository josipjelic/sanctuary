import { normalizeReminderScheduledAt } from "./reminder-scheduled-at-normalize";

describe("normalizeReminderScheduledAt", () => {
  it("returns unchanged when IANA timezone is missing", () => {
    expect(
      normalizeReminderScheduledAt("2026-03-31T14:00:00.374Z", undefined),
    ).toBe("2026-03-31T14:00:00.374Z");
  });

  it("reinterprets Z as local wall time in Europe/Zagreb (CEST → UTC)", () => {
    // 2026-03-31 is after EU DST start (last Sunday of March); Zagreb is UTC+2.
    const out = normalizeReminderScheduledAt(
      "2026-03-31T14:00:00.374Z",
      "Europe/Zagreb",
    );
    expect(out).toBe("2026-03-31T12:00:00.374Z");
  });

  it("reinterprets +00:00 like Z", () => {
    const out = normalizeReminderScheduledAt(
      "2026-03-31T14:00:00.374+00:00",
      "Europe/Zagreb",
    );
    expect(out).toBe("2026-03-31T12:00:00.374Z");
  });

  it("reinterprets +0000 like Z", () => {
    const out = normalizeReminderScheduledAt(
      "2026-03-31T14:00:00.374+0000",
      "Europe/Zagreb",
    );
    expect(out).toBe("2026-03-31T12:00:00.374Z");
  });

  it("does not change timestamps with a non-zero offset (instant already correct)", () => {
    const iso = "2026-03-31T14:00:00.374+02:00";
    expect(normalizeReminderScheduledAt(iso, "Europe/Zagreb")).toBe(iso);
  });

  it("uses CET offset in winter for Zagreb", () => {
    const out = normalizeReminderScheduledAt(
      "2026-01-15T14:00:00Z",
      "Europe/Zagreb",
    );
    expect(out).toBe("2026-01-15T13:00:00.000Z");
  });
});
