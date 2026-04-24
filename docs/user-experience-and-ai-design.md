# User Experience and AI Design

## Goal

Build a real support assistant for eQualle sandpaper customers, not a generic FAQ chatbot.

The system must help a customer start with a visible sanding problem, narrow it down, and get one exact answer for the product they bought.

## User Experience

### 1. Homepage

The customer should immediately see:

- large search box: "What sanding problem are you trying to fix?"
- main button: "Find My Problem"
- quick problem cards:
  - Deep scratches
  - Paper clogs fast
  - Not sure what grit to use
  - Finish looks uneven
  - Wet sanding left haze
  - Paper tears
  - Sanding takes too long
  - Poor result between coats

The homepage should not look like a blog or product catalog.

### 2. Search Experience

The user can type real-language phrases, for example:

- "320 grit does not remove scratches"
- "wet sanding made it cloudy"
- "paper gets clogged with paint"
- "what grit for wood before stain"
- "sandpaper tears on edges"

Search should return:

1. best matching problem
2. exact solution card when available
3. related grit pages
4. related how-to page

### 3. Problem Narrowing Flow

The flow should work like a diagnostic wizard.

Example:

1. User selects: "Scratches are too deep"
2. Site asks: "Where do you see the scratches?"
   - wood
   - metal
   - paint
   - clear coat
   - plastic
3. Site asks: "What grit did you use?"
   - coarse grit
   - medium grit
   - fine grit
   - not sure
4. Site opens the final answer page.

### 4. Final Answer Page

The final page must be short and practical.

Required structure:

```text
Problem
Likely cause
Recommended grit
Wet or dry
Step-by-step fix
Avoid this
Success check
Related links
```

Example answer style:

```text
Problem: 320 grit does not remove scratches from 180 grit.
Likely cause: the grit jump is too large or the previous scratch pattern was not fully removed.
Recommended grit: use 220 or 240 before moving to 320.
Wet or dry: dry sanding is fine for early prep; wet sanding is better for fine finishing.
Steps: sand evenly with 220 or 240 until the 180 scratches are gone, clean the surface, then move to 320.
Avoid: do not jump from coarse scratches directly to a very fine grit.
Success check: the surface should show one even scratch pattern before moving finer.
```

### 5. By Grit Experience

Each grit page should answer:

- what this grit is for
- what it is not for
- common mistakes
- previous grit
- next grit
- wet/dry use
- related problems

### 6. By Product Experience

Each product page should answer:

- what grits are included
- what tasks the product supports
- most common problems for this product
- which support path to use first

For the assorted 80-3000 grit kit, the page should focus on grit progression and choosing the correct starting grit.

## How It Works Internally

### 1. Static Knowledge Base

The core system should be structured data, not random pages.

Main files:

- `src/data/problem-tree.json`
- `src/data/grit-map.json`
- `src/data/product-map.json`
- `src/data/aliases.json`

These files are the source of truth.

### 2. Generated Pages

Pages should be generated from structured data:

- problem pages
- final solution cards
- grit pages
- product pages
- how-to pages

This prevents contradictions and makes the system easy to scale.

### 3. Search Index

The site should build a local search index from:

- problem titles
- customer phrases
- aliases
- grit numbers
- surface names
- product names
- solution summaries

This gives fast support without AI.

### 4. AI Assistant Layer

AI comes after the static system is strong.

AI should work like this:

1. user asks a question
2. frontend sends the question to a secure backend endpoint
3. backend searches approved support content
4. backend sends only relevant support snippets to the model
5. model returns a short answer and exact support links
6. frontend displays the answer and links

The AI must not make unsupported product claims.

### 5. Secret Handling

The repository has `OPENAI_API_KEY` available as a GitHub Actions secret.

Rules:

- never expose this key in frontend JavaScript
- never commit the key
- never print the key in logs
- use it only in server-side or CI/serverless context

## Best Practice Rules

1. Problem-first navigation beats product-first navigation for support.
2. Static answers must work before AI is added.
3. AI should route and clarify, not replace the knowledge base.
4. Every final answer should follow the same format.
5. Use customer language at the top level.
6. Use expert language only in the final answer.
7. Each problem page should target one user intent.
8. Use related links to connect problem, grit, product, and how-to pages.
9. Track unresolved searches later and turn them into new pages.
10. Do not create unsupported claims just to fill pages.

## How To Make It Specific To eQualle Sandpaper

The system must be built from eQualle-specific product facts:

- 9 x 11 inch sheets
- silicon carbide abrasive
- wet or dry use
- supported grits from coarse to ultra-fine
- assorted kit coverage from 80 to 3000 grit
- single-grit sheet packs
- common surfaces: wood, metal, automotive paint, clear coat, plastic, drywall patch

Every support answer should connect back to one or more of:

- exact grit range
- exact surface
- exact sanding method
- exact product type
- exact customer problem

## Next Build Step

The next implementation step should create:

1. expanded problem tree
2. surface taxonomy
3. final solution card template
4. search alias map
5. complete grit pages
6. first set of real solution cards

AI integration should start only after these support pages are useful without AI.
