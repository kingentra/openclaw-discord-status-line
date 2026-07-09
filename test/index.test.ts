import assert from "node:assert/strict";
import test from "node:test";

import pluginEntry, { register } from "../src/index.ts";

const DIAGNOSTIC_KEYS = [
  "hook",
  "configEnabled",
  "payloadPresent",
  "payloadObject",
  "payloadFieldNames",
  "readableTextFieldName",
  "readableTextPresent",
  "usageStatePresent",
  "contextPresent",
  "platformPresent",
  "platformMatched",
  "channelIdPresent",
  "attemptedInPlaceMutation",
  "returnedMutation",
];

test("registers only reply_payload_sending with api.on", () => {
  const registrations: string[] = [];

  register({
    on(event) {
      registrations.push(event);
    },
  });

  assert.deepEqual(registrations, ["reply_payload_sending"]);
});

test("default export uses the modern plugin entry shape", () => {
  assert.equal(pluginEntry.id, "openclaw-discord-status-line");
  assert.equal(pluginEntry.name, "OpenClaw Discord Status Line");
  assert.equal(typeof pluginEntry.register, "function");
});

test("uses api.on as the primary typed hook path when both APIs exist", () => {
  const registrations: string[] = [];
  let registerHookCalled = false;

  register({
    on(event) {
      registrations.push(`on:${event}`);
    },
    registerHook() {
      registerHookCalled = true;
    },
  });

  assert.deepEqual(registrations, ["on:reply_payload_sending"]);
  assert.equal(registerHookCalled, false);
});

test("falls back to registerHook only when api.on is unavailable", () => {
  const registrations: string[] = [];

  register({
    registerHook(event) {
      registrations.push(Array.isArray(event) ? event.join(",") : event);
    },
  });

  assert.deepEqual(registrations, ["reply_payload_sending"]);
});

test("reply hook appends fallback metadata without throwing when usageState is missing", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    on(event, registeredHandler) {
      assert.equal(event, "reply_payload_sending");
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  const result = handler({
    channel: "discord",
    payload: {
      text: "reply body",
    },
  });

  assert.deepEqual(result, {
    payload: {
      text: "reply body\n\n-# *unknown • tools:0 • unknown*",
    },
  });
});

test("reply hook returns a wrapper with a modified payload", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  const event = {
    channel: "discord",
    payload: {
      content: "reply body",
      untouched: true,
    },
  };
  const result = handler(event);

  assert.deepEqual(result, {
    payload: {
      content: "reply body\n\n-# *unknown • tools:0 • unknown*",
      untouched: true,
    },
  });
  assert.deepEqual(Object.keys(result as Record<string, unknown>), ["payload"]);
});

test("reply hook uses return-based payload mutation without in-place mutation", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  const event = {
    channel: "discord",
    payload: {
      body: "reply body",
      untouched: true,
    },
  };
  const result = handler(event);

  assert.equal(event.payload.body, "reply body");
  assert.equal(event.payload.untouched, true);
  assert.deepEqual(result, {
    payload: {
      body: "reply body\n\n-# *unknown • tools:0 • unknown*",
      untouched: true,
    },
  });
});

test("reply hook wrapper payload preserves object shape without mutating event", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  const event = {
    channel: "discord",
    payload: {
      text: "reply body",
      body: "secondary body",
    },
  };
  const result = handler(event) as { payload?: { text?: string; body?: string } };

  assert.deepEqual(result, {
    payload: {
      text: "reply body\n\n-# *unknown • tools:0 • unknown*",
      body: "secondary body",
    },
  });
  assert.equal(event.payload.text, "reply body");
});

test("reply hook only handles configured Discord channel IDs when allowlist is set", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
      channelIds: ["YOUR_TEST_CHANNEL_ID_HERE"],
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  assert.equal(
    handler(
      {
        channel: "discord",
        payload: {
          text: "reply body",
        },
      },
      {
        conversationId: "OTHER_CHANNEL_ID",
      },
    ),
    undefined,
  );

  assert.deepEqual(
    handler(
      {
        channel: "discord",
        payload: {
          text: "reply body",
        },
      },
      {
        conversationId: "channel:YOUR_TEST_CHANNEL_ID_HERE",
      },
    ),
    {
      payload: {
        text: "reply body\n\n-# *unknown • tools:0 • unknown*",
      },
    },
  );
});

test("reply hook ignores missing payloads and non-matching platform filters safely", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  assert.equal(handler({ channel: "discord" }), undefined);
  assert.equal(
    handler({
      channel: "slack",
      payload: {
        text: "reply body",
      },
    }),
    undefined,
  );
});

test("reply hook diagnostics are disabled by default", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;
  const diagnostics: unknown[] = [];

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    diagnostics: {
      record(summary) {
        diagnostics.push(summary);
      },
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  handler({
    channel: "discord",
    payload: {
      text: "reply body",
    },
  });

  assert.deepEqual(diagnostics, []);
});

test("reply hook diagnostics contain only allowed structural keys", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;
  const diagnostics: Array<Record<string, unknown>> = [];

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
      diagnostics: {
        enabled: true,
        safeStructuralLogging: true,
      },
    },
    diagnostics: {
      record(summary) {
        diagnostics.push(summary);
      },
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  handler(
    {
      channel: "discord",
      unknownEventField: "unknown event value",
      usageState: {
        hiddenUsageValue: "do not collect",
      },
      payload: {
        text: "message body must not appear",
        body: "secondary body must not appear",
        content: "content body must not appear",
        unknownPayloadField: "unknown payload value",
      },
    },
    {
      conversationId: "CHANNEL_ID_VALUE_SHOULD_NOT_APPEAR",
    },
  );

  assert.equal(diagnostics.length, 1);
  const [summary] = diagnostics;
  assert.deepEqual(Object.keys(summary), DIAGNOSTIC_KEYS);
  assert.deepEqual(summary.payloadFieldNames, ["text", "body", "content"]);
  assert.equal(summary.readableTextFieldName, "text");
  assert.equal(summary.readableTextPresent, true);
  assert.equal(summary.usageStatePresent, true);
  assert.equal(summary.contextPresent, true);
  assert.equal(summary.platformPresent, true);
  assert.equal(summary.platformMatched, true);
  assert.equal(summary.channelIdPresent, true);
  assert.equal(summary.attemptedInPlaceMutation, false);
  assert.equal(summary.returnedMutation, true);

  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes("message body must not appear"), false);
  assert.equal(serialized.includes("secondary body must not appear"), false);
  assert.equal(serialized.includes("content body must not appear"), false);
  assert.equal(serialized.includes("CHANNEL_ID_VALUE_SHOULD_NOT_APPEAR"), false);
  assert.equal(serialized.includes("unknownEventField"), false);
  assert.equal(serialized.includes("unknownPayloadField"), false);
  assert.equal(serialized.includes("hiddenUsageValue"), false);
});

test("reply hook diagnostics record channel ID presence only", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;
  const diagnostics: Array<Record<string, unknown>> = [];

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
      diagnostics: {
        enabled: true,
        safeStructuralLogging: true,
      },
    },
    recordDiagnostic(summary) {
      diagnostics.push(summary);
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  handler(
    {
      channel: "discord",
      payload: {
        body: "message body must not appear",
      },
    },
    {
      conversationId: "channel:CHANNEL_ID_VALUE_SHOULD_NOT_APPEAR",
    },
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].channelIdPresent, true);
  assert.equal(
    JSON.stringify(diagnostics[0]).includes("CHANNEL_ID_VALUE_SHOULD_NOT_APPEAR"),
    false,
  );
});

test("reply hook diagnostics respect safeStructuralLogging off switch", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;
  const diagnostics: unknown[] = [];

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
      diagnostics: {
        enabled: true,
        safeStructuralLogging: false,
      },
    },
    recordDiagnostic(summary) {
      diagnostics.push(summary);
    },
    on(_event, registeredHandler) {
      handler = registeredHandler;
    },
  });

  assert.ok(handler);
  handler({
    channel: "discord",
    payload: {
      text: "reply body",
    },
  });

  assert.deepEqual(diagnostics, []);
});
