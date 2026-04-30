# Operations Log

## 2026-04-29: Global Assistant Conversation Memory Implementation

### Summary
Implemented global conversation memory system for the embedded AI assistant to maintain context across follow-up questions.

### Changes
- **assets/support-assistant.js**: Added conversation state management layer.
- Storage key: `eQualleAssistantConversationV2` (sessionStorage).
- Conversation config: max 10 turns, 2-hour expiry.
- Context persists during navigation within the same browser session.

### Notes
- This is a global context mechanism, not a phrase-specific fix.
- Assistant prompt structure guides the LLM to recognize follow-ups vs new topics.

## 2026-04-29: Technical Sandpaper Support Persona

### Summary
Updated assistant persona from brand-forward support wording to a neutral technical sanding support specialist.

### Changed Files
- `supabase/functions/support-ai-chat/index.ts`
- `assets/support-assistant.js`
- `docs/operations-log.md`

### Behavior
- Assistant should answer as a practical sandpaper troubleshooting specialist, not a sales bot.
- Avoid repeated brand mentions.
- Mention eQualle only when the user directly asks about the brand, product identity, packaging, listing, order, or seller-specific support.
- Keep answers focused on sandpaper, grit choice, wet/dry sanding, cutting/trimming sheets, surface prep, wood, metal, plastic, paint, primer, clear coat, scratches, clogging, and safe next steps.
- Backend prompt and frontend contextual prompt now use the same non-sales persona direction.

### Required Deployment Note
The Supabase Edge Function `support-ai-chat` must be redeployed after this change because the main assistant persona lives in `supabase/functions/support-ai-chat/index.ts`.

## 2026-04-29: Assistant Follow-up UX Refinement

# Operations Log Entry — Assistant Follow-up UX Refinement

## Change Summary

Adjusted the AI support assistant UX globally, not for specific sample questions.

## Files Changed

- `supabase/functions/support-ai-chat/index.ts`
- `assets/support-assistant.js`
- `assets/supabase-client.js`
- `assets/support-assistant.css`

## Behavior Changes

- Turnstile is now required after the first successful anonymous AI answer.
- Manual follow-up answers are compact chat replies, not repeated structured cards.
- `Avoid` sections are removed from follow-up output and backend instructions.
- Login gate message is simplified to: `Please log in to continue.`
- After `login_required`, the input and Send button are disabled.
- During an AI request, the chat shows an animated `Thinking...` indicator and disables Send until the response returns.

## Validation Required

```powershell
npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

Because `support-ai-chat/index.ts` changed, deploy the Edge Function again through the existing GitHub Actions workflow:

```text
Deploy Support AI Chat
```


## 2026-04-29: Fresh Ask Context and Homepage Submit Behavior Fix

### Change Summary

Fixed two connected global assistant issues:

- New `/ask/?q=...` first answers now start from a fresh standalone question context instead of reusing old browser conversation memory.
- Homepage `Enter` / `Get Answer` now always sends the typed question to the AI answer page instead of automatically opening the top suggested result.

### Files Changed

- `assets/support-assistant.js`

### Behavior Changes

- Fresh `/ask/?q=...` requests reset `conversationMemory`, `lastMatches`, and `clickedPages` before the first AI request.
- Old follow-up history is used only for manual follow-up messages inside the current chat.
- First AI answers explicitly tell the assistant to ignore stale searches, old clicked pages, and irrelevant suggested pages.
- Homepage suggestions remain clickable, but they no longer hijack `Enter` or `Get Answer`.
- Manual follow-up behavior remains compact and continues to use recent conversation context.
- Existing Turnstile, loading indicator, login lock, and compact follow-up behavior are preserved.

### Validation Required

```powershell
node --check assets/support-assistant.js
npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

### Deployment Note

This archive changes frontend JavaScript only. The `support-ai-chat` Edge Function is not changed, so the `Deploy Support AI Chat` workflow is not required for this specific fix unless another backend file is modified later.


## 2026-04-29: Restore First Answer Card and Fix Homepage Submit

# Operations Log Entry — Restore First Answer Card and Fix Homepage Submit

## Change Summary

Fixed two targeted regressions without changing Edge Function logic.

## Files Changed

- `assets/support-assistant.js`
- `assets/support-autocomplete.js`

## Behavior Changes

- Homepage autocomplete suggestions remain clickable.
- Pressing `Enter` or `Get Answer` now always sends the typed text to `/ask/?q=...` instead of opening the first suggested result.
- First `/ask/?q=...` response is forced back into the structured support-card format.
- Manual follow-up answers remain compact chat replies.
- Existing fresh-question context isolation, Turnstile timing, loading indicator, and login gate behavior are preserved.

## Validation Required

```powershell
node --check assets/support-assistant.js
node --check assets/support-autocomplete.js
npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

## Deployment Note

This is a frontend-only fix. The `support-ai-chat` Edge Function was not changed, so the `Deploy Support AI Chat` workflow is not required for this fix.


## 2026-04-29: Support Assistant Modular Refactor

# Operations Log Entry — Modularize Support Assistant Frontend

## Change Summary

Split the large `assets/support-assistant.js` file into smaller browser-loaded modules while preserving the public entrypoint and existing behavior.

## Files Changed

- `assets/support-assistant.js`
- `assets/support-assistant-modules/constants.js`
- `assets/support-assistant-modules/utils.js`
- `assets/support-assistant-modules/storage.js`
- `assets/support-assistant-modules/conversation.js`
- `assets/support-assistant-modules/prompt-builder.js`
- `assets/support-assistant-modules/knowledge.js`
- `assets/support-assistant-modules/renderers.js`
- `assets/support-assistant-modules/shell.js`
- `assets/support-assistant-modules/requester.js`
- `assets/support-assistant-modules/chat.js`
- `assets/support-assistant-modules/pages.js`
- `assets/support-assistant-modules/init.js`
- `assets/support-assistant-modules/README.md`

## Behavior Goal

No behavior changes. This is an architecture-only refactor.

The public API remains:

```js
window.eQualleSupportAssistant.init(options)
```

The main `assets/support-assistant.js` file now loads the module files and queues `init()` calls until the modules are ready.

## Validation Required

```powershell
node --check assets/support-assistant.js
Get-ChildItem .\assets\support-assistant-modules\*.js | ForEach-Object { node --check $_.FullName }
npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

## Deployment Note

This is frontend-only. The `support-ai-chat` Edge Function is not changed, so the `Deploy Support AI Chat` workflow is not required.



# Operations Log Entry — First Answer Card Rendering Cleanup

## Change Summary

Frontend-only cleanup after modular refactor.

## Files Changed

- `assets/support-assistant-modules/renderers.js`
- `assets/support-assistant-modules/prompt-builder.js`

## Behavior Changes

- Removed automatic `Related Guide` rendering from first AI answers.
- Kept `Recommended Page` rendering when matched pages are returned.
- Added a visible-section whitelist for first-answer structured cards.
- Kept follow-up answers as compact chat replies.
- Updated first-answer prompt so the answer can serve as future support-card source data.
- No backend, database, or Edge Function changes.

## Validation Required

```powershell
node --check assets/support-assistant.js

Get-Content .\assets\support-assistant-modules\renderers.js -Raw | node --input-type=module --check
Get-Content .\assets\support-assistant-modules\prompt-builder.js -Raw | node --input-type=module --check

npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

## Deployment Note

This is a frontend-only change. Do not run `Deploy Support AI Chat` unless a backend file is changed separately.



# Operations Log Entry — Compact Turnstile Verification Copy

## Change Summary

Frontend-only cleanup for the Turnstile verification block.

## Files Changed

- `assets/supabase-client.js`
- `assets/support-assistant.css`

## Behavior Changes

- Replaced the verbose verification card copy with one label: `I am not a robot:`.
- Removed visible waiting/success duplicate status messages; Cloudflare Turnstile remains responsible for showing the success state.
- Kept error/expired status messages available only when needed.
- Made the verification card more compact with a fit-content layout.
- No backend, database, or Edge Function changes.

## Validation Required

```powershell
node --check assets/supabase-client.js
npm run build
node scripts/validate-source-integrity.js
node scripts/check-internal-links.js
```

## Deployment Note

This is a frontend-only change. Do not run `Deploy Support AI Chat` unless a backend file is changed separately.

