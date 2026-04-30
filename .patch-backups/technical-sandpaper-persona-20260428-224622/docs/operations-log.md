# Operations Log

## 2026-04-29: Global Assistant Conversation Memory Implementation

### Summary
Implemented global conversation memory system for the embedded AI assistant to maintain context across follow-up questions.

### Changes
- **assets/support-assistant.js**: Added conversation state management layer
  - Storage key: `eQualleAssistantConversationV2` (sessionStorage)
  - Conversation config: max 10 turns, 2-hour expiry
  - Core functions:
    - `getConversationState()` - Loads and validates conversation state, handles expiry
    - `saveConversationState(state)` - Persists state to sessionStorage
    - `addConversationTurn(role, text, extra)` - Records user/assistant turns with page context
    - `summarizeAssistantText(text)` - Compacts assistant responses (500 char max)
    - `getRecentConversationText()` - Formats recent turns as context string
    - `buildPageContext()` - Captures current page path, title, and solution context
    - `buildAssistantPrompt(currentUserMessage)` - Constructs contextual system prompt
  - Updated `createAssistantRequester()` to:
    - Record user turns before API call
    - Build contextual prompt using `buildAssistantPrompt()`
    - Record assistant replies after API response
  - Conversation storage structure (eQualleAssistantConversationV2):
    ```json
    {
      "sessionId": "conv-...",
      "createdAt": "ISO datetime",
      "updatedAt": "ISO datetime",
      "lastPage": {"path": "...", "title": "..."},
      "turns": [
        {"role": "user|assistant", "text": "...", "pagePath": "...", "pageTitle": "...", "at": "ISO datetime"}
      ]
    }
    ```

### Scope
- Global implementation across all pages with embedded assistant:
  - `/ask/` page
  - Solution pages (/solutions/*)
  - Problem pages (/problems/*)
  - Any current or future page using the assistant

### Architecture
- Uses sessionStorage (not localStorage) to keep context within session
- Maintains max 10 turns for context without token bloat
- Expires automatically after 2 hours of inactivity
- Preserves backward compatibility with existing `assistantMessages` storage
- Context persists during navigation within same session

### Testing
- Source integrity validation: PASSED
- Internal link check: PASSED (0 broken links)
- Manual browser testing of conversation flow across pages

### Notes
- This is a global context mechanism, not phrase-specific
- Assistant prompt structure guides LLM to recognize follow-ups vs new topics
- Context remains available even if user navigates between pages
- Structured answer rendering maintained with existing section titles
