import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const searchCore = require("../assets/search-core.js");

const root = process.cwd();
const searchIndexPath = path.join(root, "data", "search-index.json");
const entries = JSON.parse(fs.readFileSync(searchIndexPath, "utf-8"));

function runSearch(query) {
  return searchCore.searchEntries(entries, query, 5);
}

function titles(results) {
  return results.map(function (row) {
    return row.title || "";
  });
}

function fail(message, details) {
  console.error("FAIL:", message);
  if (details) {
    console.error(details);
  }
  process.exitCode = 1;
}

function containsAny(text, keywords) {
  const value = String(text || "").toLowerCase();
  return keywords.some(function (word) {
    return value.indexOf(word) !== -1;
  });
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  } else {
    console.log("PASS:", message);
  }
}

function assertNoForbidden(results, forbiddenTitles, message) {
  const lowered = results.map(function (r) {
    return String(r.title || "").toLowerCase();
  });
  const hasForbidden = forbiddenTitles.some(function (title) {
    return lowered.indexOf(title.toLowerCase()) !== -1;
  });
  assert(!hasForbidden, message, titles(results));
}

const cases = [];

// 1.
{
  const results = runSearch("pl");
  assert(results.length === 0, 'query "pl" returns 0 results', titles(results));
  cases.push(["pl", titles(results)]);
}

// 2.
{
  const results = runSearch("pla");
  const valid = results.every(function (row) {
    const hay = [row.title, row.description, row.target_url].join(" ").toLowerCase();
    return hay.indexOf("paint") !== -1 || hay.indexOf("plastic") !== -1;
  });
  assert(valid, 'query "pla" returns only paint/plastic-related results', titles(results));
  cases.push(["pla", titles(results)]);
}

// 3.
{
  const results = runSearch("sandpaper clogs too fast");
  assert(
    (results[0] && results[0].title) === "Sandpaper Clogs Too Fast",
    'query "sandpaper clogs too fast" top result is "Sandpaper Clogs Too Fast"',
    titles(results),
  );
  cases.push(["sandpaper clogs too fast", titles(results)]);
}

// 4.
{
  const results = runSearch("paint clogs");
  const list = titles(results);
  assert(
    list.indexOf("Paint Clogs Sandpaper") !== -1 && list.indexOf("Sandpaper Clogs Too Fast") !== -1,
    'query "paint clogs" includes Paint Clogs Sandpaper and Sandpaper Clogs Too Fast',
    list,
  );
  cases.push(["paint clogs", list]);
}

// 5.
{
  const results = runSearch("plastic turns white after sanding");
  const valid = results.some(function (row) {
    return containsAny([row.title, row.description, row.target_url].join(" "), ["plastic"]);
  });
  const unrelated = results.some(function (row) {
    return containsAny(row.title, ["60 grit", "80 grit", "100 grit"]);
  });
  assert(valid && !unrelated, 'query "plastic turns white after sanding" stays plastic-related', titles(results));
  cases.push(["plastic turns white after sanding", titles(results)]);
}

// 6.
{
  const results = runSearch("500 vs 600");
  const valid = results.some(function (row) {
    return containsAny(row.title, ["500 vs 600", "grit", "sequence builder"]);
  });
  const unrelated = results.some(function (row) {
    return containsAny(row.title, ["60 grit", "80 grit", "100 grit"]);
  });
  assert(valid && !unrelated, 'query "500 vs 600" returns grit comparison/guide/builder results', titles(results));
  cases.push(["500 vs 600", titles(results)]);
}

// 7.
{
  const results = runSearch("grit 500 where to buy near me");
  const list = titles(results);
  const valid = list.some(function (title) {
    return (
      title === "Products" ||
      title === "eQualle Assorted Sandpaper Kit 80-3000" ||
      title === "How to use 80 to 3000 grit sandpaper" ||
      title === "Which sheet from the kit should I use"
    );
  });
  assert(valid, 'query "grit 500 where to buy near me" returns product/buy results', list);
  assertNoForbidden(
    results,
    [
      "60 grit is too aggressive",
      "80 grit removes too much",
      "100 grit leaves marks before 180",
      "High grit does not remove defects",
      "Wrong Grit Progression",
    ],
    'query "grit 500 where to buy near me" excludes forbidden unrelated pages',
  );
  cases.push(["grit 500 where to buy near me", list]);
}

// 8.
{
  const results = runSearch("where to buy 3000 grit");
  const list = titles(results);
  const valid = list.some(function (title) {
    return title === "Products" || title === "eQualle Assorted Sandpaper Kit 80-3000";
  });
  const hasProblem = results.some(function (row) {
    const url = String(row.target_url || "").toLowerCase();
    return url.indexOf("/problems/") === 0 || url.indexOf("/solutions/") === 0;
  });
  assert(valid && !hasProblem, 'query "where to buy 3000 grit" returns product results, not problem pages', list);
  cases.push(["where to buy 3000 grit", list]);
}

// 9.
{
  const results = runSearch("what grit after 180");
  const list = titles(results);
  const valid = results.some(function (row) {
    return containsAny([row.title, row.target_url].join(" "), ["grit", "sequence", "progression", "next"]);
  });
  assert(valid, 'query "what grit after 180" returns grit progression style results', list);
  cases.push(["what grit after 180", list]);
}

// 10.
{
  const results = runSearch("deep scratches after 180");
  const list = titles(results);
  const valid = results.some(function (row) {
    return containsAny([row.title, row.description].join(" "), ["scratch", "deep"]);
  });
  assert(valid, 'query "deep scratches after 180" returns scratches-related results', list);
  cases.push(["deep scratches after 180", list]);
}

console.log("\nSearch outputs:");
cases.forEach(function (item) {
  console.log("-", item[0], "=>", item[1].join(" | "));
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
