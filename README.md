# OpenClaw Discord Status Line

Draft v0.1.1 scaffold for an OpenClaw plugin that appends a compact status line to outgoing Discord replies.

## Draft Warning

This plugin is not live-installed yet. It has not been loaded into OpenClaw, and no live Discord reply mutation has been tested. Do not copy it into a live OpenClaw profile, enable it in runtime config, or restart OpenClaw until the operator approves a controlled live test.

The intended hook is `reply_payload_sending`. Static inspection of OpenClaw 2026.6.x showed that this hook exists and supports reply payload mutation, but the exact live payload shape and channel metadata still need a one-message non-production test.

## What This Is

`openclaw-discord-status-line` is an OpenClaw-specific status line plugin. The v0.1.1 goal is deliberately small: append passive response metadata to the same Discord reply OpenClaw is already sending.

Default full template:

```text
-# *{duration} • ctx {ctx_pct} • {tokens} • tools:{tool_calls} • {model}*
```

Fallback when token/context metadata is missing:

```text
-# *{duration} • tools:{tool_calls} • {model}*
```

Unknown values render as `unknown`. If metadata is missing or incomplete, the plugin should append the fallback line or do nothing without crashing.

## Hook Scope

v0.1.1 registers only `reply_payload_sending` by default.

The earlier draft referenced `turn_start` and `after_tool_call`; those are not active in this version. `turn_start` is not proven as a plugin hook, and tool-call counting does not have a verified turn-scoped source in the `reply_payload_sending` payload yet. Until a live OpenClaw test proves the correct source, `{tool_calls}` renders as `0`.

## Channel Filtering

The `channels` config is a platform filter.

Example:

```json
"channels": ["discord"]
```

This means "only handle reply events whose OpenClaw hook event reports the `discord` platform." It does not mean "only handle Discord channel ID 123..." and must not be treated as a production per-channel safety control yet.

The optional `channelIds` config is a Discord conversation/channel allowlist. Leave it empty to handle all matching Discord reply events. To restrict the plugin to a test channel, replace the placeholder with your own Discord channel ID:

```json
"channelIds": ["YOUR_TEST_CHANNEL_ID_HERE"]
```

Do not commit real Discord channel IDs to this repository.

## Why Inline Append In v0.1.1

Inline append is the safest first version because it does not need Discord bot token access, does not call Discord directly, and does not create a second follow-up message. A separate follow-up send could interact badly with reply routing, bot-loop protection, durable delivery, or Discord rate limits.

## Draft Install Path Candidates

Static investigation found that OpenClaw can install plugins from local paths, but the exact install surface can vary by host and OpenClaw version.

Do not treat this as a live install recipe yet. Use `openclaw plugins install /path/to/openclaw-discord-status-line` only after the operator approves the live test.

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
        "enabled": false,
        "channels": ["discord"],
        "channelIds": [],
        "template": "-# *{duration} • ctx {ctx_pct} • {tokens} • tools:{tool_calls} • {model}*",
        "fallbackTemplate": "-# *{duration} • tools:{tool_calls} • {model}*",
        "includeWhenUnknown": true,
        "separator": "\n\n"
      }
    }
  }
}
```

Keep both outer `enabled` and inner `config.enabled` false until a controlled test is approved.

## Template Fields

- `{duration}`: wall-clock turn duration, for example `850ms`, `12s`, or `1m04s`
- `{ctx_pct}`: end-of-turn context usage percentage, including `<1%`
- `{tokens}`: token summary, usually `tok input/output`
- `{tool_calls}`: currently `0` until live OpenClaw tool-call metadata is verified
- `{model}`: resolved provider/model reference when available

## Safe One-Message Test Plan

Use this only after the operator explicitly approves install and restart/reload steps.

1. Confirm the git working tree is clean.
2. Back up the relevant OpenClaw config/state before editing anything.
3. Install from `/path/to/openclaw-discord-status-line` only; do not install from npm or an unreviewed source.
4. Enable the plugin with `channels: ["discord"]`, `channelIds: ["YOUR_TEST_CHANNEL_ID_HERE"]`, and a test-only template.
5. Use a non-production Discord test channel or disposable route.
6. Send exactly one message that should produce one OpenClaw reply.
7. Verify the status line appears on the same reply, not as a second message.
8. Confirm no secrets, IDs, prompts, tool arguments, or tool results are exposed.
9. Disable the plugin after the test unless the operator approves continued testing.

## Rollback Plan

1. Disable `openclaw-discord-status-line` in OpenClaw config.
2. Remove the local plugin install through the approved OpenClaw plugin workflow.
3. If OpenClaw copied files, remove only the approved plugin install directory after confirming the path.
4. Restore the pre-test config/state backup if behavior is abnormal.
5. Restart or reload OpenClaw only after the operator approves that operation.

## Security Notes

This plugin should not expose session IDs, account IDs, sender IDs, raw prompts, private channel names, Discord channel IDs, tool arguments, tool results, or secrets in status lines. Status lines should stay limited to high-level operational metadata.

v0.1.1 does not access the Discord token directly. It does not call Discord REST APIs. It does not send separate follow-up messages. It only attempts to modify the outbound reply payload through OpenClaw's hook system.

## Development Status

- Pure formatting helpers exist and are covered by local tests.
- `src/index.ts` registers only the intended `reply_payload_sending` hook.
- Missing metadata and missing payloads are handled defensively.
- Live install, live hook loading, live payload mutation, and real Discord channel ID discovery are still pending controlled verification.
- No OpenClaw runtime files have been modified by this repo.
