#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const TAGS_DIR = path.join(ROOT_DIR, "tags");

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
  if (!input) return "/sandpaper_support/";
  if (/^https?:\/\//i.test(input)) return input;
  const withLeadingSlash = input.charAt(0) === "/" ? input : "/" + input;
  if (withLeadingSlash.indexOf("/sandpaper_support/") === 0) return withLeadingSlash;
  return "/sandpaper_support" + withLeadingSlash;
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
  topics.push({
    label: cleanLabel,
    normalized: normalized
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
    '<link rel="icon" href="/sandpaper_support/icons/favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="/sandpaper_support/icons/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="/sandpaper_support/icons/favicon-32x32.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/sandpaper_support/icons/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="/sandpaper_support/icons/site.webmanifest">\n' +
    '<meta name="theme-color" content="#0B0C0E">\n' +
    '<link rel="stylesheet" href="/sandpaper_support/assets/styles.css?v=tags-p6b"></head>';
}

function siteHeader() {
  return '<body><header class="site-header"><div class="header-inner"><a class="logo" href="/sandpaper_support/">eQualle <span>Support</span></a><nav class="nav"><a href="/sandpaper_support/problems/">Problems</a><a href="/sandpaper_support/surfaces/">Surfaces</a><a href="/sandpaper_support/grits/">Grit Guide</a><a href="/sandpaper_support/products/">Products</a><a href="/sandpaper_support/tools/">Tools</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="footer-inner"><span>© eQualle Support System</span><span>Sandpaper troubleshooting, grit guidance, and product support.</span></div></footer></body></html>';
}

function renderTagIndexPage(tagEntries) {
  const cards = tagEntries.map(function (entry) {
    return '<a class="card" href="' + escapeHtml(sitePath('/tags/' + entry.slug + '/')) + '"><h3>' +
      escapeHtml(entry.label) +
      '</h3><p>Related solution answers for this topic chip.</p><div class="pill-list"><span class="pill">' +
      escapeHtml(String(entry.cards.length) + ' answers') +
      '</span></div><span class="cta">Open topic -></span></a>';
  }).join("");

  return siteHead("Tags", "Tag pages for related solution topics.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / Tags</div><h1>Solution Tags</h1><p class="section-intro">Browse topic chips used on solution pages and open related answers.</p><div class="grid">' +
    cards +
    '</div></section></main>' +
    siteFooter();
}

function renderTagPage(tagEntry) {
  const cards = tagEntry.cards.map(function (card) {
    return '<a class="card" href="' + escapeHtml(sitePath('/solutions/' + card.id + '/')) + '"><h3>' +
      escapeHtml(card.title) +
      '</h3><p>' +
      escapeHtml(card.problem) +
      '</p><div class="pill-list"><span class="pill">' +
      escapeHtml(card.recommended_grit || "See solution for grit guidance.") +
      '</span><span class="pill">' +
      escapeHtml(card.wet_or_dry || "See solution for wet or dry guidance.") +
      '</span></div><span class="cta">Open solution -></span></a>';
  }).join("");

  return siteHead(tagEntry.label, "Related solution answers for " + tagEntry.label + ".") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / <a href="/sandpaper_support/tags/">Tags</a> / ' +
    escapeHtml(tagEntry.label) +
    '</div><h1>' +
    escapeHtml(tagEntry.label) +
    '</h1><p class="section-intro">Related solution answers for this topic chip.</p><div class="pill-list"><span class="pill">' +
    escapeHtml(String(tagEntry.cards.length) + " related answers") +
    '</span></div><div class="grid">' +
    cards +
    '</div></section></main>' +
    siteFooter();
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
      const filePath = path.join(TAGS_DIR, entry.slug, "index.html");
      writeFile(filePath, renderTagPage(entry));
    });
  }

  console.log("Tag pages generated: " + String(tagEntries.length + 1));
  console.log("Generated: tags/index.html");
  tagEntries.forEach(function (entry) {
    console.log("Generated: tags/" + entry.slug + "/index.html" + " (" + entry.cards.length + " answers)");
  });
  console.log("Mode: " + (writeMode ? "write" : "check"));
}

main();
