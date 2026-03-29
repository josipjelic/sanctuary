import { parseSupabaseAuthParams } from "@/lib/auth-redirect";

describe("parseSupabaseAuthParams", () => {
  it("reads tokens from hash fragment", () => {
    const url =
      "sanctuary://auth/callback#access_token=at&refresh_token=rt&type=signup";
    expect(parseSupabaseAuthParams(url)).toEqual({
      access_token: "at",
      refresh_token: "rt",
      type: "signup",
    });
  });

  it("merges query and hash with hash winning on duplicate keys", () => {
    const url =
      "sanctuary://auth/callback?foo=1#access_token=at&refresh_token=rt&foo=2";
    expect(parseSupabaseAuthParams(url).foo).toBe("2");
    expect(parseSupabaseAuthParams(url).access_token).toBe("at");
  });

  it("reads PKCE code from query", () => {
    const url = "sanctuary://auth/callback?code=abc123";
    expect(parseSupabaseAuthParams(url).code).toBe("abc123");
  });

  it("reads error from query", () => {
    const url =
      "sanctuary://auth/callback?error=access_denied&error_description=nope";
    const p = parseSupabaseAuthParams(url);
    expect(p.error).toBe("access_denied");
    expect(p.error_description).toBe("nope");
  });
});
