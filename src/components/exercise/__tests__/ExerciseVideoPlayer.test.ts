import { describe, it, expect } from "vitest";
import {
  detectMediaKind,
  getPlaceholderInitial,
  getPlaceholderGradient,
} from "../ExerciseVideoPlayer";

// ── detectMediaKind ─────────────────────────────────────────────────────────

describe("detectMediaKind", () => {
  it("returns 'gif' for .gif URLs", () => {
    expect(detectMediaKind("https://example.com/bench.gif")).toBe("gif");
    expect(detectMediaKind("https://raw.githubusercontent.com/x/y/main/ex1.gif")).toBe("gif");
  });

  it("returns 'video' for .mp4 URLs", () => {
    expect(detectMediaKind("https://cdn.example.com/squat.mp4")).toBe("video");
  });

  it("returns 'video' for .webm URLs", () => {
    expect(detectMediaKind("https://cdn.example.com/press.webm")).toBe("video");
  });

  it("returns 'video' for .mov URLs", () => {
    expect(detectMediaKind("https://cdn.example.com/row.mov")).toBe("video");
  });

  it("returns 'video' for .m4v URLs", () => {
    expect(detectMediaKind("https://cdn.example.com/curl.m4v")).toBe("video");
  });

  it("returns 'image' for .jpg / .png / .webp URLs", () => {
    expect(detectMediaKind("https://example.com/bench.jpg")).toBe("image");
    expect(detectMediaKind("https://example.com/bench.png")).toBe("image");
    expect(detectMediaKind("https://example.com/bench.webp")).toBe("image");
  });

  it("returns 'image' for undefined URL", () => {
    expect(detectMediaKind(undefined)).toBe("image");
  });

  it("returns 'image' for empty string", () => {
    expect(detectMediaKind("")).toBe("image");
  });

  it("strips query strings + fragments before detecting", () => {
    expect(detectMediaKind("https://example.com/bench.gif?v=2")).toBe("gif");
    expect(detectMediaKind("https://example.com/video.mp4#t=5")).toBe("video");
    expect(detectMediaKind("https://example.com/img.jpg?token=abc")).toBe("image");
  });

  it("is case-insensitive on extensions", () => {
    expect(detectMediaKind("https://example.com/bench.GIF")).toBe("gif");
    expect(detectMediaKind("https://example.com/video.MP4")).toBe("video");
    expect(detectMediaKind("https://example.com/img.JPG")).toBe("image");
  });

  it("returns 'image' for URLs with no extension", () => {
    expect(detectMediaKind("https://example.com/benchpress")).toBe("image");
  });
});

// ── getPlaceholderInitial ───────────────────────────────────────────────────

describe("getPlaceholderInitial", () => {
  it("returns the uppercase first letter of the name", () => {
    expect(getPlaceholderInitial("Bench Press")).toBe("B");
    expect(getPlaceholderInitial("squat")).toBe("S");
  });

  it("trims leading whitespace before extracting", () => {
    expect(getPlaceholderInitial("  Bench Press")).toBe("B");
  });

  it("returns '?' for empty string", () => {
    expect(getPlaceholderInitial("")).toBe("?");
  });

  it("returns '?' for whitespace-only string", () => {
    expect(getPlaceholderInitial("   ")).toBe("?");
  });

  it("handles non-ASCII first letters (Arabic)", () => {
    // Arabic name → first character returned as-is (already uppercase-equivalent).
    expect(getPlaceholderInitial("ضغط بنش")).toBe("ض");
  });
});

// ── getPlaceholderGradient ──────────────────────────────────────────────────

describe("getPlaceholderGradient", () => {
  it("returns a gradient class string", () => {
    const g = getPlaceholderGradient("Bench Press");
    expect(g).toMatch(/^from-\w+-500\/30 to-\w+-500\/10$/);
  });

  it("is deterministic — same name always returns the same gradient", () => {
    const g1 = getPlaceholderGradient("Bench Press");
    const g2 = getPlaceholderGradient("Bench Press");
    expect(g1).toBe(g2);
  });

  it("returns a gradient for empty string (does not throw)", () => {
    const g = getPlaceholderGradient("");
    expect(typeof g).toBe("string");
    expect(g.length).toBeGreaterThan(0);
  });

  it("distributes different names across the palette (not all the same)", () => {
    const names = [
      "Bench Press",
      "Squat",
      "Deadlift",
      "Overhead Press",
      "Barbell Row",
      "Pull Up",
      "Dip",
      "Chin Up",
    ];
    const gradients = new Set(names.map(getPlaceholderGradient));
    // At least 3 distinct gradients across 8 names (palette has 6).
    expect(gradients.size).toBeGreaterThanOrEqual(3);
  });
});
