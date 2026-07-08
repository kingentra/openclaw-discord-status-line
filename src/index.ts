import { resolveStatusLineConfig } from "./config.ts";
import { appendStatusLineToText } from "./format-status-line.ts";

type OpenClawLikeApi = {
  pluginConfig?: unknown;
  on?: (event: string, handler: (event: unknown, ctx?: unknown) => unknown) => void;
  registerHook?: (
    events: string | string[],
    handler: (event: unknown, ctx?: unknown) => unknown,
    opts?: Record<string, unknown>,
  ) => void;
};

type ReplyPayloadLike = {
  text?: unknown;
  body?: unknown;
  content?: unknown;
};

type ReplyPayloadSendingEventLike = {
  channel?: unknown;
  kind?: unknown;
  payload?: ReplyPayloadLike;
  usageState?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readTextPayload(payload: ReplyPayloadLike | undefined): string | undefined {
  if (!payload) return undefined;
  for (const key of ["text", "body", "content"] as const) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function writeTextPayload(payload: ReplyPayloadLike, text: string): ReplyPayloadLike {
  if (typeof payload.text === "string") return { ...payload, text };
  if (typeof payload.body === "string") return { ...payload, body: text };
  if (typeof payload.content === "string") return { ...payload, content: text };
  return { ...payload, text };
}

function shouldHandleChannel(event: ReplyPayloadSendingEventLike, channels: string[]): boolean {
  const channel = typeof event.channel === "string" ? event.channel : undefined;
  if (!channel) return false;
  return channels.includes(channel);
}

function handleReplyPayloadSending(event: unknown, api: OpenClawLikeApi): unknown {
  if (!isRecord(event)) return undefined;

  const resolvedConfig = resolveStatusLineConfig(api.pluginConfig);
  if (!resolvedConfig.enabled) return undefined;

  const replyEvent = event as ReplyPayloadSendingEventLike;
  if (!shouldHandleChannel(replyEvent, resolvedConfig.channels)) return undefined;
  if (!replyEvent.payload || !isRecord(replyEvent.payload)) return undefined;

  const originalText = readTextPayload(replyEvent.payload);
  if (originalText === undefined) return undefined;

  const appended = appendStatusLineToText(
    originalText,
    {
      usageState: isRecord(replyEvent.usageState) ? replyEvent.usageState : undefined,
      // Tool-count metadata is not part of the verified reply_payload_sending
      // usageState contract yet. Keep v0.1.1 passive and fail-soft until a live
      // OpenClaw test proves a stable turn-scoped source for tool call counts.
      toolCalls: 0,
    },
    resolvedConfig,
  );

  if (!appended.appended) return undefined;

  return {
    payload: writeTextPayload(replyEvent.payload, appended.text),
  };
}

export function register(api: OpenClawLikeApi): void {
  // Draft integration note:
  // OpenClaw 2026.6.x exposes reply_payload_sending as a typed plugin hook.
  // Other lifecycle/tool hooks are intentionally not registered in v0.1.1
  // because turn_start was not proven as a plugin hook, and tool-call counting
  // needs a live test before it should influence production replies.
  if (typeof api.registerHook === "function") {
    api.registerHook("reply_payload_sending", (event) =>
      handleReplyPayloadSending(event, api),
    );
    return;
  }

  if (typeof api.on === "function") {
    // Extension-style registration is kept as a defensive loader fallback only.
    // The intended OpenClaw hook remains reply_payload_sending.
    api.on("reply_payload_sending", (event) =>
      handleReplyPayloadSending(event, api),
    );
  }
}

export default {
  id: "openclaw-discord-status-line",
  name: "OpenClaw Discord Status Line",
  description: "Draft inline Discord reply status line plugin for OpenClaw.",
  register,
};
