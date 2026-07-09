# OpenClaw Plugin Runtime Research

## Executive summary

Primary OpenClaw documentation and source were checked against upstream commit
`30b3a7cdeda9f43413038125917a43b2065d32b5`, whose latest release at research
time was `v2026.6.11`.

The modern OpenClaw runtime contract for this plugin is partially found and
strong enough to guide the next code change:

- Native plugins need `openclaw.plugin.json` in the plugin root.
- Runtime entrypoints are declared in `package.json` under `openclaw.extensions`
  and, for installed packages, optional built JavaScript peers under
  `openclaw.runtimeExtensions`.
- Every plugin exports a default plugin entry object. The documented helper is
  `definePluginEntry(...)`.
- The preferred hook registration API is `api.on(...)`, not `api.registerHook(...)`.
- The outgoing normalized reply hook is `reply_payload_sending`.
- `reply_payload_sending` mutates delivery by returning `{ payload: nextPayload }`
  or suppresses delivery with `{ cancel: true }`.
- The hook runner passes a cloned payload into each handler and does not rely on
  in-place mutation.

The remaining uncertainty is not the upstream hook contract. It is whether the
specific already-tested live path actually loaded this plugin entry, whether the
active Gateway was restarted after runtime changes, and whether the diagnostic
message path produced a normalized Discord reply payload rather than a CLI-only
or non-delivery result.

Final verdict: `PARTIAL_RUNTIME_CONTRACT_FOUND`.

## Sources and links checked

- OpenClaw repository:
  <https://github.com/openclaw/openclaw>
- OpenClaw plugin guide:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/tools/plugin.md>
- Manage plugins:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/plugins/manage-plugins.md>
- Plugin entrypoints:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/plugins/sdk-entrypoints.md>
- Plugin setup and config:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/plugins/sdk-setup.md>
- Plugin manifest:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/plugins/manifest.md>
- Plugin hooks:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/docs/plugins/hooks.md>
- Reply payload hook implementation:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/auto-reply/reply/reply-payload-sending-hook.ts>
- Reply routing implementation:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/auto-reply/reply/route-reply.ts>
- Auto-reply dispatch implementation:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/auto-reply/dispatch.ts>
- Outbound delivery implementation:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/infra/outbound/deliver.ts>
- Hook types:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/plugins/hook-types.ts>
- Hook runner:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/plugins/hooks.ts>
- Plugin registry API wiring:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/plugins/registry.ts>
- Package entry resolution:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/plugins/package-entry-resolution.ts>
- Reply payload hook tests:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/src/plugins/wired-hooks-reply-payload-sending.test.ts>
- Known-working bundled plugin examples:
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/extensions/thread-ownership/index.ts>
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/extensions/workboard/index.ts>
  <https://github.com/openclaw/openclaw/blob/30b3a7cdeda9f43413038125917a43b2065d32b5/extensions/codex/index.ts>

## Evidence found

### Install and load mechanism

OpenClaw recognizes native plugins by a required `openclaw.plugin.json` plus
runtime module entries declared in `package.json#openclaw.extensions`.

The plugin guide lists install sources as ClawHub, npm, git, local path, and
marketplace-compatible bundles. For local development, it documents both:

- `openclaw plugins install ./my-plugin`
- `openclaw plugins install --link ./my-plugin`

It also documents `plugins.load.paths` for explicit local plugin files or
directories, and says standalone plugin files belong there rather than in the
managed install flow.

The same guide states that installing, updating, or uninstalling plugin code
requires a Gateway restart unless a managed Gateway restarts automatically. It
also distinguishes cold inventory checks from runtime proof: `plugins list` and
plain `plugins inspect` do not prove that an already-running Gateway imported
plugin code; `plugins inspect <id> --runtime --json` is the runtime proof path.

### Entrypoint contract

`docs/plugins/sdk-entrypoints.md` says every plugin exports a default entry
object. For non-channel hook/capability plugins, the documented helper is:

```ts
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "my-plugin",
  name: "My Plugin",
  description: "Short summary",
  register(api) {
    // runtime registration here
  },
});
```

The required fields for `definePluginEntry` are `id`, `name`, `description`,
and `register(api)`. The `id` must match `openclaw.plugin.json`.

Package entry resolution confirms that `openclaw.runtimeExtensions`, when
present, is treated as a built runtime entry. It must match
`openclaw.extensions` length, remain inside the package, and exist. Installed
packages with TypeScript source entries require compiled JavaScript unless
OpenClaw is in a source/local-development path that permits source fallback.

### Hook registration contract

The preferred plugin hook API is `api.on(name, handler, opts?)`.

`docs/tools/plugin.md` explicitly separates the two APIs:

- `api.on(...)` is the typed hook surface for runtime lifecycle events.
- `api.registerHook(...)` is for the internal HOOK-style automation system.

The quick rule from the docs is that handlers needing priority, merge semantics,
or block/cancel behavior should use typed hooks.

`docs/plugins/hooks.md` documents `api.on(...)` and shows options:

- `priority`
- `timeoutMs`

The registry source wires `api.on(...)` to `registerTypedHook(...)`, which checks
that the hook name is in `PLUGIN_HOOK_NAMES`, applies per-plugin hook policy,
resolves timeout, and pushes the registration into `registry.typedHooks`.

`api.registerHook(...)` is present, but registry source shows it registers
internal hooks through the internal hook system. That is the wrong primary API
for `reply_payload_sending`.

### Outgoing reply hook name

The exact hook name is `reply_payload_sending`.

Evidence:

- `docs/plugins/hooks.md` lists `reply_payload_sending` under Messages and
  delivery.
- `src/plugins/hook-types.ts` includes `reply_payload_sending` in
  `PluginHookName` and `PLUGIN_HOOK_NAMES`.
- `src/auto-reply/reply/reply-payload-sending-hook.ts` checks
  `hookRunner.hasHooks("reply_payload_sending")`.
- `src/plugins/wired-hooks-reply-payload-sending.test.ts` registers and runs
  `reply_payload_sending` handlers.

### Payload mutation contract

The contract is return-based.

The hook event shape from `src/plugins/hook-types.ts` is:

```ts
type PluginHookReplyPayloadSendingEvent = {
  payload: PluginHookReplyPayload;
  kind: ReplyDispatchKind;
  channel?: string;
  sessionKey?: string;
  runId?: string;
  usageState?: PluginHookReplyUsageState;
};
```

The context is `PluginHookMessageContext`, which can include fields such as
`channelId`, `accountId`, `conversationId`, `sessionKey`, `runId`, and sender or
trace fields when available.

The result shape is:

```ts
type PluginHookReplyPayloadSendingResult = {
  payload?: PluginHookReplyPayload;
  cancel?: boolean;
  reason?: string;
};
```

The hook runner clones the current payload into each handler, accepts a returned
`payload`, then passes that accepted payload to the next handler. If a handler
returns `cancel: true`, the runner stops lower-priority handlers.

`src/auto-reply/reply/reply-payload-sending-hook.ts` treats `result.payload` as
the updated payload and `result.cancel` as delivery suppression. If no payload is
returned, it keeps the original payload.

The upstream tests prove these behaviors:

- Higher-priority handler output becomes the next handler's input.
- Returning `{ payload: { text: "..." } }` changes the final payload.
- Returning `{ cancel: true, reason: "..." }` stops delivery.
- `trustedLocalMedia` is hidden from plugins and cannot be granted by plugins.
- Runtime-owned metadata is preserved across plugin edits.

No primary source found in this pass says in-place mutation is accepted as the
mutation contract. The runner passes a fresh event object with a plugin-visible
payload clone, then reads only the handler return value.

### How OpenClaw calls plugin code

OpenClaw builds an `OpenClawPluginApi` with `pluginConfig`, `registrationMode`,
runtime helpers, and registration methods. During plugin load, the plugin's
default entry object is evaluated and its `register(api)` callback is invoked in
the current registration mode.

Important registration modes from `docs/plugins/sdk-entrypoints.md`:

- `full`: normal Gateway startup; register everything.
- `discovery`: non-activating capability discovery.
- `tool-discovery`: capability/tool registration only.
- `setup-only` and `setup-runtime`: setup surfaces only.
- `cli-metadata`: CLI descriptors only.

For a hook-only plugin, the relevant mode is `full`. Discovery mode may evaluate
entry code, so top-level imports should remain side-effect-free.

### Delivery path evidence

`src/auto-reply/dispatch.ts` installs a `reply_payload_sending` before-deliver
hook into inbound reply dispatchers. It passes:

- normalized payload
- reply kind
- channel from finalized context
- session key
- run id
- `usageState` from the run-state store
- message context

`src/auto-reply/reply/route-reply.ts` routes replies to channels through durable
message delivery and passes `replyPayloadSendingHook` with channel, account,
conversation, session, sender, and run metadata.

`src/infra/outbound/deliver.ts` applies `reply_payload_sending` before
`message_sending`. If the reply payload hook returns cancel, delivery is
suppressed with reason `cancelled_by_reply_payload_sending_hook`. If the mutated
reply becomes empty, delivery is suppressed with reason
`empty_after_reply_payload_sending_hook`.

This means the normal inbound reply and durable outbound delivery path should
run `reply_payload_sending`. A pure CLI stdout response, or any test path that
does not route a normalized channel reply through dispatcher/durable delivery,
would not prove Discord reply mutation.

## Known-working example paths

Known upstream examples of default plugin entries using `definePluginEntry` and
`api.on(...)`:

- `extensions/thread-ownership/index.ts`: registers `message_received` and
  `message_sending` typed hooks with `api.on(...)`.
- `extensions/workboard/index.ts`: registers `subagent_ended` with `api.on(...)`.
- `extensions/codex/index.ts`: registers typed hooks such as `inbound_claim`,
  `after_compaction`, and `session_end`.
- `docs/plugins/hooks.md`: includes a hook plugin quick-start using
  `definePluginEntry` and `api.on("before_tool_call", ...)`.

The most relevant mutation example is `thread-ownership`, because it uses the
same typed message-hook family and returns a cancel result from
`message_sending`.

## What remains unknown

- Whether the previous live test used an active Gateway process that had loaded
  the current plugin source after the most recent runtime edit.
- Whether the previous diagnostic path used `plugins inspect --runtime --json`
  or another non-Discord path that can load/discover a plugin without exercising
  a normalized Discord reply payload.
- Whether the current package metadata caused OpenClaw to load a TypeScript
  source entry or expect a built JavaScript runtime entry in that environment.
- Whether the previous diagnostic message was sent through the inbound reply
  dispatcher, durable outbound delivery, direct CLI output, or another path.
- The exact Discord adapter payload shape beyond the normalized
  `ReplyPayload` contract. Source inspection shows `text` is a valid normalized
  field, but adapter-specific media/presentation behavior was not live-proven.

## Recommended next implementation change

Change the plugin to the modern typed hook contract:

1. Make the default export a `definePluginEntry(...)` result.
2. Register with `api.on("reply_payload_sending", handler, { priority, timeoutMs })`.
3. Return `{ payload: updatedPayload }` only when changing the payload.
4. Return `undefined` when no change is needed.
5. Do not rely on in-place mutation.
6. Treat `api.registerHook(...)` as internal-hook compatibility only, not as the
   reply mutation path.

Also fix package entry metadata before any install-style test:

- For local source development, keep `openclaw.extensions: ["./src/index.ts"]`
  and remove `runtimeExtensions` unless built JavaScript exists.
- For install/package testing, build JavaScript and set
  `openclaw.runtimeExtensions` to the built `dist` entry.

## Recommended next safe test

Before touching Discord, use a non-delivery runtime proof path:

1. Verify the plugin is discoverable and enabled through cold inspection.
2. Verify runtime registration with `plugins inspect <id> --runtime --json`.
3. Confirm the runtime output reports a typed hook registration for
   `reply_payload_sending`.
4. Keep diagnostics structural only: hook name, registration count, and whether
   the plugin entry registered a typed hook. Do not print config values, message
   text, identifiers, local runtime paths, or logs.

Only after that proof should a separate operator-approved Discord test send one
generic message through the real inbound reply path.

## Should this repo change specific files?

`src/index.ts`: yes. It should prefer `definePluginEntry` and `api.on` and stop
treating `api.registerHook` as the main reply hook registration surface. The
handler should return `{ payload }` and should not depend on in-place mutation.

`openclaw.plugin.json`: no required change found for the hook contract. It
already has a native plugin id and config schema. Keep it strict and
public-safe.

`package.json`: yes, although this was not one of the three named files in the
prompt. The current runtime entry metadata should match OpenClaw's source vs
built-entry expectations before another install-style test.

Install docs: yes. The docs should distinguish local development source loading
from installed-package runtime loading, and should say runtime proof requires
`plugins inspect <id> --runtime --json` after Gateway reload/restart.

## Final verdict

`PARTIAL_RUNTIME_CONTRACT_FOUND`

The upstream plugin runtime and hook contracts are found. The live environment
path that previously failed is not proven, so the next step should be a
non-Discord runtime registration proof before another delivery test.
