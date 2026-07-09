import { resolveStatusLineConfig } from "./config.ts";
import { appendStatusLineToText } from "./format-status-line.ts";
import type { StatusLineConfig } from "./config.ts";

type DiagnosticSummary = {
  hook: "reply_payload_sending";
  configEnabled: boolean;
  payloadPresent: boolean;
  payloadObject: boolean;
  payloadFieldNames: Array<"text" | "body" | "content">;
  readableTextFieldName?: "text" | "body" | "content";
  readableTextPresent: boolean;
  usageStatePresent: boolean;
  contextPresent: boolean;
  platformPresent: boolean;
  platformMatched: boolean;
  channelIdPresent: boolean;
  attemptedInPlaceMutation: boolean;
  returnedMutation: boolean;
};

type OpenClawLikeApi = {
  pluginConfig?: unknown;
  diagnostics?: {
    record?: (summary: DiagnosticSummary) => void;
  };
  recordDiagnostic?: (summary: DiagnosticSummary) => void;
  on?: (event: string, handler: (event: unknown, ctx?: unknown) => unknown) => void;
  registerHook?: (
    events: string | string[],
    handler: (event: unknown, ctx?: unknown) => unknown,
    opts?: {
      name?: string;
      description?: string;
      timeoutMs?: number;
    },
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

type ReplyPayloadSendingContextLike = {
  conversationId?: unknown;
};

const SAFE_PAYLOAD_FIELD_NAMES = ["text", "body", "content"] as const;

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

function readTextPayloadFieldName(
  payload: ReplyPayloadLike | undefined,
): "text" | "body" | "content" | undefined {
  if (!payload) return undefined;
  for (const key of SAFE_PAYLOAD_FIELD_NAMES) {
    const value = payload[key];
    if (typeof value === "string") return key;
  }
  return undefined;
}

function writeTextPayload(payload: ReplyPayloadLike, text: string): ReplyPayloadLike {
  if (typeof payload.text === "string") return { ...payload, text };
  if (typeof payload.body === "string") return { ...payload, body: text };
  if (typeof payload.content === "string") return { ...payload, content: text };
  return { ...payload, text };
}

function mutateTextPayloadInPlace(payload: ReplyPayloadLike, text: string): void {
  if (typeof payload.text === "string") {
    payload.text = text;
    return;
  }
  if (typeof payload.body === "string") {
    payload.body = text;
    return;
  }
  if (typeof payload.content === "string") {
    payload.content = text;
    return;
  }
  payload.text = text;
}

function collectSafePayloadFieldNames(
  payload: ReplyPayloadLike | undefined,
): Array<"text" | "body" | "content"> {
  if (!payload || !isRecord(payload)) return [];
  return SAFE_PAYLOAD_FIELD_NAMES.filter((key) =>
    Object.prototype.hasOwnProperty.call(payload, key),
  );
}

function createDiagnosticSummary(
  event: unknown,
  ctx: unknown,
  config: StatusLineConfig,
): DiagnosticSummary {
  const replyEvent = isRecord(event) ? (event as ReplyPayloadSendingEventLike) : {};
  const payload = isRecord(replyEvent.payload) ? replyEvent.payload : undefined;
  const readableTextFieldName = readTextPayloadFieldName(payload);
  const context = isRecord(ctx) ? (ctx as ReplyPayloadSendingContextLike) : undefined;
  const platform = typeof replyEvent.channel === "string" ? replyEvent.channel : undefined;

  return {
    hook: "reply_payload_sending",
    configEnabled: config.enabled,
    payloadPresent: isRecord(event) && "payload" in event,
    payloadObject: Boolean(payload),
    payloadFieldNames: collectSafePayloadFieldNames(payload),
    readableTextFieldName,
    readableTextPresent: Boolean(readableTextFieldName),
    usageStatePresent: replyEvent.usageState !== undefined,
    contextPresent: ctx !== undefined && ctx !== null,
    platformPresent: Boolean(platform),
    platformMatched: Boolean(platform && config.channels.includes(platform)),
    channelIdPresent: Boolean(
      context &&
        typeof context.conversationId === "string" &&
        context.conversationId.length > 0,
    ),
    attemptedInPlaceMutation: false,
    returnedMutation: false,
  };
}

function recordDiagnosticIfEnabled(
  api: OpenClawLikeApi,
  config: StatusLineConfig,
  summary: DiagnosticSummary,
): void {
  if (!config.diagnostics.enabled || !config.diagnostics.safeStructuralLogging) return;
  const record = api.diagnostics?.record ?? api.recordDiagnostic;
  if (typeof record === "function") record(summary);
}

function shouldHandleChannel(event: ReplyPayloadSendingEventLike, channels: string[]): boolean {
  const channel = typeof event.channel === "string" ? event.channel : undefined;
  if (!channel) return false;
  return channels.includes(channel);
}

function normalizeDiscordConversationId(value: string): string {
  return value.trim().replace(/^channel:/i, "");
}

function shouldHandleChannelId(ctx: ReplyPayloadSendingContextLike, channelIds: string[]): boolean {
  if (channelIds.length === 0) return true;
  const conversationId =
    typeof ctx.conversationId === "string" ? ctx.conversationId : undefined;
  if (!conversationId) return false;
  const normalizedConversationId = normalizeDiscordConversationId(conversationId);
  return channelIds.some(
    (channelId) =>
      normalizeDiscordConversationId(channelId) === normalizedConversationId,
  );
}

function handleReplyPayloadSending(event: unknown, ctx: unknown, api: OpenClawLikeApi): unknown {
  const resolvedConfig = resolveStatusLineConfig(api.pluginConfig);
  const diagnostic = createDiagnosticSummary(event, ctx, resolvedConfig);
  const finish = (result: unknown): unknown => {
    recordDiagnosticIfEnabled(api, resolvedConfig, diagnostic);
    return result;
  };

  if (!isRecord(event)) return finish(undefined);
  if (!resolvedConfig.enabled) return finish(undefined);

  const replyEvent = event as ReplyPayloadSendingEventLike;
  if (!shouldHandleChannel(replyEvent, resolvedConfig.channels)) return finish(undefined);
  if (
    !shouldHandleChannelId(
      isRecord(ctx) ? (ctx as ReplyPayloadSendingContextLike) : {},
      resolvedConfig.channelIds,
    )
  ) {
    return finish(undefined);
  }
  if (!replyEvent.payload || !isRecord(replyEvent.payload)) return finish(undefined);

  const originalText = readTextPayload(replyEvent.payload);
  if (originalText === undefined) return finish(undefined);

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

  if (!appended.appended) return finish(undefined);

  const updatedPayload = writeTextPayload(replyEvent.payload, appended.text);

  // Contract status: not proven. The failed live test may have missed the
  // footer because OpenClaw expects in-place event.payload mutation, a returned
  // wrapper shaped as { payload }, a different wrapper, or because the tested
  // delivery path bypassed this hook. For now, try the two safest local forms:
  // mutate the known payload text field in place and also return { payload }.
  // Do not treat either form as confirmed until a controlled diagnostic test
  // proves the live OpenClaw reply contract.
  mutateTextPayloadInPlace(replyEvent.payload, appended.text);
  diagnostic.attemptedInPlaceMutation = true;
  diagnostic.returnedMutation = true;
  return finish({
    payload: updatedPayload,
  });
}

export function register(api: OpenClawLikeApi): void {
  // Draft integration note:
  // OpenClaw 2026.6.x exposes reply_payload_sending as a typed plugin hook.
  // Other lifecycle/tool hooks are intentionally not registered in v0.1.1
  // because turn_start was not proven as a plugin hook, and tool-call counting
  // needs a live test before it should influence production replies.
  if (typeof api.registerHook === "function") {
    api.registerHook("reply_payload_sending", (event, ctx) =>
      handleReplyPayloadSending(event, ctx, api),
      {
        name: "openclaw-discord-status-line.reply-payload-sending",
        description: "Append a passive status line to selected Discord replies.",
        timeoutMs: 1000,
      },
    );
    return;
  }

  if (typeof api.on === "function") {
    // Extension-style registration is kept as a defensive loader fallback only.
    // The intended OpenClaw hook remains reply_payload_sending.
    api.on("reply_payload_sending", (event, ctx) =>
      handleReplyPayloadSending(event, ctx, api),
    );
  }
}

export default {
  id: "openclaw-discord-status-line",
  name: "OpenClaw Discord Status Line",
  description: "Draft inline Discord reply status line plugin for OpenClaw.",
  register,
};
