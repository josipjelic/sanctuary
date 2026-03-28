import { normalizeTopicLabel } from "@/lib/normalizeTopicLabel";

describe("normalizeTopicLabel", () => {
  it("lowercases and trims", () => {
    expect(normalizeTopicLabel("  Hello  ")).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTopicLabel("a   b\t\nc")).toBe("a b c");
  });
});
