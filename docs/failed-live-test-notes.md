# Failed Live Test Notes

This note records a controlled live-test failure in generic, public-safe terms.
It intentionally excludes real channel IDs, local operator paths, tokens,
private logs, raw prompts, tool arguments, tool results, and private config
values.

## Expected Result

The plugin was expected to load into OpenClaw, receive the
`reply_payload_sending` hook event for a Discord reply, append a compact status
footer to the outgoing reply payload, and let OpenClaw deliver that mutated
payload as the same Discord reply.

The expected visible reply shape was:

```text
STATUS LINE TEST OK

-# *...status metadata...*
```

## Observed Result

The delivered reply contained only:

```text
STATUS LINE TEST OK
```

No appended footer was seen in durable delivery state. That means this plugin
did not successfully mutate the outgoing Discord reply payload during the test.

## Rollback Completed

Rollback was completed after the test. The safe rollback state was verified as:

- `plugins.load.paths` was `null`
- the `openclaw-discord-status-line` plugin entry was `null`
- the plugin was not listed
- OpenClaw health was OK

## Current Safe State

The repository remains a draft plugin scaffold. Local tests cover formatting,
metadata handling, and the current hook return-shape assumption, but live hook
integration is not proven.

No live install is recommended until the OpenClaw hook payload and mutation
return contract are verified in a controlled, non-production path.

## Probable Causes

The failure is consistent with one or more of these causes:

- Plugin not loaded.
- `reply_payload_sending` hook not firing for the tested delivery path.
- Payload shape mismatch between the live hook event and this draft plugin.
- Mutation return contract mismatch between OpenClaw and this draft plugin.
- CLI delivery path may bypass the Discord reply hook.

## Opt-In Diagnostic Mode Design

Any diagnostic mode must be disabled by default and operator-enabled only for a
short controlled test. It must be safe for a public repository and safe to share
as summarized output.

Diagnostic mode must never log:

- tokens, secrets, API keys, auth headers, or config values
- raw prompts or model output text
- tool arguments or tool results
- private channel names
- user IDs, account IDs, sender IDs, or Discord channel IDs
- full conversation IDs, session IDs, message IDs, or request IDs
- private file paths or private logs

Diagnostic mode may log only safe structural facts:

- hook name
- whether the plugin config resolved to enabled or disabled
- whether a payload object was present
- safe payload field names present, for example `text`, `body`, or `content`
- whether a readable text field was present, without logging its value
- whether usage metadata was present, without logging values
- count of top-level safe field names
- platform field presence and whether it matched a generic configured platform
- channel-id presence as a boolean only, never the ID
- whether the handler returned a mutation object

Suggested config shape, disabled by default:

```json
{
  "diagnostics": {
    "enabled": false,
    "safeStructuralLogging": true
  }
}
```

Suggested diagnostic event example:

```json
{
  "hook": "reply_payload_sending",
  "configEnabled": true,
  "payloadPresent": true,
  "payloadFieldNames": ["text"],
  "readableTextPresent": true,
  "usageStatePresent": false,
  "safeTopLevelFieldCount": 3,
  "platformPresent": true,
  "platformMatched": true,
  "channelIdPresent": true,
  "returnedMutation": true
}
```

The example above is intentionally structural. It contains no values that could
identify a user, channel, message, prompt, result, token, local machine, or
private runtime configuration.

## Next Investigation Step

Before another live install, confirm the OpenClaw `reply_payload_sending`
payload shape and mutation return contract with safe structural diagnostics or a
minimal host-side fixture. Do not enable the plugin in a live profile until that
contract is verified.
