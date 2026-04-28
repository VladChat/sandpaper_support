#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "/sandpaper_support";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".playwright-mcp",
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function readJson(relativePath) {
  const filePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, data) {
  const filePath = path.join(ROOT_DIR, relativePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function getExistingSolutionIds() {
  const solutionsDir = path.join(ROOT_DIR, "solutions");
  const ids = new Set();

  if (!fs.existsSync(solutionsDir)) return ids;

  for (const entry of fs.readdirSync(solutionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(solutionsDir, entry.name, "index.html");
    if (fs.existsSync(indexPath)) {
      ids.add(entry.name);
    }
  }

  return ids;
}

function normalizeSolutionId(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^sandpaper_support\/+/, "")
    .replace(/^solutions\/+/, "")
    .replace(/\/+$/, "");
}

function solutionExists(existingIds, value) {
  const id = normalizeSolutionId(value);
  return id && existingIds.has(id);
}

function internalPageExists(href) {
  let clean = String(href || "").split("#")[0].split("?")[0].trim();

  if (!clean) return true;
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

function pruneSurfaceMap(existingIds) {
  const relativePath = "data/surface-map.json";
  const data = readJson(relativePath);

  if (!Array.isArray(data)) {
    return { file: relativePath, removed: 0 };
  }

  let removed = 0;

  for (const surface of data) {
    if (!Array.isArray(surface.solution_card_ids)) continue;

    const before = surface.solution_card_ids.length;

    surface.solution_card_ids = surface.solution_card_ids.filter((id) =>
      solutionExists(existingIds, id)
    );

    removed += before - surface.solution_card_ids.length;
  }

  writeJson(relativePath, data);

  return { file: relativePath, removed };
}

function pruneGritSequences(existingIds) {
  const relativePath = "data/grit-sequences.json";
  const data = readJson(relativePath);

  if (!Array.isArray(data)) {
    return { file: relativePath, removed: 0 };
  }

  let removed = 0;

  for (const item of data) {
    if (!Array.isArray(item.related_solution_ids)) continue;

    const before = item.related_solution_ids.length;

    item.related_solution_ids = item.related_solution_ids.filter((id) =>
      solutionExists(existingIds, id)
    );

    removed += before - item.related_solution_ids.length;
  }

  writeJson(relativePath, data);

  return { file: relativePath, removed };
}

function pruneBrokenSolutionCardsFromHtml() {
  const htmlFiles = walk(ROOT_DIR).filter((file) => file.endsWith(".html"));

  let changedFiles = 0;
  let removedCards = 0;
  let replacedLooseLinks = 0;

  for (const filePath of htmlFiles) {
    let html = fs.readFileSync(filePath, "utf8");
    const original = html;

    html = html.replace(
      /<a class="card" href="\/sandpaper_support\/solutions\/([^"]+)\/">[\s\S]*?<\/a>/g,
      function (fullMatch, slug) {
        const href = "/sandpaper_support/solutions/" + slug + "/";
        if (internalPageExists(href)) return fullMatch;
        removedCards += 1;
        return "";
      }
    );

    html = html.replace(
      /\s*<a class="cta" href="\/sandpaper_support\/solutions\/([^"]+)\/">[\s\S]*?<\/a>/g,
      function (fullMatch, slug) {
        const href = "/sandpaper_support/solutions/" + slug + "/";
        if (internalPageExists(href)) return fullMatch;
        replacedLooseLinks += 1;
        return "";
      }
    );

    html = html.replace(
      /href="\/sandpaper_support\/solutions\/([^"]+)\/"/g,
      function (fullMatch, slug) {
        const href = "/sandpaper_support/solutions/" + slug + "/";
        if (internalPageExists(href)) return fullMatch;
        replacedLooseLinks += 1;
        return 'href="/sandpaper_support/"';
      }
    );

    if (html !== original) {
      fs.writeFileSync(filePath, html);
      changedFiles += 1;
    }
  }

  return {
    changedFiles,
    removedCards,
    replacedLooseLinks,
  };
}

function main() {
  const existingIds = getExistingSolutionIds();

  if (!existingIds.size) {
    console.error("No generated solution pages found under solutions/*/index.html.");
    process.exitCode = 1;
    return;
  }

  const surfaceResult = pruneSurfaceMap(existingIds);
  const gritResult = pruneGritSequences(existingIds);
  const htmlResult = pruneBrokenSolutionCardsFromHtml();

  console.log("Stale internal link pruning complete.");
  console.log(surfaceResult.file + " removed references: " + surfaceResult.removed);
  console.log(gritResult.file + " removed references: " + gritResult.removed);
  console.log("HTML files changed: " + htmlResult.changedFiles);
  console.log("Removed broken solution cards: " + htmlResult.removedCards);
  console.log("Replaced loose broken solution links: " + htmlResult.replacedLooseLinks);
}

main();