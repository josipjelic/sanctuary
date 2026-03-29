import {
  finalizeLogLine,
  logAiError,
  logAiInfo,
  sanitizeOpenRouterRequestForLog,
  truncateForLog,
  truncateJsonForLog,
} from "./ai-log";

describe("sanitizeOpenRouterRequestForLog", () => {
  it("replaces input_audio base64 with a length placeholder", () => {
    const body = {
      model: "x/y",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "hello" },
            {
              type: "input_audio",
              input_audio: { data: "QUJDRDEyMzQ=", format: "aac" },
            },
          ],
        },
      ],
    };
    const out = sanitizeOpenRouterRequestForLog(body) as {
      messages: Array<{ content: Array<{ input_audio?: { data: string } }> }>;
    };
    const audioPart = out.messages[0].content[1];
    expect(audioPart.input_audio?.data).toBe(
      "[omitted base64, length=12 chars]",
    );
    expect(JSON.stringify(out)).not.toContain("QUJDRDEyMzQ=");
  });
});

describe("truncateJsonForLog", () => {
  it("returns short JSON unchanged when under default max", () => {
    const s = JSON.stringify({ a: 1 });
    expect(truncateJsonForLog(s)).toBe(s);
  });

  it("truncates very long JSON with marker", () => {
    const inner = "z".repeat(70_000);
    const s = JSON.stringify({ blob: inner });
    const out = truncateJsonForLog(s);
    expect(out.length).toBeLessThan(s.length);
    expect(out).toMatch(/truncated json len=/);
  });
});

describe("finalizeLogLine (Supabase 10k cap)", () => {
  it("keeps total line under 10000 chars when openrouter_request object is huge", () => {
    const line = finalizeLogLine({
      event: "ai.request.start",
      function: "assign-topics",
      phase: "topics",
      model: "m",
      thought_id: "t1",
      user_id: "u1",
      openrouter_request: { blob: "x".repeat(50_000) },
      request_summary: { n: 1 },
    });
    expect(line.length).toBeLessThanOrEqual(10_000);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.openrouter_request).toBeDefined();
  });

  it("embeds openrouter_request as nested object (not a string of JSON)", () => {
    const inner = { model: "m", messages: [{ role: "user", content: "hi" }] };
    const line = finalizeLogLine({
      event: "ai.request.start",
      function: "assign-topics",
      phase: "topics",
      openrouter_request: inner,
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.openrouter_request).toEqual(inner);
    expect(typeof parsed.openrouter_request).toBe("object");
  });
});

describe("truncateForLog", () => {
  it("trims surrounding whitespace", () => {
    expect(truncateForLog("  hello  ")).toBe("hello");
  });

  it("returns the string unchanged when within default max (240)", () => {
    const s = "a".repeat(240);
    expect(truncateForLog(s)).toBe(s);
  });

  it("appends ellipsis and original length when longer than max", () => {
    const s = "x".repeat(300);
    const out = truncateForLog(s, 50);
    expect(out).toMatch(/^x{50}…\[len=300\]$/);
  });

  it("uses default max 240 when omitted", () => {
    const s = "y".repeat(500);
    const out = truncateForLog(s);
    expect(out.startsWith("y".repeat(240))).toBe(true);
    expect(out.endsWith("…[len=500]")).toBe(true);
  });

  it("does not embed characters from beyond the slice in the preview", () => {
    const prefix = "A".repeat(100);
    const uniqueTail = "UNIQUE_TAIL_MARKER_SHOULD_NOT_APPEAR";
    const s = `${prefix}${uniqueTail}`;
    const out = truncateForLog(s, 100);
    expect(out).not.toContain(uniqueTail);
    expect(out).toContain("…[len=");
    expect(out.length).toBeLessThan(s.length);
  });

  it("bounds output length for very large input", () => {
    const s = "z".repeat(50_000);
    const maxChars = 240;
    const out = truncateForLog(s, maxChars);
    // preview + ellipsis + [len=50000] — must stay far below full string size
    expect(out.length).toBeLessThan(400);
    expect(out).toMatch(/\[len=50000\]$/);
  });
});

describe("logAiInfo / logAiError", () => {
  const basePayload = {
    event: "ai.request.start" as const,
    function: "transcribe",
    phase: "transcribe" as const,
    model: "test/model",
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logAiInfo writes one JSON-parseable object per line to console.debug", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});

    logAiInfo({
      ...basePayload,
      thought_id: "t-1",
      request_summary: { foo: 1 },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toMatch(/\n/);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.log_level).toBe("debug");
    expect(typeof parsed.log_summary).toBe("string");
    expect(parsed.log_summary).toContain("[sanctuary-ai]");
    expect(parsed).toMatchObject({
      event: "ai.request.start",
      function: "transcribe",
      phase: "transcribe",
      model: "test/model",
      thought_id: "t-1",
      request_summary: { foo: 1 },
    });
  });

  it("logAiError writes one JSON-parseable object to console.debug", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});

    logAiError({
      ...basePayload,
      event: "ai.error",
      error: { message: "boom", http_status: 502, kind: "upstream" },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toMatch(/\n/);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.log_level).toBe("debug");
    expect(parsed).toMatchObject({
      event: "ai.error",
      function: "transcribe",
      phase: "transcribe",
    });
    expect(parsed.error).toEqual({
      message: "boom",
      http_status: 502,
      kind: "upstream",
    });
  });

  it("omits optional keys when undefined", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});

    logAiInfo({
      event: "ai.response.complete",
      function: "assign-topics",
      phase: "topics",
    });

    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      ["event", "function", "log_level", "log_summary", "phase"].sort(),
    );
    expect(parsed).not.toHaveProperty("model");
  });

  it("does not log full huge request_summary when caller uses truncateForLog", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});
    const huge = "h".repeat(10_000);
    const summary = truncateForLog(huge, 240);

    logAiInfo({
      ...basePayload,
      request_summary: summary,
    });

    const line = spy.mock.calls[0][0] as string;
    expect(line.length).toBeLessThan(2000);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(typeof parsed.request_summary).toBe("string");
    expect((parsed.request_summary as string).length).toBeLessThan(500);
    expect(parsed.request_summary).not.toContain("h".repeat(500));
  });

  it("does not log full huge response_summary when caller uses truncateForLog", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});
    const huge = "r".repeat(8_000);
    const summary = truncateForLog(huge, 100);

    logAiInfo({
      event: "ai.response.complete",
      function: "assign-topics",
      phase: "topics",
      response_summary: summary,
    });

    const line = spy.mock.calls[0][0] as string;
    expect(line.length).toBeLessThan(1500);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect((parsed.response_summary as string).length).toBeLessThan(200);
    expect(parsed.response_summary).not.toContain("r".repeat(200));
  });
});
