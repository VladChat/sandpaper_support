// scripts/solution-cards/merge-solution-cards.js
// Purpose: Merge all solution card JSON files from this folder into output/solution-cards.json.
// Source files are not overwritten.
//
// PowerShell run command:
// cd "C:\Users\vladi\Documents\vcoding\projects\sandpaper_support\scripts\solution-cards"; node .\merge-solution-cards.js

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = __dirname;
const OUTPUT_DIR = path.join(SOURCE_DIR, "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "solution-cards.json");
const REPORT_FILE = path.join(OUTPUT_DIR, "merge-report.json");

const VALID_GRITS = new Set([
  "60", "80", "100", "120", "150", "180", "220", "240", "280", "320",
  "360", "400", "500", "600", "800", "1000", "1200", "1500", "2000", "3000",
]);

const REQUIRED_FIELDS = [
  "id",
  "problem_slug",
  "title",
  "problem",
  "likely_cause",
  "recommended_grit",
  "wet_or_dry",
  "steps",
  "avoid",
  "success_check",
  "related_links",
  "slug",
  "surface",
  "task",
  "symptom",
  "quick_answer",
  "best_grit_path",
  "optional_starting_grits",
  "mistakes_to_avoid",
  "related_solution_ids",
  "search_phrases",
];

const ARRAY_FIELDS = [
  "steps",
  "related_links",
  "best_grit_path",
  "optional_starting_grits",
  "mistakes_to_avoid",
  "related_solution_ids",
  "search_phrases",
];

function readJsonArray(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain a JSON array.`);
  }

  return parsed;
}

function getInputFiles() {
  const files = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name !== "merge-report.json");

  return files.sort((a, b) => {
    const rank = (name) => {
      if (name === "solution-cards.json") return [0, 0, name];
      if (name === "new_missing_solution_cards.json") return [1, 0, name];

      const match = name.match(/^new_missing_solution_cards_(\d+)\.json$/);
      if (match) return [1, Number(match[1]), name];

      return [2, 0, name];
    };

    const ra = rank(a);
    const rb = rank(b);

    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    if (ra[1] !== rb[1]) return ra[1] - rb[1];

    return ra[2].localeCompare(rb[2]);
  });
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function scanForBadUrls(value, location, errors) {
  if (typeof value === "string") {
    if (
      value.includes("github.io") ||
      value.includes("vladchat.github.io") ||
      value.includes("support.equalle.com")
    ) {
      errors.push(`${location}: old/domain URL found: ${value}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanForBadUrls(item, `${location}[${index}]`, errors);
    });
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      scanForBadUrls(nested, `${location}.${key}`, errors);
    }
  }
}

function validateCardShape(card, fileName, index, errors) {
  const label = `${fileName}[${index}]`;

  if (!card || typeof card !== "object" || Array.isArray(card)) {
    errors.push(`${label}: card must be an object`);
    return;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in card)) {
      errors.push(`${label}: missing required field "${field}"`);
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (field in card && !Array.isArray(card[field])) {
      errors.push(`${label}: field "${field}" must be an array`);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (ARRAY_FIELDS.includes(field)) continue;

    if (field in card && isBlank(card[field])) {
      errors.push(`${label}: field "${field}" is empty`);
    }
  }

  if (Array.isArray(card.best_grit_path)) {
    for (const grit of card.best_grit_path) {
      if (!VALID_GRITS.has(String(grit))) {
        errors.push(`${label}: invalid grit in best_grit_path: ${grit}`);
      }
    }
  }

  if (Array.isArray(card.optional_starting_grits)) {
    for (const grit of card.optional_starting_grits) {
      if (!VALID_GRITS.has(String(grit))) {
        errors.push(`${label}: invalid grit in optional_starting_grits: ${grit}`);
      }
    }
  }

  scanForBadUrls(card, label, errors);
}

function normalizeCard(card) {
  const normalized = { ...card };

  normalized.id = String(normalized.id || "").trim();
  normalized.slug = String(normalized.slug || normalized.id).trim();

  if (!Array.isArray(normalized.related_solution_ids)) {
    normalized.related_solution_ids = [];
  }

  normalized.related_solution_ids = normalized.related_solution_ids
    .map((id) => String(id).trim())
    .filter(Boolean);

  normalized.related_links = normalized.related_solution_ids.map(
    (id) => `/solutions/${id}/`
  );

  normalized.best_grit_path = Array.isArray(normalized.best_grit_path)
    ? normalized.best_grit_path.map((grit) => String(grit))
    : [];

  normalized.optional_starting_grits = Array.isArray(normalized.optional_starting_grits)
    ? normalized.optional_starting_grits.map((grit) => String(grit))
    : [];

  return normalized;
}

function main() {
  const inputFiles = getInputFiles();

  if (!inputFiles.includes("solution-cards.json")) {
    throw new Error(
      `Base file not found: ${path.join(SOURCE_DIR, "solution-cards.json")}`
    );
  }

  const errors = [];
  const warnings = [];
  const merged = [];
  const seenIds = new Map();
  const seenSlugs = new Map();
  const fileStats = [];

  for (const fileName of inputFiles) {
    const filePath = path.join(SOURCE_DIR, fileName);
    const cards = readJsonArray(filePath);

    let added = 0;
    let skipped = 0;

    cards.forEach((rawCard, index) => {
      validateCardShape(rawCard, fileName, index, errors);

      if (!rawCard || typeof rawCard !== "object" || Array.isArray(rawCard)) {
        skipped++;
        return;
      }

      const card = normalizeCard(rawCard);

      if (seenIds.has(card.id)) {
        warnings.push(
          `${fileName}[${index}]: duplicate id "${card.id}" skipped; first seen in ${seenIds.get(card.id)}`
        );
        skipped++;
        return;
      }

      if (seenSlugs.has(card.slug)) {
        warnings.push(
          `${fileName}[${index}]: duplicate slug "${card.slug}" skipped; first seen in ${seenSlugs.get(card.slug)}`
        );
        skipped++;
        return;
      }

      seenIds.set(card.id, fileName);
      seenSlugs.set(card.slug, fileName);

      merged.push(card);
      added++;
    });

    fileStats.push({
      file: fileName,
      cards: cards.length,
      added,
      skipped,
    });
  }

  const allIds = new Set(merged.map((card) => card.id));

  merged.forEach((card) => {
    card.related_solution_ids.forEach((relatedId) => {
      if (!allIds.has(relatedId)) {
        errors.push(`${card.id}: bad related_solution_ids value "${relatedId}"`);
      }
    });

    const expectedLinks = card.related_solution_ids.map(
      (id) => `/solutions/${id}/`
    );

    const actualLinks = Array.isArray(card.related_links)
      ? card.related_links
      : [];

    if (JSON.stringify(actualLinks) !== JSON.stringify(expectedLinks)) {
      errors.push(`${card.id}: related_links do not match related_solution_ids`);
    }
  });

  const report = {
    source_dir: SOURCE_DIR,
    output_dir: OUTPUT_DIR,
    output_file: OUTPUT_FILE,
    input_files: inputFiles,
    file_stats: fileStats,
    total_cards_written: merged.length,
    warnings,
    errors,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (errors.length > 0) {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");

    console.error("MERGE FAILED");
    console.error(`Errors: ${errors.length}`);
    console.error(`Report written to: ${REPORT_FILE}`);

    for (const error of errors.slice(0, 80)) {
      console.error(`- ${error}`);
    }

    if (errors.length > 80) {
      console.error(`...and ${errors.length - 80} more errors`);
    }

    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("MERGE OK");
  console.log(`Input files: ${inputFiles.length}`);
  console.log(`Cards written: ${merged.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Report: ${REPORT_FILE}`);

  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);

    for (const warning of warnings.slice(0, 40)) {
      console.log(`- ${warning}`);
    }

    if (warnings.length > 40) {
      console.log(`...and ${warnings.length - 40} more warnings`);
    }
  }
}

main();