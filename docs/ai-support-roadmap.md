# AI Support Roadmap

## Current Project State

The public eQualle Sandpaper Support site is live from this repository and works as a static GitHub Pages support website.

Repository secret available for future GitHub Actions or backend integration:

- `OPENAI_API_KEY`

Only the secret name is documented. The secret value must never be committed, printed, logged, or exposed in browser-side code.

## Main Product Direction

This project should become a problem-first support assistant for sandpaper customers.

The site should help users:

1. identify the sanding problem quickly
2. narrow the problem by surface, stage, grit, and method
3. open one exact solution page
4. optionally ask the AI assistant for guided help

The AI assistant must support the structured content system. It must not replace it.

## Best Site Structure

### 1. Find My Problem

This remains the most important section.

Expand it into a deep diagnostic tree:

- scratches are too deep
- surface still feels rough
- paper clogs too fast
- sanding takes too long
- finish looks uneven
- swirl marks remain
- wet sanding leaves haze
- paper tears early
- poor results between coats
- not sure what grit to use
- primer sanding problem
- paint removal problem
- rust removal problem
- clear coat sanding problem
- wood finishing problem
- metal prep problem
- plastic prep problem
- drywall patch sanding problem

Each major problem should have:

- plain-language symptom title
- common customer phrases
- surface filters
- grit filters
- wet/dry filters
- final solution cards

### 2. By Grit

Create one useful page for every supported grit:

- 60
- 80
- 100
- 120
- 150
- 180
- 220
- 240
- 280
- 320
- 360
- 400
- 500
- 600
- 800
- 1000
- 1200
- 1500
- 2000
- 3000

Each grit page should include:

- best use cases
- surfaces
- common mistakes
- previous grit
- next grit
- wet/dry recommendation
- related problems
- related products

### 3. By Surface

Add dedicated surface paths:

- wood
- metal
- automotive paint
- clear coat
- plastic
- drywall patch
- primer
- furniture refinishing

Each surface page should connect users to:

- common problems
- recommended grit progressions
- wet/dry guidance
- final finish checks

### 4. By Product

Create support pages for product groups:

- assorted 80 to 3000 grit kit
- single-grit 9 x 11 sheets
- coarse grit sheets
- medium grit sheets
- fine grit sheets
- ultra-fine grit sheets

Each product page should include:

- what the product is for
- what it is not for
- most common problems
- grit selection help
- links to final answer cards

### 5. How-To Guides

Build short procedural guides:

- how to choose sandpaper grit
- how to sand wet
- how to sand dry
- how to move through grit progression
- how to sand between coats
- how to avoid deep scratches
- how to reduce clogging
- how to know when to change the sheet
- how to prepare wood for finishing
- how to wet sand clear coat
- how to sand metal before paint

### 6. Documents

Use the documents section for downloadable assets:

- grit selection guide
- wet or dry sanding guide
- troubleshooting guide
- surface-specific quick guides
- product-specific quick guides

## Final Solution Card Format

Every final support answer should use the same structure:

```text
Problem:
Likely cause:
Recommended grit:
Use wet or dry:
Steps:
Avoid:
Success check:
Next step:
Related links:
```

This keeps the support system consistent and makes AI answers easier to control.

## AI Assistant Plan

### Role

The AI assistant should be a diagnostic helper.

It should:

- ask short clarifying questions
- match the user query to the correct problem branch
- provide a short answer from approved support content
- link to the exact support page

It should not be a general chatbot.

### Safe Architecture

Do not call OpenAI directly from browser JavaScript.

Recommended architecture:

1. static site on GitHub Pages
2. AI backend through a secure endpoint
3. backend reads `OPENAI_API_KEY` from secrets or environment variables
4. frontend sends the user question to the backend
5. backend retrieves approved support content
6. backend returns a short answer and exact page links

Recommended backend options:

- GitHub Actions only for offline content generation and indexing
- Cloudflare Worker for live AI assistant endpoint
- another secure serverless endpoint if needed later

The API key must stay server-side only.

### AI Knowledge Source

AI should answer only from:

- `src/data/problem-tree.json`
- `src/data/grit-map.json`
- `src/data/product-map.json`
- future structured support pages
- approved FAQ content
- approved troubleshooting rules

Unsupported questions should receive a safe response:

> I do not have enough verified support information for that specific case. Please check the related support page or contact eQualle support.

### AI Behavior Rules

- short answers
- one best recommendation
- no guessing
- no unsupported product claims
- no hidden prompt exposure
- no API key exposure
- no medical, legal, or unrelated advice
- always prefer linking to an exact support page

## Expansion Plan

### Phase 1: Content Depth

Expand the static site first.

Tasks:

1. add all major problem branches
2. add surface-specific branches
3. add final solution cards
4. expand grit pages
5. expand product pages
6. add related links
7. add search aliases

### Phase 2: Search Quality

Improve local search before adding live AI.

Tasks:

1. build a richer search index
2. add customer phrase aliases
3. add typo-tolerant matching
4. add synonym matching
5. route searches to exact problem pages

### Phase 3: AI Preparation

Prepare the site for controlled AI.

Tasks:

1. create a normalized support knowledge export
2. create AI system prompt
3. create retrieval format
4. create answer format
5. create unsupported-question handling

### Phase 4: AI Backend

Add live AI assistant.

Tasks:

1. create secure backend endpoint
2. use `OPENAI_API_KEY` only on backend
3. connect frontend assistant widget
4. log unresolved questions without personal data
5. use unresolved questions to create new support pages

### Phase 5: Amazon Support Integration

Use Amazon Product Support links to send customers to:

- homepage for general help
- exact product page for product-specific help
- troubleshooting page for common issues
- document downloads for PDF support materials

## Immediate Next Implementation Step

The next commit should focus on content expansion, not AI.

Add:

1. more detailed problem-tree data
2. surface pages
3. complete grit pages
4. final solution-card template
5. improved local search aliases

After the static support system is rich enough, add AI assistant integration.
