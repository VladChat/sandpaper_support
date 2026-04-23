# Architecture

## Objective
Build a public support website that can be linked from Amazon and used directly by customers.

## Recommended architecture

### Public layer
- static frontend site
- published from GitHub
- hosted publicly
- built to work without AI

### Data layer
- structured JSON and/or Markdown
- source of truth for support content
- powers pages, search, PDFs, and AI answers

### Search layer
- lightweight local search index
- supports symptom-style phrases
- maps queries to problem tree nodes and support pages

### AI layer
- separate secure backend endpoint
- retrieval from approved support content only
- no secret keys in browser code
- returns short support answers and exact page routing

## Why static-first
The support site must remain useful even when:
- AI is disabled
- API budget is limited
- backend is temporarily unavailable

Static-first also improves:
- reliability
- deployment simplicity
- SEO crawlability
- control over approved content

## Recommended deployment shape
- GitHub repository = source control
- GitHub Pages = public support website
- separate secure endpoint = AI assistant backend

## MVP architecture
For MVP, the project needs only:
- docs
- structured data files
- frontend scaffold later
- static support pages later

The AI backend is not required for the first commit.

## Future architecture concerns
Later phases should consider:
- analytics for search and dead ends
- support content validation scripts
- PDF export scripts
- versioned content generation
- support page templates

## Build priorities
1. knowledge model
2. taxonomy
3. search mapping
4. page generation
5. UI polish
6. AI assistant
