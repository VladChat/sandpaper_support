#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const TEMPLATE_PATH = path.join(ROOT_DIR, "templates", "solution-page.html");
const SOLUTIONS_DIR = path.join(ROOT_DIR, "solutions");

const VALID_GRITS = new Set([
  "60", "80", "100", "120", "150", "180", "220", "240", "280", "320",
  "360", "400", "500", "600", "800", "1000", "1200", "1500", "2000", "3000",
]);

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

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonForHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/<\/script/gi, "<\\/script");
}

function sitePath(relativeUrl) {
  const input = String(relativeUrl || "").trim();
  if (!input) {
    return "/sandpaper_support/";
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  const withLeadingSlash = input.charAt(0) === "/" ? input : "/" + input;
  if (withLeadingSlash.indexOf("/sandpaper_support/") === 0) {
    return withLeadingSlash;
  }

  return "/sandpaper_support" + withLeadingSlash;
}

function replaceAllPlaceholders(template, values) {
  let output = String(template || "");
  Object.keys(values || {}).forEach(function (key) {
    const token = "{{" + key + "}}";
    output = output.split(token).join(String(values[key] == null ? "" : values[key]));
  });
  return output;
}

function normalizeGrit(value) {
  const cleaned = String(value == null ? "" : value).trim();
  return cleaned;
}

function listToLiHtml(items, baseIndent) {
  return (Array.isArray(items) ? items : [])
    .map(function (item) {
      return baseIndent + "<li>" + escapeHtml(item) + "</li>";
    })
    .join("\n");
}

function renderSteps(steps) {
  return listToLiHtml(steps, "          ");
}

function renderMistakesToAvoid(card) {
  return listToLiHtml(card.mistakes_to_avoid, "          ");
}

function renderBestGritPath(card) {
  const optionalStarts = Array.isArray(card.optional_starting_grits)
    ? card.optional_starting_grits.map(normalizeGrit).filter(Boolean)
    : [];
  const mainPath = Array.isArray(card.best_grit_path)
    ? card.best_grit_path.map(normalizeGrit).filter(Boolean)
    : [];

  const parts = [];
  if (optionalStarts.length) {
    parts.push(optionalStarts.join(" or ") + " only if very uneven");
  }
  parts.push(mainPath.join(" \u2192 "));
  return escapeHtml(parts.join(" \u2192 "));
}

function renderRelatedSolutions(card, cardsById) {
  const ids = Array.isArray(card.related_solution_ids) ? card.related_solution_ids : [];
  const uniqueIds = [];
  const seen = {};
  ids.forEach(function (id) {
    const key = String(id || "").trim();
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    uniqueIds.push(key);
  });

  const items = uniqueIds
    .map(function (solutionId) {
      const related = cardsById[solutionId];
      if (!related) {
        return "";
      }
      return (
        "        <li><a href=\"" +
        escapeHtml(sitePath("/solutions/" + related.id + "/")) +
        "\">" +
        escapeHtml(related.title) +
        "</a></li>"
      );
    })
    .filter(Boolean);

  if (!items.length) {
    return "";
  }

  return [
    '    <section class="solution-card related-solutions-card">',
    '      <div class="solution-card-label">Related Problems</div>',
    '      <div class="related-solutions">',
    "      <ul>",
    items.join("\n"),
    "      </ul>",
    "      </div>",
    "    </section>",
  ].join("\n");
}

function buildSolutionContextJson(card) {
  return {
    solution_id: card.id,
    solution_slug: card.slug,
    title: card.title,
    problem: card.problem,
    surface: card.surface,
    task: card.task,
    symptom: card.symptom,
    quick_answer: card.quick_answer,
    best_grit_path: Array.isArray(card.best_grit_path) ? card.best_grit_path : [],
    optional_starting_grits: Array.isArray(card.optional_starting_grits)
      ? card.optional_starting_grits
      : [],
    steps: Array.isArray(card.steps) ? card.steps : [],
    why_it_happens: card.likely_cause,
    mistakes_to_avoid: Array.isArray(card.mistakes_to_avoid)
      ? card.mistakes_to_avoid
      : [],
    success_check: card.success_check,
    wet_or_dry: card.wet_or_dry,
    related_solution_ids: Array.isArray(card.related_solution_ids)
      ? card.related_solution_ids
      : [],
  };
}

function hasPlaceholderText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) {
    return false;
  }
  return (
    text.indexOf("todo") !== -1 ||
    text.indexOf("tbd") !== -1 ||
    text.indexOf("placeholder") !== -1 ||
    text.indexOf("lorem ipsum") !== -1 ||
    text.indexOf("xxx") !== -1
  );
}

function validateCard(card, index, idsSet, slugsSet, cardsById) {
  const errors = [];
  const cardLabel = "Card " + index + " (" + (card && card.id ? card.id : "unknown") + ")";

  REQUIRED_STRING_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push(cardLabel + ": missing required field '" + field + "'");
      return;
    }
    const value = String(card[field] == null ? "" : card[field]).trim();
    if (!value) {
      errors.push(cardLabel + ": field '" + field + "' must be non-empty");
      return;
    }
    if (hasPlaceholderText(value)) {
      errors.push(cardLabel + ": field '" + field + "' contains placeholder text");
    }
  });

  REQUIRED_ARRAY_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push(cardLabel + ": missing required field '" + field + "'");
      return;
    }
    if (!Array.isArray(card[field])) {
      errors.push(cardLabel + ": field '" + field + "' must be an array");
    }
  });

  if (Array.isArray(card.best_grit_path) && card.best_grit_path.length === 0) {
    errors.push(cardLabel + ": field 'best_grit_path' must be a non-empty array");
  }

  if (Array.isArray(card.steps) && card.steps.length === 0) {
    errors.push(cardLabel + ": field 'steps' must be a non-empty array");
  }

  if (Array.isArray(card.mistakes_to_avoid) && card.mistakes_to_avoid.length === 0) {
    errors.push(cardLabel + ": field 'mistakes_to_avoid' must be a non-empty array");
  }

  if (Array.isArray(card.search_phrases) && card.search_phrases.length === 0) {
    errors.push(cardLabel + ": field 'search_phrases' must be a non-empty array");
  }

  if (idsSet[card.id]) {
    errors.push(cardLabel + ": id '" + card.id + "' is duplicated");
  } else {
    idsSet[card.id] = true;
  }

  if (slugsSet[card.slug]) {
    errors.push(cardLabel + ": slug '" + card.slug + "' is duplicated");
  } else {
    slugsSet[card.slug] = true;
  }

  if (String(card.id || "").trim() !== String(card.slug || "").trim()) {
    errors.push(cardLabel + ": id and slug must match");
  }

  if (Array.isArray(card.best_grit_path)) {
    card.best_grit_path.forEach(function (grit, gritIndex) {
      const value = normalizeGrit(grit);
      if (!value || !VALID_GRITS.has(value)) {
        errors.push(cardLabel + ": best_grit_path[" + gritIndex + "] is invalid (" + value + ")");
      }
    });
  }

  if (Array.isArray(card.optional_starting_grits)) {
    card.optional_starting_grits.forEach(function (grit, gritIndex) {
      const value = normalizeGrit(grit);
      if (!value || !VALID_GRITS.has(value)) {
        errors.push(cardLabel + ": optional_starting_grits[" + gritIndex + "] is invalid (" + value + ")");
      }
    });
  }

  if (Array.isArray(card.steps)) {
    card.steps.forEach(function (step, stepIndex) {
      const value = String(step == null ? "" : step).trim();
      if (!value) {
        errors.push(cardLabel + ": steps[" + stepIndex + "] must be non-empty");
      }
    });
  }

  if (Array.isArray(card.mistakes_to_avoid)) {
    card.mistakes_to_avoid.forEach(function (item, itemIndex) {
      const value = String(item == null ? "" : item).trim();
      if (!value) {
        errors.push(cardLabel + ": mistakes_to_avoid[" + itemIndex + "] must be non-empty");
      }
      if (hasPlaceholderText(value)) {
        errors.push(cardLabel + ": mistakes_to_avoid[" + itemIndex + "] contains placeholder text");
      }
    });
  }

  if (Array.isArray(card.search_phrases)) {
    const phrasesSeen = {};
    card.search_phrases.forEach(function (phrase, phraseIndex) {
      const value = String(phrase == null ? "" : phrase).trim();
      if (!value) {
        errors.push(cardLabel + ": search_phrases[" + phraseIndex + "] must be non-empty");
        return;
      }
      if (hasPlaceholderText(value)) {
        errors.push(cardLabel + ": search_phrases[" + phraseIndex + "] contains placeholder text");
      }
      const normalized = value.toLowerCase();
      if (phrasesSeen[normalized]) {
        errors.push(cardLabel + ": search_phrases contains duplicates (" + value + ")");
      }
      phrasesSeen[normalized] = true;
    });
  }

  if (Array.isArray(card.related_links)) {
    card.related_links.forEach(function (rawLink, linkIndex) {
      const link = String(rawLink == null ? "" : rawLink).trim();
      if (!link) {
        errors.push(cardLabel + ": related_links[" + linkIndex + "] must be non-empty");
        return;
      }
      if (link.indexOf("/solutions/") !== 0) {
        errors.push(cardLabel + ": related_links[" + linkIndex + "] must point to /solutions/...");
      }
    });
  }

  if (Array.isArray(card.related_solution_ids)) {
    card.related_solution_ids.forEach(function (id, relIndex) {
      const relId = String(id == null ? "" : id).trim();
      if (!relId) {
        errors.push(cardLabel + ": related_solution_ids[" + relIndex + "] must be non-empty");
        return;
      }
      if (!cardsById[relId]) {
        errors.push(cardLabel + ": related_solution_ids[" + relIndex + "] references missing id '" + relId + "'");
      }
    });
  }

  return errors;
}

function renderPage(card, template, cardsById) {
  const contextJson = escapeJsonForHtml(JSON.stringify(buildSolutionContextJson(card), null, 2));
  const values = {
    PAGE_TITLE: escapeHtml(card.title),
    META_DESCRIPTION: escapeHtml(card.problem),
    BREADCRUMB_TITLE: escapeHtml(card.title),
    PROBLEM_TITLE: escapeHtml(card.title),
    PROBLEM_DESCRIPTION: escapeHtml(card.problem),
    QUICK_ANSWER: escapeHtml(card.quick_answer),
    BEST_GRIT_PATH: renderBestGritPath(card),
    STEPS_HTML: renderSteps(card.steps),
    WHY_IT_HAPPENS: escapeHtml(card.likely_cause),
    WET_OR_DRY: escapeHtml(card.wet_or_dry),
    MISTAKES_HTML: renderMistakesToAvoid(card),
    SUCCESS_CHECK: escapeHtml(card.success_check),
    RELATED_SOLUTIONS_HTML: renderRelatedSolutions(card, cardsById),
    SOLUTION_ID: escapeHtml(card.id),
    SOLUTION_CONTEXT_JSON: contextJson,
  };

  return replaceAllPlaceholders(template, values);
}

function plannedOutputPath(card) {
  return path.join(SOLUTIONS_DIR, card.id, "index.html");
}

function ensureArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(name + " must be an array");
  }
  return value;
}

function findCardByPreviewId(cards, requestedId) {
  const rawId = String(requestedId || "").trim();
  if (!rawId) {
    return null;
  }
  return cards.find(function (card) {
    return card && card.id === rawId;
  }) || null;
}

function main() {
  const args = process.argv.slice(2);
  const hasCheck = args.indexOf("--check") !== -1;
  const hasWrite = args.indexOf("--write") !== -1;
  const previewFlagIndex = args.indexOf("--preview");
  const hasPreview = previewFlagIndex !== -1;
  const previewCardId = hasPreview ? String(args[previewFlagIndex + 1] || "").trim() : "";

  const modeCount = [hasCheck, hasWrite, hasPreview].filter(Boolean).length;
  if (modeCount > 1) {
    throw new Error("Use only one mode flag: --check, --write, or --preview <card-id>.");
  }
  if (hasPreview && !previewCardId) {
    throw new Error("Preview mode requires a card id: --preview <card-id>.");
  }

  const mode = hasPreview ? "preview" : (hasWrite ? "write" : "check");

  const cards = ensureArray(readJson(DATA_PATH), "data/solution-cards.json");
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const cardsById = {};
  cards.forEach(function (card) {
    if (card && card.id) {
      cardsById[card.id] = card;
    }
  });

  const validationErrors = [];
  const seenIds = {};
  const seenSlugs = {};

  cards.forEach(function (card, index) {
    validateCard(card, index, seenIds, seenSlugs, cardsById).forEach(function (err) {
      validationErrors.push(err);
    });
  });

  if (validationErrors.length) {
    validationErrors.forEach(function (err) {
      console.error(err);
    });
    process.exitCode = 1;
    return;
  }

  const rendered = cards.map(function (card) {
    return {
      card: card,
      html: renderPage(card, template, cardsById),
      outputPath: plannedOutputPath(card),
    };
  });

  if (mode === "preview") {
    const selectedCard = findCardByPreviewId(cards, previewCardId);
    if (!selectedCard) {
      console.error("Preview card id not found: " + previewCardId);
      process.exitCode = 1;
      return;
    }
    const previewPath = path.join(SOLUTIONS_DIR, "preview-generated-solution", "index.html");
    const previewHtml = renderPage(selectedCard, template, cardsById);
    fs.mkdirSync(path.dirname(previewPath), { recursive: true });
    fs.writeFileSync(previewPath, previewHtml);
    console.log("Preview solution page written: solutions/preview-generated-solution/index.html");
    console.log("Source card: " + previewCardId);
    console.log("Mode: preview");
    return;
  }

  if (mode === "write") {
    rendered.forEach(function (item) {
      fs.mkdirSync(path.dirname(item.outputPath), { recursive: true });
      fs.writeFileSync(item.outputPath, item.html);
    });
    console.log("Solution pages written: " + rendered.length);
    console.log("Mode: write");
    return;
  }

  console.log("Solution cards checked: " + cards.length);
  console.log("Planned solution pages: " + rendered.length);
  console.log("Mode: check");
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
}
