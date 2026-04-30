# Support Assistant Modules

This folder contains the modularized implementation that used to live inside `assets/support-assistant.js`.

`assets/support-assistant.js` remains the public entry file and still exposes:

```js
window.eQualleSupportAssistant.init(options)
```

Future edits should target the smallest relevant module:

- `prompt-builder.js` — first-answer and follow-up prompt rules
- `renderers.js` — structured card and compact answer rendering
- `chat.js` — sending, loading state, login lock, first-answer vs follow-up rendering
- `pages.js` — homepage submit, `/ask/?q=...`, and solution follow-up setup
- `knowledge.js` — local data matching and retrieved context
- `conversation.js` / `storage.js` — browser session and fresh-question context

No UX behavior is intentionally changed by this refactor.
