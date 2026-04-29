# Operations Log


## 2026-04-28 — P7 Local Autocomplete
- Changed files: index.html, assets/support-assistant.js, assets/home-autocomplete.js, assets/styles.css, package.json, package-lock.json, assets/vendor/autocomplete-js/index.production.js, assets/vendor/fuse.min.mjs.
- Behavior: replaced homepage suggestion rendering with @algolia/autocomplete-js UI + local Fuse.js fuzzy ranking using local data (search-index, solution-cards, problem-tree). Suggestions now refresh on every keystroke, cap at 8 results, keep multi-word queries like 'how to', and show empty state message 'No matching answers found.'.
- Validation: npm run build passed; node scripts/validate-source-integrity.js passed; node scripts/check-internal-links.js passed (0 broken links).

## 2026-04-29 — P7 Autocomplete Activation on Homepage
- Updated index.html to explicitly load autocomplete activation flag, vendor script, and home-autocomplete module before assets/app.js.
- Updated assets/home-autocomplete.js Fuse import to relative path ./vendor/fuse.min.mjs.
- Updated assets/support-assistant.js to skip old homepage suggestion binding when window.eQualleUseAlgoliaAutocomplete is true and homepage search input exists.
- Validation: npm run build passed; node scripts/validate-source-integrity.js passed; node scripts/check-internal-links.js passed (0 broken links).

## 2026-04-29 — Homepage Autocomplete Rendering Fix
- Removed homepage dependency on @algolia/autocomplete-js UI rendering for suggestions.
- Updated index.html to keep the homepage autocomplete flag and module, removed vendor autocomplete-js script include, and kept assets/app.js loading after module.
- Replaced assets/home-autocomplete.js with a direct Fuse.js autocomplete controller bound to [data-support-search] and [data-search-results], rendering up to 8 results per keystroke and fallback to /ask when no matches.
- Added startup console message: eQualle homepage autocomplete initialized and explicit console.error on search-index load failure.
- Browser-tested queries: h, ho, how, how to, how to fix, clogged, wet sanding, plastic.
- Browser test result: suggestions rendered and refreshed on every keystroke; no disappearing on 'how to'; max 8 rows; click navigation worked; no console errors.
- Validation: npm run build passed; node scripts/validate-source-integrity.js passed; node scripts/check-internal-links.js passed (0 broken links).

## 2026-04-29 — Visible-Title-Only Autocomplete Matching
- Homepage autocomplete now indexes and ranks only visible customer-facing suggestion titles (isibleTitle) for matching.
- Hidden fields (description, customer_phrases, aliases, surface, grits, method) are no longer used for autocomplete ranking.
- Ranking order for homepage autocomplete: visibleTitle prefix match, visibleTitle contains query, then Fuse fuzzy match on visibleTitle only.
- Added query-specific filtering so how to fix returns only How do I fix ... visible titles.
- Tested queries: h, ho, how, how to, how to fix, clogged, wet sanding, plastic, grit, scratches.
- Validation: npm run build passed; source integrity passed; internal links passed (0 broken links); browser test showed max 8 suggestions and no console errors.

## 2026-04-29 — Unified Autocomplete Across Support Pages
- Added shared module: assets/support-autocomplete.js.
- Shared module loads data/search-index.json once, builds visibleTitle suggestions once, and binds all [data-support-search] inputs on each page with per-input result containers and submit buttons.
- Unified behavior everywhere: visibleTitle-only ranking (prefix, contains, Fuse fuzzy), max 8 suggestions, same rendering, Enter/Get Answer first-result behavior, ask fallback, and base-path-safe URLs.
- Updated index.html and templates/solution-page.html to load assets/support-autocomplete.js before assets/app.js with flags: window.eQualleUseUnifiedAutocomplete=true and window.eQualleUseAlgoliaAutocomplete=true.
- Updated assets/support-assistant.js old homepage search guard to skip when unified autocomplete flag is active so old suggestion rendering does not conflict.
- assets/home-autocomplete.js is now a compatibility shim that forwards to support-autocomplete.
- Browser-tested pages: /, /solutions/plastic-still-rough/, /solutions/paint-clogs-sheet/.
- Tested queries: h, ho, how, how to, how to fix, clogged, wet sanding, plastic, grit, scratches (home) and how to fix, clogged, wet sanding, plastic (solution pages).
- Results: suggestions update on every keystroke, max 8 results, consistent visible titles across pages, click + Enter navigation works, and no console errors.

## 2026-04-29 — Answer Card Heading Size Fix
- Updated templates/solution-page.html to use <h2 class='answer-section-title'>What to do</h2> inside solution answer cards.
- Added scoped styling in assets/styles.css for .answer-card .answer-section-title and fallback .answer-card > h2 to keep the internal heading compact and card-style.
- Regenerated solutions from template via build.
- Browser-verified pages: /solutions/paint-clogs-sheet/ and /solutions/plastic-still-rough/.
- Verification: page title remains large (~53.76px), internal What to do heading is compact (~21.6px), autocomplete still works (8 suggestions for how to fix), no console errors.
