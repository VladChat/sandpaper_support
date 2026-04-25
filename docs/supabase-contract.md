# Supabase Contract

This document defines the first backend foundation for the eQualle Sandpaper Support System. It does not add product claims, secret values, or live AI provider calls.

## Database Purpose

Supabase stores operational support data that should not live in the static site:

- `support_feedback`: page-level feedback from customers.
- `search_logs`: customer search phrases, result counts, and selected paths.
- `ai_sessions`: support assistant session records.
- `ai_messages`: assistant and customer messages tied to a session.
- `draft_solution_cards`: proposed support answers that require review before publishing.
- `content_sync_queue`: internal queue for approved content changes that need to sync into the static content model.

Core support content remains static-first. Supabase supports feedback, measurement, assistant routing, and controlled content review.

## AI Chat Contract

Endpoint:

```text
POST /functions/v1/support-ai-chat
```

Request body:

```json
{
  "sessionToken": "public-session-token",
  "userMessage": "I still see scratches after sanding",
  "context": {
    "currentPath": "/problems/scratches-too-deep/",
    "problemSlug": "scratches-too-deep",
    "surface": "wood",
    "stage": "prep",
    "grit": "320",
    "method": "dry"
  }
}
```

Response body:

```json
{
  "reply": "Support AI is not enabled yet. Use the support pages for approved troubleshooting guidance.",
  "needsClarification": true,
  "clarifyingQuestion": "What surface are you sanding, and what grit are you using now?",
  "matchedPages": [],
  "draftCreated": false
}
```

The placeholder function validates `POST` requests and required fields only. A later implementation may retrieve approved support content, create or update AI session records, and route users to exact pages. It must not answer from unsupported knowledge.

## Feedback Flow

Customers can submit feedback for a support page without logging in. Anonymous users may insert into `support_feedback`, but cannot read feedback.

Expected public fields:

- page path
- problem slug when known
- rating or feedback type
- optional message
- user agent metadata when supplied by the frontend

Review and reporting require service/admin access.

## Search Log Flow

Customers can search with symptom-like phrasing. Anonymous users may insert into `search_logs`, but cannot read logs.

Expected public fields:

- raw query
- normalized query
- result count
- selected path when a result is clicked
- session token when available

Search logs are for improving taxonomy, aliases, and missing content coverage.

## Draft Card Approval Flow

`draft_solution_cards` is private. It is intended for proposed support answers from internal tools or future AI-assisted workflows.

Drafts must not become public content automatically. Approval requires service/admin access, validation of product facts, and review against the project rule: no unsupported grit, compatibility, or product claims.

Approved draft cards can be queued in `content_sync_queue` for a later static-content sync process.
