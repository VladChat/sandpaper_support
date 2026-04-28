#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "/sandpaper_support";
const SOLUTION_CARDS_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "grits", "index.html");

const GRIT_RANGES = [
  {
    id: "coarse",
    title: "60-120 — Coarse / Removal",
    description: "Use this range for heavy material removal, rough sanding, paint removal, rust removal, shaping uneven spots, and starting surfaces that still have visible defects.",
    use: "Heavy removal, rough leveling, old paint or rust removal, and first-pass sanding.",
    avoid: "Avoid final finishing with this range because coarse grits leave visible scratch patterns.",
    next: "Move to 150-240 for surface preparation after the heavy defect is removed.",
    grits: ["60", "80", "100", "120"],
    surfaceLinks: [
      ["Wood", "/sandpaper_support/surfaces/wood/"],
      ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"],
      ["Metal", "/sandpaper_support/surfaces/metal/"],
      ["Drywall Patch", "/sandpaper_support/surfaces/drywall-patch/"]
    ],
    problemLinks: [
      ["Paint Removal", "/sandpaper_support/problems/paint-removal/"],
      ["Rust Removal", "/sandpaper_support/problems/rust-removal/"],
      ["Too Aggressive", "/sandpaper_support/problems/too-aggressive/"],
      ["Sanding Takes Too Long", "/sandpaper_support/problems/sanding-takes-too-long/"]
    ]
  },
  {
    id: "medium",
    title: "150-240 — Medium / Preparation",
    description: "Use this range for general surface preparation, smoothing after rough sanding, wood prep, primer prep, and removing earlier coarse scratch patterns.",
    use: "Surface preparation before paint, primer, stain, sealer, or the next refinement stage.",
    avoid: "Avoid jumping directly from coarse grits to fine grits when visible scratches remain.",
    next: "Move to 280-400 for fine prep when the surface is already even.",
    grits: ["150", "180", "220", "240"],
    surfaceLinks: [
      ["Wood", "/sandpaper_support/surfaces/wood/"],
      ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"],
      ["Metal", "/sandpaper_support/surfaces/metal/"],
      ["Drywall Patch", "/sandpaper_support/surfaces/drywall-patch/"],
      ["Plastic", "/sandpaper_support/surfaces/plastic/"]
    ],
    problemLinks: [
      ["Wood Finish Prep", "/sandpaper_support/problems/wood-finish-prep/"],
      ["Paint Prep", "/sandpaper_support/problems/paint-prep/"],
      ["Drywall Patch", "/sandpaper_support/problems/drywall-patch/"],
      ["Surface Still Feels Rough", "/sandpaper_support/problems/surface-still-feels-rough/"],
      ["Scratches Too Deep", "/sandpaper_support/problems/scratches-too-deep/"]
    ]
  },
  {
    id: "fine",
    title: "280-400 — Fine Prep",
    description: "Use this range for fine sanding, coating preparation, light scuffing, primer sanding, and refining surfaces that are already mostly smooth.",
    use: "Fine prep, light scuffing, primer sanding, and preparation before many coating stages.",
    avoid: "Avoid using this range for heavy removal because it cuts slowly when defects are still deep.",
    next: "Move to 500-800 for extra-fine finishing or to 1000+ for wet sanding stages when the surface is ready.",
    grits: ["280", "320", "360", "400"],
    surfaceLinks: [
      ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"],
      ["Plastic", "/sandpaper_support/surfaces/plastic/"],
      ["Metal", "/sandpaper_support/surfaces/metal/"],
      ["Wood", "/sandpaper_support/surfaces/wood/"]
    ],
    problemLinks: [
      ["Paint Prep", "/sandpaper_support/problems/paint-prep/"],
      ["Poor Results Between Coats", "/sandpaper_support/problems/poor-results-between-coats/"],
      ["Finish Looks Uneven", "/sandpaper_support/problems/finish-looks-uneven/"],
      ["Plastic Sanding", "/sandpaper_support/problems/plastic-sanding/"],
      ["Cabinet Paint Prep", "/sandpaper_support/problems/cabinet-paint-prep/"]
    ]
  },
  {
    id: "extra-fine",
    title: "500-800 — Extra Fine",
    description: "Use this range for extra-fine finishing, light wet sanding, coating refinement, and reducing fine surface marks before ultra-fine sanding.",
    use: "Extra-fine finish prep, light wet sanding, and bridging between fine prep and ultra-fine refinement.",
    avoid: "Avoid expecting this range to remove deep scratches, rough paint edges, or heavy oxidation.",
    next: "Move to 1000-3000 for wet sanding and polishing preparation when the surface is level.",
    grits: ["500", "600", "800"],
    surfaceLinks: [
      ["Clear Coat", "/sandpaper_support/surfaces/clear-coat/"],
      ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"],
      ["Plastic", "/sandpaper_support/surfaces/plastic/"],
      ["Metal", "/sandpaper_support/surfaces/metal/"]
    ],
    problemLinks: [
      ["Wet Sanding Clear Coat", "/sandpaper_support/problems/wet-sanding-clear-coat/"],
      ["Polishing Prep", "/sandpaper_support/problems/polishing-prep/"],
      ["Paint Repair", "/sandpaper_support/problems/paint-repair/"],
      ["Surface Fit", "/sandpaper_support/problems/surface-fit/"]
    ]
  },
  {
    id: "ultra-fine",
    title: "1000-3000 — Ultra Fine / Wet Sanding",
    description: "Use this range for very fine wet sanding, haze reduction, clear coat refinement, plastic polishing preparation, headlight restoration, and final sanding before polishing.",
    use: "Wet sanding, polishing preparation, haze refinement, clear coat work, plastic restoration, epoxy/gelcoat finishing, and ultra-fine surface refinement.",
    avoid: "Avoid using ultra-fine grits to remove heavy defects. These grits refine; they do not replace earlier cutting steps.",
    next: "After 3000, use the correct polishing or finishing step when gloss or clarity is required.",
    grits: ["1000", "1200", "1500", "2000", "3000"],
    surfaceLinks: [
      ["Clear Coat", "/sandpaper_support/surfaces/clear-coat/"],
      ["Plastic", "/sandpaper_support/surfaces/plastic/"],
      ["Metal", "/sandpaper_support/surfaces/metal/"],
      ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"]
    ],
    problemLinks: [
      ["Wet Sanding Leaves Haze", "/sandpaper_support/problems/wet-sanding-leaves-haze/"],
      ["Wet Sanding Haze", "/sandpaper_support/problems/wet-sanding-haze/"],
      ["Wet Sanding Clear Coat", "/sandpaper_support/problems/wet-sanding-clear-coat/"],
      ["Polishing Prep", "/sandpaper_support/problems/polishing-prep/"],
      ["Headlight Restoration", "/sandpaper_support/problems/headlight-restoration/"],
      ["Epoxy Resin", "/sandpaper_support/problems/epoxy-resin/"],
      ["Gelcoat", "/sandpaper_support/problems/gelcoat/"]
    ]
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function htmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageExists(url) {
  let clean = String(url || "").split("#")[0].split("?")[0].trim();

  if (!clean) return false;
  if (!clean.startsWith(BASE_PATH + "/")) return true;

  clean = clean.slice(BASE_PATH.length);

  if (clean === "" || clean === "/") {
    return fs.existsSync(path.join(ROOT_DIR, "index.html"));
  }

  clean = clean.replace(/^\/+/, "");

  const expected = clean.endsWith("/")
    ? clean + "index.html"
    : clean + "/index.html";

  return fs.existsSync(path.join(ROOT_DIR, expected));
}

function solutionExists(id) {
  if (!id) return false;
  return fs.existsSync(path.join(ROOT_DIR, "solutions", id, "index.html"));
}

function loadEligibleCards() {
  const cards = readJson(SOLUTION_CARDS_PATH);
  return cards.filter(function(card) {
    return card && card.id && solutionExists(card.id);
  });
}

function collectCardText(card) {
  return normalizeText([
    card.id,
    card.title,
    card.problem,
    card.surface,
    card.task,
    card.symptom,
    card.quick_answer,
    card.likely_cause,
    card.recommended_grit,
    card.wet_or_dry,
    Array.isArray(card.best_grit_path) ? card.best_grit_path.join(" ") : "",
    Array.isArray(card.optional_starting_grits) ? card.optional_starting_grits.join(" ") : "",
    Array.isArray(card.search_phrases) ? card.search_phrases.join(" ") : ""
  ].join(" "));
}

function mentionsGrit(text, grit) {
  const escaped = String(grit).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("(^|[^0-9])" + escaped + "([^0-9]|$)", "i");
  return pattern.test(text);
}

function cardMatchesRange(card, range) {
  const text = collectCardText(card);
  return range.grits.some(function(grit) {
    return mentionsGrit(text, grit);
  });
}

function getRangeCards(range, cards) {
  const matched = [];
  const seen = new Set();

  for (const card of cards) {
    if (!cardMatchesRange(card, range)) continue;
    if (seen.has(card.id)) continue;

    seen.add(card.id);
    matched.push(card);
  }

  matched.sort(function(a, b) {
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  return matched.slice(0, 12);
}

function renderSafeChip(label, url) {
  if (url && pageExists(url)) {
    return '<a class="pill" href="' + htmlEscape(url) + '">' + htmlEscape(label) + "</a>";
  }

  return '<span class="pill">' + htmlEscape(label) + "</span>";
}

function renderChipList(items) {
  const chips = [];

  for (const item of items) {
    const label = item[0];
    const url = item[1];

    if (url && !pageExists(url)) continue;
    chips.push(renderSafeChip(label, url));
  }

  if (!chips.length) return "";

  return '<div class="pill-list">' + chips.join("") + "</div>";
}

function siteHead(title, description) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    htmlEscape(title) +
    ' | eQualle Support</title><meta name="description" content="' +
    htmlEscape(description) +
    '">\n' +
    '<link rel="icon" href="/sandpaper_support/icons/favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="/sandpaper_support/icons/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="/sandpaper_support/icons/favicon-32x32.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/sandpaper_support/icons/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="/sandpaper_support/icons/site.webmanifest">\n' +
    '<meta name="theme-color" content="#0B0C0E">\n' +
    '<link rel="stylesheet" href="/sandpaper_support/assets/styles.css?v=grit-guide-navigation-p3"></head>';
}

function siteHeader() {
  return '<body><header class="site-header"><div class="header-inner"><a class="logo" href="/sandpaper_support/">eQualle <span>Support</span></a><nav class="nav"><a href="/sandpaper_support/problems/">Problems</a><a href="/sandpaper_support/surfaces/">Surfaces</a><a href="/sandpaper_support/grits/">Grit Guide</a><a href="/sandpaper_support/products/">Products</a><a href="/sandpaper_support/tools/">Tools</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="footer-inner"><span>© eQualle Support System</span><span>Sandpaper troubleshooting, grit guidance, and product support.</span></div></footer></body></html>';
}

function renderProductCard() {
  return '<a class="card" href="/sandpaper_support/products/assorted-80-3000/"><h3>Using the 60-3000 Assorted Kit</h3><p>Use the full grit range when a project needs removal, preparation, fine finishing, and wet sanding refinement.</p><span class="cta">Open kit guide -&gt;</span></a>';
}

function renderSolutionCard(card) {
  return '<a class="card" href="/sandpaper_support/solutions/' +
    htmlEscape(card.id) +
    '/"><h3>' +
    htmlEscape(card.title) +
    '</h3><p>' +
    htmlEscape(card.problem) +
    '</p><div class="pill-list"><span class="pill">' +
    htmlEscape(card.recommended_grit || "See solution for grit guidance.") +
    '</span><span class="pill">' +
    htmlEscape(card.wet_or_dry || "See solution for wet or dry guidance.") +
    '</span></div><span class="cta">Open solution -&gt;</span></a>';
}

function renderRangeSection(range, cards) {
  const gritChips = range.grits.map(function(grit) {
    return ["Grit " + grit, ""];
  });

  const solutionCards = cards.map(renderSolutionCard).join("");

  return '<section class="section band" id="' +
    htmlEscape(range.id) +
    '"><h2>' +
    htmlEscape(range.title) +
    '</h2><p class="section-intro">' +
    htmlEscape(range.description) +
    '</p><div class="grid"><article class="card"><h3>Best For</h3><p>' +
    htmlEscape(range.use) +
    '</p>' +
    renderChipList(gritChips) +
    '</article><article class="card"><h3>Avoid</h3><p>' +
    htmlEscape(range.avoid) +
    '</p></article><article class="card"><h3>Next Step</h3><p>' +
    htmlEscape(range.next) +
    '</p></article></div><h3>Useful paths</h3>' +
    renderChipList(range.surfaceLinks) +
    renderChipList(range.problemLinks) +
    '<h3>Related answers</h3><div class="grid">' +
    renderProductCard() +
    solutionCards +
    '</div></section>';
}

function renderIndexNav() {
  const chips = GRIT_RANGES.map(function(range) {
    return ["Jump to " + range.title.split(" — ")[0], "#"+range.id];
  });

  const rendered = chips.map(function(item) {
    return '<a class="pill" href="' + htmlEscape(item[1]) + '">' + htmlEscape(item[0]) + '</a>';
  });

  return '<div class="pill-list">' + rendered.join("") + '</div>';
}

function renderPage(rangeCards) {
  const intro = "Use this guide when you already know the grit number or need to choose the next grit. Each range now links to related surfaces, problem groups, product support, and matching answer pages.";

  const sections = GRIT_RANGES.map(function(range) {
    return renderRangeSection(range, rangeCards[range.id] || []);
  }).join("");

  return siteHead("Sandpaper Grit Guide", "Grit ranges, sanding use cases, and direct support paths for eQualle wet or dry silicon carbide sandpaper.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / By Grit</div><h1>Sandpaper Grit Guide</h1><p class="section-intro">' +
    htmlEscape(intro) +
    '</p>' +
    renderIndexNav() +
    '</section>' +
    sections +
    '</main>' +
    siteFooter();
}

function main() {
  const writeMode = process.argv.includes("--write") || !process.argv.includes("--check");
  const cards = loadEligibleCards();
  const rangeCards = {};

  for (const range of GRIT_RANGES) {
    rangeCards[range.id] = getRangeCards(range, cards);
  }

  const html = renderPage(rangeCards);

  if (writeMode) {
    writeFile(OUTPUT_PATH, html);
  }

  console.log("Grit guide generated: grits/index.html");
  for (const range of GRIT_RANGES) {
    console.log(range.id + " related answers: " + String((rangeCards[range.id] || []).length));
  }
  console.log("Mode: " + (writeMode ? "write" : "check"));
}

main();