# AGENTS.md

## Project

**Name:** eQualle Support System  
**Purpose:** Public support website for eQualle sandpaper products.  
**Primary use case:** Send Amazon customers to a support website where they can quickly identify their exact sanding problem and get a precise answer.  
**Delivery model:** GitHub Pages static site + Supabase for logging, admin, missing-answer capture, and secure AI Edge Function.

This file is a working guide for agents. **Agents must read AGENTS.md completely before working in this repository.**

It is **guidance**, not an immutable canonical spec, except for the locked canonical solution page design rules in section 11A. Agents may improve the system when there is a clear reason, but they must preserve the main direction: simple, problem-first, search-first customer support.

**Locked Design:** The canonical solution page design, layout, visual structure, typography scale, spacing, section order, related topic chips, answer-card structure, and bottom solution search bar are locked. See section 11A. Any task that may affect solution page design, layout, spacing, typography, section order, button styling, chip behavior, or visible structure requires Vlad’s explicit approval in the current task before changing it.

---

## 1) Preferred UX Direction

The site should feel closer to a **Google-style support center** than a traditional FAQ site.

The customer should not need to understand the full site structure. They should be able to type their issue into one clear search/ask box and quickly get useful results.

Preferred flow:

```text
One main search / ask bar
→ live matching answer pages only
→ exact answer page
→ optional follow-up in the same context
```

AI is not the main destination. AI is a helper layer that continues the search experience when static answer content is not enough.

Important current rule:

```text
Homepage search results must not send the user to guide/list/tool/product pages.
Homepage search results should open exact answer pages only.
```

---

## 2) Recommended Public Site Structure

### Homepage

Keep the homepage simple and focused.

Current preferred above-the-fold layout:

```text
eQualle Support
Problems | Surfaces | Grit Guide | Products | Tools

Sandpaper Help Center
Describe the problem.
[ one large Google-style search / ask input ]
```

Do not overload the homepage with cards, category blocks, documents, technical explanations, duplicate inputs, or secondary chat boxes.

### Main navigation

Recommended main navigation:

```text
Problems
Surfaces
Grit Guide
Products
Tools
```

Avoid making these primary nav items unless there is a strong UX reason:

```text
AI Assistant
Documents
How To
FAQ
```

They may exist inside the site, but should not distract from the main support flow.

---

## 3) Search / Ask Bar Behavior

The main search box is the central interface.

It should work as:

```text
search input
+
AI question input
+
follow-up input
```

But visually it should be **one input**, not multiple boxes.

### Homepage answer-only search rule

Homepage live search should show only concrete answer pages:

```text
/problems/...
/solutions/...
```

Homepage live search should not show these as normal results:

```text
/surfaces/...
/tools/...
/products/...
/how-to/
```

Reason: a customer searching from the homepage wants an answer. Sending them to a list page, guide page, product page, or tool means they have to search again.

### When answer matches exist

User types:

```text
paper clogs with paint
```

The site should show strong matching answer pages, such as:

```text
Sandpaper Clogs Too Fast
Paint Clogs Sandpaper
Sheet Feels Smooth But Stops Cutting
```

The user can open a result or continue typing in the same input.

### When no useful answer match exists

The site should not show weak, unrelated, guide, tool, product, or surface-page fallbacks.

Correct behavior:

```text
No answer page exists → show no misleading result → Get Answer opens /ask/?q=...
```

Then the AI/support assistant may answer in the ask flow and save the query as a missing-answer candidate for future page creation.

### Question starter behavior

One-word starters may show curated popular answer suggestions:

```text
how
why
what
which
can
should
where
when
do
does
is
```

Multi-word starter queries must require real semantic support-content matches beyond the starter word.

Examples:

```text
how → show curated How answer suggestions
how remove scratches → show relevant answer
how to cut a sheet → show no result until a specific answer page exists
is → show curated Is answer suggestions
is 60 grit too aggressive → show relevant answer
is there smaller smaller size → show no result
can I get smaller sheets → show no result until a specific answer page exists
```

Do not let filler words such as `to`, `a`, `the`, `sheet`, `size`, or `there` make an unrelated suggestion pass relevance scoring.

### Follow-up behavior

After a support answer, the same input remains available for another question.

Example:

```text
what grit should I use next?
```

The assistant should use session/page context instead of starting from zero.

### Important UX rule

Do **not** create a second large chat input under the homepage search results. One input on the homepage is the preferred direction.

---

## 4) Search Relevance Rules

Search quality is critical. Weak or unrelated results make the site feel useless.

### Short queries

For queries shorter than 3 characters:

```text
show no results
```

For 3–4 character queries, match only:

```text
title prefix
alias prefix
customer phrase prefix
exact grit number
strong surface word such as wood, paint, clear, metal, plastic, drywall
```

Do not match random substrings inside descriptions, steps, or long text for short queries.

### Multi-word queries

For multi-word queries:

```text
exact phrase in title/customer phrase = highest priority
multiple meaningful terms matched = strong result
exact_scenario pages rank above broad landing pages
single vague term match = weak and should usually be hidden
```

Expected behavior:

```text
pla → plastic/paint only, not random sheet problems
plastic turns white → exact plastic solution
3000 gloss → exact 3000 gloss solution
paper clogs paint → paint clogging / clogging solution
how to cut a sheet → no result until a specific answer page exists
```

### Result destination rule

A search result that looks like an answer must open an answer page.

Do not show list pages as homepage answer results:

```text
/surfaces/plastic/ is a guide/list page, not an answer page.
/tools/grit-sequence-builder/ is a tool, not an answer page.
/products/ is a product section, not an answer page.
```

If a useful answer does not exist yet, capture the missing answer instead of routing the user to a broad page.

---

## 5) Missing Answer Capture and Knowledge Base Growth

The site should gradually improve by capturing questions that do not yet have a good static answer page.

Current strategic flow:

```text
User asks question on homepage
→ answer page exists: open answer page
→ answer page missing: open /ask/?q=...
→ AI gives a short support answer from approved context
→ question + AI answer + context are saved as missing_answer_candidate
→ later workflow turns approved candidates into static answer pages
→ future users get the static page directly
```

Important technical rule:

```text
Do not create static GitHub Pages files directly from the browser.
```

Reason: the browser must not have GitHub write credentials. Static answer pages should be created by a secure server-side/admin workflow, GitHub Action, or local agent workflow.

Recommended future table:

```text
missing_answer_candidates
```

Recommended fields:

```text
id
query
normalized_query
ai_answer
matched_pages
session_token
status
created_at
updated_at
```

Recommended statuses:

```text
new
reviewed
draft_created
published
rejected
```

Recommended future publishing flow:

```text
missing_answer_candidates
→ draft_solution_cards
→ generated /solutions/<slug>/index.html
→ update data/search-index.json
→ update data/search-suggestions.json when needed
→ validate
→ commit
→ GitHub Pages deploy
```

Do not remove missing-answer information after answering the customer. It is product knowledge backlog.

---

## 6) Problems Section

Problems are the primary customer entry path.

URL:

```text
/problems/
```

Problem pages can organize related exact answers, but homepage search should not treat broad problem/list pages as final answer destinations.

Each exact answer card inside a problem page should eventually become its own `/solutions/<slug>/index.html` page.

Recommended problem groups:

```text
Scratches & Marks
- Scratches are too deep
- Swirl marks remain
- Straight scratches after wet sanding
- Scratches show after stain

Clogging & Cutting
- Sandpaper clogs too fast
- Paint clogs paper
- Aluminum clogs paper
- Sheet feels smooth but stops cutting

Finish Problems
- Finish looks uneven
- Wet sanding leaves haze
- 3000 grit does not create gloss
- Gloss still shows scratches

Sheet Problems
- Sheet tears early
- Sheet curls during wet sanding
- Grit comes off sheet
- Sheet edge frays

Grit Choice Problems
- Not sure what grit to use
- Wrong grit progression
- High grit does not remove defects
- Low grit damages finish
```

---

## 7) Surfaces Section

Surface pages are the second main user path, but they are not homepage answer-search results.

URL:

```text
/surfaces/
```

Main surface pages:

```text
Wood
Paint / Primer
Clear Coat
Metal
Plastic
Drywall Patch
Sheet Problems
```

Surface pages may organize related answers, but they should not replace exact answer pages.

---

## 8) Grit Guide

URL:

```text
/grits/
```

This section explains what each grit range does. It is not just a SKU list.

Recommended range structure:

```text
Coarse: 60–120
For heavy removal, rough shaping, paint removal.

Medium: 150–240
For surface preparation and smoothing after coarse grits.

Fine: 280–400
For fine prep before coating, primer, or finish.

Extra Fine: 500–800
For smoothing coating layers and fine finishing.

Ultra Fine: 1000–3000
For wet sanding, haze reduction, clear coat prep, polishing preparation.
```

---

## 9) Tools Section

URL:

```text
/tools/
```

The most useful tool right now is the Grit Sequence Builder:

```text
/tools/grit-sequence-builder/
https://vladchat.github.io/sandpaper_support/tools/grit-sequence-builder/
```

This is a useful and important part of the site. Preserve it and improve it, but do not use it as a homepage answer-search fallback.

---

## 10) Products Section

URL:

```text
/products/
```

Current important product page:

```text
/products/assorted-80-3000/
```

Product pages may support purchase/product questions, but they should not appear as normal homepage answer-search results for sanding problems.

Allowed product facts:

```text
eQualle sandpaper sheets
9 x 11 inch
silicon carbide abrasive
wet or dry use
grits 60 through 3000
assorted kit: 60 through 3000 grit
```

Do not invent unsupported product claims.

---

## 11) Canonical Solution Page Direction

Current state: solution pages are generated from one canonical solution page template and one generator.

Canonical files:

```text
templates/solution-page.html
scripts/build-solution-pages.js
```

Data source:

```text
data/solution-cards.json
```

Generated pages:

```text
solutions/*/index.html
```

Each solution page should answer one exact customer problem.

Current required page structure:

```text
Header
Breadcrumb
Problem label
[problem title]
[problem description]
Related topic chips

Large answer card
  Answer
  [one short direct answer]

  Answer grid
    Why it happens
    Recommended grit
    Wet or dry
    Success check

  What to do
  Avoid

Bottom solution search bar
← Back to search
Footer
```

Rules:

```text
Do not write both "Answer" and "Short answer".
"Answer" is the short direct answer.
One answer card = one /solutions/<slug>/ page.
Problem pages may remain as overview/navigation pages.
Homepage search should open exact solution pages, not problem/list pages.
The bottom link should be "← Back to search" and should point to /sandpaper_support/.
Tags that look clickable must be real links; otherwise they should not look like buttons.
Use the existing bottom solution search bar. Do not replace it with a large disconnected chat block.
Do not manually edit generated solution pages except for emergency inspection; update data/template/generator and regenerate.
```

---

## 11A) Locked Canonical Solution Page Design

**The current solution page design, visual structure, layout, spacing, typography scale, section order, answer-card structure, related topic chips, and bottom solution search bar are locked.**

The canonical template is finalized in:

```text
templates/solution-page.html
```

The build script that generates all solution pages is:

```text
scripts/build-solution-pages.js
```

Generated pages under this path must follow the locked template:

```text
solutions/*/index.html
```

Locked design elements:

```text
Header with site logo and navigation
Breadcrumb trail
Problem label and title (h1)
Problem description
Related topics section with topic chips
  - max 4 chips per page
  - chips only from approved whitelist
  - no raw search phrases as chips
  - no URLs with spaces
  - clickable chips link to approved pages
  - non-clickable chips display as text
Answer card with:
  - Answer summary (short direct answer)
  - Answer grid (Why it happens, Recommended grit, Wet or dry, Success check)
  - h2 "What to do" with ordered steps
  - Yellow note box with "Avoid: ..." content
Solution search block at bottom with:
  - Input field for follow-up question
  - Support tool button (mic icon)
  - Support tool button (photo icon with "Add Photo" text)
  - Search button with "Get Answer" text
  - Search results area below input
Back to search link at bottom
Footer
```

Do not change:

```text
- Visual layout scale or spacing
- Typography sizes or weights
- Section ordering
- Answer card structure
- Topic chip whitelist or href mapping
- Button styling or SVG icons
- Search results positioning
- Breadcrumb or header layout
```

If a future request would modify solution page design, layout, visible structure, button styling, chip behavior, section order, or typography, ask Vlad for explicit approval before proceeding.

Required confirmation question:

```text
This change may affect the locked solution page design. Do you approve changing the visual design/structure, or should I only update content/data/logic while preserving the current design?
```

Allowed without extra design approval:

```text
improving data/solution-cards.json content
fixing answer wording
fixing quick_answer quality
fixing recommended_grit text
fixing grit paths
fixing steps
fixing avoid text
fixing success_check text
fixing related_solution_ids
fixing search_phrases
regenerating solutions/*/index.html from the same locked template
fixing bugs that preserve the same visible design
backend or AI changes that do not alter visible layout
```

Not allowed without explicit approval:

```text
replacing the one-card answer layout with many small cards
removing or moving related topic chips
removing or replacing the bottom solution search bar
moving the answer summary
changing the answer grid into separate cards
adding a visible large follow-up chat block
changing solution page scale, width, or typography
changing section order
changing CSS that alters the approved visual appearance
using a content task as a reason to redesign the page
```

This instruction applies even when Vlad casually asks to "edit the template" or "fix the page" and the request is ambiguous. Preserve the locked design unless Vlad explicitly approves a visual design or structure change in the current task.

The current design was validated and locked on 2026-04-27.

---

## 12) AI Assistant Direction

AI should not feel like a separate chatbot product.

Preferred behavior:

```text
Search found answer → open/show matching answer page
User needs more → same input continues the conversation
Search found nothing → same typed text becomes AI request
Solution page → user can ask follow-up in that page context
```

AI should:

```text
read the user query
use current page context
retrieve approved solution cards / grit sequences / surface data
write a short support answer
link only to approved pages
ask one clarifying question only when needed
save missing-answer candidates when static content is missing
```

AI should not:

```text
replace static support content
invent product claims
act like a general workshop chatbot
create a second confusing input on the homepage
bury the useful answer under chat UI
route a homepage answer search to a guide/list page
```

AI response format should usually be:

```text
Likely issue:
Why it happens:
Recommended next step:
Suggested grit sequence:
Wet or dry:
Avoid:
Related answers:
```

---

## 13) Product and Content Rules

1. All public user-facing text must be English.
2. Keep answers short, direct, and practical.
3. Avoid unsupported marketing terms such as:
   ```text
   best
   premium
   superior
   professional-grade
   high-quality
   unmatched
   ultimate
   ```
4. Do not invent product facts.
5. Do not claim a grit can do something that is not supported by the current knowledge base.
6. Prefer one clear recommended path over many competing options.
7. When uncertain, create a validation task instead of guessing.
8. Static support pages must remain useful even if AI is unavailable.

---

## 14) Repo / Implementation Rules

1. Work only in this repository unless the user explicitly says otherwise:
   ```text
   https://github.com/VladChat/sandpaper_support
   ```
2. Verify remote before commits:
   ```text
   git remote get-url origin
   ```
3. Expected remote:
   ```text
   https://github.com/VladChat/sandpaper_support.git
   ```
4. Do not print or expose secrets.
5. Do not put OpenAI API keys in browser code.
6. Frontend must call a secure backend function for OpenAI.
7. Preserve Supabase search logging and feedback logging.
8. Preserve admin dashboard auth.
9. Keep changes small and focused.
10. Commit and push only after tests pass or report exact failure.
11. Read this AGENTS.md file before starting any work in this repository.
12. For solution page design/layout/structure changes, follow section 11A and ask for explicit approval when required.
13. Agent prompts and reports must include exact repository, branch, local path, validation commands, commit command, and push command when code or documentation changes are requested.

---

## 15) Quality Checks For Agents

Before reporting a task complete, check:

### User clarity

```text
Can a customer understand the page in 5 seconds?
Is the next action obvious?
Is the useful answer near the top?
```

### Support quality

```text
Does the page solve a real sanding problem?
Does it include grit / surface / wet-dry guidance where needed?
Does it say what to avoid?
```

### Search quality

```text
Does the query return strong relevant answer results?
Are weak unrelated results hidden?
Does exact customer language match the right answer page?
Are guide/list/tool/product pages excluded from homepage answer search?
Does a missing answer go to AI capture instead of a bad fallback?
```

### AI quality

```text
Does AI answer from approved context?
Does AI link to approved pages?
Does AI avoid unsupported claims?
Does AI ask only one clarifying question when needed?
Does AI save missing-answer candidates when static content is missing?
```

### Solution page design lock

```text
Did this task change the locked solution page visual design, structure, scale, section order, button styling, chip behavior, or visible layout?
If yes, did Vlad explicitly approve that design change in the current task?
If no explicit approval exists, stop and ask before changing the design.
```

---

## 16) Current Strategic Direction

The current UX direction is:

```text
Simplify the site.
Make one search / ask bar the central interface.
Homepage search must return exact answer pages only.
Do not use guide/tool/product/list pages as homepage search fallback.
If no exact answer exists, answer through AI and save the missing-answer candidate.
Preserve the canonical solution page template and generator.
Split answer cards into individual /solutions/<slug>/ pages.
Later, generate reviewed static answer pages from saved candidates.
Keep Problems, Surfaces, Grit Guide, Products, Tools as the main structure.
Keep Grit Sequence Builder available in Tools, not as an answer fallback.
Remove confusing duplicate inputs.
Do not make AI a separate destination.
Use AI as continuation of search and support pages.
Preserve the locked canonical solution page design unless Vlad explicitly approves a design change.
```

This section is guidance, not a rigid canonical law. Agents can improve the implementation, but should not return to a cluttered homepage, duplicated chat inputs, unrelated fallback results, guide/list-page search results, disconnected bottom assistant blocks, or unapproved solution page design changes.