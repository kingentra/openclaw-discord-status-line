# Hook Contract Investigation Plan

This plan defines how to verify the patched OpenClaw `reply_payload_sending`
entry and payload contract without exposing private runtime data. It is a
design note only; it is not a live-test record or an install guide.

## Current Unknowns

The failed live test proved only that the footer was not appended to the
delivered Discord reply. It did not prove why. Later research found the modern
runtime contract: default plugin entry, `api.on("reply_payload_sending", ...)`,
and return-based mutation with `{ payload: updatedPayload }`.

The current patched handler still handles these safe payload text fields because
the live Discord payload shape has not been re-tested:

- `payload.text`
- `payload.body`
- `payload.content`

It uses the evidence-backed mutation style:

- a returned wrapper object shaped like `{ payload: updatedPayload }`

In-place mutation of `event.payload` is not the primary contract and is not used
by the patched handler. The remaining unknown is whether this plugin entry is
loaded in the live Gateway path being tested and whether that path produces a
normalized Discord reply payload.

## Exact Hook Data To Learn

A later controlled diagnostic test needs to learn only structural facts:

- Whether the plugin is loaded.
- Whether `api.on` is called for `reply_payload_sending`.
- Whether `registerHook` is avoided on the primary runtime path.
- Whether the registered `reply_payload_sending` handler is called.
- Whether the hook event is an object.
- Which safe top-level event field names are present.
- Whether `event.payload` is present and object-shaped.
- Which safe payload field names are present.
- Which payload text field, if any, is readable as a string.
- Whether `usageState` is present and object-shaped.
- Whether context is present and object-shaped.
- Whether context includes a conversation/channel identifier field, as a
  boolean only.
- Whether the handler avoids in-place mutation.
- Whether the handler returns a mutation value.
- Whether the delivered reply includes the diagnostic footer.

## Safe Field Names To Log

Diagnostic output may include only safe field names, booleans, counts, and
generic presence flags:

- `hook`
- `pluginLoaded`
- `apiOnCalled`
- `registerHookCalled`
- `handlerCalled`
- `eventObject`
- `eventFieldNames`
- `payloadPresent`
- `payloadObject`
- `payloadFieldNames`
- `readableTextFieldName`
- `readableTextPresent`
- `usageStatePresent`
- `contextPresent`
- `platformPresent`
- `platformMatched`
- `channelIdPresent`
- `attemptedInPlaceMutation`
- `returnedMutation`

`payloadFieldNames` must be filtered to the allowlisted payload keys `text`,
`body`, and `content`. `readableTextFieldName` may only be one of those same
three names. Unknown field names must not be printed.

The current implementation collects this summary only through an explicit
diagnostic recorder callback when both `diagnostics.enabled` and
`diagnostics.safeStructuralLogging` are true. It does not print diagnostics to
console by default.

## Data That Must Never Be Logged

Diagnostic mode must never log:

- tokens, secrets, API keys, auth headers, or config values
- raw prompts, raw replies, message text, or model output text
- tool arguments or tool results
- private channel names
- user IDs, account IDs, sender IDs, Discord channel IDs, message IDs, request
  IDs, session IDs, or full conversation IDs
- local machine paths or runtime config paths
- private logs
- environment variable values
- stack traces that may contain private paths or runtime config values

When in doubt, log a boolean or count instead of a value. The blade stays in
the sheath until the contract is known.

## Verify Whether The Hook Fires

In a later controlled live test, use an opt-in diagnostic mode that is disabled
by default. The test should record only these structural milestones:

1. Plugin module loaded.
2. `register(api)` called.
3. `api.on("reply_payload_sending", ...)` called.
4. Handler invoked for a generic Discord reply event.
5. Handler saw an object-shaped event.
6. Handler saw object-shaped payload.
7. Handler saw a readable text field without logging text.

If milestones 1-3 appear but milestone 4 does not, the plugin loaded but the
tested delivery path probably did not fire `reply_payload_sending`.

If milestone 4 appears without payload/text milestones, the hook fires but the
payload shape differs from the current draft assumptions.

## Verify The Mutation Contract

The later controlled test should attempt one footer append using a short,
generic diagnostic marker. The handler should use the researched return-based
mutation contract:

1. Create an updated payload that preserves original safe payload fields.
2. Return a wrapper object shaped like `{ payload: updatedPayload }`.
3. Log only `attemptedInPlaceMutation: false` and `returnedMutation: true`.
4. Check the delivered reply for the diagnostic footer.

Interpretation:

- If the handler fires and the footer appears, the researched return-based
  mutation style worked in the live Discord reply path.
- If the handler fires, payload text is readable, return-based mutation is
  attempted, and the footer does not appear, OpenClaw may be using a different
  delivery path, the Gateway may not have loaded the patched entry, or the live
  route may not be producing a normalized reply payload for this hook.
- If the handler does not fire, the blocker is hook registration, plugin
  loading, or a delivery path that bypasses the hook.

The test must not branch into multiple live messages unless the operator
approves that separately. One controlled message is enough to determine the
next safe direction.

## One Controlled Live Test Later

Only after operator approval, use a non-production route and a temporary
diagnostic configuration:

1. Confirm the repository commit under test.
2. Confirm a restore point or rollback plan.
3. Enable diagnostic mode only for the test.
4. Use a generic test footer with no identifiers.
5. Send exactly one test message that should produce one reply.
6. Capture only the safe structural diagnostic summary.
7. Verify whether the delivered reply includes the footer.
8. Disable diagnostics and roll back the plugin state immediately after the
   test unless the operator approves more investigation.

No live install is recommended until the diagnostic implementation is reviewed
and the operator approves the exact test steps.
