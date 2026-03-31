/**
 * Unit tests for detect-reminders shared module.
 *
 * Strategy: mock fetch (OpenRouter HTTP) and the Supabase client (passed as DI parameter).
 * The module is pure logic — these tests exercise the parsing, status-update, and insert
 * paths without hitting any live network or database.
 */

import { detectRemindersForThought } from "./detect-reminders";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Supabase client mock with chainable query builder. */
function makeSupabaseMock() {
  const thoughtsUpdateMock = jest.fn().mockReturnValue({ error: null });
  const remindersInsertMock = jest.fn().mockReturnValue({ error: null });

  // Each call to .from() returns a builder for that table.
  const fromMock = jest.fn((table: string) => {
    if (table === "reminders") {
      return {
        insert: remindersInsertMock,
      };
    }
    // Default: thoughts table
    return {
      update: jest.fn().mockReturnValue({
        eq: thoughtsUpdateMock,
      }),
    };
  });

  return {
    from: fromMock,
    _thoughtsUpdateMock: thoughtsUpdateMock,
    _remindersInsertMock: remindersInsertMock,
  };
}

/** Build an OpenRouter-style success response wrapping `content`. */
function makeOrResponse(content: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
    text: () => Promise.resolve(content),
  } as unknown as Response;
}

/** Standard params used across most tests — override individual fields as needed. */
function baseParams(
  overrides: Partial<Parameters<typeof detectRemindersForThought>[0]> = {},
) {
  return {
    userId: "user-uuid-1",
    thoughtId: "thought-uuid-1",
    text: "Call mum next Monday",
    currentIsoTimestamp: "2026-04-01T10:00:00",
    supabaseClient: makeSupabaseMock() as unknown as Parameters<
      typeof detectRemindersForThought
    >[0]["supabaseClient"],
    openRouterApiKey: "test-api-key",
    model: "test/model",
    callerFunction: "detect-reminders",
    ...overrides,
  };
}

// Silence console.debug output produced by the logger during tests.
beforeAll(() => {
  jest.spyOn(console, "debug").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. No reminders found (has_reminder equivalent: empty array)
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — no reminders returned", () => {
  it("does not insert any rows and marks status complete", async () => {
    const orPayload = JSON.stringify({ reminders: [] });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    const params = baseParams({
      supabaseClient: sbMock as unknown as Parameters<
        typeof detectRemindersForThought
      >[0]["supabaseClient"],
    });

    await detectRemindersForThought(params);

    // reminders.insert must NOT have been called
    expect(sbMock._remindersInsertMock).not.toHaveBeenCalled();

    // Final thoughts update should have set status to 'complete'
    const allFromCalls: string[] = sbMock.from.mock.calls.map(
      (c: [string]) => c[0],
    );
    const thoughtsCalls = allFromCalls.filter((t) => t === "thoughts");
    expect(thoughtsCalls.length).toBeGreaterThanOrEqual(2); // pending + complete

    // The last thoughts update arg must be 'complete'
    const lastUpdateCall = sbMock.from.mock.results
      .filter(
        (_: unknown, i: number) => sbMock.from.mock.calls[i][0] === "thoughts",
      )
      .pop();
    expect(lastUpdateCall).toBeDefined();
  });

  it("sets reminder_detection_status to pending then complete", async () => {
    const orPayload = JSON.stringify({ reminders: [] });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const statusSequence: string[] = [];
    // Track every update({ reminder_detection_status }) call
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: jest.fn().mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toEqual(["pending", "complete"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Single reminder returned
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — single reminder", () => {
  it("inserts one inactive row with correct fields", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "Call mum", scheduled_at: "2026-04-07T09:00:00" },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(sbMock._remindersInsertMock).toHaveBeenCalledTimes(1);
    const inserted: Array<Record<string, unknown>> =
      sbMock._remindersInsertMock.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: "user-uuid-1",
      thought_id: "thought-uuid-1",
      extracted_text: "Call mum",
      scheduled_at: "2026-04-07T09:00:00",
      status: "inactive",
    });
  });

  it("marks status complete after successful insert", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "dentist appt", scheduled_at: "2026-04-10T15:00:00" },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const statusSequence: string[] = [];
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: jest.fn().mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toEqual(["pending", "complete"]);
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple reminders returned
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — multiple reminders", () => {
  it("inserts the correct number of rows", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "Call mum", scheduled_at: "2026-04-07T09:00:00" },
        {
          extracted_text: "Dentist Wednesday 3pm",
          scheduled_at: "2026-04-09T15:00:00",
        },
        {
          extracted_text: "Submit report by Friday",
          scheduled_at: "2026-04-11T17:00:00",
        },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(sbMock._remindersInsertMock).toHaveBeenCalledTimes(1);
    const inserted: unknown[] = sbMock._remindersInsertMock.mock.calls[0][0];
    expect(inserted).toHaveLength(3);
  });

  it("all inserted rows have status inactive and correct user/thought ids", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "Meeting", scheduled_at: "2026-04-08T10:00:00" },
        { extracted_text: "Lunch", scheduled_at: "2026-04-09T12:00:00" },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    const inserted: Array<Record<string, unknown>> =
      sbMock._remindersInsertMock.mock.calls[0][0];
    for (const row of inserted) {
      expect(row.status).toBe("inactive");
      expect(row.user_id).toBe("user-uuid-1");
      expect(row.thought_id).toBe("thought-uuid-1");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Malformed JSON from OpenRouter
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — malformed JSON response", () => {
  it("marks status failed and does not insert any rows", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeOrResponse("This is not JSON at all!"));

    const statusSequence: string[] = [];
    const insertMock = jest.fn();
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: insertMock.mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
    expect(statusSequence).not.toContain("complete");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("marks status failed when response JSON missing 'reminders' array", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeOrResponse(
          JSON.stringify({ has_reminder: true, description: "oops" }),
        ),
      );

    const statusSequence: string[] = [];
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: jest.fn().mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
  });

  it("strips code fences and still parses valid JSON", async () => {
    const inner = JSON.stringify({
      reminders: [
        { extracted_text: "Team standup", scheduled_at: "2026-04-08T09:00:00" },
      ],
    });
    // Simulate model wrapping response in markdown code block
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeOrResponse(`\`\`\`json\n${inner}\n\`\`\``));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(sbMock._remindersInsertMock).toHaveBeenCalledTimes(1);
    const inserted: Array<Record<string, unknown>> =
      sbMock._remindersInsertMock.mock.calls[0][0];
    expect(inserted[0].extracted_text).toBe("Team standup");
  });
});

// ---------------------------------------------------------------------------
// 5. OpenRouter HTTP error (non-200)
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — OpenRouter HTTP error", () => {
  it("marks status failed on 500 response and does not insert", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeOrResponse("Internal Server Error", 500));

    const statusSequence: string[] = [];
    const insertMock = jest.fn();
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: insertMock.mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
    expect(statusSequence).not.toContain("complete");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("marks status failed on 401 response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeOrResponse("Unauthorized", 401));

    const statusSequence: string[] = [];
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: jest.fn().mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
  });
});

// ---------------------------------------------------------------------------
// 6. Network error (fetch throws)
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — network error", () => {
  it("marks status failed when fetch throws and does not insert", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network unreachable"));

    const statusSequence: string[] = [];
    const insertMock = jest.fn();
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: insertMock.mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Reminder row items with missing / invalid fields are skipped
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — partial/invalid reminder items", () => {
  it("skips items with empty extracted_text", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "", scheduled_at: "2026-04-07T09:00:00" },
        {
          extracted_text: "Valid reminder",
          scheduled_at: "2026-04-08T10:00:00",
        },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(sbMock._remindersInsertMock).toHaveBeenCalledTimes(1);
    const inserted: Array<Record<string, unknown>> =
      sbMock._remindersInsertMock.mock.calls[0][0];
    // Only the valid item should be inserted
    expect(inserted).toHaveLength(1);
    expect(inserted[0].extracted_text).toBe("Valid reminder");
  });

  it("skips items with non-parseable scheduled_at", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "Bad date", scheduled_at: "not-a-date" },
        {
          extracted_text: "Good reminder",
          scheduled_at: "2026-04-09T12:00:00",
        },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const sbMock = makeSupabaseMock();
    await detectRemindersForThought(
      baseParams({
        supabaseClient: sbMock as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    const inserted: Array<Record<string, unknown>> =
      sbMock._remindersInsertMock.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].extracted_text).toBe("Good reminder");
  });

  it("does not insert when all items are invalid — marks complete (not failed)", async () => {
    // All items are skipped by the parser — the result is an empty valid array
    const orPayload = JSON.stringify({
      reminders: [{ extracted_text: "", scheduled_at: "not-a-date" }],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const statusSequence: string[] = [];
    const insertMock = jest.fn();
    const fromMock = jest.fn((table: string) => {
      if (table === "thoughts") {
        return {
          update: (data: Record<string, unknown>) => {
            if (typeof data.reminder_detection_status === "string") {
              statusSequence.push(data.reminder_detection_status);
            }
            return { eq: jest.fn().mockReturnValue({ error: null }) };
          },
        };
      }
      return { insert: insertMock.mockReturnValue({ error: null }) };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    // Parser filtered all out → empty array → no insert, status = complete
    expect(insertMock).not.toHaveBeenCalled();
    expect(statusSequence).toContain("complete");
    expect(statusSequence).not.toContain("failed");
  });
});

// ---------------------------------------------------------------------------
// 8. Supabase insert error
// ---------------------------------------------------------------------------

describe("detectRemindersForThought — DB insert error", () => {
  it("marks status failed when insert returns an error", async () => {
    const orPayload = JSON.stringify({
      reminders: [
        { extracted_text: "Call dentist", scheduled_at: "2026-04-10T14:00:00" },
      ],
    });
    global.fetch = jest.fn().mockResolvedValueOnce(makeOrResponse(orPayload));

    const statusSequence: string[] = [];
    const fromMock = jest.fn((table: string) => {
      if (table === "reminders") {
        return {
          insert: jest
            .fn()
            .mockReturnValue({ error: { message: "unique constraint" } }),
        };
      }
      return {
        update: (data: Record<string, unknown>) => {
          if (typeof data.reminder_detection_status === "string") {
            statusSequence.push(data.reminder_detection_status);
          }
          return { eq: jest.fn().mockReturnValue({ error: null }) };
        },
      };
    });

    await detectRemindersForThought(
      baseParams({
        supabaseClient: { from: fromMock } as unknown as Parameters<
          typeof detectRemindersForThought
        >[0]["supabaseClient"],
      }),
    );

    expect(statusSequence).toContain("failed");
    expect(statusSequence).not.toContain("complete");
  });
});
