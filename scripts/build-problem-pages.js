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
  const tree = readJson(PROBLEM_TREE_PATH);
  if (!Array.isArray(tree)) return [];
  return tree
    .map(function (item) {
      const slug = String(item && item.id ? item.id : "").trim();
      if (!slug) return null;
      const title = String(item && item.title ? item.title : "").trim() || titleFromSlug(slug);
      const description = String(item && item.description ? item.description : "").trim();
      return { slug: slug, title: title, description: description };
    })
    .filter(Boolean);
}

function mergeProblemGroups(cards) {
  const cardGroups = groupCardsByProblemSlug(cards);
  const cardBySlug = Object.create(null);
  cardGroups.forEach(function (group) { cardBySlug[group.slug] = group; });

  const treeGroups = readProblemTreeGroups();
  if (!treeGroups.length) return cardGroups;

  const merged = [];
  const used = new Set();

  treeGroups.forEach(function (treeGroup) {
    const fromCards = cardBySlug[treeGroup.slug];
    if (fromCards) {
      if (treeGroup.title) fromCards.title = treeGroup.title;
      if (treeGroup.description) fromCards.description = treeGroup.description;
      merged.push(fromCards);
    } else {
      merged.push({
        slug: treeGroup.slug,
        title: treeGroup.title,
        description: treeGroup.description,
        cards: []
      });
    }
    used.add(treeGroup.slug);
  });

  cardGroups.forEach(function (group) {
    if (!used.has(group.slug)) merged.push(group);
  });

  return merged;
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
    '        <span class="cta">Open problem group →</span>',
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
    '        <span class="cta">Open answer →</span>',
    "      </a>"
  ].filter(Boolean).join("\n");
}

function renderProblemsIndex(groups, template, totalSolutions) {
  return replaceAllPlaceholders(template, {
    PROBLEM_GROUPS_HTML: groups.map(renderProblemGroupCard).join("\n"),
    TOTAL_GROUPS: String(groups.length),
    TOTAL_SOLUTIONS: String(totalSolutions)
  });
}

function renderProblemPage(group, template) {
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
