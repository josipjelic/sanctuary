import {
  buildThoughtPayload,
  buildVoiceThoughtPayload,
  formatDuration,
  validateCaptureText,
} from "./capture";

describe("validateCaptureText", () => {
  it("returns error for empty string", () => {
    expect(validateCaptureText("")).not.toBeNull();
  });

  it("returns error for whitespace-only string", () => {
    expect(validateCaptureText("   ")).not.toBeNull();
  });

  it("returns error for newline-only string", () => {
    expect(validateCaptureText("\n")).not.toBeNull();
  });

  it("returns null for a single character", () => {
    expect(validateCaptureText("a")).toBeNull();
  });

  it("returns null for a normal sentence", () => {
    expect(validateCaptureText("Buy oat milk on the way home.")).toBeNull();
  });

  it("returns null for a very long string", () => {
    expect(validateCaptureText("a".repeat(1000))).toBeNull();
  });
});

describe("buildThoughtPayload", () => {
  const payload = buildThoughtPayload("user-123", "  Hello world  ");

  it("sets correct user_id", () => {
    expect(payload.user_id).toBe("user-123");
  });

  it("trims whitespace from body", () => {
    expect(payload.body).toBe("Hello world");
  });

  it("sets has_audio to false", () => {
    expect(payload.has_audio).toBe(false);
  });

  it("sets transcription_status to none", () => {
    expect(payload.transcription_status).toBe("none");
  });

  it("sets tagging_status to none", () => {
    expect(payload.tagging_status).toBe("none");
  });

  it("sets tags to empty array", () => {
    expect(payload.tags).toEqual([]);
  });

  it("sets body_extended to null", () => {
    expect(payload.body_extended).toBeNull();
  });
});

describe("buildVoiceThoughtPayload", () => {
  const payload = buildVoiceThoughtPayload("user-456");

  it("sets body to empty string", () => {
    expect(payload.body).toBe("");
  });

  it("sets has_audio to true", () => {
    expect(payload.has_audio).toBe(true);
  });

  it("sets transcription_status to pending", () => {
    expect(payload.transcription_status).toBe("pending");
  });

  it("sets tagging_status to none", () => {
    expect(payload.tagging_status).toBe("none");
  });
});

describe("formatDuration", () => {
  it("formats 0 seconds", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats 65 seconds as 01:05", () => {
    expect(formatDuration(65)).toBe("01:05");
  });

  it("formats 3599 seconds as 59:59", () => {
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("pads single digit seconds", () => {
    expect(formatDuration(9)).toBe("00:09");
  });
});
