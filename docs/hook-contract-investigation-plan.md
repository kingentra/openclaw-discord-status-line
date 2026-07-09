# Hook Contract Investigation Plan

This plan defines how to learn the real OpenClaw `reply_payload_sending`
payload and mutation contract without exposing private runtime data. It is a
design note only; it is not a live-test record or an install guide.

## Current Unknowns

The failed live test proved only that the footer was not appended to the
delivered Discord reply. It did not prove why. The likely blocker is that this
draft plugin does not yet know the exact live hook payload shape or mutation
return contract.

The current draft handler is intentionally defensive and assumes these payload
text fields may exist:

- `payload.text`
- `payload.body`
- `payload.content`

It also assumes that OpenClaw may accept one of these mutation styles:

- a returned wrapper object shaped like `{ payload: updatedPayload }`
- an in-place mutation of `event.payload`
- both in-place mutation and a returned wrapper object

None of those mutation styles is proven for the live Discord reply path yet.

## Exact Hook Data To Learn

A later controlled diagnostic test needs to learn only structural facts:

- Whether the plugin is loaded.
- Whether `registerHook` is called.
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
- Whether the handler attempts an in-place mutation.
- Whether the handler returns a mutation value.
- Whether the delivered reply includes the diagnostic footer.

## Safe Field Names To Log

Diagnostic output may include only safe field names, booleans, counts, and
generic presence flags:

- `hook`
- `pluginLoaded`
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
- `usageStateObject`
- `contextPresent`
- `contextObject`
- `conversationIdPresent`
- `platformPresent`
- `platformMatched`
- `configuredChannelIdAllowlistPresent`
- `attemptedInPlaceMutation`
- `returnedMutation`
- `deliveredFooterPresent`

Field-name lists must be allowlisted to structural keys such as `channel`,
`kind`, `payload`, `usageState`, `text`, `body`, and `content`. Unknown field
names should be counted but not printed unless they are manually reviewed and
added to the allowlist.

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
3. `api.registerHook("reply_payload_sending", ...)` called.
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
generic diagnostic marker. The handler can safely attempt both mutation styles:

1. Create an updated payload that preserves original safe payload fields.
2. Mutate the detected text field on `event.payload` in place.
3. Return a wrapper object shaped like `{ payload: event.payload }`.
4. Log only `attemptedInPlaceMutation: true` and `returnedMutation: true`.
5. Check the delivered reply for the diagnostic footer.

Interpretation:

- If the handler fires and the footer appears, at least one attempted mutation
  style worked. A follow-up fixture or host-side inspection is needed to narrow
  which one.
- If the handler fires, payload text is readable, mutation is attempted, and the
  footer does not appear, OpenClaw may require a different return shape or may
  ignore reply mutations for that delivery path.
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
