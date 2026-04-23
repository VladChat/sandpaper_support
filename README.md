# eQualle Support System

Public support website for eQualle sandpaper products.

## Goal
Create a problem-first support system that helps customers:
- identify their sanding problem quickly
- narrow it down in a few steps
- get one exact answer
- access related grit, product, and how-to guidance

This project is intended to support customers arriving from Amazon and other channels.

## Product Direction
This is **not** a blog and **not** a product catalog.

This is a **diagnostic support system**.

Primary path:
1. Find My Problem
2. Narrow the issue
3. Open exact solution page
4. Follow the recommended next step

Secondary paths:
- By Grit
- By Product
- How To
- FAQ
- Documents / Downloads
- AI Assistant

## First Commit Scope
This first commit contains the project foundation only:
- project rules
- architecture notes
- content model
- taxonomy
- starter JSON data files

No frontend is required yet.

## Recommended Next Build Order
1. define support taxonomy
2. validate starter problem tree
3. validate grit map
4. validate product map
5. build homepage
6. build problem search
7. build problem tree pages
8. build leaf solution template
9. build grit pages
10. build product pages
11. add AI assistant later

## Repository Structure
```text
/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ .gitignore
├─ docs/
│  ├─ architecture.md
│  ├─ content-model.md
│  └─ taxonomy.md
└─ src/
   └─ data/
      ├─ problem-tree.json
      ├─ grit-map.json
      ├─ product-map.json
      └─ aliases.json
```

## Principles
- problem-first
- static-first
- one best answer per leaf page
- English-only public content
- no guessing
- structured data first

## Notes
All public content should be generated from approved source data.

The AI assistant should be added only after the static support system already works.
