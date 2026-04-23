# Content Model

## Goal
Define the structured data model that will power the support website.

## Core principle
The website should be generated from reusable source data.

We do not want to hardcode support logic separately in:
- pages
- PDFs
- AI prompts
- FAQs
- search rules

All of those should derive from shared data.

---

## Main content objects

### 1) Problem node
Represents a support issue in the tree.

Suggested fields:
- `id`
- `slug`
- `title`
- `search_terms`
- `summary`
- `level`
- `parent_id`
- `qualifier_type`
- `children`
- `status`

### 2) Solution card
Represents a final actionable answer.

Suggested fields:
- `id`
- `title`
- `problem_path`
- `short_answer`
- `likely_cause`
- `recommended_grit`
- `method`
- `steps`
- `avoid`
- `success_check`
- `next_step`
- `related_links`
- `status`

### 3) Grit profile
Represents one grit or grit family page.

Suggested fields:
- `grit`
- `family`
- `typical_uses`
- `not_for`
- `commonly_before`
- `commonly_after`
- `related_problems`
- `status`

### 4) Product profile
Represents a support view of a product.

Suggested fields:
- `product_id`
- `slug`
- `display_name`
- `format`
- `size`
- `abrasive`
- `use_mode`
- `included_grits`
- `related_problems`
- `related_guides`
- `status`

### 5) Alias mapping
Maps real customer phrasing to canonical support nodes.

Suggested fields:
- `alias`
- `maps_to`
- `confidence`
- `notes`

---

## Tree logic

### Level 1
Major problem categories.

### Level 2
Qualifiers such as:
- surface
- stage
- method
- known/unknown grit

### Level 3
Exact scenarios phrased like specific user situations.

### Level 4
Final solution card.

---

## Required behavior

### Search
Search should use:
- titles
- synonyms
- alias mappings
- search_terms arrays

### Pages
Pages should derive from structured content, not manual duplication.

### AI assistant
AI should answer only from approved structured data and linked documents.

### PDFs
PDF exports later should pull from the same structured answers where possible.

---

## Status values
Use explicit status markers.

Recommended values:
- `approved`
- `draft`
- `needs_validation`
- `blocked`

---

## First data objective
For the first commit, we need starter data for:
- top problems
- grit families
- first products
- search aliases

The data does not need to be complete yet, but the structure must be solid.
