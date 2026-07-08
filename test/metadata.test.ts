import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStatusLineMetadata } from "../src/metadata.ts";

test("normalizes full reply usage metadata", () => {
  const metadata = normalizeStatusLineMetadata({
    toolCalls: 2,
    usageState: {
      resolvedRef: "codex/gpt-5.5",
      durationMs: 3400,
      contextUsedTokens: 500,
      contextTokenBudget: 1000,
      usage: {
        total: 2000,
      },
      lastUsage: {
        input: 120,
        output: 30,
        total: 150,
      },
    },
  });

  assert.deepEqual(metadata, {
    model: "codex/gpt-5.5",
    durationMs: 3400,
    contextUsedTokens: 500,
    contextTokenBudget: 1000,
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    toolCalls: 2,
  });
});

test("falls back through model fields and clamps tool calls", () => {
  const metadata = normalizeStatusLineMetadata({
    toolCalls: -10,
    usageState: {
      provider: "codex",
      durationMs: Number.NaN,
    },
  });

  assert.equal(metadata.model, "codex");
  assert.equal(metadata.durationMs, undefined);
  assert.equal(metadata.toolCalls, 0);
});

test("handles empty input defensively", () => {
  assert.deepEqual(normalizeStatusLineMetadata(), {
    model: undefined,
    durationMs: undefined,
    contextUsedTokens: undefined,
    contextTokenBudget: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    toolCalls: 0,
  });
});

