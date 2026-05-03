#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "";

const REQUIRED_FILES = [
  "index.html",
  "problems/index.html",
  "surfaces/index.html",
  "grits/index.html",
  "tags/index.html",
  "products/index.html",
  "products/assorted-80-3000/index.html",
  "products/single-grit-sheets/index.html",
  "tools/index.html",
  "tools/grit-sequence-builder/index.html",
  "data/solution-cards.json",
  "data/problem-tree.json",
  "data/search-index.json",
  "data/surface-map.json",
  "data/grit-sequences.json"
];

const REQUIRED_SURFACE_PAGES = [
  "surfaces/wood/index.html",
  "surfaces/paint-primer/index.html",
  "surfaces/clear-coat/index.html",
  "surfaces/metal/index.html",
  "surfaces/plastic/index.html",
  "surfaces/drywall-patch/index.html",
  "surfaces/sheet-problems/index.html"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(relativePath) {
  const filePath = path.join(ROOT_DIR, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT_DIR, relativePath));
}

function normalizeSolutionId(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^sandpaper_support\/+/, "")
    .replace(/^solutions\/+/, "")
    .replace(/\/+$/, "");
}

function solutionPath(id) {
  return "solutions/" + normalizeSolutionId(id) + "/index.html";
}

function solutionExists(id) {
  const cleanId = normalizeSolutionId(id);
  return cleanId && exists(solutionPath(cleanId));
}

function isConcreteSolutionAnswerUrl(targetUrl) {
  const target = String(targetUrl || "").trim();
  return /^\/solutions\/[^/]+\/?$/.test(target) && target !== "/solutions/";
}

function pageUrlToLocalPath(rawUrl) {
  let url = String(rawUrl || "").split("#")[0].split("?")[0].trim();

  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return null;
  if (url.startsWith("mailto:")) return null;
  if (url.startsWith("tel:")) return null;
  if (url.startsWith("#")) return null;

  if (url.startsWith(BASE_PATH)) {
    url = url.slice(BASE_PATH.length);
  }

  if (url === "" || url === "/") {
    return "index.html";
  }

  if (!url.startsWith("/")) {
    return null;
  }

  url = url.replace(/^\/+/, "");

  const ignoredExt = [
    ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".webp", ".ico", ".webmanifest", ".pdf", ".txt", ".map", ".woff", ".woff2"
  ];

  const lower = url.toLowerCase();
  if (ignoredExt.some((ext) => lower.endsWith(ext))) {
    return null;
  }

  return url.endsWith("/") ? url + "index.html" : url + "/index.html";
}

function validateRequiredFiles(errors) {
  REQUIRED_FILES.concat(REQUIRED_SURFACE_PAGES).forEach((relativePath) => {
    if (!exists(relativePath)) {
      errors.push("Missing required file: " + relativePath);
    }
  });
}

function validateSolutionCards(errors) {
  const cards = readJson("data/solution-cards.json");

  if (!Array.isArray(cards)) {
    errors.push("data/solution-cards.json must be an array.");
    return { cards: [], cardsById: new Map() };
  }

  const cardsById = new Map();

  cards.forEach((card, index) => {
    const label = "solution-cards[" + index + "]";

    if (!card || typeof card !== "object") {
      errors.push(label + " must be an object.");
      return;
    }

    const id = String(card.id || "").trim();
    const slug = String(card.slug || "").trim();

    if (!id) errors.push(label + " missing id.");
    if (!slug) errors.push(label + " missing slug.");
    if (id && slug && id !== slug) errors.push(label + " id and slug must match: " + id + " vs " + slug);

    if (id) {
      if (cardsById.has(id)) {
        errors.push("Duplicate solution id: " + id);
      }
      cardsById.set(id, card);

      if (!solutionExists(id)) {
        errors.push("Missing generated solution page for card id: " + id + " expected " + solutionPath(id));
      }
    }

    [
      "problem_slug",
      "title",
      "problem",
      "surface",
      "task",
      "symptom",
      "quick_answer",
      "recommended_grit",
      "wet_or_dry"
    ].forEach((field) => {
      if (!String(card[field] || "").trim()) {
        errors.push(label + " missing required field: " + field);
      }
    });

    [
      "best_grit_path",
      "steps",
      "mistakes_to_avoid",
      "related_solution_ids",
      "search_phrases"
    ].forEach((field) => {
      if (!Array.isArray(card[field])) {
        errors.push(label + " field must be array: " + field);
      }
    });
  });

  cards.forEach((card) => {
    if (!card || !Array.isArray(card.related_solution_ids)) return;

    card.related_solution_ids.forEach((relatedId) => {
      const cleanId = normalizeSolutionId(relatedId);

      if (!cardsById.has(cleanId)) {
        errors.push("Card " + card.id + " references missing related_solution_id in source data: " + cleanId);
      }

      if (!solutionExists(cleanId)) {
        errors.push("Card " + card.id + " references related solution without generated page: " + cleanId);
      }
    });
  });

  return { cards, cardsById };
}

function validateSearchIndex(errors) {
  const index = readJson("data/search-index.json");

  if (!Array.isArray(index)) {
    errors.push("data/search-index.json must be an array.");
    return;
  }

  index.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      errors.push("search-index[" + idx + "] must be an object.");
      return;
    }

    if (!String(item.title || "").trim()) {
      errors.push("search-index[" + idx + "] missing title.");
    }

    const targetUrl = String(item.target_url || "").trim();
    if (!targetUrl) {
      errors.push("search-index[" + idx + "] missing target_url.");
      return;
    }

    const localPath = pageUrlToLocalPath(targetUrl);
    if (localPath && !exists(localPath)) {
      errors.push("search-index target_url points to missing page: " + targetUrl + " expected " + localPath);
    }

    const resultKind = String(item.result_kind || "").trim();
    if (resultKind === "answer") {
      if (!isConcreteSolutionAnswerUrl(targetUrl)) {
        errors.push("search-index[" + idx + "] invalid answer target_url: " + targetUrl);
        return;
      }
      const solutionId = normalizeSolutionId(targetUrl);
      if (!solutionExists(solutionId)) {
        errors.push("search-index[" + idx + "] answer target_url missing solution page: " + targetUrl);
      }
    }
  });
}

function validateSearchSuggestions(errors) {
  const suggestions = readJson("data/search-suggestions.json");

  if (!Array.isArray(suggestions)) {
    errors.push("data/search-suggestions.json must be an array.");
    return;
  }

  suggestions.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      errors.push("search-suggestions[" + idx + "] must be an object.");
      return;
    }

    const targetUrl = String(item.target_url || "").trim();
    if (!targetUrl) {
      errors.push("search-suggestions[" + idx + "] missing target_url.");
      return;
    }

    const resultKind = String(item.result_kind || "").trim();
    if (resultKind === "answer") {
      if (!isConcreteSolutionAnswerUrl(targetUrl)) {
        errors.push("search-suggestions[" + idx + "] invalid answer target_url: " + targetUrl);
        return;
      }
      const solutionId = normalizeSolutionId(targetUrl);
      if (!solutionExists(solutionId)) {
        errors.push("search-suggestions[" + idx + "] answer target_url missing solution page: " + targetUrl);
      }
    }
  });
}

function validateSurfaceMap(errors) {
  const surfaceMap = readJson("data/surface-map.json");

  if (!Array.isArray(surfaceMap)) {
    errors.push("data/surface-map.json must be an array.");
    return;
  }

  surfaceMap.forEach((surface, idx) => {
    const label = "surface-map[" + idx + "]";

    if (!surface || typeof surface !== "object") {
      errors.push(label + " must be an object.");
      return;
    }

    if (!String(surface.id || "").trim()) errors.push(label + " missing id.");
    if (!String(surface.title || "").trim()) errors.push(label + " missing title.");
    if (!String(surface.description || "").trim()) errors.push(label + " missing description.");

    if (!Array.isArray(surface.solution_card_ids)) {
      errors.push(label + " solution_card_ids must be an array.");
      return;
    }

    surface.solution_card_ids.forEach((id) => {
      if (!solutionExists(id)) {
        errors.push(label + " references missing solution page: " + id);
      }
    });
  });
}

function validateGritSequences(errors) {
  const sequences = readJson("data/grit-sequences.json");

  if (!Array.isArray(sequences)) {
    errors.push("data/grit-sequences.json must be an array.");
    return;
  }

  sequences.forEach((sequence, idx) => {
    const label = "grit-sequences[" + idx + "]";

    if (!sequence || typeof sequence !== "object") {
      errors.push(label + " must be an object.");
      return;
    }

    if (!String(sequence.surface || "").trim()) errors.push(label + " missing surface.");
    if (!String(sequence.goal || "").trim()) errors.push(label + " missing goal.");

    if (!Array.isArray(sequence.sequence) || !sequence.sequence.length) {
      errors.push(label + " sequence must be a non-empty array.");
    }

    if (sequence.related_surface_url) {
      const localPath = pageUrlToLocalPath((BASE_PATH || "") + sequence.related_surface_url);
      if (localPath && !exists(localPath)) {
        errors.push(label + " related_surface_url points to missing page: " + sequence.related_surface_url);
      }
    }

    if (sequence.related_product_url) {
      const localPath = pageUrlToLocalPath((BASE_PATH || "") + sequence.related_product_url);
      if (localPath && !exists(localPath)) {
        errors.push(label + " related_product_url points to missing page: " + sequence.related_product_url);
      }
    }

    if (Array.isArray(sequence.related_solution_ids)) {
      sequence.related_solution_ids.forEach((id) => {
        if (!solutionExists(id)) {
          errors.push(label + " references missing related solution page: " + id);
        }
      });
    }
  });
}

function validateProblemTree(errors, cardsById) {
  const raw = readJson("data/problem-tree.json");
  const groups = Array.isArray(raw)
    ? raw
    : (raw && Array.isArray(raw.groups) ? raw.groups : null);

  if (!Array.isArray(groups)) {
    errors.push("data/problem-tree.json must be an array or an object with groups array.");
    return;
  }

  groups.forEach((group, idx) => {
    const label = "problem-tree[" + idx + "]";
    const groupId = String(group && group.id ? group.id : "").trim();
    if (!groupId) {
      errors.push(label + " missing id.");
      return;
    }

    if (!Array.isArray(group.solution_card_ids) || !group.solution_card_ids.length) {
      errors.push(label + " (" + groupId + ") solution_card_ids must be a non-empty array.");
      return;
    }

    let validCount = 0;
    group.solution_card_ids.forEach((rawId) => {
      const id = normalizeSolutionId(rawId);
      if (!id) {
        errors.push(label + " (" + groupId + ") has empty solution_card_id.");
        return;
      }
      if (!cardsById.has(id)) {
        errors.push(label + " (" + groupId + ") missing referenced solution card id: " + id);
        return;
      }
      if (!solutionExists(id)) {
        errors.push(
          label + " (" + groupId + ") missing generated solution page for id " + id + ": " + solutionPath(id)
        );
        return;
      }
      validCount += 1;
    });

    if (validCount === 0) {
      errors.push(label + " (" + groupId + ") resolves to 0 real answers.");
    }
  });
}

function validateBuildScript(errors) {
  const pkg = readJson("package.json");
  const scripts = pkg.scripts || {};
  const build = String(scripts.build || "");

  const requiredParts = [
    "build:problem-pages",
    "build:solution-pages",
    "sync:solution-search",
    "build:product-pages",
    "build:surface-pages",
    "build:grit-guide",
    "build:tag-pages",
    "validate:source",
    "check:links"
  ];

  requiredParts.forEach((part) => {
    if (!build.includes(part)) {
      errors.push("package.json build script missing: " + part);
    }
  });

  if (build.includes("prune:stale-links")) {
    errors.push("package.json build script must not include prune:stale-links during normal build.");
  }

  if (!scripts["validate:source"]) {
    errors.push("package.json missing validate:source script.");
  }
}

function topicLabelToTagSlug(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function hasAnyPhrase(text, phrases) {
  if (!text || !Array.isArray(phrases)) return false;
  return phrases.some((p) => hasPhrase(text, p));
}

function hasAnyGrit(text, grits) {
  if (!text || !Array.isArray(grits)) return false;
  return grits.some((g) => hasWholeWord(text, String(g)));
}

function addTopic(topics, label) {
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel || cleanLabel.length > 24) return;
  const normalized = cleanLabel.toLowerCase();
  if (topics.some((topic) => topic.normalized === normalized)) return;
  topics.push({
    label: cleanLabel,
    normalized
  });
}

function inferRelatedTopics(card) {
  const topics = [];
  const text = collectTopicText(card);

  if (hasAnyPhrase(text, ["wood", "grain", "veneer", "hardwood", "softwood"])) addTopic(topics, "wood");
  if (hasAnyPhrase(text, ["plastic", "pvc", "acrylic", "bumper"])) addTopic(topics, "plastic");
  if (hasAnyPhrase(text, ["metal", "aluminum", "steel", "stainless", "rust"])) addTopic(topics, "metal");
  if (hasAnyPhrase(text, ["drywall", "joint compound", "spackle", "patch"])) addTopic(topics, "drywall patch");
  if (hasAnyPhrase(text, ["clear coat", "clearcoat"])) addTopic(topics, "clear coat");
  if (hasAnyPhrase(text, ["paint", "painted"])) addTopic(topics, "paint");
  if (hasPhrase(text, "primer")) addTopic(topics, "primer");

  if (hasAnyPhrase(text, ["wet", "water", "rinse", "slurry"])) addTopic(topics, "wet sanding");
  if (hasAnyPhrase(text, ["dry", "dust"])) addTopic(topics, "dry sanding");
  if (hasAnyPhrase(text, ["between coats", "coat", "coating", "recoat"])) addTopic(topics, "between coats");
  if (hasAnyPhrase(text, ["polish", "polishing", "gloss"])) addTopic(topics, "polishing prep");
  if (hasAnyPhrase(text, ["haze", "hazy", "cloudy", "dull"])) addTopic(topics, "haze");
  if (hasAnyPhrase(text, ["scratch", "scratches", "marks", "lines"])) addTopic(topics, "scratches");
  if (hasAnyPhrase(text, ["clog", "clogs", "clogged", "loading", "loaded", "glaze", "residue"])) addTopic(topics, "clogging");
  if (hasAnyPhrase(text, ["pressure", "press", "hard", "aggressive", "gouge"])) addTopic(topics, "pressure");
  if (hasPhrase(String(card.title || "").toLowerCase(), "starting grit") || hasPhrase(String(card.task || "").toLowerCase(), "grit selection")) {
    addTopic(topics, "grit selection");
  }

  if (hasAnyGrit(text, ["60", "80", "100", "120"])) addTopic(topics, "coarse grit");
  if (hasAnyGrit(text, ["150", "180", "220", "240"])) addTopic(topics, "medium grit");
  if (hasAnyGrit(text, ["280", "320", "360", "400"])) addTopic(topics, "fine grit");
  if (hasAnyGrit(text, ["500", "600", "800", "1000", "1200", "1500", "2000", "3000"])) addTopic(topics, "ultra fine grit");

  return topics.slice(0, 4);
}

function validateTagPages(errors, cards) {
  const expectedTagSlugs = new Set();
  const tagsDir = path.join(ROOT_DIR, "tags");
  const tagIndexPath = path.join(tagsDir, "index.html");

  if (!fs.existsSync(tagIndexPath)) {
    errors.push("Missing generated tag index page: tags/index.html");
  }

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (!card || !card.id) return;
    const topics = inferRelatedTopics(card);
    topics.forEach((topic) => {
      const slug = topicLabelToTagSlug(topic.label);
      if (!slug) return;
      expectedTagSlugs.add(slug);
      const tagPage = path.join(tagsDir, slug, "index.html");
      if (!fs.existsSync(tagPage)) {
        errors.push("Missing generated tag page for chip '" + topic.label + "': tags/" + slug + "/index.html");
      }
    });
  });

  expectedTagSlugs.forEach((slug) => {
    const filePath = path.join(tagsDir, slug, "index.html");
    if (!fs.existsSync(filePath)) return;
    const html = fs.readFileSync(filePath, "utf8");
    if (!/href="\/solutions\/[^"]+\/"/.test(html)) {
      errors.push("Tag page has no related answers: tags/" + slug + "/index.html");
    }
  });

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (!card || !card.id) return;
    const filePath = path.join(ROOT_DIR, "solutions", String(card.id), "index.html");
    if (!fs.existsSync(filePath)) return;
    const html = fs.readFileSync(filePath, "utf8");
    const links = html.match(/href="\/tags\/[^"]+\/"/g) || [];
    const expected = inferRelatedTopics(card).length;
    if (links.length !== expected) {
      errors.push("Solution chip link count mismatch for " + card.id + ": expected " + expected + ", found " + links.length);
    }
    links.forEach((hrefText) => {
      const href = hrefText.replace(/^href="/, "").replace(/"$/, "");
      const localPath = pageUrlToLocalPath(href);
      if (localPath && !exists(localPath)) {
        errors.push("Solution chip link points to missing tag page (" + card.id + "): " + href);
      }
    });
  });
}

function main() {
  const errors = [];

  validateRequiredFiles(errors);
  const solutionData = validateSolutionCards(errors);
  validateProblemTree(errors, solutionData.cardsById);
  validateTagPages(errors, solutionData.cards);
  validateSearchIndex(errors);
  validateSearchSuggestions(errors);
  validateSurfaceMap(errors);
  validateGritSequences(errors);
  validateBuildScript(errors);

  if (errors.length) {
    console.error("Source integrity validation failed.");
    console.error("Errors found: " + errors.length);
    errors.forEach((error) => console.error("- " + error));
    process.exitCode = 1;
    return;
  }

  console.log("Source integrity validation passed.");
}

main();
