#!/usr/bin/env node

// File: scripts/build-sitemap.js
// Purpose: Generate sitemap.xml for the public support.equalle.com site.

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "sitemap.xml");
const SITE_URL = String(process.env.SITE_URL || "https://support.equalle.com").replace(/\/+$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

const EXCLUDED_TOP_LEVEL_DIRS = new Set([
  ".git",
  ".github",
  "assets",
  "data",
  "docs",
  "icons",
  "node_modules",
  "scripts",
  "supabase",
  "templates",
  "vendor",
]);

const EXCLUDED_PUBLIC_PREFIXES = [
  "admin/",
  "solutions/preview-generated-solution/",
];

const EXCLUDED_PATH_PARTS = new Set([
  "debug",
  "draft",
  "preview",
  "test",
]);

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isExcludedDirectory(relativeDir) {
  const clean = relativeDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!clean) return false;

  const parts = clean.split("/");
  if (EXCLUDED_TOP_LEVEL_DIRS.has(parts[0])) return true;
  if (parts.some((part) => EXCLUDED_PATH_PARTS.has(part))) return true;

  const withSlash = clean + "/";
  return EXCLUDED_PUBLIC_PREFIXES.some((prefix) => withSlash.startsWith(prefix));
}

function isPublicHtmlIndex(filePath) {
  if (path.basename(filePath) !== "index.html") return false;

  const relativeFile = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const relativeDir = path.dirname(relativeFile).replace(/\\/g, "/");
  return !isExcludedDirectory(relativeDir === "." ? "" : relativeDir);
}

function walk(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (!isExcludedDirectory(relativePath)) {
        walk(fullPath, results);
      }
      return;
    }

    if (entry.isFile() && isPublicHtmlIndex(fullPath)) {
      results.push(fullPath);
    }
  });
}

function fileToUrl(filePath) {
  const relativeFile = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const relativeDir = path.dirname(relativeFile).replace(/\\/g, "/");

  if (relativeDir === ".") {
    return SITE_URL + "/";
  }

  return SITE_URL + "/" + relativeDir.replace(/^\/+|\/+$/g, "") + "/";
}

function priorityForUrl(url) {
  const pathPart = url.replace(SITE_URL, "");
  if (pathPart === "/") return "1.0";
  if (/^\/(problems|surfaces|grits|products)\/$/.test(pathPart)) return "0.9";
  if (/^\/(solutions|problems|surfaces|products|tags)\//.test(pathPart)) return "0.8";
  if (/^\/(privacy|terms|disclaimer|contact)\/$/.test(pathPart)) return "0.5";
  return "0.7";
}

function changefreqForUrl(url) {
  const pathPart = url.replace(SITE_URL, "");
  if (pathPart === "/") return "weekly";
  if (/^\/(solutions|problems|surfaces|products|tags|grits)\//.test(pathPart)) return "monthly";
  return "monthly";
}

function buildSitemap(urls) {
  const entries = urls.map((url) => [
    "  <url>",
    `    <loc>${xmlEscape(url)}</loc>`,
    `    <lastmod>${TODAY}</lastmod>`,
    `    <changefreq>${changefreqForUrl(url)}</changefreq>`,
    `    <priority>${priorityForUrl(url)}</priority>`,
    "  </url>",
  ].join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join("\n"),
    '</urlset>',
    '',
  ].join("\n");
}

function main() {
  const files = [];
  walk(ROOT_DIR, files);

  const urls = Array.from(new Set(files.map(fileToUrl))).sort((a, b) => {
    if (a === SITE_URL + "/") return -1;
    if (b === SITE_URL + "/") return 1;
    return a.localeCompare(b);
  });

  fs.writeFileSync(OUTPUT_PATH, buildSitemap(urls), "utf8");

  console.log(`Sitemap generated: sitemap.xml`);
  console.log(`Site URL: ${SITE_URL}`);
  console.log(`URLs included: ${urls.length}`);
}

main();
