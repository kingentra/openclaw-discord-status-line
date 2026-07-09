import assert from "node:assert/strict";
import test from "node:test";

import { register } from "../src/index.ts";

test("registers only reply_payload_sending with registerHook", () => {
  const registrations: string[] = [];

  register({
    registerHook(event) {
      registrations.push(Array.isArray(event) ? event.join(",") : event);
    },
  });

  assert.deepEqual(registrations, ["reply_payload_sending"]);
});

test("uses extension-style on fallback only for reply_payload_sending", () => {
  const registrations: string[] = [];

  register({
    on(event) {
      registrations.push(event);
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
    registerHook(event, registeredHandler) {
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
    registerHook(_event, registeredHandler) {
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

test("reply hook also mutates event.payload in place for compatibility", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    registerHook(_event, registeredHandler) {
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

  assert.equal(event.payload.body, "reply body\n\n-# *unknown • tools:0 • unknown*");
  assert.equal(event.payload.untouched, true);
  assert.deepEqual(result, {
    payload: {
      body: "reply body\n\n-# *unknown • tools:0 • unknown*",
      untouched: true,
    },
  });
});

test("reply hook wrapper payload preserves object shape after in-place mutation", () => {
  let handler: ((event: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
    },
    registerHook(_event, registeredHandler) {
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
  assert.equal(event.payload.text, result.payload?.text);
});

test("reply hook only handles configured Discord channel IDs when allowlist is set", () => {
  let handler: ((event: unknown, ctx?: unknown) => unknown) | undefined;

  register({
    pluginConfig: {
      enabled: true,
      channels: ["discord"],
      channelIds: ["YOUR_TEST_CHANNEL_ID_HERE"],
    },
    registerHook(_event, registeredHandler) {
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
    registerHook(_event, registeredHandler) {
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
