export type ReplyUsageLike = {
  provider?: unknown;
  model?: unknown;
  resolvedRef?: unknown;
  requested?: unknown;
  durationMs?: unknown;
  contextTokenBudget?: unknown;
  contextUsedTokens?: unknown;
  usage?: {
    input?: unknown;
    output?: unknown;
    cacheRead?: unknown;
    cacheWrite?: unknown;
    total?: unknown;
  };
  lastUsage?: {
    input?: unknown;
    output?: unknown;
    cacheRead?: unknown;
    cacheWrite?: unknown;
    total?: unknown;
  };
};

export type StatusLineMetadataInput = {
  usageState?: ReplyUsageLike;
  toolCalls?: unknown;
  model?: unknown;
  durationMs?: unknown;
};

export type StatusLineMetadata = {
  model?: string;
  durationMs?: number;
  contextUsedTokens?: number;
  contextTokenBudget?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  toolCalls: number;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  const number = readFiniteNumber(value);
  if (number === undefined) return undefined;
  return Math.max(0, Math.floor(number));
}

function readUsageNumber(value: unknown): number | undefined {
  const number = readFiniteNumber(value);
  if (number === undefined || number < 0) return undefined;
  return Math.floor(number);
}

export function normalizeStatusLineMetadata(
  input: StatusLineMetadataInput = {},
): StatusLineMetadata {
  const usageState = input.usageState ?? {};
  const lastUsage = usageState.lastUsage ?? usageState.usage ?? {};
  const aggregateUsage = usageState.usage ?? {};

  return {
    model:
      readString(input.model) ??
      readString(usageState.resolvedRef) ??
      readString(usageState.model) ??
      readString(usageState.requested) ??
      readString(usageState.provider),
    durationMs:
      readFiniteNumber(input.durationMs) ?? readFiniteNumber(usageState.durationMs),
    contextUsedTokens: readUsageNumber(usageState.contextUsedTokens),
    contextTokenBudget: readUsageNumber(usageState.contextTokenBudget),
    inputTokens: readUsageNumber(lastUsage.input),
    outputTokens: readUsageNumber(lastUsage.output),
    totalTokens:
      readUsageNumber(lastUsage.total) ?? readUsageNumber(aggregateUsage.total),
    toolCalls: readNonNegativeInteger(input.toolCalls) ?? 0,
  };
}

