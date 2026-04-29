#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "/sandpaper_support";
const SOLUTION_CARDS_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const SURFACE_MAP_PATH = path.join(ROOT_DIR, "data", "surface-map.json");
const SURFACES_DIR = path.join(ROOT_DIR, "surfaces");

const SURFACE_GROUPS = [
  {
    id: "wood",
    title: "Wood",
    pageTitle: "Wood Sanding Problems",
    description:
      "Wood sanding issues including scratches, raised grain, stain prep, veneer, softwood, hardwood, furniture, cabinets, and edges.",
    keywords: [
      "wood",
      "hardwood",
      "softwood",
      "veneer",
      "furniture",
      "cabinet",
      "oak",
      "pine",
      "stain",
    ],
  },
  {
    id: "paint-primer",
    title: "Paint / Primer",
    pageTitle: "Paint / Primer Sanding Problems",
    description:
      "Paint and primer sanding issues including clogging, feather edges, scratches, chips, dull spots, repaint prep, and between-coat sanding.",
    keywords: [
      "paint",
      "primer",
      "painted",
      "coating",
      "finish",
      "recoat",
      "between coats",
      "spray paint",
    ],
  },
  {
    id: "clear-coat",
    title: "Clear Coat",
    pageTitle: "Clear Coat Sanding Problems",
    description:
      "Clear coat wet sanding issues including haze, orange peel, 1500 marks, 2000 marks, edge burn-through, and polishing preparation.",
    keywords: [
      "clear coat",
      "clearcoat",
      "automotive clear coat",
      "orange peel",
      "car paint",
      "wet sanding clear coat",
    ],
  },
  {
    id: "metal",
    title: "Metal",
    pageTitle: "Metal Sanding Problems",
    description:
      "Metal sanding issues including rust, oxidation, aluminum, stainless steel, scratch blending, burrs, and paint prep.",
    keywords: [
      "metal",
      "aluminum",
      "steel",
      "stainless",
      "rust",
      "wrought iron",
      "tool steel",
      "sink",
      "grill",
      "knife",
      "mower blade",
    ],
  },
  {
    id: "plastic",
    title: "Plastic",
    pageTitle: "Plastic Sanding Problems",
    description:
      "Plastic sanding issues including white haze, smearing, fuzzy edges, visible scratches, heat, 3D prints, headlights, and clogged paper.",
    keywords: [
      "plastic",
      "acrylic",
      "abs",
      "vinyl",
      "polycarbonate",
      "headlight",
      "3d print",
      "pla",
      "resin print",
    ],
  },
  {
    id: "drywall-patch",
    title: "Drywall Patch",
    pageTitle: "Drywall Patch Sanding Problems",
    description:
      "Drywall patch sanding issues including ridges, torn paper, clogged joint compound, visible edges, dust, ceiling patches, and low spots.",
    keywords: ["drywall", "joint compound", "spackle", "wall patch", "ceiling patch"],
  },
  {
    id: "sheet-problems",
    title: "General Sheet Problems",
    pageTitle: "General Sheet Problems",
    description:
      "Sheet and abrasive handling issues including clogging, grit shedding, curling, fraying, tearing, residue, soaking, storage, and worn sheets.",
    keywords: [
      "sandpaper sheet",
      "sheet",
      "paper tears",
      "curls",
      "frays",
      "grit comes off",
      "residue",
      "storage",
      "wet or dry",
      "silicon carbide",
      "assortment",
      "pack",
      "cutting slows",
      "stops cutting",
      "clogs",
    ],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function solutionExists(id) {
  if (!id) return false;
  const filePath = path.join(ROOT_DIR, "solutions", id, "index.html");
  return fs.existsSync(filePath);
}

function loadEligibleCards() {
  const cards = readJson(SOLUTION_CARDS_PATH);

  return cards.filter((card) => card && card.id && solutionExists(card.id));
}

function matchesGroup(card, group) {
  const haystack = normalizeText(
    [card.surface, card.task, card.title, card.problem].join(" ")
  );

  return group.keywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function getGroupCards(group, cards) {
  const seen = new Set();
  const matched = [];

  for (const card of cards) {
    if (!matchesGroup(card, group)) continue;
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    matched.push(card);
  }

  matched.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  return matched.slice(0, 36);
}

function siteHead(title, description) {
  return (
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" +
    htmlEscape(title) +
    " | eQualle Support</title><meta name=\"description\" content=\"" +
    htmlEscape(description) +
    "\">\n" +
    '<link rel="icon" href="/sandpaper_support/icons/favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="/sandpaper_support/icons/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="/sandpaper_support/icons/favicon-32x32.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/sandpaper_support/icons/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="/sandpaper_support/icons/site.webmanifest">\n' +
    '<meta name="theme-color" content="#0B0C0E">\n' +
    '<link rel="stylesheet" href="/sandpaper_support/assets/styles.css?v=hero-width-fix-20260426"></head>'
  );
}

function siteHeader() {
  return '<body><header class="site-header"><div class="header-inner"><a class="logo" href="/sandpaper_support/">eQualle <span>Support</span></a><nav class="nav"><a href="/sandpaper_support/problems/">Problems</a><a href="/sandpaper_support/surfaces/">Surfaces</a><a href="/sandpaper_support/grits/">Grit Guide</a><a href="/sandpaper_support/products/">Products</a><a href="/sandpaper_support/tags/">Tags</a><a href="/sandpaper_support/tools/grit-sequence-builder/">Tools</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="footer-inner"><span>© eQualle Support System</span><span>Sandpaper troubleshooting, grit guidance, and product support.</span></div></footer><script src="/sandpaper_support/assets/config.js"></script><script src="/sandpaper_support/assets/supabase-client.js?v=feedback-minimal-20260426"></script><script src="/sandpaper_support/assets/app.js?v=search-fix-20260426"></script></body></html>';
}

function renderProductCard() {
  return '<a class="card" href="/sandpaper_support/products/assorted-80-3000/"><h3>Using the 60-3000 Assorted Kit</h3><p>Choose the starting grit and sequence for this surface using the 9 x 11 inch wet or dry silicon carbide sheets.</p><span class="cta">Open kit guide -&gt;</span></a>';
}

function renderSolutionCard(card) {
  const recommendedGrit = card.recommended_grit || "Check the solution for grit guidance.";
  const wetOrDry = card.wet_or_dry || "See solution for wet or dry guidance.";

  return (
    '<a class="card" href="' +
    BASE_PATH +
    "/solutions/" +
    htmlEscape(card.id) +
    '/"><h3>' +
    htmlEscape(card.title) +
    "</h3><p>" +
    htmlEscape(card.problem) +
    '</p><div class="pill-list"><span class="pill">' +
    htmlEscape(recommendedGrit) +
    '</span><span class="pill">' +
    htmlEscape(wetOrDry) +
    '</span></div><span class="cta">Open solution -&gt;</span></a>'
  );
}

function renderSurfacePage(group, cards) {
  const count = cards.length;
  const gridCards = [renderProductCard()].concat(cards.map(renderSolutionCard)).join("");

  return (
    siteHead(group.pageTitle, group.description) +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / <a href="/sandpaper_support/surfaces/">By Surface</a> / ' +
    htmlEscape(group.title) +
    "</div><h1>" +
    htmlEscape(group.pageTitle) +
    "</h1><p class=\"section-intro\">" +
    htmlEscape(group.description) +
    '</p><div class="pill-list"><span class="pill">' +
    count +
    ' related fixes</span><span class="pill">Problem-first support</span></div></section><section class="section band"><h2>Common Fixes</h2><p class="section-intro">Choose the symptom that most closely matches what you see on the surface.</p><div class="grid">' +
    gridCards +
    "</div></section></main>" +
    siteFooter()
  );
}

function renderSurfacesIndex(groupsWithCards) {
  const cards = groupsWithCards
    .map((entry) => {
      return (
        '<a class="card" href="/sandpaper_support/surfaces/' +
        htmlEscape(entry.group.id) +
        '/"><h3>' +
        htmlEscape(entry.group.title) +
        "</h3><p>" +
        htmlEscape(entry.group.description) +
        '</p><div class="pill-list"><span class="pill">' +
        entry.cards.length +
        ' fixes</span></div><span class="cta">Open surface -&gt;</span></a>'
      );
    })
    .join("");

  const intro =
    "Start with the material or surface you are sanding, then choose the exact symptom.";

  return (
    siteHead("By Surface", "Find sandpaper support by surface: wood, paint, primer, clear coat, metal, plastic, drywall patch, and sheet problems.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / By Surface</div><h1>By Surface</h1><p class="section-intro">' +
    htmlEscape(intro) +
    '</p><div class="grid">' +
    cards +
    "</div></section></main>" +
    siteFooter()
  );
}

function buildSurfaceMap(groupsWithCards) {
  return groupsWithCards.map((entry) => ({
    id: entry.group.id,
    title: entry.group.title,
    description: entry.group.description,
    solution_card_ids: entry.cards.map((card) => card.id),
  }));
}

function main() {
  const writeMode = process.argv.includes("--write") || !process.argv.includes("--check");
  const cards = loadEligibleCards();

  const groupsWithCards = SURFACE_GROUPS.map((group) => ({
    group,
    cards: getGroupCards(group, cards),
  }));

  for (const entry of groupsWithCards) {
    const html = renderSurfacePage(entry.group, entry.cards);
    const filePath = path.join(SURFACES_DIR, entry.group.id, "index.html");
    if (writeMode) writeFile(filePath, html);
  }

  const surfacesIndexHtml = renderSurfacesIndex(groupsWithCards);
  if (writeMode) writeFile(path.join(SURFACES_DIR, "index.html"), surfacesIndexHtml);

  const surfaceMap = buildSurfaceMap(groupsWithCards);
  if (writeMode) {
    fs.writeFileSync(SURFACE_MAP_PATH, JSON.stringify(surfaceMap, null, 2) + "\n");
  }

  console.log("Surface index written: surfaces/index.html");
  console.log("Surface pages written: " + groupsWithCards.length);
  console.log(
    "Surface map entries written: " + surfaceMap.length
  );
  console.log("Mode: " + (writeMode ? "write" : "check"));
}

main();
