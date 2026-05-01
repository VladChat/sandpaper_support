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
    return "/";
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  const withLeadingSlash = input.charAt(0) === "/" ? input : "/" + input;
  if (withLeadingSlash.indexOf("/") === 0) {
    return withLeadingSlash;
  }

  return "" + withLeadingSlash;
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

function collectSearchableText(card) {
  const parts = [];
  if (card.title) parts.push(card.title);
  if (card.problem) parts.push(card.problem);
  if (card.quick_answer) parts.push(card.quick_answer);
  if (Array.isArray(card.search_phrases)) parts.push(card.search_phrases.join(" "));
  if (Array.isArray(card.steps)) parts.push(card.steps.join(" "));
  if (card.likely_cause) parts.push(card.likely_cause);
  if (card.recommended_grit) parts.push(card.recommended_grit);
  return parts.join(" \n\n").toLowerCase();
}

function collectTopicText(card) {
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
    Array.isArray(card.steps) ? card.steps.join(" ") : "",
    Array.isArray(card.mistakes_to_avoid) ? card.mistakes_to_avoid.join(" ") : ""
  ].join(" ").toLowerCase();
}

function hasPhrase(text, phrase) {
  if (!text || !phrase) return false;
  return text.indexOf(String(phrase).toLowerCase()) !== -1;
}

function hasWholeWord(text, word) {
  if (!text || !word) return false;
  const re = new RegExp("\\b" + String(word).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\b", "i");
  return re.test(text);
}

function hasAnyWholeWord(text, words) {
  if (!text || !Array.isArray(words)) return false;
  return words.some(function (w) {
    return hasWholeWord(text, w);
  });
}

function hasAnyPhrase(text, phrases) {
  if (!text || !Array.isArray(phrases)) return false;
  return phrases.some(function (p) {
    return hasPhrase(text, p);
  });
}

function hasGrit(text, grit) {
  if (!text || !grit) return false;
  return hasWholeWord(text, String(grit));
}

function hasAnyGrit(text, grits) {
  if (!text || !Array.isArray(grits)) return false;
  return grits.some(function (g) {
    return hasGrit(text, g);
  });
}

function addTopic(topics, label, href) {
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel || cleanLabel.length > 24) {
    return;
  }

  const normalized = cleanLabel.toLowerCase();
  if (topics.some(function (topic) { return topic.normalized === normalized; })) {
    return;
  }

  topics.push({
    label: cleanLabel,
    href: href || "",
    normalized: normalized,
  });
}

function relativeHrefToFilePath(href) {
  if (!href) return null;
  // normalize to site path and map to local file path
  const rel = href.replace(/^\/+/, "");
  return path.join(ROOT_DIR, rel);
}

function hrefExists(href) {
  if (!href) return false;
  try {
    const filePath = relativeHrefToFilePath(href);
    return fs.existsSync(filePath) || fs.existsSync(path.join(filePath, "index.html"));
  } catch (e) {
    return false;
  }
}

function topicLabelToTagSlug(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferRelatedTopics(card) {
  const topics = [];
  const text = collectTopicText(card);

  // Surface tags
  if (hasAnyPhrase(text, ["wood", "grain", "veneer", "hardwood", "softwood"])) {
    addTopic(topics, "wood", "/surfaces/wood/");
  }
  if (hasAnyPhrase(text, ["plastic", "pvc", "acrylic", "bumper"])) {
    addTopic(topics, "plastic", "/surfaces/plastic/");
  }
  if (hasAnyPhrase(text, ["metal", "aluminum", "steel", "stainless", "rust"])) {
    addTopic(topics, "metal", "/surfaces/metal/");
  }
  if (hasAnyPhrase(text, ["drywall", "joint compound", "spackle", "patch"])) {
    addTopic(topics, "drywall patch", "/surfaces/drywall-patch/");
  }
  if (hasAnyPhrase(text, ["clear coat", "clearcoat"])) {
    addTopic(topics, "clear coat", "/surfaces/clear-coat/");
  }
  if (hasAnyPhrase(text, ["paint", "painted"])) {
    addTopic(topics, "paint", "/surfaces/paint-primer/");
  }
  if (hasPhrase(text, "primer")) {
    addTopic(topics, "primer", "/surfaces/paint-primer/");
  }

  // Method/problem tags
  if (hasAnyPhrase(text, ["wet", "water", "rinse", "slurry"])) {
    addTopic(topics, "wet sanding", "");
  }
  if (hasAnyPhrase(text, ["dry", "dust"])) {
    addTopic(topics, "dry sanding", "");
  }
  if (hasAnyPhrase(text, ["between coats", "coat", "coating", "recoat"])) {
    addTopic(topics, "between coats", "/problems/poor-results-between-coats/");
  }
  if (hasAnyPhrase(text, ["polish", "polishing", "gloss"])) {
    addTopic(topics, "polishing prep", "");
  }
  if (hasAnyPhrase(text, ["haze", "hazy", "cloudy", "dull"])) {
    addTopic(topics, "haze", "/solutions/normal-haze-after-wet-sanding/");
  }
  if (hasAnyPhrase(text, ["scratch", "scratches", "marks", "lines"])) {
    addTopic(topics, "scratches", "/solutions/deep-scratches-after-80-grit/");
  }
  if (hasAnyPhrase(text, ["clog", "clogs", "clogged", "loading", "loaded", "glaze", "residue"])) {
    addTopic(topics, "clogging", "/solutions/paint-clogs-sheet/");
  }
  if (hasAnyPhrase(text, ["pressure", "press", "hard", "aggressive", "gouge"])) {
    addTopic(topics, "pressure", "");
  }
  if (hasPhrase(card.title, "starting grit") || hasPhrase(card.task, "grit selection")) {
    addTopic(topics, "grit selection", "");
  }

  // Grit family tags
  if (hasAnyGrit(text, ["60", "80", "100", "120"])) {
    addTopic(topics, "coarse grit", "");
  }
  if (hasAnyGrit(text, ["150", "180", "220", "240"])) {
    addTopic(topics, "medium grit", "");
  }
  if (hasAnyGrit(text, ["280", "320", "360", "400"])) {
    addTopic(topics, "fine grit", "");
  }
  if (hasAnyGrit(text, ["500", "600", "800", "1000", "1200", "1500", "2000", "3000"])) {
    addTopic(topics, "ultra fine grit", "");
  }

  // Return max 4 topics with method/problem priority
  return topics.slice(0, 4);
}

function renderRelatedTopics(card) {
  const topics = inferRelatedTopics(card);
  if (!topics || !topics.length) {
    return "";
  }

  const rows = topics.map(function (topic) {
    const label = escapeHtml(topic.label);
    const slug = topicLabelToTagSlug(topic.label);
    const href = sitePath("/tags/" + slug + "/");
    return '      <a class="topic-pill topic-pill-link pill-link" href="' + escapeHtml(href) + '">' + label + '</a>';
  });

  return [
    '    <div class="related-topics" aria-label="Related topics">',
    rows.join("\n"),
    '    </div>'
  ].join("\n");
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
    '<section class="related-answers">',
    "  <h2>Related answers</h2>",
    "  <ul>",
    items.join("\n"),
    "  </ul>",
    "</section>",
  ].join("\n");
}

function renderAvoidText(card) {
  const avoid = String(card.avoid || "").trim();
  const mistakes = Array.isArray(card.mistakes_to_avoid)
    ? card.mistakes_to_avoid
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(Boolean)
    : [];

  if (avoid.length >= 24) {
    return avoid;
  }

  if (!mistakes.length) {
    return avoid || "";
  }

  return mistakes.slice(0, 3).join(" ");
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
    PROBLEM_SLUG: escapeHtml(card.problem_slug),
    ANSWER_TEXT: escapeHtml(card.quick_answer || card.answer || ""),
    LIKELY_CAUSE: escapeHtml(card.likely_cause),
    RECOMMENDED_GRIT: escapeHtml(card.recommended_grit),
    STEPS_HTML: renderSteps(card.steps),
    WET_OR_DRY: escapeHtml(card.wet_or_dry),
    AVOID: escapeHtml(renderAvoidText(card)),
    SUCCESS_CHECK: escapeHtml(card.success_check),
    RELATED_ANSWERS_HTML: "",
    RELATED_TOPICS_HTML: renderRelatedTopics(card),
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
