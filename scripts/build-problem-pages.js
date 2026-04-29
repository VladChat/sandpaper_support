#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "solution-cards.json");
const PROBLEM_TREE_PATH = path.join(ROOT_DIR, "data", "problem-tree.json");
const PROBLEMS_INDEX_TEMPLATE_PATH = path.join(ROOT_DIR, "templates", "problems-index.html");
const PROBLEM_PAGE_TEMPLATE_PATH = path.join(ROOT_DIR, "templates", "problem-page.html");
const PROBLEMS_DIR = path.join(ROOT_DIR, "problems");

const PROBLEM_LABELS = {
  "scratches-too-deep": "Scratches Too Deep",
  "not-sure-what-grit-to-use": "Not Sure What Grit To Use",
  "paper-clogs-too-fast": "Sandpaper Clogs Too Fast",
  "sanding-takes-too-long": "Sanding Takes Too Long",
  "finish-looks-uneven": "Finish Looks Uneven",
  "swirl-marks-remain": "Swirl Marks Remain",
  "paper-tears-early": "Paper Tears Early",
  "poor-results-between-coats": "Poor Results Between Coats",
  "wet-sanding-leaves-haze": "Wet Sanding Leaves Haze",
  "surface-still-feels-rough": "Surface Still Feels Rough"
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

function replaceAllPlaceholders(template, values) {
  let output = String(template || "");
  Object.keys(values || {}).forEach(function (key) {
    output = output.split("{{" + key + "}}").join(String(values[key] == null ? "" : values[key]));
  });
  return output;
}

function unique(values) {
  const seen = Object.create(null);
  const result = [];
  values.forEach(function (value) {
    const clean = String(value == null ? "" : value).trim();
    const key = clean.toLowerCase();
    if (!clean || seen[key]) return;
    seen[key] = true;
    result.push(clean);
  });
  return result;
}

function titleFromSlug(slug) {
  const clean = String(slug || "").trim();
  if (PROBLEM_LABELS[clean]) return PROBLEM_LABELS[clean];
  return clean.split("-").filter(Boolean).map(function (part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function getProblemDescription(slug, cards) {
  if (!cards.length) return "Browse matching sandpaper support answers.";
  const surfaces = unique(cards.map(function (card) { return card.surface; }).filter(Boolean)).slice(0, 4);
  const tasks = unique(cards.map(function (card) { return card.task; }).filter(Boolean)).slice(0, 4);
  const parts = [];
  if (surfaces.length) parts.push("surfaces: " + surfaces.join(", "));
  if (tasks.length) parts.push("tasks: " + tasks.join(", "));
  if (parts.length) {
    return "Browse " + String(cards.length) + " matching answers for " + titleFromSlug(slug).toLowerCase() + " (" + parts.join("; ") + ").";
  }
  return "Browse " + String(cards.length) + " matching sandpaper support answers.";
}

function groupCardsByProblemSlug(cards) {
  const groups = [];
  const bySlug = Object.create(null);
  cards.forEach(function (card) {
    const slug = String(card && card.problem_slug ? card.problem_slug : "").trim();
    if (!slug) return;
    if (!bySlug[slug]) {
      bySlug[slug] = { slug: slug, title: titleFromSlug(slug), cards: [] };
      groups.push(bySlug[slug]);
    }
    bySlug[slug].cards.push(card);
  });
  return groups;
}

function readProblemTreeGroups() {
  if (!fs.existsSync(PROBLEM_TREE_PATH)) return [];
  const treeRaw = readJson(PROBLEM_TREE_PATH);
  const tree = Array.isArray(treeRaw)
    ? treeRaw
    : (treeRaw && Array.isArray(treeRaw.groups) ? treeRaw.groups : []);
  if (!Array.isArray(tree)) return [];

  return tree
    .map(function (item) {
      const slug = String(item && item.id ? item.id : "").trim();
      if (!slug) return null;
      const title = String(item && item.title ? item.title : "").trim() || titleFromSlug(slug);
      const description = String(item && item.description ? item.description : "").trim();
      const solutionCardIds = Array.isArray(item && item.solution_card_ids)
        ? item.solution_card_ids.map(function (id) { return String(id || "").trim(); }).filter(Boolean)
        : [];
      return {
        slug: slug,
        title: title,
        description: description,
        solution_card_ids: solutionCardIds
      };
    })
    .filter(Boolean);
}

function mergeProblemGroups(cards) {
  const cardsById = new Map();
  cards.forEach(function (card) {
    if (card && card.id) cardsById.set(String(card.id), card);
  });

  const cardGroups = groupCardsByProblemSlug(cards);
  const cardGroupsBySlug = Object.create(null);
  cardGroups.forEach(function (group) { cardGroupsBySlug[group.slug] = group; });

  const treeGroups = readProblemTreeGroups();
  if (!treeGroups.length) return cardGroups;

  const merged = [];
  const used = new Set();

  treeGroups.forEach(function (treeGroup) {
    const groupCards = [];
    const missingIds = [];
    if (Array.isArray(treeGroup.solution_card_ids) && treeGroup.solution_card_ids.length) {
      treeGroup.solution_card_ids.forEach(function (id) {
        const card = cardsById.get(String(id));
        if (!card) {
          missingIds.push(id);
          return;
        }
        groupCards.push(card);
      });
    }

    if (missingIds.length) {
      throw new Error(
        "Problem tree group " + treeGroup.slug + " references missing solution_card_ids: " + missingIds.join(", ")
      );
    }

    if (!groupCards.length) {
      throw new Error("Problem tree group " + treeGroup.slug + " has 0 real answers.");
    }

    merged.push({
      slug: treeGroup.slug,
      title: treeGroup.title || titleFromSlug(treeGroup.slug),
      description: treeGroup.description || getProblemDescription(treeGroup.slug, groupCards),
      cards: groupCards
    });
    used.add(treeGroup.slug);
  });

  cardGroups.forEach(function (group) {
    if (!used.has(group.slug) && group.cards.length) merged.push(group);
  });

  return merged.filter(function (group) {
    return Array.isArray(group.cards) && group.cards.length > 0;
  });
}

function validateCards(cards) {
  if (!Array.isArray(cards)) throw new Error("data/solution-cards.json must be an array.");
  const errors = [];
  const ids = Object.create(null);
  cards.forEach(function (card, index) {
    const label = "Card " + index + " (" + (card && card.id ? card.id : "unknown") + ")";
    ["id", "slug", "title", "problem", "problem_slug"].forEach(function (field) {
      if (!String(card && card[field] ? card[field] : "").trim()) errors.push(label + ": missing " + field);
    });
    const id = String(card && card.id ? card.id : "").trim();
    if (id) {
      if (ids[id]) errors.push(label + ": duplicate id " + id);
      ids[id] = true;
    }
  });
  if (errors.length) throw new Error(errors.join("\n"));
}

function renderProblemGroupCard(group) {
  const previewItems = group.cards.slice(0, 4).map(function (card) {
    return "        <li>" + escapeHtml(card.title) + "</li>";
  }).join("\n");
  const moreCount = Math.max(0, group.cards.length - 4);
  const moreHtml = moreCount ? "\n        <li>+" + String(moreCount) + " more answers</li>" : "";
  return [
    '      <a class="card" href="/sandpaper_support/problems/' + escapeHtml(group.slug) + '/">',
    "        <h3>" + escapeHtml(group.title) + "</h3>",
    "        <p>" + escapeHtml(group.description || getProblemDescription(group.slug, group.cards)) + "</p>",
    '        <ul class="pill-list" style="display:block;padding-left:18px;margin:10px 0 0;">',
    previewItems + moreHtml,
    "        </ul>",
    '        <span class="cta">View problem guide</span>',
    "      </a>"
  ].join("\n");
}

function renderSolutionCard(card) {
  const detailParts = [];
  if (card.problem) detailParts.push(card.problem);
  if (card.recommended_grit) detailParts.push("Recommended grit: " + card.recommended_grit);
  const pills = [card.surface, card.task].filter(Boolean).map(function (value) {
    return '          <span class="pill">' + escapeHtml(value) + "</span>";
  }).join("\n");
  return [
    '      <a class="card" href="/sandpaper_support/solutions/' + escapeHtml(card.id) + '/">',
    "        <h3>" + escapeHtml(card.title) + "</h3>",
    "        <p>" + escapeHtml(detailParts.join(" ")) + "</p>",
    pills ? '        <div class="pill-list">\n' + pills + "\n        </div>" : "",
    '        <span class="cta">View solution</span>',
    "      </a>"
  ].filter(Boolean).join("\n");
}

const PRIMARY_PROBLEM_HUB = [
  { slug: "scratches-too-deep", description: "Scratch marks stay visible even after moving to finer grits." },
  { slug: "not-sure-what-grit-to-use", description: "You are unsure where to start or which grit should come next." },
  { slug: "paper-clogs-too-fast", description: "The sheet loads with dust, paint, or residue and stops cutting." },
  { slug: "sanding-takes-too-long", description: "Cutting feels slow and defects are not clearing in a reasonable time." },
  { slug: "surface-still-feels-rough", description: "The surface still feels uneven or textured after sanding." },
  { slug: "wet-sanding-leaves-haze", description: "Wet sanding leaves cloudiness or haze that does not clear." },
  { slug: "swirl-marks-remain", description: "Circular marks remain visible after sanding or prep work." },
  { slug: "finish-looks-uneven", description: "The finish looks patchy, blotchy, or inconsistent across the surface." },
  { slug: "poor-results-between-coats", description: "Between-coat sanding does not produce a smooth, even base." },
  { slug: "paper-tears-early", description: "Sheets tear, fray, or wear out before finishing the sanding step." }
];

const TASK_OR_MATERIAL_HUB = [
  { slug: "paint-prep", title: "Paint Prep", cta: "View prep guide" },
  { slug: "wood-finish-prep", title: "Wood Finish Prep", cta: "View prep guide" },
  { slug: "drywall-patch", title: "Drywall Patch", cta: "View related problems" },
  { slug: "rust-removal", title: "Rust Removal", cta: "View related problems" },
  { slug: "paint-removal", title: "Paint Removal", cta: "View related problems" },
  { slug: "metal-prep", title: "Metal Prep", cta: "View prep guide" },
  { slug: "plastic-sanding", title: "Plastic Sanding", cta: "View sanding guide" },
  { slug: "wet-or-dry-use", title: "Wet Or Dry Use", cta: "View sanding guide" },
  { slug: "grit-sequence", title: "Grit Sequence", cta: "View sanding guide" },
  { slug: "headlight-restoration", title: "Headlight Restoration", cta: "View related problems" }
];

function renderPrimaryProblemCard(group, overrideDescription) {
  const examples = group.cards.slice(0, 5).map(function (card) {
    return '<span class="pill">' + escapeHtml(card.title) + "</span>";
  }).join("");

  return [
    '      <article class="card">',
    "        <h3>" + escapeHtml(group.title) + "</h3>",
    "        <p>" + escapeHtml(overrideDescription || group.description || getProblemDescription(group.slug, group.cards)) + "</p>",
    examples ? '        <div class="pill-list">' + examples + "</div>" : "",
    '        <a class="cta" href="/sandpaper_support/problems/' + escapeHtml(group.slug) + '/">View problem guide</a>',
    "      </article>"
  ].filter(Boolean).join("\n");
}

function renderTaskCard(group, title, cta) {
  const examples = group.cards.slice(0, 3).map(function (card) {
    return '<span class="pill">' + escapeHtml(card.title) + "</span>";
  }).join("");

  return [
    '      <article class="card">',
    "        <h3>" + escapeHtml(title || group.title) + "</h3>",
    "        <p>" + escapeHtml(group.description || getProblemDescription(group.slug, group.cards)) + "</p>",
    examples ? '        <div class="pill-list">' + examples + "</div>" : "",
    '        <a class="cta" href="/sandpaper_support/problems/' + escapeHtml(group.slug) + '/">' + escapeHtml(cta) + "</a>",
    "      </article>"
  ].filter(Boolean).join("\n");
}

function renderCuratedProblemsHtml(groupsBySlug) {
  const primaryCards = PRIMARY_PROBLEM_HUB.map(function (item) {
    const group = groupsBySlug[item.slug];
    if (!group) return "";
    return renderPrimaryProblemCard(group, item.description);
  }).filter(Boolean).join("\n");

  const secondaryCards = TASK_OR_MATERIAL_HUB.map(function (item) {
    const group = groupsBySlug[item.slug];
    if (!group) return "";
    return renderTaskCard(group, item.title, item.cta);
  }).filter(Boolean).join("\n");

  return [
    '<section class="section band"><h2>Common sanding problems</h2><div class="grid">',
    primaryCards,
    "</div></section>",
    '<section class="section"><h2>Start by task or material</h2><div class="grid">',
    secondaryCards,
    "</div></section>"
  ].join("");
}

function renderProblemsIndex(groups, template, totalSolutions) {
  const groupsBySlug = Object.create(null);
  groups.forEach(function (group) {
    groupsBySlug[group.slug] = group;
  });

  return replaceAllPlaceholders(template, {
    CURATED_PROBLEMS_HTML: renderCuratedProblemsHtml(groupsBySlug),
    TOTAL_GROUPS: String(groups.length),
    TOTAL_SOLUTIONS: String(totalSolutions)
  });
}

function renderProblemPage(group, template) {
  if (!Array.isArray(group.cards) || group.cards.length === 0) {
    throw new Error("Cannot render empty problem page: " + group.slug);
  }
  const description = group.description || getProblemDescription(group.slug, group.cards);
  return replaceAllPlaceholders(template, {
    PROBLEM_TITLE: escapeHtml(group.title),
    META_DESCRIPTION: escapeHtml(description),
    PROBLEM_DESCRIPTION: escapeHtml(description),
    SOLUTION_CARDS_HTML: group.cards.map(renderSolutionCard).join("\n"),
    SOLUTION_COUNT: String(group.cards.length)
  });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function listExistingProblemDirs() {
  if (!fs.existsSync(PROBLEMS_DIR)) return [];
  return fs.readdirSync(PROBLEMS_DIR, { withFileTypes: true })
    .filter(function (entry) { return entry.isDirectory(); })
    .map(function (entry) { return entry.name; });
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.indexOf("--write") !== -1 ? "write" : "check";
  const cards = readJson(DATA_PATH);
  validateCards(cards);
  const groups = mergeProblemGroups(cards);
  const allowedSlugs = new Set(groups.map(function (group) { return group.slug; }));
  const staleDirs = listExistingProblemDirs().filter(function (dir) { return !allowedSlugs.has(dir); });
  const indexTemplate = fs.readFileSync(PROBLEMS_INDEX_TEMPLATE_PATH, "utf8");
  const pageTemplate = fs.readFileSync(PROBLEM_PAGE_TEMPLATE_PATH, "utf8");
  const indexHtml = renderProblemsIndex(groups, indexTemplate, cards.length);
  const pages = groups.map(function (group) {
    return { path: path.join(PROBLEMS_DIR, group.slug, "index.html"), html: renderProblemPage(group, pageTemplate) };
  });
  if (mode === "write") {
    writeFile(path.join(PROBLEMS_DIR, "index.html"), indexHtml);
    pages.forEach(function (page) { writeFile(page.path, page.html); });
    console.log("Problem index written: problems/index.html");
    console.log("Problem group pages written: " + String(pages.length));
  } else {
    console.log("Problem groups checked: " + String(groups.length));
    console.log("Planned problem group pages: " + String(pages.length));
  }
  if (staleDirs.length) {
    console.log("Stale problem directories found: " + staleDirs.join(", "));
    console.log("Review and delete only if they are confirmed old generated pages.");
  }
  console.log("Solution cards used: " + String(cards.length));
  console.log("Mode: " + mode);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
}


