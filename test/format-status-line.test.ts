import assert from "node:assert/strict";
import test from "node:test";

import {
  appendStatusLineToText,
  formatStatusLine,
} from "../src/format-status-line.ts";

test("formats normal full metadata", () => {
  const line = formatStatusLine(
    {
      toolCalls: 3,
      usageState: {
        resolvedRef: "codex/gpt-5.5",
        durationMs: 12_300,
        contextUsedTokens: 64_000,
        contextTokenBudget: 128_000,
        lastUsage: {
          input: 1200,
          output: 340,
        },
      },
    },
    { enabled: true },
  );

  assert.equal(line, "-# *12s • ctx 50% • tok 1200/340 • tools:3 • codex/gpt-5.5*");
});

test("uses fallback when token or context metadata is unavailable", () => {
  const line = formatStatusLine(
    {
      toolCalls: 1,
      usageState: {
        resolvedRef: "openai/gpt-5.5",
        durationMs: 850,
      },
    },
    { enabled: true },
  );

  assert.equal(line, "-# *850ms • tools:1 • openai/gpt-5.5*");
});

test("ctx percent under 1 percent displays less-than-one percent", () => {
  const line = formatStatusLine(
    {
      usageState: {
        model: "codex/gpt-5.5",
        durationMs: 1000,
        contextUsedTokens: 10,
        contextTokenBudget: 2000,
        lastUsage: {
          input: 10,
          output: 5,
        },
      },
    },
    { enabled: true },
  );

  assert.equal(line, "-# *1s • ctx <1% • tok 10/5 • tools:0 • codex/gpt-5.5*");
});

test("unknown values do not crash", () => {
  const line = formatStatusLine(
    {
      toolCalls: "not-a-number",
      usageState: {
        resolvedRef: "",
        durationMs: "slow",
        lastUsage: {
          input: "many",
          output: null,
        },
      },
    },
    { enabled: true },
  );

  assert.equal(line, "-# *unknown • tools:0 • unknown*");
});

test("disabled config returns original message with no status line", () => {
  const result = appendStatusLineToText(
    "reply body",
    {
      usageState: {
        model: "codex/gpt-5.5",
        durationMs: 1000,
      },
    },
    { enabled: false },
  );

  assert.deepEqual(result, {
    text: "reply body",
    appended: false,
  });
});

