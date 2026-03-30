import {
  formatLocalIsoWithOffset,
  getIanaTimeZone,
} from "./reminderTimeContext";

describe("reminderTimeContext", () => {
  it("getIanaTimeZone returns a non-empty string", () => {
    expect(getIanaTimeZone().length).toBeGreaterThan(0);
  });

  it("formatLocalIsoWithOffset produces ISO-like string with numeric offset", () => {
    const s = formatLocalIsoWithOffset(new Date(2026, 2, 30, 14, 5, 9));
    expect(s).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
  });
});
