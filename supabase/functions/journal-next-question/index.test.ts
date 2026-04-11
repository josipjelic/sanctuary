/**
 * Unit tests for the journal-next-question edge function handler.
 *
 * Strategy: capture the Deno.serve handler before module load, then test it
 * by constructing Request objects directly. Supabase createClient and global
 * fetch are mocked — no live network or database calls.
 *
 * Key behaviours verified (ADR-006 Decision 1):
 *  - Turn 0: returns JOURNAL_OPENING_QUESTION_V1 with no OpenRouter call
 *  - 3-turn cap: returns { done: true } unconditionally when turns.length >= 3
 *  - Authentication: missing Authorization header → 401
 *  - Session ownership: unknown / wrong-user session → 403
 */

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any require() of the module under test
// ---------------------------------------------------------------------------

jest.mock("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// Global Deno stub — set before the module is loaded so Deno.serve works
// ---------------------------------------------------------------------------

type Handler = (req: Request) => Promise<Response>;

let handler: Handler;

const testEnv: Record<string, string | undefined> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  OPENROUTER_API_KEY: "test-openrouter-key",
};

(global as Record<string, unknown>).Deno = {
  serve: (fn: Handler) => {
    handler = fn;
  },
  env: {
    get: (key: string) => testEnv[key],
  },
};

// ---------------------------------------------------------------------------
// Load the module under test — this triggers Deno.serve, capturing the handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./index");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JOURNAL_OPENING_QUESTION_V1 =
  "Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?";

const TEST_USER_ID = "user-uuid-test";
const TEST_SESSION_ID = "session-uuid-test";

interface Turn {
  turn_index: number;
  question: string;
  answer: string;
}

/** Build a POST Request with optional Authorization header and JSON body. */
function makeRequest(
  body: unknown,
  options: { auth?: string | null } = {},
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth !== null) {
    headers["Authorization"] = options.auth ?? "Bearer test-jwt";
  }
  return new Request("https://example.com/journal-next-question", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Build a chainable Supabase query builder that resolves to `result`. */
function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "order", "update", "upsert"]) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  return chain;
}

/**
 * Build a minimal mock Supabase client.
 *
 * `fromMap` keys are table names; values are the resolved query result for
 * that table. When the same table is queried multiple times, entries are
 * consumed in order (first call → first entry).
 */
function makeMockSupabaseClient(
  getUserResult: { data: { user: { id: string } | null }; error: unknown },
  fromMap: Record<string, unknown[]>,
) {
  const callCounters: Record<string, number> = {};

  const from = jest.fn((table: string) => {
    callCounters[table] = (callCounters[table] ?? 0);
    const results = fromMap[table] ?? [{ data: null, error: null }];
    const idx = callCounters[table];
    callCounters[table]++;
    return makeQueryChain(results[idx] ?? { data: null, error: null });
  });

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue(getUserResult),
    },
    from,
  };
}

const { createClient } = jest.requireMock<{
  createClient: jest.Mock;
}>("@supabase/supabase-js");

// Silence logger output during tests
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
// 1. OPTIONS pre-flight
// ---------------------------------------------------------------------------

describe("journal-next-question — OPTIONS", () => {
  it("returns 200 ok for OPTIONS requests", async () => {
    const req = new Request("https://example.com/journal-next-question", {
      method: "OPTIONS",
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 2. Authentication — missing or invalid JWT
// ---------------------------------------------------------------------------

describe("journal-next-question — authentication", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const req = makeRequest(
      { session_id: TEST_SESSION_ID, turns: [] },
      { auth: null },
    );
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when supabase.auth.getUser() returns an error", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: null }, error: new Error("invalid token") },
        {},
      ),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: [] });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when supabase.auth.getUser() returns null user", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({ data: { user: null }, error: null }, {}),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: [] });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 3. Session ownership — session not found → 403
// ---------------------------------------------------------------------------

describe("journal-next-question — session ownership", () => {
  it("returns 403 when session_id belongs to a different user (not found via RLS)", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          // journal_sessions: no row found (RLS hides other user's sessions)
          journal_sessions: [{ data: null, error: null }],
        },
      ),
    );

    const req = makeRequest({ session_id: "other-user-session-id", turns: [] });
    const res = await handler(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session not found");
  });
});

// ---------------------------------------------------------------------------
// 4. Turn 0 — opening question (no OpenRouter call)
// ---------------------------------------------------------------------------

describe("journal-next-question — turn 0 (opening question)", () => {
  it("returns JOURNAL_OPENING_QUESTION_V1 with turn_index 0 when turns is empty", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
        },
      ),
    );

    global.fetch = jest.fn();

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: [] });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { question: string; turn_index: number };
    expect(body.question).toBe(JOURNAL_OPENING_QUESTION_V1);
    expect(body.turn_index).toBe(0);

    // No OpenRouter call made for turn 0
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not call OpenRouter even if user_state is present", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
        },
      ),
    );

    global.fetch = jest.fn();

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: [] });
    await handler(req);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. 3-turn cap — server-side enforcement (ADR-006 Decision 1)
// ---------------------------------------------------------------------------

describe("journal-next-question — 3-turn cap", () => {
  const threeTurns: Turn[] = [
    { turn_index: 0, question: JOURNAL_OPENING_QUESTION_V1, answer: "First answer" },
    { turn_index: 1, question: "Follow-up question 1?", answer: "Second answer" },
    { turn_index: 2, question: "Follow-up question 2?", answer: "Third answer" },
  ];

  it("returns { done: true } when turns.length >= 3", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
        },
      ),
    );

    global.fetch = jest.fn();

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: threeTurns });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { done: boolean };
    expect(body.done).toBe(true);
  });

  it("does not call OpenRouter when 3-turn cap is hit", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
        },
      ),
    );

    global.fetch = jest.fn();

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: threeTurns });
    await handler(req);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns { done: true } even when turns has more than 3 entries", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
        },
      ),
    );

    global.fetch = jest.fn();

    const extraTurns: Turn[] = [
      ...threeTurns,
      { turn_index: 3, question: "Extra?", answer: "Extra answer" },
    ];

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: extraTurns });
    const res = await handler(req);

    const body = (await res.json()) as { done: boolean };
    expect(body.done).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Follow-up turn (turn 1) — calls OpenRouter
// ---------------------------------------------------------------------------

describe("journal-next-question — follow-up turn (turn 1)", () => {
  const oneTurn: Turn[] = [
    {
      turn_index: 0,
      question: JOURNAL_OPENING_QUESTION_V1,
      answer: "I've been thinking about work stress.",
    },
  ];

  function makeOpenRouterResponse(content: string, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        Promise.resolve({ choices: [{ message: { content } }] }),
      text: () => Promise.resolve(content),
    } as unknown as Response;
  }

  it("calls OpenRouter and returns the question from the AI response", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
          user_state: [{ data: { content: null }, error: null }],
        },
      ),
    );

    const aiQuestion = "What's been weighing on you most today?";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeOpenRouterResponse(JSON.stringify({ question: aiQuestion })),
      );

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: oneTurn });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { question: string; turn_index: number };
    expect(body.question).toBe(aiQuestion);
    expect(body.turn_index).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns { done: true } when AI responds with { done: true }", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
          user_state: [{ data: null, error: null }],
        },
      ),
    );

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeOpenRouterResponse(JSON.stringify({ done: true })),
      );

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: oneTurn });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { done: boolean };
    expect(body.done).toBe(true);
  });

  it("returns 502 when OpenRouter returns a non-2xx status", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
          user_state: [{ data: null, error: null }],
        },
      ),
    );

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeOpenRouterResponse("Internal Server Error", 500));

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: oneTurn });
    const res = await handler(req);

    expect(res.status).toBe(502);
  });

  it("strips markdown code fences from AI response before parsing", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {
          journal_sessions: [
            { data: { id: TEST_SESSION_ID, status: "pending" }, error: null },
          ],
          user_state: [{ data: null, error: null }],
        },
      ),
    );

    const inner = JSON.stringify({ question: "How did that make you feel?" });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeOpenRouterResponse(`\`\`\`json\n${inner}\n\`\`\``),
      );

    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: oneTurn });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { question: string };
    expect(body.question).toBe("How did that make you feel?");
  });
});

// ---------------------------------------------------------------------------
// 7. Input validation
// ---------------------------------------------------------------------------

describe("journal-next-question — input validation", () => {
  beforeEach(() => {
    createClient.mockReturnValue(
      makeMockSupabaseClient(
        { data: { user: { id: TEST_USER_ID } }, error: null },
        {},
      ),
    );
  });

  it("returns 400 when session_id is missing", async () => {
    const req = makeRequest({ turns: [] });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("session_id");
  });

  it("returns 400 when turns is not an array", async () => {
    const req = makeRequest({ session_id: TEST_SESSION_ID, turns: "invalid" });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("turns");
  });

  it("returns 405 when method is not POST", async () => {
    const req = new Request("https://example.com/journal-next-question", {
      method: "GET",
      headers: { Authorization: "Bearer test-jwt" },
    });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });
});
