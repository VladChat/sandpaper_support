# Supabase Implementation Plan

## Target Architecture

Use one split model:

- GitHub Pages = public support site
- GitHub repo = approved knowledge base and published static content
- Supabase = live state, feedback, search logs, AI conversations, draft support cards
- Supabase Edge Functions = server-side AI endpoint and internal write API

This keeps the public site fast and simple while allowing live collection and AI workflows.

## What Will Be Built

### Block 1 — Database Schema

Create these tables first:

#### 1. support_feedback
- id
- page_slug
- answer_id
- vote (`up` / `down`)
- optional_comment
- created_at

Purpose:
- track whether answer pages are useful
- find weak answers

#### 2. search_logs
- id
- query
- normalized_query
- matched_type
- matched_id
- results_count
- used_ai_fallback
- created_at

Purpose:
- see what users search for
- identify zero-result queries
- identify missing support pages

#### 3. ai_sessions
- id
- session_token
- status (`active` / `resolved` / `unresolved`)
- resolved_answer_id
- created_at
- updated_at

Purpose:
- group multiple chat messages into one session

#### 4. ai_messages
- id
- session_id
- role (`user` / `assistant` / `system`)
- message_text
- created_at

Purpose:
- store the dialogue

#### 5. draft_solution_cards
- id
- source (`ai` / `manual`)
- title
- problem_summary
- customer_phrases_json
- likely_cause
- recommended_grit
- wet_or_dry
- steps_json
- avoid_text
- success_check
- related_problem_slug
- related_surface
- related_product
- confidence_score
- status (`draft` / `review` / `approved` / `rejected`)
- created_at
- updated_at

Purpose:
- hold AI-generated candidate answers before approval

#### 6. content_sync_queue
- id
- entity_type
- entity_id
- action (`publish` / `update`)
- status (`pending` / `done` / `failed`)
- created_at
- updated_at

Purpose:
- track which approved drafts must be converted into repo content

## Block 2 — Security and RLS

Create RLS policies with this rule:

### Public anonymous users can:
- insert `support_feedback`
- insert `search_logs`
- create `ai_sessions`
- insert `ai_messages` only through Edge Function

### Public anonymous users cannot:
- read all feedback rows
- read all conversations
- read all drafts
- approve drafts
- write directly into draft approval states

### Admin/service role can:
- read everything
- approve/reject drafts
- run content sync

## Block 3 — AI Edge Function

Create one main Edge Function:

`support-ai-chat`

### Input
```json
{
  "sessionToken": "...",
  "userMessage": "320 grit still leaves scratches",
  "context": {
    "currentPage": "/problems/scratches-too-deep/",
    "product": "assorted-60-3000",
    "surface": "paint"
  }
}
```

### Function steps
1. validate request
2. load relevant support content from approved JSON export or Supabase support index
3. detect whether exact answer already exists
4. if answer exists, return short answer + exact links
5. if answer is incomplete, ask one clarifying question
6. continue until answer is good enough
7. save messages to `ai_messages`
8. if conversation resolves a new repeatable issue, create `draft_solution_cards` row
9. return structured response

### Output
```json
{
  "reply": "Use 220 or 240 before moving back to 320.",
  "needsClarification": false,
  "clarifyingQuestion": null,
  "matchedPages": [
    {
      "title": "Scratches Are Too Deep",
      "url": "/problems/scratches-too-deep/"
    }
  ],
  "draftCreated": true
}
```

## Block 4 — Frontend Integration

### Search-first flow
1. user types in homepage search
2. local JSON search runs first
3. show autocomplete suggestions immediately
4. if user finds result, open static page
5. if no result or poor result, show `Ask Support Assistant`

### AI flow
1. user opens AI panel
2. frontend creates session token
3. frontend calls Supabase Edge Function
4. assistant responds
5. assistant may ask one clarifying question
6. final answer displayed in chat
7. user can mark answer helpful / not helpful

### Feedback flow
On every answer page and AI answer:
- 👍 Helpful
- 👎 Not Helpful

Write votes to `support_feedback`.

## Block 5 — Approval Workflow

AI-generated answers must not go live automatically.

### Correct workflow
1. AI resolves a new scenario
2. AI creates `draft_solution_cards`
3. admin reviews draft
4. admin approves or rejects
5. approved rows go into `content_sync_queue`
6. sync script converts approved rows into repo JSON/pages
7. GitHub deploy publishes them

This prevents junk, duplication, and hallucinated support pages.

## Block 6 — Repo Sync Strategy

Keep the public site content in GitHub.

### Published files remain in repo
- `data/problem-tree.json`
- `data/search-index.json`
- `data/solution-cards.json`
- generated problem pages

### Live state remains in Supabase
- votes
- logs
- chats
- drafts

### Sync process
Use one script or GitHub Action later:
1. fetch approved drafts from Supabase
2. normalize format
3. merge into repo JSON
4. regenerate static pages
5. commit and deploy

## Build Order

### Phase 1
1. create SQL schema
2. create RLS policies
3. create Edge Function contract

### Phase 2
1. connect homepage search logs
2. connect page feedback buttons
3. connect AI assistant UI shell

### Phase 3
1. implement AI retrieval rules
2. implement clarifying-question flow
3. store chat sessions and messages
4. create draft card generation

### Phase 4
1. create admin review page or admin script
2. approve/reject drafts
3. sync approved drafts into repo content

## First Deliverables

The first concrete implementation package should contain:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/functions/support-ai-chat/index.ts`
4. `docs/supabase-contract.md`
5. updated homepage plan for search + AI fallback + feedback

## Working Rule

Static content answers first.

AI only handles:
- unresolved searches
- ambiguous user descriptions
- converting useful solved chats into reviewed draft content
