# Search Autocomplete Strategy

## Decision

The homepage should not show a huge visible list of problems.

The full problem list should live in structured data and power search, autocomplete, and guided diagnosis.

The public homepage should show:

1. one large problem search box
2. a small set of top problem shortcuts
3. optional category chips
4. AI helper entry point

The full taxonomy stays in files such as:

- `src/data/problem-tree.json`
- `src/data/aliases.json`
- `src/data/search-index.json`
- future `src/data/solution-cards.json`

## User Experience

### Main homepage behavior

The user sees:

```text
What sanding problem are you trying to fix?
[ Start typing your problem... ]
```

As the user types, the system shows suggestions:

- matching problems
- matching surface scenarios
- matching grit scenarios
- exact solution cards
- related how-to guides

Example query:

```text
paper clogs
```

Suggestions:

- Sandpaper clogs quickly on painted surfaces
- Sandpaper loads up during dry sanding
- How to reduce clogging while sanding
- Should I wet sand to reduce clogging?

Example query:

```text
320 scratches
```

Suggestions:

- 320 grit does not remove 180 grit scratches
- Scratches are still visible after sanding
- How to move through grit progression
- 320 grit guide

## Visible Homepage Shortcuts

Show only 6-8 top problems, not the full database.

Recommended shortcut cards:

- Scratches are too deep
- Not sure what grit to use
- Sandpaper clogs too fast
- Surface still feels rough
- Wet sanding left haze
- Finish looks uneven
- Sanding takes too long
- Paper tears early

These cards are fallback navigation for users who do not want to type.

## Internal Search Model

Each searchable item should include:

```json
{
  "id": "paper-clogs-on-paint",
  "type": "problem",
  "title": "Sandpaper clogs quickly on painted surfaces",
  "symptoms": ["paper clogs", "paint builds up", "sandpaper loads up"],
  "aliases": ["gets clogged", "gums up", "fills with paint"],
  "surfaces": ["paint", "wood", "metal"],
  "grits": ["80", "120", "180", "220", "320"],
  "methods": ["dry", "wet"],
  "targetUrl": "/problems/paper-clogs-too-fast/on-paint/"
}
```

## Best Practice Rules

1. Do not expose the whole problem tree on the homepage.
2. Use autocomplete to reveal the problem tree progressively.
3. Use customer language in suggestions.
4. Keep expert terms inside final answers.
5. Show the best match first.
6. Show no more than 5-7 suggestions at once.
7. Include a fallback button: "Browse all problems".
8. Use synonyms and aliases aggressively.
9. Track zero-result searches later.
10. Turn repeated zero-result searches into new support pages.

## AI Role

AI should support search, not replace it.

Best AI behavior:

1. user types a problem
2. local search suggests pages instantly
3. user can ask AI when suggestions are not enough
4. AI asks one clarifying question if needed
5. AI links to the best exact page

## Implementation Order

1. expand `aliases.json`
2. create `search-index.json`
3. update homepage to search-first layout
4. show autocomplete suggestions while typing
5. add small top-problem shortcut cards
6. add "Browse all problems" page
7. add unresolved-search logging later
8. add AI assistant after the content base is strong

## Final UX Rule

The system should feel like Amazon search suggestions for sanding problems:

- type the symptom
- get suggested problems
- click the closest match
- receive one exact answer
