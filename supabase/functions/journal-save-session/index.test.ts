/**
 * Unit tests for the journal-save-session edge function handler.
 *
 * Strategy: capture the Deno.serve handler before module load, then drive it
 * with Request objects. Supabase createClient and global fetch are mocked.
 *
 * Key behaviours verified (ADR-006 Decision 1 + 2):
 *  - Happy path: pending session with answered entries → completed, { success: true }
 *  - No answered entries → 422
 *  - Already completed session → 409
 *  - Non-pending status → 422
 *  - User state update failure is fire-and-forget — HTTP response unaffected
 *  - Authentication: missing Authorization header → 401
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// Global Deno stub
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
// Load the module under test
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./index");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "user-uuid-test";
const TEST_SESSION_ID = "session-uuid-test";

const ANSWERED_ENTRIES = [
  { turn_index: 0, question: "Opening question", answer: "My answer" },
];

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
  return new Request("https://example.com/journal-save-session", {
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

interface SessionData {
  id: string;
  status: string;
}

interface SupabaseMockConfig {
  getUserResult: { data: { user: { id: string } | null }; error: unknown };
  sessionData?: SessionData | null;
  sessionError?: unknown;
  entriesData?: unknown[] | null;
  entriesError?: unknown;
  updateSessionError?: unknown;
  /** If set, user_state read/write will use this error. */
  userStateError?: unknown;
}

/**
 * Build a mock Supabase client for save-session.
 *
 * The function makes these calls in order:
 *  1. auth.getUser()
 *  2. from('journal_sessions').select().eq().eq().maybeSingle()  → session check
 *  3. from('journal_entries').select().eq().eq().not().order()  → entries fetch
 *     (resolves via the chain, not maybeSingle — returns { data, error } directly)
 *  4. from('journal_sessions').update().eq().eq()               → status update
 *
 * Note: journal_entries uses .not().order() which terminates without .maybeSingle().
 * We handle that by making `order` return the final { data, error } object.
 */
function makeMockSupabaseClient(cfg: SupabaseMockConfig) {
  const {
    getUserResult,
    sessionData = { id: TEST_SESSION_ID, status: "pending" },
    sessionError = null,
    entriesData = ANSWERED_ENTRIES,
    entriesError = null,
    updateSessionError = null,
    userStateError = null,
  } = cfg;

  let journalSessionsCallCount = 0;

  const from = jest.fn((table: string) => {
    if (table === "journal_sessions") {
      journalSessionsCallCount++;
      if (journalSessionsCallCount === 1) {
        // First call: SELECT to check session existence + status
        return makeQueryChain({ data: sessionData, error: sessionError });
      }
      // Second call: UPDATE to mark completed
      const updateChain: Record<string, unknown> = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      // The last .eq() call resolves the promise
      let eqCallCount = 0;
      updateChain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ error: updateSessionError });
          }
          return {
            eq: jest.fn().mockResolvedValue({ error: updateSessionError }),
          };
        }),
      });
      return updateChain;
    }

    if (table === "journal_entries") {
      // Build a chain where the terminal .order() resolves to the entries result
      const entriesChain: Record<string, unknown> = {};
      const terminal = Promise.resolve({
        data: entriesError ? null : entriesData,
        error: entriesError,
      });
      for (const method of ["select", "eq", "not"]) {
        entriesChain[method] = jest.fn().mockReturnValue(entriesChain);
      }
      entriesChain.order = jest.fn().mockReturnValue(terminal);
      return entriesChain;
    }

    if (table === "user_state") {
      // Fire-and-forget: read user_state, then upsert
      const chain = makeQueryChain({
        data: userStateError ? null : { content: null, session_count: 0 },
        error: userStateError,
      });
      chain.upsert = jest.fn().mockResolvedValue({ error: null });
      return chain;
    }

    return makeQueryChain({ data: null, error: null });
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
// 1. Authentication
// ---------------------------------------------------------------------------

describe("journal-save-session — authentication", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const req = makeRequest({ session_id: TEST_SESSION_ID }, { auth: null });
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when supabase.auth.getUser() returns an error", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: null },
          error: new Error("bad token"),
        },
      }),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. Happy path — session completed, { success: true } returned
// ---------------------------------------------------------------------------

describe("journal-save-session — happy path", () => {
  it("marks session completed and returns { success: true }", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
      }),
    );

    // OpenRouter mock for fire-and-forget user state update
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Updated user state." } }],
        }),
    } as unknown as Response);

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. No answered entries → 422
// ---------------------------------------------------------------------------

describe("journal-save-session — no answered entries", () => {
  it("returns 422 with error message when no entries have answers", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
        entriesData: [],
      }),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No answers found for session");
  });
});

// ---------------------------------------------------------------------------
// 4. Already completed session → 409
// ---------------------------------------------------------------------------

describe("journal-save-session — already completed", () => {
  it("returns 409 when session status is already 'completed'", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
        sessionData: { id: TEST_SESSION_ID, status: "completed" },
      }),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session already completed");
  });
});

// ---------------------------------------------------------------------------
// 5. Non-pending status (e.g. abandoned) → 422
// ---------------------------------------------------------------------------

describe("journal-save-session — non-pending status", () => {
  it("returns 422 when session status is 'abandoned'", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
        sessionData: { id: TEST_SESSION_ID, status: "abandoned" },
      }),
    );

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session is not in a saveable state");
  });
});

// ---------------------------------------------------------------------------
// 6. Session not found → 403
// ---------------------------------------------------------------------------

describe("journal-save-session — session ownership", () => {
  it("returns 403 when session_id is not found (cross-user or non-existent)", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
        sessionData: null,
      }),
    );

    const req = makeRequest({ session_id: "other-session-id" });
    const res = await handler(req);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session not found");
  });
});

// ---------------------------------------------------------------------------
// 7. User state update failure is fire-and-forget (ADR-006 Decision 2)
// ---------------------------------------------------------------------------

describe("journal-save-session — fire-and-forget user state update", () => {
  it("returns { success: true } even when OpenRouter call for user state fails", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
      }),
    );

    // Simulate OpenRouter returning an error for the user state update
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as unknown as Response);

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    // Session save succeeds regardless of user state update failure
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("returns { success: true } even when OpenRouter fetch throws for user state", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
      }),
    );

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("Network unreachable"));

    const req = makeRequest({ session_id: TEST_SESSION_ID });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Input validation
// ---------------------------------------------------------------------------

describe("journal-save-session — input validation", () => {
  it("returns 400 when session_id is missing", async () => {
    createClient.mockReturnValue(
      makeMockSupabaseClient({
        getUserResult: {
          data: { user: { id: TEST_USER_ID } },
          error: null,
        },
      }),
    );

    const req = makeRequest({});
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("session_id");
  });

  it("returns 405 when method is not POST", async () => {
    const req = new Request("https://example.com/journal-save-session", {
      method: "GET",
      headers: { Authorization: "Bearer test-jwt" },
    });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });
});
