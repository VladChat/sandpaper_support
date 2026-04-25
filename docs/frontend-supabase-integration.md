# Frontend Supabase Integration

The static site can write limited support telemetry to Supabase with the public anon key. It does not use the service role key and does not call OpenAI from the browser.

## Public Config

Set these values before `assets/config.js` loads:

```html
<script>
  window.SUPABASE_URL = "https://your-project-ref.supabase.co";
  window.SUPABASE_ANON_KEY = "your-public-anon-key";
</script>
```

The repo ships placeholders only. The loaded config is exposed as:

- `window.eQualleConfig.SUPABASE_URL`
- `window.eQualleConfig.SUPABASE_ANON_KEY`

If either value is missing, feedback and search logging are skipped and the site continues to work normally.

## Tables Written

The browser writes to two tables through the Supabase REST API:

- `support_feedback`: answer-page helpful/not-helpful feedback.
- `search_logs`: homepage support-search queries and clicked result paths.

Both writes use the anon key. Row Level Security should allow anonymous inserts only and block anonymous reads.

## Feedback Flow

Problem answer cards show:

- `Was this helpful?`
- `👍 Helpful`
- `👎 Not helpful`
- optional text feedback after `Not helpful`

Submitted fields include page path, problem slug, feedback type, rating, optional message, and user agent. Feedback is non-blocking; failed or disabled logging does not break the support page.

## Search Log Flow

When a customer types in the homepage search box, the frontend records the query and result count after a short debounce. When a suggestion is clicked, it records the same query with the selected path.

This helps improve aliases, taxonomy, and missing support coverage without changing the static-first support flow.

## Not Exposed

The frontend intentionally does not expose:

- Supabase service role key
- database password
- OpenAI API key
- AI assistant system instructions
- private feedback, logs, AI messages, or draft solution cards

OpenAI integration belongs behind the secure backend endpoint, not in static browser JavaScript.
