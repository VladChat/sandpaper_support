#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const SEARCH_INDEX_PATH = path.join(ROOT_DIR, "data", "search-index.json");
const TEMPLATE_PATH = path.join(ROOT_DIR, "templates", "solution-page.html");
const SOLUTIONS_DIR = path.join(ROOT_DIR, "solutions");

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

const PREVIEW_COMPAT_CARD_ALIASES = {
  "uneven-pressure-pattern": "uneven-finish-from-pressure",
};

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function humanizeSlug(slugOrPath) {
  const text = String(slugOrPath || "").trim();
  if (!text) {
    return "Related answer";
  }

  const withoutQuery = text.split("?")[0].split("#")[0];
  const trimmed = withoutQuery.replace(/^\/+|\/+$/g, "");
  const parts = trimmed.split("/").filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : trimmed;
  const cleaned = last
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Related answer";
  }

  return cleaned
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
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

function renderSteps(steps) {
  return steps
    .map(function (step) {
      return "        <li>" + escapeHtml(step) + "</li>";
    })
    .join("\n");
}

function isAnswerRelativeUrl(url) {
  const value = String(url || "").trim();
  return value.indexOf("/problems/") === 0 || value.indexOf("/solutions/") === 0;
}

function buildSearchIndexTitleMap(searchIndex) {
  const titleMap = {};
  (Array.isArray(searchIndex) ? searchIndex : []).forEach(function (entry) {
    const key = String((entry && entry.target_url) || "").trim();
    const title = String((entry && entry.title) || "").trim();
    if (!key || !title || titleMap[key]) {
      return;
    }
    titleMap[key] = title;
  });
  return titleMap;
}

function renderRelatedAnswers(card, searchIndex) {
  const links = Array.isArray(card.related_links) ? card.related_links : [];
  const titleMap = buildSearchIndexTitleMap(searchIndex);
  const unique = {};
  const items = [];

  links.forEach(function (rawUrl) {
    const url = String(rawUrl || "").trim();
    if (!isAnswerRelativeUrl(url) || unique[url]) {
      return;
    }
    unique[url] = true;

    const title = titleMap[url] || humanizeSlug(url);
    items.push(
      "    <li><a href=\"" +
        escapeHtml(sitePath(url)) +
        "\">" +
        escapeHtml(title) +
        "</a></li>",
    );
  });

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

function buildAnswerText(card) {
  const explicit = String(card.answer || card.short_answer || "").trim();
  if (explicit) {
    return explicit;
  }

  const recommended = String(card.recommended_grit || "").trim();
  const firstStep = Array.isArray(card.steps) && card.steps.length
    ? String(card.steps[0] || "").trim()
    : "";

  if (recommended && firstStep) {
    return "Use " + recommended + ". " + firstStep;
  }

  if (recommended) {
    return "Use " + recommended + ".";
  }

  if (firstStep) {
    return firstStep;
  }

  return String(card.title || "").trim();
}

function validateCard(card) {
  const errors = [];

  REQUIRED_CARD_FIELDS.forEach(function (field) {
    if (!(field in card)) {
      errors.push("missing required field '" + field + "'");
      return;
    }

    if (field === "steps") {
      if (!Array.isArray(card.steps) || card.steps.length === 0) {
        errors.push("field 'steps' must be a non-empty array");
      }
      return;
    }

    const value = String(card[field] == null ? "" : card[field]).trim();
    if (!value) {
      errors.push("field '" + field + "' must be non-empty");
    }
  });

  if (Array.isArray(card.steps)) {
    card.steps.forEach(function (step, index) {
      const value = String(step == null ? "" : step).trim();
      if (!value) {
        errors.push("field 'steps[" + index + "]' must be non-empty");
      }
    });
  }

  return errors;
}

function renderPage(card, template, searchIndex) {
  const pageTitle = String(card.title || "").trim();
  const problemText = String(card.problem || "").trim();
  const answerText = buildAnswerText(card);

  const values = {
    PAGE_TITLE: escapeHtml(pageTitle),
    META_DESCRIPTION: escapeHtml(problemText),
    BREADCRUMB_TITLE: escapeHtml(pageTitle),
    PROBLEM_TITLE: escapeHtml(pageTitle),
    PROBLEM_DESCRIPTION: escapeHtml(problemText),
    ANSWER_TEXT: escapeHtml(answerText),
    LIKELY_CAUSE: escapeHtml(card.likely_cause),
    RECOMMENDED_GRIT: escapeHtml(card.recommended_grit),
    WET_OR_DRY: escapeHtml(card.wet_or_dry),
    SUCCESS_CHECK: escapeHtml(card.success_check),
    AVOID: escapeHtml(card.avoid),
    SOLUTION_ID: escapeHtml(card.id),
    PROBLEM_SLUG: escapeHtml(card.problem_slug),
    STEPS_HTML: renderSteps(card.steps),
    RELATED_ANSWERS_HTML: renderRelatedAnswers(card, searchIndex),
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

  const resolvedId = PREVIEW_COMPAT_CARD_ALIASES[rawId] || rawId;
  return cards.find(function (card) {
    return card && card.id === resolvedId;
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
  const searchIndex = ensureArray(readJson(SEARCH_INDEX_PATH), "data/search-index.json");
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  const rendered = [];
  const validationErrors = [];

  cards.forEach(function (card, index) {
    const cardErrors = validateCard(card);
    if (cardErrors.length) {
      cardErrors.forEach(function (msg) {
        validationErrors.push("Card " + index + " (" + (card && card.id ? card.id : "unknown") + "): " + msg);
      });
      return;
    }

    rendered.push({
      card: card,
      html: renderPage(card, template, searchIndex),
      outputPath: plannedOutputPath(card),
    });
  });

  if (validationErrors.length) {
    validationErrors.forEach(function (err) {
      console.error(err);
    });
    process.exitCode = 1;
    return;
  }

  if (mode === "preview") {
    const selectedCard = findCardByPreviewId(cards, previewCardId);
    if (!selectedCard) {
      console.error("Preview card id not found: " + previewCardId);
      process.exitCode = 1;
      return;
    }

    const previewPath = path.join(SOLUTIONS_DIR, "preview-generated-solution", "index.html");
    const previewHtml = renderPage(selectedCard, template, searchIndex);
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
