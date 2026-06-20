import { describe, it, expect } from "vitest";
import {
  validateString,
  validateDisplayName,
  validateUrl,
  validateOptionalUrl,
  validateInt,
  validateFloat,
  validateId,
} from "../validation";

describe("validateString", () => {
  it("trims whitespace and returns the trimmed value", () => {
    expect(validateString("  hello  ")).toBe("hello");
  });

  it("returns null for empty string after trim", () => {
    expect(validateString("   ")).toBeNull();
  });

  it("returns null for non-string values", () => {
    expect(validateString(null)).toBeNull();
    expect(validateString(undefined)).toBeNull();
    expect(validateString(123)).toBeNull();
    expect(validateString({})).toBeNull();
  });

  it("caps to maxLength", () => {
    expect(validateString("hello", 3)).toBe("hel");
    expect(validateString("ab", 10)).toBe("ab");
  });
});

describe("validateDisplayName", () => {
  it("accepts a normal name", () => {
    expect(validateDisplayName("John Doe")).toBe("John Doe");
  });

  it("rejects names longer than 50 chars", () => {
    const long = "a".repeat(60);
    expect(validateDisplayName(long)).toHaveLength(50);
  });

  it("rejects names with control characters", () => {
    expect(validateDisplayName("hello\x00world")).toBeNull();
    expect(validateDisplayName("hello\x1f")).toBeNull();
    expect(validateDisplayName("hello\x7f")).toBeNull();
  });

  it("returns null for empty", () => {
    expect(validateDisplayName("")).toBeNull();
    expect(validateDisplayName("   ")).toBeNull();
  });
});

describe("validateUrl", () => {
  it("accepts http and https URLs", () => {
    expect(validateUrl("http://example.com")).toBe("http://example.com");
    expect(validateUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  it("rejects javascript: scheme (XSS prevention)", () => {
    expect(validateUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: scheme", () => {
    expect(validateUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(validateUrl("not a url")).toBeNull();
    expect(validateUrl("")).toBeNull();
  });

  it("caps URL length to 2048", () => {
    const long = "https://example.com/" + "a".repeat(2100);
    expect(validateUrl(long)).toHaveLength(2048);
  });
});

describe("validateOptionalUrl", () => {
  it("returns null for null/undefined/empty", () => {
    expect(validateOptionalUrl(null)).toBeNull();
    expect(validateOptionalUrl(undefined)).toBeNull();
    expect(validateOptionalUrl("")).toBeNull();
  });

  it("validates URL when provided", () => {
    expect(validateOptionalUrl("https://example.com")).toBe("https://example.com");
    expect(validateOptionalUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("validateInt", () => {
  it("accepts valid integers in range", () => {
    expect(validateInt(5, 0, 100)).toBe(5);
    expect(validateInt("42", 0, 100)).toBe(42);
  });

  it("rejects values outside range", () => {
    expect(validateInt(-1, 0, 100)).toBeNull();
    expect(validateInt(101, 0, 100)).toBeNull();
  });

  it("rejects non-finite values", () => {
    expect(validateInt(Infinity)).toBeNull();
    expect(validateInt(NaN)).toBeNull();
    expect(validateInt("abc")).toBeNull();
  });

  it("truncates floats to integers", () => {
    expect(validateInt(3.7, 0, 10)).toBe(3);
  });

  it("uses default range [0, MAX_SAFE_INTEGER]", () => {
    expect(validateInt(0)).toBe(0);
    expect(validateInt(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("validateFloat", () => {
  it("accepts valid floats in range", () => {
    expect(validateFloat(3.14, 0, 10)).toBe(3.14);
  });

  it("rejects Infinity and NaN", () => {
    expect(validateFloat(Infinity)).toBeNull();
    expect(validateFloat(-Infinity)).toBeNull();
    expect(validateFloat(NaN)).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(validateFloat(-0.1, 0, 1e9)).toBeNull();
    expect(validateFloat(1e10, 0, 1e9)).toBeNull();
  });

  it("accepts string numbers", () => {
    expect(validateFloat("42.5", 0, 100)).toBe(42.5);
  });
});

describe("validateId", () => {
  it("accepts a normal ID", () => {
    expect(validateId("user_123")).toBe("user_123");
  });

  it("returns null for empty or whitespace-only", () => {
    expect(validateId("")).toBeNull();
    expect(validateId("   ")).toBeNull();
  });

  it("rejects IDs with whitespace", () => {
    expect(validateId("user 123")).toBeNull();
  });

  it("caps to 200 chars", () => {
    const long = "a".repeat(250);
    expect(validateId(long)).toHaveLength(200);
  });

  it("returns null for non-string", () => {
    expect(validateId(null)).toBeNull();
    expect(validateId(123)).toBeNull();
  });
});
