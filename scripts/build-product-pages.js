#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "/sandpaper_support";
const PRODUCTS_DIR = path.join(ROOT_DIR, "products");

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

function pageExists(url) {
  let clean = String(url || "").split("#")[0].split("?")[0].trim();

  if (!clean) return false;
  if (clean.startsWith("#")) return true;
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
    '<link rel="stylesheet" href="/sandpaper_support/assets/styles.css?v=product-pages-cleanup-p4"></head>';
}

function siteHeader() {
  return '<body><header class="site-header"><div class="header-inner"><a class="logo" href="/sandpaper_support/">eQualle <span>Support</span></a><nav class="nav"><a href="/sandpaper_support/problems/">Problems</a><a href="/sandpaper_support/surfaces/">Surfaces</a><a href="/sandpaper_support/grits/">Grit Guide</a><a href="/sandpaper_support/products/">Products</a><a href="/sandpaper_support/tools/">Tools</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="footer-inner"><span>© eQualle Support System</span><span>Sandpaper troubleshooting, grit guidance, and product support.</span></div></footer><script src="/sandpaper_support/assets/config.js"></script><script src="/sandpaper_support/assets/supabase-client.js?v=feedback-minimal-20260426"></script><script src="/sandpaper_support/assets/app.js?v=search-fix-20260426"></script></body></html>';
}

function productCard(href, title, text, cta, chips) {
  return '<a class="card" href="' +
    htmlEscape(href) +
    '"><h3>' +
    htmlEscape(title) +
    '</h3><p>' +
    htmlEscape(text) +
    '</p>' +
    renderChipList(chips || []) +
    '<span class="cta">' +
    htmlEscape(cta) +
    " -&gt;</span></a>";
}

function infoCard(title, text, chips) {
  return '<article class="card"><h3>' +
    htmlEscape(title) +
    '</h3><p>' +
    htmlEscape(text) +
    '</p>' +
    renderChipList(chips || []) +
    "</article>";
}

function renderProductsIndex() {
  const intro = "Choose the product type first, then move to the correct grit guide, surface guide, or troubleshooting answer.";

  return siteHead("Product Support", "Product-specific support paths for eQualle sandpaper sheets.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / By Product</div><h1>Product Support</h1><p class="section-intro">' +
    htmlEscape(intro) +
    '</p><div class="grid">' +
    productCard(
      "/sandpaper_support/products/assorted-80-3000/",
      "eQualle Assorted Sandpaper Kit 60-3000",
      "Use this guide when you have the assorted 9 x 11 inch silicon carbide wet or dry sheets and need help choosing a grit sequence.",
      "Open kit support",
      [
        ["60-3000 grit", ""],
        ["Wet or dry use", ""],
        ["Grit sequence help", "/sandpaper_support/grits/"]
      ]
    ) +
    productCard(
      "/sandpaper_support/products/single-grit-sheets/",
      "eQualle Single-Grit Sandpaper Sheets",
      "Use this guide when you have one grit number and need to understand what that grit is best for, what comes next, or why the result is not right.",
      "Open single-grit support",
      [
        ["9 x 11 in sheets", ""],
        ["Silicon carbide", ""],
        ["By grit", "/sandpaper_support/grits/"]
      ]
    ) +
    infoCard(
      "Start by Surface",
      "When the material matters more than the product package, start with the surface you are sanding.",
      [
        ["Wood", "/sandpaper_support/surfaces/wood/"],
        ["Paint / Primer", "/sandpaper_support/surfaces/paint-primer/"],
        ["Metal", "/sandpaper_support/surfaces/metal/"],
        ["Plastic", "/sandpaper_support/surfaces/plastic/"],
        ["Clear Coat", "/sandpaper_support/surfaces/clear-coat/"]
      ]
    ) +
    infoCard(
      "Start by Problem",
      "When the result looks wrong, start with the symptom: scratches, clogging, haze, roughness, or slow cutting.",
      [
        ["Problems", "/sandpaper_support/problems/"],
        ["Clogging", "/sandpaper_support/problems/paper-clogs-too-fast/"],
        ["Scratches", "/sandpaper_support/problems/scratches-too-deep/"],
        ["Wet sanding haze", "/sandpaper_support/problems/wet-sanding-haze/"]
      ]
    ) +
    '</div></section></main>' +
    siteFooter();
}

function rangeCard(title, text, chips) {
  return infoCard(title, text, chips);
}

function renderAssortedKitPage() {
  const intro = "Support guide for choosing and using the 9 x 11 inch silicon carbide wet or dry sandpaper sheets in the assorted 60 through 3000 grit kit.";

  return siteHead("eQualle Assorted Sandpaper Kit 60-3000 Support", "Support guide for the eQualle assorted 60 through 3000 grit sandpaper kit.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / <a href="/sandpaper_support/products/">By Product</a> / Assorted 60-3000 Kit</div><h1>eQualle Assorted Sandpaper Kit 60-3000 Support</h1><p class="section-intro">' +
    htmlEscape(intro) +
    '</p><div class="pill-list"><span class="pill">9 x 11 in sheets</span><span class="pill">Silicon carbide abrasive</span><span class="pill">Wet or dry use</span><span class="pill">60 through 3000 grit</span></div></section>' +
    '<section class="section band"><h2>Choose the Right Grit Range</h2><p class="section-intro">Start with the least aggressive grit that still changes the problem, then move finer step by step.</p><div class="grid">' +
    rangeCard(
      "60-120 — Coarse / Removal",
      "Use for heavy material removal, rough sanding, paint or rust removal, and shaping uneven areas before moving finer.",
      [["Open grit guide", "/sandpaper_support/grits/#coarse"]]
    ) +
    rangeCard(
      "150-240 — Medium / Preparation",
      "Use for general prep, smoothing after rough sanding, wood prep, paint prep, and removing earlier coarse scratches.",
      [["Open grit guide", "/sandpaper_support/grits/#medium"]]
    ) +
    rangeCard(
      "280-400 — Fine Prep",
      "Use for finer preparation, light scuffing, primer sanding, and preparing a smoother surface for the next stage.",
      [["Open grit guide", "/sandpaper_support/grits/#fine"]]
    ) +
    rangeCard(
      "500-800 — Extra Fine",
      "Use for extra-fine finishing, light wet sanding, coating refinement, and bridging to ultra-fine sanding.",
      [["Open grit guide", "/sandpaper_support/grits/#extra-fine"]]
    ) +
    rangeCard(
      "1000-3000 — Ultra Fine / Wet Sanding",
      "Use for wet sanding, haze refinement, clear coat work, plastic restoration, and polishing preparation.",
      [["Open grit guide", "/sandpaper_support/grits/#ultra-fine"]]
    ) +
    '</div></section>' +
    '<section class="section"><h2>Support Paths by Surface</h2><p class="section-intro">Choose the material first when you are unsure where to start.</p><div class="grid">' +
    productCard("/sandpaper_support/surfaces/wood/", "Wood", "Wood sanding support for prep, scratches, stain, furniture, cabinets, and edges.", "Open wood support", []) +
    productCard("/sandpaper_support/surfaces/paint-primer/", "Paint / Primer", "Paint and primer support for prep, feathering, clogging, dull spots, and between-coat sanding.", "Open paint support", []) +
    productCard("/sandpaper_support/surfaces/clear-coat/", "Clear Coat", "Clear coat support for haze, orange peel, wet sanding, 1500 marks, 2000 marks, and polishing prep.", "Open clear coat support", []) +
    productCard("/sandpaper_support/surfaces/metal/", "Metal", "Metal support for rust, oxidation, aluminum, stainless steel, scratch blending, and paint prep.", "Open metal support", []) +
    productCard("/sandpaper_support/surfaces/plastic/", "Plastic", "Plastic support for haze, smearing, fuzzy edges, 3D prints, headlights, and heat control.", "Open plastic support", []) +
    productCard("/sandpaper_support/surfaces/drywall-patch/", "Drywall Patch", "Drywall patch support for ridges, torn paper, joint compound, visible edges, and low spots.", "Open drywall support", []) +
    '</div></section>' +
    '<section class="section band"><h2>Common Mistakes</h2><div class="grid">' +
    infoCard("Starting Too Fine", "Fine grits refine scratches. They are slow when the surface still has raised defects, rust, thick paint, or deep scratches.", []) +
    infoCard("Skipping Too Far", "Large jumps can leave the previous grit scratches behind. Step down gradually until the old scratch pattern is gone.", []) +
    infoCard("Expecting 3000 To Create Gloss", "3000 grit can prepare a surface for polishing, but sanding alone usually leaves a very fine haze.", []) +
    '</div></section></main>' +
    siteFooter();
}

function renderSingleGritPage() {
  const intro = "Support guide for eQualle single-grit 9 x 11 inch silicon carbide wet or dry sandpaper sheets.";

  return siteHead("eQualle Single-Grit Sandpaper Sheets Support", "Support guide for eQualle single-grit 9 x 11 inch wet or dry silicon carbide sandpaper sheets.") +
    "\n" +
    siteHeader() +
    '<main><section class="section"><div class="breadcrumb"><a href="/sandpaper_support/">Home</a> / <a href="/sandpaper_support/products/">By Product</a> / Single-Grit Sheets</div><h1>eQualle Single-Grit Sandpaper Sheets Support</h1><p class="section-intro">' +
    htmlEscape(intro) +
    '</p><div class="pill-list"><span class="pill">9 x 11 in sheets</span><span class="pill">Silicon carbide abrasive</span><span class="pill">Wet or dry use</span><span class="pill">Single-grit packs</span></div></section>' +
    '<section class="section band"><h2>Available Grit Support</h2><p class="section-intro">Use the grit range first, then choose the surface or problem that matches the project.</p><div class="grid">' +
    rangeCard("60 grit", "Use for very aggressive removal only. Available pack support: 10, 25, and 50 sheets.", [["Coarse range", "/sandpaper_support/grits/#coarse"]]) +
    rangeCard("80-120 grit", "Use for rough sanding, paint removal, rust removal, and first-pass leveling.", [["Coarse range", "/sandpaper_support/grits/#coarse"]]) +
    rangeCard("150-240 grit", "Use for surface preparation, smoothing, and preparing for paint, primer, stain, or sealer.", [["Medium range", "/sandpaper_support/grits/#medium"]]) +
    rangeCard("280-400 grit", "Use for fine prep, primer sanding, light scuffing, and smoother coating preparation.", [["Fine range", "/sandpaper_support/grits/#fine"]]) +
    rangeCard("500-800 grit", "Use for extra-fine finishing and bridging into ultra-fine wet sanding stages.", [["Extra fine range", "/sandpaper_support/grits/#extra-fine"]]) +
    rangeCard("1000-3000 grit", "Use for wet sanding, haze refinement, clear coat work, plastic restoration, and polishing preparation.", [["Ultra fine range", "/sandpaper_support/grits/#ultra-fine"]]) +
    '</div></section>' +
    '<section class="section"><h2>When Single-Grit Packs Are Better</h2><div class="grid">' +
    infoCard("Repeating One Stage", "Choose a single-grit pack when the project needs more sheets for one sanding stage instead of a full sequence.", [["By grit", "/sandpaper_support/grits/"]]) +
    infoCard("Fixing One Problem", "Choose the problem path when one result is not right, such as clogging, scratches, roughness, or haze.", [["Problems", "/sandpaper_support/problems/"]]) +
    infoCard("Working by Surface", "Choose the surface path when the material determines the safest grit and sanding method.", [["Surfaces", "/sandpaper_support/surfaces/"]]) +
    '</div></section>' +
    '<section class="section band"><h2>Common Single-Grit Questions</h2><div class="grid">' +
    productCard("/sandpaper_support/problems/which-grit-to-use/", "Which grit should I use?", "Start here when you know the surface but not the grit number.", "Open grit selection help", []) +
    productCard("/sandpaper_support/problems/paper-clogs-too-fast/", "Why does the sheet clog?", "Use this path when dust, paint, primer, or residue loads into the abrasive.", "Open clogging help", []) +
    productCard("/sandpaper_support/problems/scratches-too-deep/", "Why are scratches still visible?", "Use this path when the previous grit marks are not being removed.", "Open scratch help", []) +
    '</div></section></main>' +
    siteFooter();
}

function main() {
  const writeMode = process.argv.includes("--write") || !process.argv.includes("--check");

  const files = [
    {
      path: path.join(PRODUCTS_DIR, "index.html"),
      html: renderProductsIndex()
    },
    {
      path: path.join(PRODUCTS_DIR, "assorted-80-3000", "index.html"),
      html: renderAssortedKitPage()
    },
    {
      path: path.join(PRODUCTS_DIR, "single-grit-sheets", "index.html"),
      html: renderSingleGritPage()
    }
  ];

  if (writeMode) {
    for (const file of files) {
      writeFile(file.path, file.html);
    }
  }

  console.log("Product pages generated: " + files.length);
  console.log("Generated: products/index.html");
  console.log("Generated: products/assorted-80-3000/index.html");
  console.log("Generated: products/single-grit-sheets/index.html");
  console.log("Mode: " + (writeMode ? "write" : "check"));
}

main();