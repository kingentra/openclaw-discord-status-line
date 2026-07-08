import { DEFAULT_CONFIG, type StatusLineConfig } from "./config.ts";
import {
  normalizeStatusLineMetadata,
  type StatusLineMetadata,
  type StatusLineMetadataInput,
} from "./metadata.ts";

export type AppendStatusLineResult = {
  text: string;
  appended: boolean;
  statusLine?: string;
};

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || durationMs < 0) return "unknown";
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${trimNumber(seconds, seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m${remainingSeconds}s` : `${minutes}m`;
}

function trimNumber(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits).replace(/\.0$/u, "");
}

function formatContextPercent(metadata: StatusLineMetadata): string | undefined {
  const used = metadata.contextUsedTokens;
  const budget = metadata.contextTokenBudget;
  if (!used || !budget || budget <= 0) return undefined;
  const pct = (used / budget) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.min(999, Math.round(pct))}%`;
}

function formatTokens(metadata: StatusLineMetadata): string | undefined {
  const input = metadata.inputTokens;
  const output = metadata.outputTokens;
  if (input !== undefined && output !== undefined) return `tok ${input}/${output}`;
  if (metadata.totalTokens !== undefined) return `tok ${metadata.totalTokens}`;
  return undefined;
}

function replaceTemplateFields(
  template: string,
  metadata: StatusLineMetadata,
  fields: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/gu, (_match, key: string) => {
    return fields[key] ?? fields.unknown ?? "unknown";
  });
}

export function formatStatusLine(
  input: StatusLineMetadataInput = {},
  config: Partial<StatusLineConfig> = {},
): string | undefined {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!resolvedConfig.enabled) return undefined;

  const metadata = normalizeStatusLineMetadata(input);
  const ctxPct = formatContextPercent(metadata);
  const tokens = formatTokens(metadata);
  const hasFullMetadata = Boolean(ctxPct && tokens);

  if (!resolvedConfig.includeWhenUnknown && !metadata.model) return undefined;

  const fields: Record<string, string> = {
    duration: formatDuration(metadata.durationMs),
    ctx_pct: ctxPct ?? "unknown",
    tokens: tokens ?? "unknown",
    tool_calls: String(metadata.toolCalls),
    model: metadata.model ?? "unknown",
    unknown: "unknown",
  };

  return replaceTemplateFields(
    hasFullMetadata ? resolvedConfig.template : resolvedConfig.fallbackTemplate,
    metadata,
    fields,
  );
}

export function appendStatusLineToText(
  text: string,
  input: StatusLineMetadataInput = {},
  config: Partial<StatusLineConfig> = {},
): AppendStatusLineResult {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  const statusLine = formatStatusLine(input, resolvedConfig);
  if (!statusLine) return { text, appended: false };

  return {
    text: `${text}${resolvedConfig.separator}${statusLine}`,
    appended: true,
    statusLine,
  };
}

