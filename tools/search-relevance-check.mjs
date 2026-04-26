import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const searchCore = require("../assets/search-core.js");

const root = process.cwd();
const entries = JSON.parse(fs.readFileSync(path.join(root, "data", "search-index.json"), "utf-8"));

function runSearch(query) {
  return searchCore.searchEntries(entries, query, 5);
}

function titles(results) {
  return results.map((row) => row.title || "");
}

function fail(message, details) {
  console.error("FAIL:", message);
  if (details) {
    console.error(details);
  }
  process.exitCode = 1;
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  } else {
    console.log("PASS:", message);
  }
}

function includesText(text, fragments) {
  const value = String(text || "").toLowerCase();
  return fragments.some((item) => value.includes(String(item).toLowerCase()));
}

function hasOnlyPopularQuestionSuggestions(results) {
  const allowed = [
    "What grit should I use?",
    "Why does sandpaper clog?",
    "How do I sand plastic?",
    "Which grit comes next?",
  ];
  return results.length > 0 && results.every((row) => allowed.includes(row.title || ""));
}

function expectNoGenericKitHowTo(results, query) {
  assert(
    !titles(results).some((title) => String(title).toLowerCase() === "how to use 60 to 3000 grit sandpaper"),
    `query "${query}" excludes generic kit how-to suggestion`,
    titles(results),
  );
}

const cases = [];

{
  const q = "how";
  const results = runSearch(q);
  assert(hasOnlyPopularQuestionSuggestions(results), 'query "how" returns popular suggestions only', titles(results));
  expectNoGenericKitHowTo(results, q);
  cases.push([q, titles(results)]);
}

{
  const q = "why";
  const results = runSearch(q);
  assert(hasOnlyPopularQuestionSuggestions(results), 'query "why" returns popular suggestions only', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "what";
  const results = runSearch(q);
  assert(hasOnlyPopularQuestionSuggestions(results), 'query "what" returns popular suggestions only', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "which";
  const results = runSearch(q);
  assert(hasOnlyPopularQuestionSuggestions(results), 'query "which" returns popular suggestions only', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "grit 220";
  const results = runSearch(q);
  assert(results.length > 0, 'query "grit 220" returns local grit-related results', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "220 grit";
  const results = runSearch(q);
  assert(results.length > 0, 'query "220 grit" returns local grit-related results', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "grit 500";
  const results = runSearch(q);
  assert(results.length > 0, 'query "grit 500" returns local grit/product/guide results', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "how to sand plastic";
  const results = runSearch(q);
  const valid = results.some((row) =>
    includesText([row.title, row.description, row.target_url].join(" "), ["plastic", "/surfaces/plastic/"]),
  );
  assert(valid, 'query "how to sand plastic" returns plastic-specific results', titles(results));
  expectNoGenericKitHowTo(results, q);
  cases.push([q, titles(results)]);
}

{
  const q = "sand plastic";
  const results = runSearch(q);
  const valid = results.some((row) => includesText([row.title, row.description, row.target_url].join(" "), ["plastic"]));
  assert(valid, 'query "sand plastic" returns plastic-specific results', titles(results));
  cases.push([q, titles(results)]);
}

{
  const q = "clogging";
  const results = runSearch(q);
  const list = titles(results);
  assert(
    list.includes("Sandpaper Clogs Too Fast") || list.includes("Paint Clogs Sandpaper"),
    'query "clogging" returns clogging problem results',
    list,
  );
  cases.push([q, list]);
}

{
  const q = "where to buy 3000 grit";
  const results = runSearch(q);
  const list = titles(results);
  assert(
    list.length === 1 && list[0] === "eQualle Assorted Sandpaper Kit 60-3000",
    'query "where to buy 3000 grit" returns specific kit only',
    list,
  );
  assert(!list.includes("Products"), 'query "where to buy 3000 grit" excludes generic Products fallback', list);
  cases.push([q, list]);
}

{
  const q = "random unsupported question";
  const results = runSearch(q);
  assert(results.length === 0 || !results[0].search_strong, 'query "random unsupported question" has no strong local match', titles(results));
  cases.push([q, titles(results)]);
}

console.log("\nSearch outputs:");
for (const item of cases) {
  console.log("-", item[0], "=>", item[1].join(" | "));
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
