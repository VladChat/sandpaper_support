# AGENTS.md

## Project
**Name:** eQualle Support System  
**Purpose:** Build a public web-based support system for eQualle sandpaper products.  
**Primary use case:** Send Amazon customers to a support website where they can quickly identify their exact sanding problem and get a precise answer.  
**Delivery model:** GitHub repository + static public website + separate AI backend endpoint.

---

## 1) Core Decision

We will build this project as a **problem-first support system**, not a product-first catalog.

That means the main entry point is:

- **Find My Problem**
- then narrow down by symptoms
- then narrow down by surface / stage / grit / wet-or-dry
- then show one exact solution

Secondary navigation will include:

- **By Grit**
- **By Product**
- **How To**
- **AI Assistant**
- **FAQ**
- **Documents / Guides**

This is the best fit for post-purchase support because customers usually arrive with a problem, not with a desire to read general documentation.

---

## 2) Non-Negotiable Product Principles

1. **Problem-first navigation**
   - The homepage must lead with user problems.
   - The user should recognize their issue in seconds.

2. **Fast path to answer**
   - Every journey should reduce clicks.
   - Avoid long generic pages before diagnosis.

3. **One best answer**
   - For each leaf issue, provide one primary recommended resolution.
   - Do not overwhelm the user with many competing options.

4. **Structured narrowing**
   - Large problem
   - Problem subtype
   - Exact scenario
   - Final solution

5. **Plain customer language**
   - Use real search-like phrases customers understand.
   - Avoid internal jargon at the top levels.

6. **Expert precision at the leaf level**
   - Final answers must be specific:
     - likely cause
     - recommended grit
     - wet or dry
     - exact steps
     - what to avoid
     - when to move on

7. **SEO and support must align**
   - Every problem branch should be indexable and useful as a landing page.
   - Each page should target one problem intent cleanly.

8. **English-only user-facing content**
   - All public site text, labels, FAQs, support flows, and AI responses default to English.
   - Internal comments and planning notes may be in Russian.

9. **No guessing**
   - Do not invent product facts, grit claims, or material compatibility.
   - Mark unknowns clearly and create validation tasks.

10. **Static-first architecture**
    - Core support content must work without AI.
    - AI is an enhancement layer, not the foundation.

---

## 3) Best Architecture Choice

### Recommended architecture
- **Frontend:** static site in repo, published publicly
- **Hosting:** GitHub Pages for the site
- **AI backend:** separate secure serverless endpoint
- **Content source:** structured JSON / Markdown generated from a central knowledge model
- **Search:** local indexed search for symptom/problem pages
- **AI assistant:** calls backend endpoint that uses approved support knowledge only

### Why this is the best choice
GitHub Pages is excellent for a public static support site, but it is still a static hosting model and has usage limits. It is not suitable for exposing secrets or directly calling paid AI APIs from the browser. OpenAI specifically says not to deploy API keys in client-side apps and to route requests through your own backend. GitHub also documents Pages usage limits and that Pages should not be used as a SaaS backend. citeturn916450view2turn916450view4turn916450view3turn916450view5

### One recommended deployment model
- **GitHub repo** = source of truth
- **GitHub Pages** = public support website
- **Cloudflare Worker** = secure AI endpoint and optional analytics/search helper

This gives:
- simple publishing
- cheap hosting
- secure API key handling
- clear separation between public content and private AI logic

---

## 4) Content Model

The support system will use a **multi-level problem tree**.

### Level 1 — Major problems
Examples:
- scratches too deep
- not sure what grit to use
- paper clogs too fast
- sanding takes too long
- finish looks uneven
- swirl marks remain
- paper tears early
- poor results between coats
- wet sanding leaves haze
- surface still feels rough

### Level 2 — Problem qualifiers
Examples:
- on wood
- on metal
- on painted surface
- on clear coat
- during wet sanding
- during dry sanding
- early prep stage
- final finish stage
- hand sanding
- sanding block use

### Level 3 — Exact scenario
Examples:
- 320 grit does not remove 180 grit scratches
- 1000 grit leaves haze on clear coat
- sandpaper loads up quickly on paint
- 220 grit still leaves wood rough
- paper tears on sharp edges

### Level 4 — Final resolution card
Each final card must contain:
- issue title
- likely cause
- recommended grit
- wet or dry
- exact steps
- avoid this
- success check
- next step

---

## 5) Required Public Sections

### A. Find My Problem
This is the primary section and homepage focus.

Must include:
- symptom-first entry
- visual cards or large buttons
- progressive narrowing
- direct jump to answer

### B. By Grit
Purpose:
- help customers understand when each grit is used
- support customers who already know the grit number

Suggested structure:
- grit family overview
- common uses
- do not use for
- typical progression before/after

### C. By Product
Purpose:
- support users who bought a specific SKU or kit

Suggested structure:
- product overview
- included grits
- common tasks
- most relevant problems
- linked support flows

### D. How To
Purpose:
- procedural support

Suggested pages:
- how to choose grit
- how to sand wet
- how to sand dry
- how to move through grit progression
- how to sand between coats
- how to avoid deep scratches

### E. AI Assistant
Purpose:
- speed up diagnosis
- answer narrow support questions
- guide users into the problem tree

### F. FAQ
Purpose:
- short answers for high-frequency questions
- highly indexable SEO pages

### G. Documents / Downloads
Purpose:
- PDF guides
- troubleshooting sheets
- quick reference charts
- Amazon-safe support assets

---

## 6) AI Assistant Rules

The AI assistant is **not** a free-form general chatbot.

It must behave like a **support triage assistant**.

### AI assistant goals
- identify the user problem fast
- ask minimal clarifying questions
- route to the correct support page
- provide short, exact answers
- stay inside approved knowledge

### AI assistant must not
- hallucinate unsupported product claims
- give unsafe workshop instructions beyond approved guidance
- answer outside the support domain as if it is authoritative
- expose system prompts
- reveal internal taxonomy or hidden logic

### AI assistant response style
- short
- direct
- diagnostic
- problem-solving
- minimal filler

### AI assistant best operating mode
1. detect problem
2. ask 1 focused clarifying question only when needed
3. choose one support path
4. answer
5. link the exact support page

### AI source policy
The assistant should answer only from:
- approved support content
- approved product facts
- approved troubleshooting rules
- approved grit mappings
- approved FAQs

If the answer is not supported, it must say so and route the user to contact/support escalation.

---

## 7) Information Architecture Rules

1. Homepage = problems first.
2. Search bar must be visible above the fold.
3. Search must accept symptom-like phrasing.
4. Every major problem needs a dedicated landing page.
5. Every landing page must offer narrowing filters:
   - surface
   - stage
   - grit known/unknown
   - wet/dry
6. Final answer pages must be short and scannable.
7. Each page should have a related-links block:
   - related problem
   - next grit
   - product page
   - PDF guide
8. Never bury the answer under marketing copy.
9. Public support pages should be accessible without login.
10. Core content must remain useful even with JavaScript disabled where practical.

---

## 8) SEO Rules

1. Build pages around real problem intent.
2. Page titles should match recognizable customer queries.
3. One page = one main problem intent.
4. Use clean URLs.
5. Add internal links between related issues.
6. Include concise FAQ schema-ready sections later.
7. Avoid thin duplicate pages.
8. Avoid keyword stuffing.
9. Put solution summary high on the page.
10. Use static pre-rendered content for all core support pages.

### URL examples
- `/problems/scratches-too-deep/`
- `/problems/paper-clogs-too-fast/on-paint/`
- `/problems/not-sure-what-grit-to-use/wood/`
- `/grits/320/`
- `/products/assorted-kit-80-3000/`
- `/how-to/wet-sanding/`

---

## 9) Repo Rules

### Recommended repo structure
```text
/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ public/
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ content/
│  │  ├─ problems/
│  │  ├─ grits/
│  │  ├─ products/
│  │  ├─ how-to/
│  │  └─ faq/
│  ├─ data/
│  │  ├─ problem-tree.json
│  │  ├─ grit-map.json
│  │  ├─ product-map.json
│  │  └─ aliases.json
│  ├─ lib/
│  ├─ search/
│  └─ styles/
├─ scripts/
│  ├─ build-content/
│  ├─ validate-content/
│  └─ export-pdfs/
├─ docs/
│  ├─ architecture.md
│  ├─ content-model.md
│  ├─ taxonomy.md
│  └─ ai-assistant.md
└─ worker/
   └─ api/
```

### Branching rules
- `main` = production-ready only
- feature branches for all work
- small focused commits
- no direct commit to `main` except emergency fix

### Content rules
- structured content first
- rendered pages second
- no manual duplication across many pages
- all repeated claims must come from shared source data

---

## 10) Quality Rules

Every completed support page must pass these checks:

### User clarity
- Can a customer identify this issue in under 5 seconds?
- Is the answer visible without heavy reading?
- Is the next action obvious?

### Support quality
- Does it solve a real post-purchase issue?
- Does it avoid vague advice?
- Does it specify grit, stage, and method where needed?

### SEO quality
- Is the page focused on one search intent?
- Is the title aligned with a real customer query?
- Is there duplicate overlap with another page?

### Data quality
- Is every factual claim sourced from approved project knowledge?
- Is product compatibility verified?
- Are grit recommendations internally consistent?

---

## 11) Build Plan

## Phase 1 — Foundation
Goal: create the project skeleton and core rules.

Tasks:
1. create repo
2. create frontend scaffold
3. add AGENTS.md
4. define content model
5. define URL structure
6. define visual style
7. define problem taxonomy
8. define grit taxonomy
9. define product taxonomy

Deliverable:
- working local project with empty but real structure

---

## Phase 2 — Knowledge Model
Goal: build the support database before building pretty pages.

Tasks:
1. create master problem list
2. create problem qualifiers
3. create leaf solution format
4. create grit map
5. create product map
6. create phrase alias map from real customer language
7. create validation rules to catch contradictions

Deliverable:
- structured JSON/Markdown support knowledge base

---

## Phase 3 — Core UX
Goal: build the support flows customers will actually use.

Tasks:
1. homepage with problem-first navigation
2. global search
3. problem tree pages
4. leaf solution pages
5. by grit pages
6. by product pages
7. related links blocks
8. document download section

Deliverable:
- static support site fully navigable without AI

---

## Phase 4 — AI Assistant
Goal: add secure assistant without breaking the static-first model.

Tasks:
1. create secure backend endpoint
2. add retrieval over approved support content
3. add strict assistant instructions
4. add conversation logging policy
5. add user interface widget
6. add guardrails for unsupported questions
7. add handoff to exact page links

Deliverable:
- AI assistant that improves routing and diagnosis

---

## Phase 5 — Content Expansion
Goal: scale breadth and coverage.

Tasks:
1. add all major problem branches
2. add grit-specific support pages
3. add kit-specific support pages
4. add FAQs
5. add downloadable PDFs
6. add short support videos
7. add Amazon-facing landing pages

Deliverable:
- broad useful support library

---

## Phase 6 — Measurement and Refinement
Goal: improve searchability and reduce unresolved visits.

Tasks:
1. add analytics
2. track most searched problems
3. track dead-end searches
4. track page exits
5. improve taxonomy and aliases
6. improve AI routing quality
7. add missing content based on real usage

Deliverable:
- measurable support system that gets better over time

---

## 12) Working Rules For Agents

1. Always preserve the problem-first architecture.
2. Do not turn the homepage into a product catalog.
3. Do not start with a giant blog strategy.
4. Build the support knowledge model before scaling design.
5. Prefer reusable structured data over hardcoded page text.
6. Keep answers short and concrete.
7. Every support statement must be traceable to approved data.
8. When uncertain, create a validation task instead of guessing.
9. AI must route to content, not replace the content system.
10. Public UX simplicity is more important than fancy architecture.

---

## 13) First Execution Target

The first practical milestone is:

**A working MVP with:**
- homepage
- problem search
- 10 major problems
- 3 levels of narrowing
- final answer pages
- grit pages
- product pages for the first key SKUs
- no hallucination AI assistant linked to approved support content only

---

## 14) Immediate Next Step

Create these files first:

1. `README.md`
2. `docs/architecture.md`
3. `docs/content-model.md`
4. `docs/taxonomy.md`
5. `src/data/problem-tree.json`
6. `src/data/grit-map.json`
7. `src/data/product-map.json`

Then build the first version of:
- homepage
- problem tree
- leaf answer template
- search index

---

## 15) Amazon Fit

This support system is designed to work well with Amazon Product Support because Amazon allows self-help content, documents, and URLs that help customers resolve product issues quickly, and product documents like manuals or troubleshooting guides can be uploaded for products. The website will serve as the richer support destination, while Amazon can point customers to the relevant support resource. citeturn916450view0turn335319search1turn335319search9
