#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const TAGS_DIR = path.join(ROOT_DIR, "tags");

const TAG_CATEGORIES = [
  {
    title: "Surface",
    tags: ["wood", "metal", "plastic", "drywall patch", "clear coat", "paint", "primer"]
  },
  {
    title: "Method",
    tags: ["dry sanding", "wet sanding", "between coats", "polishing prep"]
  },
  {
    title: "Problem",
    tags: ["scratches", "clogging", "haze", "pressure"]
  },
  {
    title: "Grit",
    tags: ["coarse grit", "medium grit", "fine grit", "ultra fine grit", "grit selection"]
  }
];

const TAG_DESCRIPTIONS = {
  "wood": "Wood answers covering prep, scratch control, grain behavior, and finish-ready sanding steps.",
  "metal": "Metal answers for rust, oxidation, blending scratches, and prep before paint or coating.",
  "plastic": "Plastic answers for haze, smearing, heat marks, and controlled refinement.",
  "drywall patch": "Drywall patch answers for seams, ridges, visible edges, and compound sanding issues.",
  "clear coat": "Clear coat answers for wet sanding marks, haze, and polishing preparation.",
  "paint": "Paint answers for prep, feathering, touch-up blending, and surface correction.",
  "primer": "Primer answers for leveling, between-coat sanding, and defect correction.",
  "dry sanding": "Dry sanding answers when you need controlled cutting without water.",
  "wet sanding": "Wet sanding answers for refinement, haze control, and ultra-fine finishing.",
  "between coats": "Between-coat answers for smooth recoat prep and finish consistency.",
  "polishing prep": "Polishing-prep answers for final sanding stages before compound or polish.",
  "scratches": "Scratch-related answers for removing visible sanding marks safely.",
  "clogging": "Clogging answers for loaded sheets, reduced cut rate, and abrasive life issues.",
  "haze": "Haze answers for cloudy appearance after fine or wet sanding stages.",
  "pressure": "Pressure-related answers for cut consistency and avoiding deep or uneven marks.",
  "coarse grit": "Coarse-grit answers for heavy removal and first-pass defect reduction.",
  "medium grit": "Medium-grit answers for prep and smoothing after coarse stages.",
  "fine grit": "Fine-grit answers for coating prep and refined surface correction.",
  "ultra fine grit": "Ultra-fine answers for wet sanding refinement and polishing preparation.",
  "grit selection": "Grit-selection answers for choosing the next sanding step with confidence."
};

const TAG_HELPER_TEXT = {
  "wood": "Use this when sanding wood surfaces, grain transitions, and finish prep work.",
  "metal": "Use this when sanding rusted, painted, or bare metal parts.",
  "plastic": "Use this for plastic parts where heat, haze, or smearing is a concern.",
  "drywall patch": "Use this for drywall repair and joint compound blending problems.",
  "clear coat": "Use this for automotive-style clear coat correction and prep.",
  "paint": "Use this when paint defects, prep quality, or repaint readiness is the issue.",
  "primer": "Use this for primer leveling and between-coat prep questions.",
  "dry sanding": "Use this when you are sanding without water and need clean dust control decisions.",
  "wet sanding": "Use this when water-assisted sanding stages are involved.",
  "between coats": "Use this when sanding between coating layers.",
  "polishing prep": "Use this when preparing a surface for polish after sanding.",
  "scratches": "Use this when visible scratch marks are the main symptom.",
  "clogging": "Use this when paper loads up and stops cutting effectively.",
  "haze": "Use this when the finish looks cloudy or dull after sanding.",
  "pressure": "Use this when uneven pressure may be causing marks or inconsistent cut.",
  "coarse grit": "Use this when aggressive cutting or heavy removal is required.",
  "medium grit": "Use this for transition and prep stages after coarse cuts.",
  "fine grit": "Use this for fine prep before coating and finish steps.",
  "ultra fine grit": "Use this for final refinement and wet sanding stages.",
  "grit selection": "Use this when deciding where to start and what grit comes next."
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sitePath(relativeUrl) {
  const input = String(relativeUrl || "").trim();
  if (!input) return "/";
  if (/^https?:\/\//i.test(input)) return input;
  const withLeadingSlash = input.charAt(0) === "/" ? input : "/" + input;
  if (withLeadingSlash.indexOf("/") === 0) return withLeadingSlash;
  return "" + withLeadingSlash;
}

function normalizeText(value) {
  return String(value == null ? "" : value).toLowerCase();
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
  return phrases.some(function (p) {
    return hasPhrase(text, p);
  });
}

function hasAnyGrit(text, grits) {
  if (!text || !Array.isArray(grits)) return false;
  return grits.some(function (grit) {
    return hasWholeWord(text, String(grit));
  });
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

function addTopic(topics, label) {
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel || cleanLabel.length > 24) return;
  const normalized = cleanLabel.toLowerCase();
  if (topics.some(function (topic) { return topic.normalized === normalized; })) return;
  topics.push({ label: cleanLabel, normalized: normalized });
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

  if (hasPhrase(normalizeText(card.title), "starting grit") || hasPhrase(normalizeText(card.task), "grit selection")) {
    addTopic(topics, "grit selection");
  }

  if (hasAnyGrit(text, ["60", "80", "100", "120"])) addTopic(topics, "coarse grit");
  if (hasAnyGrit(text, ["150", "180", "220", "240"])) addTopic(topics, "medium grit");
  if (hasAnyGrit(text, ["280", "320", "360", "400"])) addTopic(topics, "fine grit");
  if (hasAnyGrit(text, ["500", "600", "800", "1000", "1200", "1500", "2000", "3000"])) addTopic(topics, "ultra fine grit");

  return topics.slice(0, 4);
}

function topicLabelToTagSlug(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function siteHead(title, description) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    escapeHtml(title) +
    ' | eQualle Support</title><meta name="description" content="' +
    escapeHtml(description) +
    '">\n' +
    '<link rel="icon" href="/icons/favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="/icons/site.webmanifest">\n' +
    '<meta name="theme-color" content="#0B0C0E">\n' +
    '<link rel="stylesheet" href="/assets/styles.css?v=footer-layout-20260503"></head>';
}

function siteHeader() {
  return '<body><header class="site-header"><div class="header-inner"><a class="logo" href="/">eQualle <span>Support</span></a><nav class="nav"><a href="/problems/">Problems</a><a href="/surfaces/">Surfaces</a><a href="/grits/">Grit Guide</a><a href="/products/">Products</a><a href="/tools/grit-sequence-builder/">Tools</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="footer-inner"><div class="footer-left"><span>&copy; <span data-current-year></span> eQualle Support</span></div><div class="footer-right"><span class="footer-context">Sandpaper troubleshooting, grit guidance, and product support.</span><nav class="footer-legal-links" aria-label="Legal links"><a href="/privacy/">Privacy Policy</a><a href="/terms/">Terms of Use</a><a href="/disclaimer/">Disclaimer</a><a href="/contact/">Contact</a></nav></div></div></footer><script src="/assets/footer-year.js?v=footer-layout-20260503"></script></body></html>';
}

function buildTagMap(cards) {
  const map = new Map();

  cards.forEach(function (card) {
    if (!card || !card.id) return;
    const solutionPath = path.join(ROOT_DIR, "solutions", card.id, "index.html");
    if (!fs.existsSync(solutionPath)) return;

    const topics = inferRelatedTopics(card);
    topics.forEach(function (topic) {
      const slug = topicLabelToTagSlug(topic.label);
      if (!slug) return;
      if (!map.has(slug)) {
        map.set(slug, {
          slug: slug,
          label: topic.label,
          cards: []
        });
      }
      const entry = map.get(slug);
      if (!entry.cards.some(function (existing) { return existing.id === card.id; })) {
        entry.cards.push(card);
      }
    });
  });

  return map;
}

function renderTagIndexCategory(category, entriesByLabel) {
  const cards = category.tags
    .map(function (label) {
      const entry = entriesByLabel.get(label);
      if (!entry) return "";
      return '<article class="card"><h3>' +
        escapeHtml(entry.label) +
        '</h3><p>' +
        escapeHtml(TAG_DESCRIPTIONS[label] || "Related sanding answers for this topic.") +
        '</p><div class="pill-list"><span class="pill">' +
        escapeHtml(String(entry.cards.length) + " answers") +
        '</span></div><a class="cta" href="' +
        escapeHtml(sitePath("/tags/" + entry.slug + "/")) +
        '">View related answers</a></article>';
    })
    .filter(Boolean)
    .join("");

  if (!cards) return "";

  return '<section class="section band"><h2>' + escapeHtml(category.title) + '</h2><div class="grid">' + cards + "</div></section>";
}

function renderTagIndexPage(tagEntries) {
  const entriesByLabel = new Map();
  tagEntries.forEach(function (entry) {
    entriesByLabel.set(entry.label.toLowerCase(), entry);
  });

  const sections = TAG_CATEGORIES
    .map(function (category) {
      return renderTagIndexCategory(category, entriesByLabel);
    })
    .filter(Boolean)
    .join("");

  return siteHead("Topic Tags", "Browse related sanding answer tags used across solution pages.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/">Home</a> / Tags</div><h1>Topic Tags</h1><p class="section-intro">These tags connect related sanding answers. They are mainly used inside answer pages.</p></section>' +
    sections +
    "</main>" +
    siteFooter();
}

function renderTagPage(tagEntry) {
  const sortedCards = tagEntry.cards
    .slice()
    .sort(function (a, b) {
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

  const cap = 36;
  const visibleCards = sortedCards.slice(0, cap);
  const cardsHtml = visibleCards.map(function (card) {
    return '<a class="card" href="' + escapeHtml(sitePath('/solutions/' + card.id + '/')) + '"><h3>' +
      escapeHtml(card.title) +
      '</h3><p>' +
      escapeHtml(card.problem) +
      '</p><div class="pill-list"><span class="pill">' +
      escapeHtml(card.recommended_grit || "See solution for grit guidance.") +
      '</span><span class="pill">' +
      escapeHtml(card.wet_or_dry || "See solution for wet or dry guidance.") +
      '</span></div><span class="cta">View solution</span></a>';
  }).join("");

  const helper = TAG_HELPER_TEXT[tagEntry.label.toLowerCase()] || "Use this tag to narrow to related solution answers.";
  const cappedNote = sortedCards.length > cap
    ? '<p class="section-intro">Showing the most relevant related answers. Use search or problem guides for narrower help.</p>'
    : "";

  return siteHead('Answers tagged "' + tagEntry.label + '"', 'Related solution answers for ' + tagEntry.label + '.') +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/">Home</a> / <a href="/tags/">Tags</a> / ' +
    escapeHtml(tagEntry.label) +
    '</div><h1>Answers tagged "' +
    escapeHtml(tagEntry.label) +
    '"</h1><p class="section-intro">' +
    escapeHtml(String(sortedCards.length) + ' related answers') +
    '</p><p class="section-intro">' +
    escapeHtml(helper) +
    '</p>' +
    cappedNote +
    '<div class="grid">' +
    cardsHtml +
    '</div></section></main>' +
    siteFooter();
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main() {
  const writeMode = process.argv.includes("--write") || !process.argv.includes("--check");
  const cards = readJson(DATA_PATH);
  const tagMap = buildTagMap(Array.isArray(cards) ? cards : []);

  const tagEntries = Array.from(tagMap.values())
    .filter(function (entry) { return Array.isArray(entry.cards) && entry.cards.length > 0; })
    .sort(function (a, b) { return a.label.localeCompare(b.label); });

  if (writeMode) {
    writeFile(path.join(TAGS_DIR, "index.html"), renderTagIndexPage(tagEntries));
    tagEntries.forEach(function (entry) {
      writeFile(path.join(TAGS_DIR, entry.slug, "index.html"), renderTagPage(entry));
    });
  }

  console.log("Tag pages generated: " + String(tagEntries.length + 1));
  console.log("Generated: tags/index.html");
  tagEntries.forEach(function (entry) {
    console.log("Generated: tags/" + entry.slug + "/index.html (" + entry.cards.length + " answers)");
  });
  console.log("Mode: " + (writeMode ? "write" : "check"));
}

main();
