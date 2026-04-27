# Solution Card Content Standard

## Purpose

This document defines the content standard for all eQualle sandpaper support solution cards.

It applies to two workflows:

1. Improving existing records in `data/solution-cards.json`.
2. Creating new records in `data/solution-cards.json`.

The goal is to make every generated solution page useful, consistent, clear, and practical for a normal sandpaper customer.

This is a content standard only.

Do not change the locked solution page design, template, layout, CSS, typography, chips layout, answer-card structure, or bottom search bar without Vlad’s explicit approval. The locked design rules are defined in `AGENTS.md`, section `11A) Locked Canonical Solution Page Design`.

---

## Project Context

This project is the eQualle Support System.

It is a public support website for customers using eQualle sandpaper sheets.

The site helps customers solve sanding problems such as:

- scratches remain
- surface still feels rough
- sandpaper clogs
- wrong grit was used
- wet sanding leaves haze
- paint or primer does not sand cleanly
- plastic gets gouged or rough
- wood still feels raised
- metal still has rust or scratches
- clear coat has sanding marks

Each solution page should answer one exact customer problem.

The customer may not know technical sanding language. Write for a normal buyer who wants a direct answer.

---

## Canonical Workflow

Do not manually edit generated HTML pages.

Correct workflow:

```text
data/solution-cards.json
→ npm run sync:solution-search
→ npm run build:solution-pages
→ generated solutions/*/index.html
```

Edit:

```text
data/solution-cards.json
```

Do not manually edit:

```text
solutions/*/index.html
```

Generated pages must come from the data file and generator.

---

## Files

Primary content file:

```text
data/solution-cards.json
```

Generated output:

```text
solutions/*/index.html
```

Search data generated from solution cards:

```text
data/search-index.json
data/search-suggestions.json
```

Canonical locked visual template:

```text
templates/solution-page.html
```

Generator:

```text
scripts/build-solution-pages.js
```

Do not change the template or generator for content-only tasks unless there is a clear bug and the visible design is preserved.

---

## Required Fields Per Solution Card

Every solution card must include:

```json
{
  "id": "",
  "slug": "",
  "problem_slug": "",
  "title": "",
  "problem": "",
  "surface": "",
  "task": "",
  "symptom": "",
  "quick_answer": "",
  "likely_cause": "",
  "recommended_grit": "",
  "best_grit_path": [],
  "optional_starting_grits": [],
  "wet_or_dry": "",
  "steps": [],
  "avoid": "",
  "mistakes_to_avoid": [],
  "success_check": "",
  "related_links": [],
  "related_solution_ids": [],
  "search_phrases": []
}
```

`id` and `slug` should normally match.

Example:

```text
plastic-still-rough
```

---

## Core Rule

Each card must answer one exact problem.

Bad:

```text
Choosing sandpaper
```

Better:

```text
Choosing a starting grit
```

Best:

```text
Not sure what grit to start with
```

The card should not become a general article. It should be a short support answer.

---

## Field Standards

### `title`

Use the exact customer problem in simple English.

Good:

```text
Plastic still feels rough
Wood still rough after 120 grit
Paint clogs the sheet quickly
320 grit does not remove 180 grit scratches
```

Avoid:

```text
Complete guide to plastic sanding
Professional surface preparation
Ultimate sanding solution
```

---

### `problem`

One short sentence describing the visible issue.

Good:

```text
Plastic remains rough or uneven after sanding.
```

Bad:

```text
The user is experiencing a sanding issue that may involve roughness, scratches, or a need for further surface refinement depending on the project.
```

---

### `surface`

Use a clear surface/category.

Allowed common values:

```text
general sandpaper use
wood
metal
plastic
paint / primer
automotive / clear coat
drywall
sheet problem
```

Do not use an unrelated surface just to force topic chips.

Example:

For `choosing-starting-grit`, use:

```text
general sandpaper use
```

Not:

```text
automotive / clear coat
```

unless the problem is specifically about clear coat.

---

### `task`

Use the practical task.

Examples:

```text
scratch removal
surface refinement
grit selection
clog control
paint removal
wet sanding
finish preparation
drywall patch smoothing
rust removal
```

---

### `symptom`

Use the customer’s issue in plain language.

Good:

```text
plastic remains rough or uneven after sanding
```

Bad:

```text
surface refinement issue
```

---

## `quick_answer`

This is the most important field.

It becomes the main Answer block at the top of the page.

It must be:

- direct
- useful
- short
- human
- specific
- not mechanically pasted from another field

Good:

```text
Start with 400 grit for normal roughness. Use 320 only for very uneven spots, then move to 600, 800, and 1000 grit until the plastic feels even.
```

Bad:

```text
320 or 400 for prep, then 600+ for finer finish needs. Clean the plastic.
```

Bad:

```text
Use 320, then 400, then 600 grit in order.
```

Bad:

```text
Use the recommended grit sequence.
```

The `quick_answer` should usually include:

```text
starting grit
when to use optional coarser grit
next grit sequence
simple success target
```

---

## `recommended_grit`

This field must match the logic of `quick_answer` and `best_grit_path`.

Good:

```text
Use 400 grit for normal roughness. Use 320 only for uneven or scratched spots. Then refine with 600, 800, and 1000 grit.
```

Bad:

```text
320 or 400 for prep, then 600+ for finer finish needs.
```

Avoid vague endings like:

```text
600+
as needed
depending on stage
```

Use them only when the card clearly explains what they mean.

---

## `best_grit_path`

This must be a logical sequence from the starting grit to the finishing grit.

Good:

```json
["320", "400", "600", "800", "1000"]
```

Bad:

```json
["120", "180", "220", "320", "80"]
```

The path must not put the original coarse grit at the end.

For a card about fixing scratches left by 80 grit:

```json
["80", "120", "180", "220", "320"]
```

For a card about moving past 180 grit scratches:

```json
["180", "220", "320"]
```

For plastic roughness:

```json
["400", "600", "800", "1000"]
```

Use `optional_starting_grits` when a grit is only for worse cases:

```json
"optional_starting_grits": ["320"]
```

---

## `optional_starting_grits`

Use this for grits that are not always needed.

Example:

For plastic roughness:

```json
"optional_starting_grits": ["320"]
```

Meaning:

```text
Use 320 only if the plastic has rough or uneven spots that 400 grit does not level.
```

Do not put optional grits into the main path when they are not always needed.

---

## `steps`

Steps must tell the customer exactly what to do.

Good steps:

```json
[
  "Clean the plastic surface before sanding.",
  "Start with 400 grit for normal roughness.",
  "Use 320 grit only on rough or uneven spots that 400 grit does not level.",
  "Sand with light pressure to avoid heat buildup.",
  "Move to 600 grit once the surface feels even.",
  "Continue with 800 and 1000 grit for a smoother finish.",
  "Rinse or wipe residue before each finer grit.",
  "Stop when the surface feels even and the scratch pattern is consistent."
]
```

Bad steps:

```json
[
  "Clean the plastic.",
  "Use light pressure.",
  "Progress through finer grits.",
  "Rinse residue before each finer grit."
]
```

Each step should be specific enough that the buyer knows what to do next.

---

## `likely_cause`

Explain why the issue happens in one short sentence.

Good:

```text
Plastic can stay rough when the grit jump is too large, the starting grit is too coarse, or too much pressure creates heat and leaves deeper scratches.
```

Bad:

```text
The surface needs more work.
```

---

## `wet_or_dry`

Be specific.

Good:

```text
Use dry sanding for early shaping. Use wet sanding from 600 grit and finer when the plastic can safely be rinsed.
```

Bad:

```text
Wet when suitable.
```

Bad:

```text
Dry or wet depending on the stage.
```

---

## `avoid`

This is the visible yellow note.

It should be one clear warning.

Good:

```text
Do not press hard or stay in one spot too long. Heat can gouge, smear, or deform plastic.
```

Bad:

```text
Do not do it wrong.
```

Bad:

```text
Avoid incorrect sanding.
```

---

## `mistakes_to_avoid`

Use this as the structured version of `avoid`.

Good:

```json
[
  "Do not press hard or stay in one spot too long because heat can gouge or deform plastic.",
  "Do not jump from coarse grit directly to very fine grit.",
  "Do not move to the next grit before the current scratch pattern is even."
]
```

---

## `success_check`

Tell the user how to know they are done.

Good:

```text
The surface feels even, has a consistent fine scratch pattern, and no longer has rough high spots.
```

Bad:

```text
The surface looks good.
```

---

## `related_solution_ids`

Use only closely related solution pages.

Rules:

- plastic pages should usually link to plastic pages
- wood pages should usually link to wood pages
- metal pages should usually link to metal pages
- grit-choice pages should link to grit-choice or grit-sequence pages
- clogging pages should link to clogging/loading/sheet-wear pages

Bad for `plastic-still-rough`:

```json
[
  "wood-still-rough-after-120",
  "wood-still-rough-after-220",
  "metal-still-rough"
]
```

Better:

```json
[
  "plastic-has-deep-scratches",
  "plastic-looks-hazy-after-sanding",
  "plastic-bumper-sanding-prep"
]
```

Only use IDs that actually exist in `data/solution-cards.json`.

---

## `related_links`

Keep this consistent with `related_solution_ids`.

Example:

```json
"related_solution_ids": [
  "plastic-has-deep-scratches",
  "plastic-looks-hazy-after-sanding"
],
"related_links": [
  "/solutions/plastic-has-deep-scratches/",
  "/solutions/plastic-looks-hazy-after-sanding/"
]
```

---

## `search_phrases`

Use real customer search language.

Good:

```json
[
  "plastic still feels rough",
  "rough plastic after sanding",
  "plastic uneven after sanding",
  "how to smooth rough plastic",
  "plastic feels scratchy after sanding"
]
```

Bad:

```json
[
  "plastic plastic remains rough or uneven after sanding",
  "how to fix plastic still feels rough",
  "surface still feels rough"
]
```

Do not generate search phrases mechanically.

Avoid duplicate words like:

```text
wood wood
metal metal
plastic plastic
paint / primer paint
general sandpaper use wet sanding residue
```

Search phrases should be what a real customer might type.

---

## Content Style

Use simple English.

Write like a helpful support specialist.

Avoid:

```text
best
premium
superior
professional-grade
high-quality
ultimate
perfect
```

Avoid long explanations.

Avoid filler.

Avoid generic advice that could apply to every page.

Each page should feel specific.

---

## Grit Logic

Use grit sequences that move from coarser to finer.

Common ranges:

```text
60–120: heavy removal / rough shaping
150–240: surface prep / smoothing
280–400: fine prep
500–800: fine finishing
1000–3000: wet sanding / haze reduction / polishing prep
```

Do not recommend 60 grit as the default starting point unless the task clearly requires heavy removal.

For “not sure what grit to start with,” use task-based guidance:

```text
Use 60–120 only for heavy removal.
Use 150–240 for normal prep.
Use 280–400 for fine prep before coating.
Use 600–3000 for fine wet sanding or finishing stages.
Start with the least aggressive grit that still fixes the problem.
```

---

## Example Fix: Plastic Still Feels Rough

Corrected card direction:

```json
{
  "id": "plastic-still-rough",
  "slug": "plastic-still-rough",
  "problem_slug": "surface-still-feels-rough",
  "title": "Plastic still feels rough",
  "problem": "Plastic remains rough or uneven after sanding.",
  "surface": "plastic",
  "task": "surface refinement",
  "symptom": "plastic remains rough or uneven after sanding",
  "quick_answer": "Start with 400 grit for normal roughness. Use 320 only for very uneven spots, then move to 600, 800, and 1000 grit until the plastic feels even.",
  "best_grit_path": ["400", "600", "800", "1000"],
  "optional_starting_grits": ["320"],
  "likely_cause": "Plastic can stay rough when the grit jump is too large, the starting grit is too coarse, or too much pressure creates heat and leaves deeper scratches.",
  "recommended_grit": "Use 400 grit for normal roughness. Use 320 only for uneven or scratched spots. Then refine with 600, 800, and 1000 grit.",
  "wet_or_dry": "Use dry sanding for early shaping. Use wet sanding from 600 grit and finer when the plastic can safely be rinsed.",
  "steps": [
    "Clean the plastic surface before sanding.",
    "Start with 400 grit for normal roughness.",
    "Use 320 grit only on rough or uneven spots that 400 grit does not level.",
    "Sand with light pressure to avoid heat buildup.",
    "Move to 600 grit once the surface feels even.",
    "Continue with 800 and 1000 grit for a smoother finish.",
    "Rinse or wipe residue before each finer grit.",
    "Stop when the surface feels even and the scratch pattern is consistent."
  ],
  "avoid": "Do not press hard or stay in one spot too long. Heat can gouge, smear, or deform plastic.",
  "mistakes_to_avoid": [
    "Do not press hard or stay in one spot too long because heat can gouge or deform plastic.",
    "Do not jump from coarse grit directly to very fine grit.",
    "Do not move to the next grit before the current scratch pattern is even."
  ],
  "success_check": "The surface feels even, has a consistent fine scratch pattern, and no longer has rough high spots.",
  "related_links": [
    "/solutions/plastic-has-deep-scratches/",
    "/solutions/plastic-looks-hazy-after-sanding/",
    "/solutions/plastic-bumper-sanding-prep/"
  ],
  "related_solution_ids": [
    "plastic-has-deep-scratches",
    "plastic-looks-hazy-after-sanding",
    "plastic-bumper-sanding-prep"
  ],
  "search_phrases": [
    "plastic still feels rough",
    "rough plastic after sanding",
    "plastic uneven after sanding",
    "how to smooth rough plastic",
    "plastic feels scratchy after sanding"
  ]
}
```

---

## Example Fix: Choosing a Starting Grit

Corrected card direction:

```json
{
  "id": "choosing-starting-grit",
  "slug": "choosing-starting-grit",
  "problem_slug": "not-sure-what-grit-to-use",
  "title": "Choosing a starting grit",
  "problem": "It is unclear which grit to start with.",
  "surface": "general sandpaper use",
  "task": "grit selection",
  "symptom": "not sure what grit to start with",
  "quick_answer": "Choose the starting grit by the task. Use 60–120 only for heavy removal, 150–240 for normal prep, 280–400 for fine prep, and 600–3000 for fine wet sanding or finishing stages.",
  "best_grit_path": ["120", "180", "220", "320", "400", "600"],
  "optional_starting_grits": ["60", "80"],
  "likely_cause": "The right starting grit depends on how much material must be removed and how smooth the surface needs to be afterward.",
  "recommended_grit": "Use 60–120 for heavy removal, 150–240 for normal prep, 280–400 for fine prep, and 600–3000 for fine wet sanding or finishing stages.",
  "wet_or_dry": "Use dry sanding for removal and normal prep. Use wet sanding for finer stages when the surface can safely be rinsed.",
  "steps": [
    "Identify whether the job is heavy removal, normal prep, fine prep, or fine finishing.",
    "Start with the least aggressive grit that still removes the defect.",
    "Use 60 or 80 only for heavy removal.",
    "Use 150, 180, or 220 for most normal prep work.",
    "Use 280 or 400 for fine prep before coating.",
    "Use 600 and finer for wet sanding or finishing stages.",
    "Move finer gradually and inspect after each grit."
  ],
  "avoid": "Do not start with 60 grit unless heavy removal is needed. It can create deep scratches that require extra refinement.",
  "mistakes_to_avoid": [
    "Do not start with the coarsest grit by default.",
    "Do not skip directly from coarse grit to very fine grit.",
    "Do not move finer before the previous scratch pattern is even."
  ],
  "success_check": "The starting grit removes the problem without creating unnecessary deep scratches.",
  "related_links": [
    "/solutions/skipped-120-to-320/",
    "/solutions/fine-grit-used-for-removal/",
    "/solutions/high-grit-not-removing-defects/"
  ],
  "related_solution_ids": [
    "skipped-120-to-320",
    "fine-grit-used-for-removal",
    "high-grit-not-removing-defects"
  ],
  "search_phrases": [
    "what grit should I start with",
    "not sure what grit to use",
    "which sandpaper grit first",
    "starting grit for sanding",
    "how to choose sandpaper grit"
  ]
}
```

---

## Existing Card Cleanup Checklist

When improving existing cards, check each card for:

```text
quick_answer is not mechanical
recommended_grit matches quick_answer
best_grit_path is logical
optional_starting_grits are separated correctly
steps are specific
avoid is a useful warning
success_check is clear
surface matches the actual problem
task matches the actual action
related_solution_ids are relevant
search_phrases sound like real customer searches
no duplicated words in search_phrases
no unsupported marketing language
```

---

## New Card Creation Checklist

Before adding a new card:

```text
Is this one exact customer problem?
Does this problem deserve its own /solutions/<slug>/ page?
Does the title match how a customer would describe it?
Is the grit path safe and logical?
Does quick_answer answer the problem immediately?
Are the steps actionable?
Are related solutions real and relevant?
Are search phrases natural?
Does this preserve the locked design?
```

---

## Validation Commands

Run after editing `data/solution-cards.json`:

```bash
npm run validate:data
npm run sync:solution-search
npm run build:solution-pages
npm run build:solution-pages:check
```

Run syntax checks when scripts are touched:

```bash
node --check scripts/build-solution-pages.js
node --check scripts/sync-solution-search-data.js
node --check assets/app.js
node --check assets/search-core.js
node --check assets/support-assistant.js
```

For content-only changes, scripts usually should not be touched.

---

## Manual Page Checks

After generation, inspect these pages first:

```text
solutions/plastic-still-rough/index.html
solutions/choosing-starting-grit/index.html
solutions/deep-scratches-after-80-grit/index.html
solutions/320-does-not-remove-180-scratches/index.html
solutions/sheet-smooth-but-unused/index.html
```

Check:

```text
Answer is useful and specific
Recommended grit does not contradict Answer
Steps are practical
Avoid note is clear
Success check tells the customer when to stop
Topic chips are still short and clean
Bottom search bar is still unchanged
No design changed
```

---

## Git Workflow

Repository:

```text
https://github.com/VladChat/sandpaper_support
```

Local path:

```text
C:\Users\vladi\Documents\vcoding\projects\sandpaper_support
```

Branch:

```text
main
```

Before work:

```bash
cd C:\Users\vladi\Documents\vcoding\projects\sandpaper_support
git remote get-url origin
git branch --show-current
git status
```

Expected remote:

```text
https://github.com/VladChat/sandpaper_support.git
```

Expected branch:

```text
main
```

Commit and push after successful validation:

```bash
cd C:\Users\vladi\Documents\vcoding\projects\sandpaper_support
git status
git add data/solution-cards.json data/search-index.json data/search-suggestions.json solutions
git commit -m "fix: improve solution card content quality"
git push origin main
```

If documentation was also updated, add that exact documentation file too.

---

## Final Report Format

Report:

```text
Changed files:
- data/solution-cards.json
- data/search-index.json
- data/search-suggestions.json
- solutions/*/index.html

Cards improved:
- list card IDs

Validation:
- npm run validate:data
- npm run sync:solution-search
- npm run build:solution-pages
- npm run build:solution-pages:check

Manual checks:
- list checked solution pages

Commit:
- commit hash

Push:
- success or exact failure
```