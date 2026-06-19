/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import ReactDOMServer from "react-dom/server";

import AnatomyMap from "../AnatomyMap";

describe("AnatomyMap Performance", () => {
  it("renders within performance budget (2s)", () => {
    const start = performance.now();
    render(React.createElement(AnatomyMap));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("SSR within 500ms", () => {
    const start = performance.now();
    ReactDOMServer.renderToString(React.createElement(AnatomyMap));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("updates within 200ms when muscles change", () => {
    const { rerender } = render(
      React.createElement(AnatomyMap, { activeMuscles: ["chest"] })
    );
    const start = performance.now();
    rerender(
      React.createElement(AnatomyMap, { activeMuscles: ["back", "biceps"] })
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it("handles rapid prop changes without crashing", () => {
    const { rerender } = render(React.createElement(AnatomyMap));
    for (let i = 0; i < 50; i++) {
      rerender(
        React.createElement(AnatomyMap, { activeMuscles: [`muscle-${i}`] })
      );
    }
  });

  it("stays under 1s when all muscles are highlighted", () => {
    const allMuscles = [
      "chest", "back", "shoulders", "biceps", "triceps",
      "quads", "hamstrings", "glutes", "calves", "abs",
    ];
    const start = performance.now();
    render(
      React.createElement(AnatomyMap, { activeMuscles: allMuscles })
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it("renders without active muscles", () => {
    const start = performance.now();
    render(React.createElement(AnatomyMap, { activeMuscles: [] }));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
