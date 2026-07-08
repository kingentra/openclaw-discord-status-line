# OpenClaw Discord Status Line

Draft v0.1 scaffold for an OpenClaw plugin that appends a compact status line to outgoing Discord replies.

## Draft Warning

This repo is not live-installed yet. It has not been loaded into OpenClaw, and the install path below is unverified. Do not copy it into `~/.openclaw`, enable it in runtime config, or restart OpenClaw until the hook contract has been tested in a disposable OpenClaw setup.

## What This Is

`openclaw-discord-status-line` is an OpenClaw-specific port of the Hermes Discord status line idea. The v0.1 goal is deliberately small: append passive response metadata to the same Discord reply OpenClaw is already sending.

Default full template:

```text
-# *{duration} • ctx {ctx_pct} • {tokens} • tools:{tool_calls} • {model}*
```

Fallback when token/context metadata is missing:

```text
-# *{duration} • tools:{tool_calls} • {model}*
```

## Difference From Hermes

This is not a direct Hermes plugin copy. Hermes and OpenClaw have different runtime surfaces. This draft targets OpenClaw plugin hooks, especially the observed `reply_payload_sending` hook and reply usage metadata. It avoids Hermes-specific assumptions about session state, Discord send behavior, or status message delivery.

## Why Inline Append In v0.1

Inline append is the safest first version because it does not need Discord bot token access, does not call Discord directly, and does not create a second follow-up message. A separate follow-up send could interact badly with reply routing, bot-loop protection, durable delivery, or Discord rate limits. The blade stays small until the edge is proven.

## Draft Install Path

Unverified OpenClaw install concept:

1. Package or copy this plugin as a local OpenClaw plugin.
2. Enable the plugin in OpenClaw config with `enabled: true`.
3. Allow the `reply_payload_sending` hook.
4. Restart or reload OpenClaw through the approved OpenClaw workflow.
5. Test in a non-production Discord channel first.

Do not treat that as a live install recipe yet. The exact plugin placement and config shape still need confirmation against OpenClaw's loader.

## Config Example

See [examples/openclaw.config.example.json](examples/openclaw.config.example.json).

```json
{
  "plugins": {
    "openclaw-discord-status-line": {
      "enabled": false,
      "hooks": {
        "allowConversationAccess": false,
        "timeoutMs": 1000
      },
      "config": {
        "enabled": true,
        "channels": ["discord"],
        "template": "-# *{duration} • ctx {ctx_pct} • {tokens} • tools:{tool_calls} • {model}*",
        "fallbackTemplate": "-# *{duration} • tools:{tool_calls} • {model}*",
        "includeWhenUnknown": true,
        "separator": "\n\n"
      }
    }
  }
}
```

## Template Fields

- `{duration}`: wall-clock turn duration, for example `850ms`, `12s`, or `1m04s`
- `{ctx_pct}`: end-of-turn context usage percentage, including `<1%`
- `{tokens}`: token summary, usually `tok input/output`
- `{tool_calls}`: number of observed tool calls in the turn
- `{model}`: resolved provider/model reference when available

Unknown values render as `unknown`. If token or context metadata is unavailable, the fallback template is used.

## Security Notes

This plugin should not expose session IDs, account IDs, sender IDs, raw prompts, private channel names, tool arguments, tool results, or secrets in status lines. Status lines should stay limited to high-level operational metadata.

## Safety Notes

v0.1 does not access the Discord token directly. It does not call Discord REST APIs. It does not send separate follow-up messages. It only attempts to modify the outbound reply payload through OpenClaw's hook system.

## Development Status

- Pure formatting helpers exist and are covered by local tests.
- `src/index.ts` is a draft integration shim for `reply_payload_sending`, `turn_start`, and `after_tool_call`.
- The exact public OpenClaw plugin registration API still needs live loader verification.
- No GitHub repo has been created yet.
- No OpenClaw runtime files have been modified.

