import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "./auth";

describe("validateEmail", () => {
  it("returns error for empty string", () => {
    expect(validateEmail("")).not.toBeNull();
  });

  it("returns error for whitespace-only string", () => {
    expect(validateEmail("   ")).not.toBeNull();
  });

  it("returns null for valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("returns error for missing @ symbol", () => {
    expect(validateEmail("userexample.com")).not.toBeNull();
  });

  it("returns error for missing domain", () => {
    expect(validateEmail("user@")).not.toBeNull();
  });

  it("returns error for email with spaces", () => {
    expect(validateEmail("user @example.com")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("returns error for empty string", () => {
    expect(validatePassword("")).not.toBeNull();
  });

  it("returns error for 7-character password", () => {
    expect(validatePassword("1234567")).not.toBeNull();
  });

  it("returns null for 8-character password", () => {
    expect(validatePassword("12345678")).toBeNull();
  });

  it("returns null for long password", () => {
    expect(validatePassword("correct-horse-battery-staple")).toBeNull();
  });
});

describe("validatePasswordConfirm", () => {
  it("returns error for empty confirm field", () => {
    expect(validatePasswordConfirm("password123", "")).not.toBeNull();
  });

  it("returns error when passwords do not match", () => {
    expect(
      validatePasswordConfirm("password123", "different123"),
    ).not.toBeNull();
  });

  it("returns null when passwords match", () => {
    expect(validatePasswordConfirm("password123", "password123")).toBeNull();
  });
});
