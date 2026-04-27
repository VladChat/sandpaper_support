#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOLUTION_CARDS_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const SEARCH_INDEX_PATH = path.join(ROOT_DIR, "data", "search-index.json");
const SEARCH_SUGGESTIONS_PATH = path.join(ROOT_DIR, "data", "search-suggestions.json");

const REQUIRED_CARD_FIELDS = [
  "id",
  "title",
  "problem_slug",
  "problem",
  "likely_cause",
  "recommended_grit",
  "wet_or_dry",
  "steps",
  "avoid",
  "success_check",
];

const SURFACE_RULES = [
  { term: "wood", value: "wood" },
  { term: "paint", value: "paint" },
  { term: "primer", value: "primer" },
  { term: "clear coat", value: "clear coat" },
  { term: "clearcoat", value: "clear coat" },
  { term: "metal", value: "metal" },
  { term: "plastic", value: "plastic" },
  { term: "drywall", value: "drywall" },
  { term: "finish", value: "finish" },
  { term: "coating", value: "finish" },
];

const GRIT_ORDER = [60, 80, 100, 120, 150, 180, 220, 240, 280, 320, 360, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 3000];

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

function buildSearchableText(card) {
  return [
    card.title,
    card.problem,
    card.likely_cause,
    card.recommended_grit,
    card.wet_or_dry,
    card.avoid,
    card.success_check,
    ...(Array.isArray(card.steps) ? card.steps : []),
  ].join(" ");
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  (values || []).forEach(function (value) {
    const cleaned = String(value || "").trim();
    if (!cleaned || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    output.push(cleaned);
  });
  return output;
}

function inferSurfaces(searchableText) {
  const text = normalizeText(searchableText);
  const found = [];

  SURFACE_RULES.forEach(function (rule) {
    if (text.indexOf(rule.term) !== -1) {
      found.push(rule.value);
    }
  });

  return uniqueStrings(found);
}

function inferGrits(searchableText) {
  const text = normalizeText(searchableText);
  const found = [];
  GRIT_ORDER.forEach(function (grit) {
    const pattern = new RegExp("\\b" + grit + "\\b");
    if (pattern.test(text)) {
      found.push(String(grit));
    }
  });
  return found;
}

function inferMethods(card, searchableText) {
  const text = normalizeText(searchableText + " " + String(card.wet_or_dry || ""));
  const methods = [];
  if (text.indexOf("wet") !== -1) {
    methods.push("wet");
  }
  if (text.indexOf("dry") !== -1) {
    methods.push("dry");
  }
  return uniqueStrings(methods);
}

function validateCard(card, index) {
  const errors = [];
  REQUIRED_CARD_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push("Card " + index + " (" + (card.id || "unknown") + ") missing field: " + field);
      return;
    }

    if (field === "steps") {
      if (!Array.isArray(card.steps) || card.steps.length === 0) {
        errors.push("Card " + index + " (" + (card.id || "unknown") + ") field 'steps' must be a non-empty array");
      }
      return;
    }

    if (!String(card[field] || "").trim()) {
      errors.push("Card " + index + " (" + (card.id || "unknown") + ") field '" + field + "' must be non-empty");
    }
  });
  return errors;
}

function buildSolutionSearchEntry(card) {
  const searchableText = buildSearchableText(card);
  const firstTwoSteps = Array.isArray(card.steps) ? card.steps.slice(0, 2) : [];

  return {
    id: "solution-" + card.id,
    type: "exact_solution",
    title: card.title,
    description: card.problem,
    customer_phrases: uniqueStrings([card.title, card.problem].concat(firstTwoSteps)),
    aliases: uniqueStrings([card.likely_cause, card.recommended_grit, card.avoid]),
    surface: inferSurfaces(searchableText),
    grits: inferGrits(searchableText),
    method: inferMethods(card, searchableText),
    target_url: "/solutions/" + card.id + "/",
    result_kind: "answer",
  };
}

function keywordsFromText(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];

  const seen = new Set();
  const output = [];

  tokens.forEach(function (token) {
    if (KEYWORD_FILLERS.has(token)) {
      return;
    }
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    output.push(token);
  });

  return output.slice(0, 12);
}

function buildSuggestionObject(questionWord, rankIndex, title, card) {
  const type = questionWord === "sandpaper" ? "general_sandpaper_suggestion" : "question_suggestion";
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

  const validationErrors = [];
  cards.forEach(function (card, index) {
    validateCard(card, index).forEach(function (error) {
      validationErrors.push(error);
    });
  });

  if (validationErrors.length) {
    validationErrors.forEach(function (error) {
      console.error(error);
    });
    process.exitCode = 1;
    return;
  }

  const cardsById = {};
  cards.forEach(function (card) {
    cardsById[card.id] = card;
  });

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