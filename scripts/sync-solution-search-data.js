#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOLUTION_CARDS_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const SEARCH_INDEX_PATH = path.join(ROOT_DIR, "data", "search-index.json");
const SEARCH_SUGGESTIONS_PATH = path.join(ROOT_DIR, "data", "search-suggestions.json");

const REQUIRED_STRING_FIELDS = [
  "id",
  "slug",
  "problem_slug",
  "title",
  "problem",
  "surface",
  "task",
  "symptom",
  "quick_answer",
  "likely_cause",
  "recommended_grit",
  "wet_or_dry",
  "avoid",
  "success_check",
];

const REQUIRED_ARRAY_FIELDS = [
  "best_grit_path",
  "optional_starting_grits",
  "steps",
  "mistakes_to_avoid",
  "related_solution_ids",
  "search_phrases",
];

const GRIT_ORDER = [
  60, 80, 100, 120, 150, 180, 220, 240, 280, 320, 360, 400, 500, 600, 800,
  1000, 1200, 1500, 2000, 3000,
];

const KEYWORD_FILLERS = new Set([
  "how", "why", "what", "which", "can", "should", "where", "when", "do", "does", "is",
  "i", "me", "my", "the", "a", "an", "to", "for", "with", "and", "or", "of", "this", "that", "it",
]);

const CURATED_SUGGESTION_GROUPS = {
  how: [
    ["How do I remove deep scratches?", "deep-scratches-after-80-grit"],
    ["How do I fix clogged sandpaper?", "paint-clogs-sheet"],
    ["How do I reduce wet sanding haze?", "normal-haze-after-wet-sanding"],
    ["How do I sand plastic smoother?", "plastic-still-rough"],
    ["How do I choose a starting grit?", "choosing-starting-grit"],
  ],
  why: [
    ["Why does sandpaper clog?", "paint-clogs-sheet"],
    ["Why are scratches still visible?", "deep-scratches-after-80-grit"],
    ["Why does wet sanding leave haze?", "normal-haze-after-wet-sanding"],
    ["Why does the surface stay rough?", "wood-still-rough-after-120"],
    ["Why does the finish look uneven?", "uneven-finish-from-pressure"],
  ],
  what: [
    ["What grit should I use?", "choosing-starting-grit"],
    ["What grit removes paint?", "paint-removal-too-slow"],
    ["What grit is used for wood prep?", "what-grit-for-wood-prep"],
    ["What grit is used for paint prep?", "what-grit-for-paint-prep"],
    ["What grit helps wet sanding haze?", "normal-haze-after-wet-sanding"],
  ],
  which: [
    ["Which grit should I start with?", "choosing-starting-grit"],
    ["Which grit fixes 180 grit scratches?", "320-does-not-remove-180-scratches"],
    ["Which grit is too aggressive?", "60-grit-too-aggressive"],
    ["Which sandpaper helps rough plastic?", "plastic-still-rough"],
    ["Which grit works between coats?", "between-coats-too-coarse"],
  ],
  can: [
    ["Can I use 320 after 180?", "320-does-not-remove-180-scratches"],
    ["Can 3000 grit help polishing prep?", "normal-haze-after-wet-sanding"],
    ["Can sandpaper remove paint?", "paint-removal-too-slow"],
    ["Can sanding fix swirl marks?", "swirls-after-1000"],
    ["Can I wet sand clear coat?", "clear-coat-haze-after-1000"],
  ],
  should: [
    ["Should I replace sandpaper when it stops cutting?", "sheet-smooth-but-unused"],
    ["Should I soak sandpaper before wet sanding?", "sheet-soft-after-soaking-too-long"],
    ["Should I skip grits?", "skipped-120-to-320"],
    ["Should I use coarse grit first?", "60-grit-too-aggressive"],
    ["Should I sand wet or dry?", "normal-haze-after-wet-sanding"],
  ],
  when: [
    ["When should I replace sandpaper?", "sheet-smooth-but-unused"],
    ["When should I wet sand?", "normal-haze-after-wet-sanding"],
    ["When should I stop sanding?", "uneven-finish-from-pressure"],
    ["When should I use 3000 grit?", "normal-haze-after-wet-sanding"],
    ["When should I change grit?", "skipped-120-to-320"],
  ],
  do: [
    ["Do I need water for wet sanding?", "normal-haze-after-wet-sanding"],
    ["Do I sand between coats?", "between-coats-too-coarse"],
    ["Do I need to start over after deep scratches?", "deep-scratches-after-80-grit"],
    ["Do I need a sanding block?", "sheet-hard-to-hold-detail-sanding"],
    ["Do I need to clean the sandpaper?", "paint-clogs-sheet"],
  ],
  does: [
    ["Does this sandpaper work wet and dry?", "normal-haze-after-wet-sanding"],
    ["Does 3000 grit polish the surface?", "normal-haze-after-wet-sanding"],
    ["Does sandpaper remove rust?", "metal-still-rough"],
    ["Does clogging mean the sandpaper is worn out?", "sheet-smooth-but-unused"],
    ["Does grit come off the sheet?", "grit-comes-off-sheet"],
  ],
  is: [
    ["Is wet sanding better than dry sanding?", "normal-haze-after-wet-sanding"],
    ["Is 60 grit too aggressive?", "60-grit-too-aggressive"],
    ["Is 80 grit too coarse?", "80-grit-removes-too-much"],
    ["Is the surface ready for the next grit?", "skipped-120-to-320"],
    ["Is the sandpaper worn out?", "sheet-smooth-but-unused"],
  ],
  sandpaper: [
    ["Sandpaper clogs too fast", "paint-clogs-sheet"],
    ["Scratches are too deep", "deep-scratches-after-80-grit"],
    ["Surface still feels rough", "wood-still-rough-after-120"],
    ["Wet sanding leaves haze", "normal-haze-after-wet-sanding"],
    ["Sheet feels smooth but stops cutting", "sheet-smooth-but-unused"],
  ],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  (Array.isArray(values) ? values : []).forEach(function (value) {
    const cleaned = String(value || "").trim();
    if (!cleaned || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    out.push(cleaned);
  });
  return out;
}

function ensureNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCard(card, index, cardsById) {
  const errors = [];
  const label = "Card " + index + " (" + (card.id || "unknown") + ")";

  REQUIRED_STRING_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push(label + " missing field '" + field + "'");
      return;
    }
    if (!ensureNonEmptyString(card[field])) {
      errors.push(label + " field '" + field + "' must be non-empty");
    }
  });

  REQUIRED_ARRAY_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push(label + " missing field '" + field + "'");
      return;
    }
    if (!Array.isArray(card[field])) {
      errors.push(label + " field '" + field + "' must be an array");
    }
  });

  if (Array.isArray(card.best_grit_path) && !card.best_grit_path.length) {
    errors.push(label + " field 'best_grit_path' must be non-empty");
  }
  if (Array.isArray(card.steps) && !card.steps.length) {
    errors.push(label + " field 'steps' must be non-empty");
  }
  if (Array.isArray(card.mistakes_to_avoid) && !card.mistakes_to_avoid.length) {
    errors.push(label + " field 'mistakes_to_avoid' must be non-empty");
  }
  if (Array.isArray(card.search_phrases) && !card.search_phrases.length) {
    errors.push(label + " field 'search_phrases' must be non-empty");
  }

  if (card.id !== card.slug) {
    errors.push(label + " id and slug should match");
  }

  if (Array.isArray(card.related_solution_ids)) {
    card.related_solution_ids.forEach(function (id, relIndex) {
      const relId = String(id || "").trim();
      if (!relId) {
        errors.push(label + " related_solution_ids[" + relIndex + "] must be non-empty");
        return;
      }
      if (!cardsById[relId]) {
        errors.push(label + " related_solution_ids[" + relIndex + "] references missing id '" + relId + "'");
      }
    });
  }

  return errors;
}

function buildSearchableText(card) {
  return [
    card.title,
    card.problem,
    card.surface,
    card.task,
    card.symptom,
    card.quick_answer,
    card.likely_cause,
    card.recommended_grit,
    card.wet_or_dry,
    card.avoid,
    card.success_check,
    ...(Array.isArray(card.steps) ? card.steps : []),
    ...(Array.isArray(card.best_grit_path) ? card.best_grit_path : []),
    ...(Array.isArray(card.optional_starting_grits) ? card.optional_starting_grits : []),
    ...(Array.isArray(card.mistakes_to_avoid) ? card.mistakes_to_avoid : []),
    ...(Array.isArray(card.search_phrases) ? card.search_phrases : []),
  ].join(" ");
}

function inferGrits(card, searchableText) {
  const text = normalizeText(searchableText);
  const fromPaths = uniqueStrings(
    (Array.isArray(card.best_grit_path) ? card.best_grit_path : [])
      .concat(Array.isArray(card.optional_starting_grits) ? card.optional_starting_grits : [])
      .map(String),
  );

  const detected = GRIT_ORDER
    .map(String)
    .filter(function (grit) {
      return new RegExp("\\b" + grit + "\\b").test(text);
    });

  const merged = uniqueStrings(fromPaths.concat(detected));
  return GRIT_ORDER.map(String).filter(function (grit) {
    return merged.indexOf(grit) !== -1;
  });
}

function inferMethods(card, searchableText) {
  const text = normalizeText([card.wet_or_dry, searchableText].join(" "));
  const methods = [];
  if (text.indexOf("wet") !== -1) {
    methods.push("wet");
  }
  if (text.indexOf("dry") !== -1) {
    methods.push("dry");
  }
  return uniqueStrings(methods);
}

function buildSolutionSearchEntry(card) {
  const searchableText = buildSearchableText(card);

  return {
    id: "solution-" + card.id,
    type: "exact_solution",
    title: card.title,
    description: card.problem,
    customer_phrases: uniqueStrings([card.title, card.problem, card.quick_answer].concat(card.search_phrases || [])),
    aliases: uniqueStrings([
      card.surface,
      card.task,
      card.symptom,
      card.likely_cause,
      card.recommended_grit,
      card.avoid,
    ].concat(card.mistakes_to_avoid || [])),
    surface: uniqueStrings([card.surface]),
    grits: inferGrits(card, searchableText),
    method: inferMethods(card, searchableText),
    target_url: "/solutions/" + card.id + "/",
    result_kind: "answer",
  };
}

function keywordsFromText(text) {
  const tokens = String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  const seen = new Set();
  const out = [];
  tokens.forEach(function (token) {
    if (KEYWORD_FILLERS.has(token) || seen.has(token)) {
      return;
    }
    seen.add(token);
    out.push(token);
  });
  return out.slice(0, 12);
}

function buildSuggestionObject(questionWord, rankIndex, title, card) {
  const type = questionWord === "sandpaper"
    ? "general_sandpaper_suggestion"
    : "question_suggestion";
  return {
    id: "suggestion-" + questionWord + "-" + card.id,
    type: type,
    question_word: questionWord,
    title: title,
    description: card.problem,
    target_url: "/solutions/" + card.id + "/",
    keywords: keywordsFromText([title, card.title, card.problem].join(" ")),
    aliases: [card.title, card.problem],
    priority: 100 - rankIndex * 5,
    result_kind: "answer",
  };
}

function buildCuratedSuggestions(cardsById) {
  const suggestions = [];
  const missingIds = [];

  Object.keys(CURATED_SUGGESTION_GROUPS).forEach(function (groupKey) {
    const items = CURATED_SUGGESTION_GROUPS[groupKey] || [];
    items.forEach(function (item, index) {
      const title = item[0];
      const cardId = item[1];
      const card = cardsById[cardId];
      if (!card) {
        missingIds.push(cardId);
        return;
      }
      suggestions.push(buildSuggestionObject(groupKey, index, title, card));
    });
  });

  return {
    suggestions: suggestions,
    missingIds: uniqueStrings(missingIds),
  };
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.indexOf("--write") !== -1 ? "write" : "check";

  const cards = readJson(SOLUTION_CARDS_PATH);
  const searchIndex = readJson(SEARCH_INDEX_PATH);
  if (!Array.isArray(cards)) {
    throw new Error("data/solution-cards.json must be an array");
  }
  if (!Array.isArray(searchIndex)) {
    throw new Error("data/search-index.json must be an array");
  }

  const cardsById = {};
  cards.forEach(function (card) {
    cardsById[card.id] = card;
  });

  const errors = [];
  const seenId = {};
  const seenSlug = {};

  cards.forEach(function (card, index) {
    if (seenId[card.id]) {
      errors.push("Duplicate card id: " + card.id);
    }
    if (seenSlug[card.slug]) {
      errors.push("Duplicate card slug: " + card.slug);
    }
    seenId[card.id] = true;
    seenSlug[card.slug] = true;
    validateCard(card, index, cardsById).forEach(function (error) {
      errors.push(error);
    });
  });

  if (errors.length) {
    errors.forEach(function (error) {
      console.error(error);
    });
    process.exitCode = 1;
    return;
  }

  const generatedEntries = cards.map(buildSolutionSearchEntry);
  const solutionTargetSet = new Set(cards.map(function (card) {
    return "/solutions/" + card.id + "/";
  }));

  const preservedEntries = searchIndex.filter(function (entry) {
    const id = String((entry && entry.id) || "").trim();
    const target = String((entry && entry.target_url) || "").trim();
    if (id.indexOf("solution-") === 0) {
      return false;
    }
    if (solutionTargetSet.has(target)) {
      return false;
    }
    return true;
  });

  const nextSearchIndex = generatedEntries.concat(preservedEntries);
  const curated = buildCuratedSuggestions(cardsById);
  if (curated.missingIds.length) {
    curated.missingIds.forEach(function (id) {
      console.error("Missing card id for curated suggestions: " + id);
    });
    process.exitCode = 1;
    return;
  }

  if (mode !== "write") {
    console.log("Mode: check");
    console.log("Planned solution search entries: " + generatedEntries.length);
    console.log("Planned search suggestions: " + curated.suggestions.length);
    return;
  }

  writeJson(SEARCH_INDEX_PATH, nextSearchIndex);
  writeJson(SEARCH_SUGGESTIONS_PATH, curated.suggestions);
  console.log("Solution search entries written: " + generatedEntries.length);
  console.log("Search suggestions written: " + curated.suggestions.length);
  console.log("Mode: write");
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
}
