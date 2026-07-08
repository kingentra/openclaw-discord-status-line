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
