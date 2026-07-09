export type StatusLineConfig = {
  enabled: boolean;
  channels: string[];
  channelIds: string[];
  template: string;
  fallbackTemplate: string;
  includeWhenUnknown: boolean;
  separator: string;
};

export const DEFAULT_TEMPLATE =
  "-# *{duration} • ctx {ctx_pct} • {tokens} • tools:{tool_calls} • {model}*";

export const DEFAULT_FALLBACK_TEMPLATE =
  "-# *{duration} • tools:{tool_calls} • {model}*";

export const DEFAULT_CONFIG: StatusLineConfig = {
  enabled: false,
  channels: ["discord"],
  channelIds: [],
  template: DEFAULT_TEMPLATE,
  fallbackTemplate: DEFAULT_FALLBACK_TEMPLATE,
  includeWhenUnknown: true,
  separator: "\n\n",
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_CONFIG.channels;
  const channels = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return channels.length > 0 ? channels : DEFAULT_CONFIG.channels;
}

function readChannelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_CONFIG.channelIds;
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function resolveStatusLineConfig(input: unknown): StatusLineConfig {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    enabled: readBoolean(source.enabled, DEFAULT_CONFIG.enabled),
    channels: readChannels(source.channels),
    channelIds: readChannelIds(source.channelIds),
    template: readString(source.template, DEFAULT_CONFIG.template),
    fallbackTemplate: readString(
      source.fallbackTemplate,
      DEFAULT_CONFIG.fallbackTemplate,
    ),
    includeWhenUnknown: readBoolean(
      source.includeWhenUnknown,
      DEFAULT_CONFIG.includeWhenUnknown,
    ),
    separator: readString(source.separator, DEFAULT_CONFIG.separator),
  };
}
