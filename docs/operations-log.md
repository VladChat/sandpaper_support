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
