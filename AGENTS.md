# AGENTS.md

## Project

**Name:** eQualle Support System  
**Purpose:** Public support website for eQualle sandpaper products.  
**Primary use case:** Send Amazon customers to a support website where they can quickly identify their exact sanding problem and get a precise answer.  
**Delivery model:** GitHub Pages static site + Supabase for logging, admin, and secure AI Edge Function.

This file is a working guide for agents. It is **guidance**, not an immutable canonical spec. Agents may improve the structure when there is a clear reason, but they should preserve the main direction: simple, problem-first, search-first customer support.

---

## 1) Preferred UX Direction

The site should feel closer to a **Google-style support center** than a traditional FAQ site.

The customer should not need to understand the full site structure. They should be able to type their issue into one clear search/ask box and quickly get useful results.

Preferred flow:

```text
One main search / ask bar
→ live matching support pages
→ exact answer page
→ optional follow-up in the same context
```

AI is not the main destination. AI is a helper layer that continues the search experience when static support content is not enough.

---

## 2) Recommended Public Site Structure

### Homepage

Keep the homepage simple and focused.

Recommended above-the-fold layout:

```text
eQualle Support
Problems | Surfaces | Grit Guide | Products | Tools

What sanding problem do you have?
[ one main search / ask input ]

Example searches:
plastic turns white
3000 grit not glossy
paper clogs with paint
scratches after staining wood

Main paths:
Find by Problem
Choose Surface
Build Grit Sequence
```

Do not overload the homepage with too many cards, menus, documents, or technical explanations.

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

### When matches exist

User types:

```text
plastic turns white
```

The site should show strong matching pages, such as:

```text
Plastic Turns White After Sanding
Plastic Scratches Stay Visible
Sanding Plastic Surface Guide
Grit Sequence For Plastic
```

The user can open a result or continue typing in the same input.

### When no useful match exists

The typed text becomes the assistant request automatically after a short debounce.

The assistant answer appears below the same search/ask area.

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
```

---

## 5) Problems Section

Problems are the primary customer entry path.

URL:

```text
/problems/
```

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

Each problem path should lead to exact solution pages, not long generic articles.

---

## 6) Surfaces Section

Surface pages are the second main user path.

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

Each surface page should use the same structure:

```text
Surface name
Best starting grits
Common problems
Recommended sequences
Common mistakes
Related answers
Link to Grit Sequence Builder
```

Example for Wood:

```text
Best starting grits
- Rough wood: 80–120
- Surface prep: 120–180
- Before stain: 180–220
- Fine prep: 220–320

Common wood problems
- Scratches show after stain
- Stain looks blotchy
- Raised grain after water
- Veneer sands through
- Edges round over too much

Recommended sequences
- General prep: 120 → 150 → 180 → 220
- Before stain: 150 → 180 → 220
- Fix scratches: step back one grit, then progress again

Common mistakes
- sanding across grain
- skipping grits
- using too much pressure
- not removing dust before finish
```

---

## 7) Grit Guide

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

Include a clear “what grit comes next” reference:

```text
80 → 120
120 → 150 or 180
180 → 220
220 → 320
320 → 400
400 → 600
600 → 800
800 → 1000
1000 → 1500
1500 → 2000
2000 → 3000
```

---

## 8) Tools Section

URL:

```text
/tools/
```

The most useful tool right now is the Grit Sequence Builder:

```text
/tools/grit-sequence-builder/
https://vladchat.github.io/sandpaper_support/tools/grit-sequence-builder/
```

This is a useful and important part of the site. Preserve it and improve it rather than hiding it.

### Grit Sequence Builder structure

```text
Choose surface:
Wood / Paint / Clear Coat / Metal / Plastic / Drywall

Choose goal:
Heavy removal / Surface preparation / Fine prep / Wet sanding / Fix scratches / Remove haze
```

Result should show:

```text
Start grit
Next grit sequence
Wet or dry
Avoid
Related solution pages
Related product page
```

---

## 9) Products Section

URL:

```text
/products/
```

Current important product page:

```text
/products/assorted-80-3000/
```

This page supports the eQualle Assorted Sandpaper Kit 80–3000.

Recommended structure:

```text
What is included
Which sheet should I start with?
Do I need to use every grit?
What is 3000 grit for?
Wet or dry?
Common mistakes
Related tools
Related solutions
```

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

## 10) Solution Page Template

Each solution page should answer one exact customer problem.

Recommended structure:

```text
Top search / ask bar
Problem title
Short answer
What to do
Recommended grit / grit sequence
Wet or dry
Avoid
Success check
Related guides
```

Avoid placing a large disconnected assistant/chat block at the bottom of the page. If a follow-up helper exists, it should be integrated near the main answer or referenced through the top search/ask bar.

---

## 11) AI Assistant Direction

AI should not feel like a separate chatbot product.

Preferred behavior:

```text
Search found answer → show matching pages
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
link to approved pages
ask one clarifying question only when needed
```

AI should not:

```text
replace static support content
invent product claims
act like a general workshop chatbot
create a second confusing input on the homepage
bury the useful answer under chat UI
```

AI response format should usually be:

```text
Likely issue:
Why it happens:
Recommended next step:
Suggested grit sequence:
Wet or dry:
Avoid:
Related guides:
```

---

## 12) Product and Content Rules

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

## 13) Repo / Implementation Rules

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

---

## 14) Quality Checks For Agents

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
Does the query return strong relevant results?
Are weak unrelated results hidden?
Does exact customer language match the right page?
```

### AI quality

```text
Does AI answer from approved context?
Does AI link to approved pages?
Does AI avoid unsupported claims?
Does AI ask only one clarifying question when needed?
```

---

## 15) Current Strategic Direction

The next UX direction should be:

```text
Simplify the site.
Make one search / ask bar the central interface.
Keep Problems, Surfaces, Grit Guide, Products, Tools as the main structure.
Keep Grit Sequence Builder prominent.
Remove confusing duplicate inputs.
Do not make AI a separate destination.
Use AI as continuation of search and support pages.
```

This section is guidance, not a rigid canonical law. Agents can improve the implementation, but should not return to a cluttered homepage, duplicated chat inputs, or disconnected bottom assistant blocks.
