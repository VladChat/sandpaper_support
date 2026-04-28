#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_PATH = "/sandpaper_support";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".playwright-mcp",
]);

const IGNORE_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".webmanifest",
  ".pdf",
  ".txt",
  ".map",
  ".woff",
  ".woff2",
  ".ttf",
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function stripQueryAndHash(value) {
  return String(value || "").split("#")[0].split("?")[0].trim();
}

function isIgnoredUrl(rawUrl) {
  const url = String(rawUrl || "").trim();

  if (!url) return true;
  if (url.startsWith("#")) return true;
  if (/^[a-z]+:/i.test(url) && !url.startsWith("http")) return true;
  if (/^https?:\/\//i.test(url)) return true;

  const clean = stripQueryAndHash(url).toLowerCase();
  return IGNORE_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

function pageUrlToLocalPath(rawUrl) {
  if (isIgnoredUrl(rawUrl)) return null;

  let url = stripQueryAndHash(rawUrl);

  if (url.startsWith(BASE_PATH)) {
    url = url.slice(BASE_PATH.length);
  } else if (url.startsWith("/solutions/") || url.startsWith("/problems/") || url.startsWith("/surfaces/") || url.startsWith("/products/") || url.startsWith("/tools/") || url.startsWith("/grits/") || url.startsWith("/ask/") || url.startsWith("/ai-assistant/") || url.startsWith("/documents/") || url.startsWith("/how-to/")) {
    // Data JSON files often store URLs without /sandpaper_support prefix.
  } else if (url === "/" || url === BASE_PATH + "/") {
    url = "/";
  } else {
    return null;
  }

  if (url === "" || url === "/") {
    return "index.html";
  }

  url = url.replace(/^\/+/, "");

  if (url.endsWith("/")) {
    return url + "index.html";
  }

  return url + "/index.html";
}

function solutionIdToLocalPath(rawId) {
  let id = String(rawId || "").trim();

  if (!id) return null;

  id = id
    .replace(/^\/+/, "")
    .replace(/^sandpaper_support\/+/, "")
    .replace(/^solutions\/+/, "")
    .replace(/\/+$/, "");

  if (!id) return null;

  return "solutions/" + id + "/index.html";
}

function existsLocal(localPath) {
  if (!localPath) return true;
  return fs.existsSync(path.join(ROOT_DIR, localPath));
}

function addBroken(broken, source, target, expected) {
  broken.push({
    source,
    target,
    expected,
  });
}

function scanHtmlFiles(broken) {
  const htmlFiles = walk(ROOT_DIR).filter((file) => file.endsWith(".html"));

  for (const file of htmlFiles) {
    const source = rel(file);
    const html = readText(file);
    const hrefRegex = /\bhref\s*=\s*["']([^"']+)["']/gi;

    let match;
    while ((match = hrefRegex.exec(html))) {
      const href = match[1];
      const expected = pageUrlToLocalPath(href);

      if (!expected) continue;

      if (!existsLocal(expected)) {
        addBroken(broken, source, href, expected);
      }
    }
  }
}

function scanSearchIndex(broken) {
  const filePath = path.join(ROOT_DIR, "data", "search-index.json");
  if (!fs.existsSync(filePath)) return;

  const data = readJson(filePath);
  if (!Array.isArray(data)) return;

  for (const item of data) {
    if (!item || !item.target_url) continue;

    const expected = pageUrlToLocalPath(item.target_url);

    if (!expected) continue;

    if (!existsLocal(expected)) {
      addBroken(
        broken,
        "data/search-index.json",
        item.target_url,
        expected
      );
    }
  }
}

function scanSurfaceMap(broken) {
  const filePath = path.join(ROOT_DIR, "data", "surface-map.json");
  if (!fs.existsSync(filePath)) return;

  const data = readJson(filePath);
  if (!Array.isArray(data)) return;

  for (const surface of data) {
    const ids = Array.isArray(surface.solution_card_ids)
      ? surface.solution_card_ids
      : [];

    for (const id of ids) {
      const expected = solutionIdToLocalPath(id);

      if (!expected) continue;

      if (!existsLocal(expected)) {
        addBroken(
          broken,
          "data/surface-map.json",
          String(id),
          expected
        );
      }
    }
  }
}

function scanGritSequences(broken) {
  const filePath = path.join(ROOT_DIR, "data", "grit-sequences.json");
  if (!fs.existsSync(filePath)) return;

  const data = readJson(filePath);
  if (!Array.isArray(data)) return;

  for (const sequence of data) {
    const ids = Array.isArray(sequence.related_solution_ids)
      ? sequence.related_solution_ids
      : [];

    for (const id of ids) {
      const expected = solutionIdToLocalPath(id);

      if (!expected) continue;

      if (!existsLocal(expected)) {
        addBroken(
          broken,
          "data/grit-sequences.json",
          String(id),
          expected
        );
      }
    }
  }
}

function printReport(broken) {
  if (!broken.length) {
    console.log("Internal link check passed: 0 broken links.");
    return;
  }

  console.error("Internal link check failed.");
  console.error("Broken links found: " + broken.length);
  console.error("");

  const grouped = new Map();

  for (const item of broken) {
    if (!grouped.has(item.source)) {
      grouped.set(item.source, []);
    }

    grouped.get(item.source).push(item);
  }

  for (const [source, items] of grouped.entries()) {
    console.error(source);

    for (const item of items) {
      console.error("  target:   " + item.target);
      console.error("  expected: " + item.expected);
    }

    console.error("");
  }
}

function main() {
  const broken = [];

  scanHtmlFiles(broken);
  scanSearchIndex(broken);
  scanSurfaceMap(broken);
  scanGritSequences(broken);

  printReport(broken);

  if (broken.length) {
    process.exitCode = 1;
  }
}

main();