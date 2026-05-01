#!/usr/bin/env node

/*
  File: scripts/enrich-card-videos.js
  Purpose: Enrich sandpaper solution cards with relevant YouTube videos and automatic QC.

  Run from repo root:
    cd "C:\\Users\\vladi\\Documents\\vcoding\\projects\\sandpaper_support"
    node scripts\\enrich-card-videos.js
*/

const fs = require("fs");
const path = require("path");
const https = require("https");

// =========================
// CONFIG BLOCK - EDIT HERE
// =========================
const CONFIG = {
  WRITE: true,
  LIMIT: 30,
  CARD_ID: "",
  FORCE: false,

  // Selection behavior
  REVIEW_EXISTING_CANDIDATES_FIRST: true,
  RECHECK_REJECTED_WITH_OLD_QC: true,
  RECHECK_NO_MATCH_WITH_OLD_QC: false,
  RETRY_DAYS: 30,

  // YouTube API safety
  MAX_RESULTS_PER_CARD: 8,
  DELAY_MS: 1000,
  QUOTA_BUDGET_UNITS: 9000,
  SEARCH_COST_UNITS: 100,
  VIDEO_DETAILS_COST_UNITS: 1,
  MAX_API_RETRIES: 3,
  BACKOFF_START_MS: 1500,

  // Automatic QC policy
  QC_POLICY: "auto-quality-qc-v4-short-video-penalty-video-cap-1",
  AUTO_APPROVE_MIN_SCORE: 72,
  SHORT_VIDEO_AUTO_APPROVE_MIN_SCORE: 80,
  MAX_APPROVALS_PER_VIDEO_ID: 1,

  // Video filters
  MIN_HARD_VIDEO_SECONDS: 45,      // below this = hard reject
  SHORT_VIDEO_PENALTY_SECONDS: 75, // 45-74 sec = allowed with penalty and higher approve threshold
  SHORT_VIDEO_SCORE_PENALTY: 8,
  MAX_VIDEO_SECONDS: 20 * 60,
  SAFE_SEARCH: "moderate",
  REGION_CODE: "US",
  RELEVANCE_LANGUAGE: "en",

  // Sales/competitor language is now a score penalty, not a hard block.
  SALES_PENALTY: 8,
  STRONG_SALES_PENALTY: 14,
  COMPETITOR_CONTEXT_PENALTY: 8,

  // Files
  SOLUTION_CARDS_PATH: "data/solution-cards.json",
  CARD_VIDEOS_PATH: "data/card-videos.json",
  QUOTA_LOG_PATH: "data/card-videos-quota-log.json",
  DEBUG_LOG_PATH: "data/card-videos-debug-log.json",

  // Signals used for scoring/penalty only, not automatic hard reject.
  COMPETITOR_BRANDS: [
    "3m", "norton", "diablo", "dewalt", "mirka", "gator", "rhynowet", "klingspor",
    "harbor freight", "dura-block", "durablock", "eastwood"
  ],
  SALES_TERMS: [
    "amazon", "temu", "aliexpress", "walmart", "affiliate", "sponsored", "buy now",
    "product review", "review", "unboxing", "best sandpaper", "best auto body sandpaper",
    "link in description", "discount", "coupon"
  ],
  STRONG_SALES_TERMS: [
    "amazon review", "product review", "unboxing", "affiliate link", "sponsored by", "buy now",
    "discount code", "coupon code", "temu", "aliexpress"
  ]
};
// =========================
// END CONFIG BLOCK
// =========================

const ROOT_DIR = process.cwd();
const SOLUTION_CARDS_PATH = path.join(ROOT_DIR, CONFIG.SOLUTION_CARDS_PATH);
const CARD_VIDEOS_PATH = path.join(ROOT_DIR, CONFIG.CARD_VIDEOS_PATH);
const QUOTA_LOG_PATH = path.join(ROOT_DIR, CONFIG.QUOTA_LOG_PATH);
const DEBUG_LOG_PATH = path.join(ROOT_DIR, CONFIG.DEBUG_LOG_PATH);

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

function loadEnv() {
  loadDotEnvFile(path.join(ROOT_DIR, ".env"));
  loadDotEnvFile(path.join(ROOT_DIR, ".env.local"));
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function includesAny(text, terms) {
  const clean = normalizeText(text);
  return (terms || []).some((term) => clean.includes(normalizeText(term)));
}

function matchedTerms(text, terms) {
  const clean = normalizeText(text);
  return (terms || []).filter((term) => clean.includes(normalizeText(term)));
}

function hasWholeWord(text, word) {
  const re = new RegExp(`(^|[^a-z0-9])${String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
  return re.test(String(text || ""));
}

function parseIsoDurationToSeconds(duration) {
  const match = String(duration || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function loadQuotaLog() {
  const log = readJson(QUOTA_LOG_PATH, {});
  if (!log || Array.isArray(log) || typeof log !== "object") return {};
  return log;
}

function getTodayQuotaUsed(log) {
  const record = log[todayKey()] || {};
  return Number(record.usedUnits || 0);
}

function addQuota(log, units, reason, meta) {
  const today = todayKey();
  if (!log[today]) log[today] = { usedUnits: 0, events: [] };
  log[today].usedUnits = Number(log[today].usedUnits || 0) + units;
  log[today].events.push({ at: new Date().toISOString(), units, reason, ...(meta || {}) });
}

function canSpendQuota(log, unitsNeeded) {
  return getTodayQuotaUsed(log) + unitsNeeded <= CONFIG.QUOTA_BUDGET_UNITS;
}

class ApiError extends Error {
  constructor(message, statusCode, payload) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function httpsGetJsonOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        let json;
        try {
          json = body ? JSON.parse(body) : {};
        } catch (error) {
          reject(new ApiError(`YouTube API returned invalid JSON (${res.statusCode})`, res.statusCode, body));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = json && json.error && json.error.message ? json.error.message : body;
          reject(new ApiError(`YouTube API error ${res.statusCode}: ${message}`, res.statusCode, json));
          return;
        }
        resolve(json);
      });
    }).on("error", reject);
  });
}

function isRetriableError(error) {
  return error && [429, 500, 502, 503, 504].includes(Number(error.statusCode));
}

function isQuotaStopError(error) {
  const text = JSON.stringify(error && error.payload ? error.payload : {}).toLowerCase();
  return Number(error && error.statusCode) === 403 && (
    text.includes("quota") || text.includes("dailylimitexceeded") || text.includes("ratelimitexceeded")
  );
}

async function httpsGetJson(url) {
  let attempt = 0;
  let delay = CONFIG.BACKOFF_START_MS;
  while (true) {
    try {
      return await httpsGetJsonOnce(url);
    } catch (error) {
      attempt += 1;
      if (isQuotaStopError(error)) throw error;
      if (!isRetriableError(error) || attempt > CONFIG.MAX_API_RETRIES) throw error;
      console.log(`API retry ${attempt}/${CONFIG.MAX_API_RETRIES} after ${delay}ms: ${error.message}`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function getCardGrits(card) {
  const grits = [];
  if (Array.isArray(card.optional_starting_grits)) grits.push(...card.optional_starting_grits);
  if (Array.isArray(card.best_grit_path)) grits.push(...card.best_grit_path);
  return unique(grits.map((grit) => String(grit || "").trim()).filter(Boolean));
}

function inferCardSurface(card) {
  const text = normalizeText([
    card.surface, card.task, card.title, card.problem, card.symptom, card.quick_answer, card.recommended_grit,
    Array.isArray(card.search_phrases) ? card.search_phrases.join(" ") : ""
  ].join(" "));

  if (includesAny(text, ["clear coat", "clearcoat", "automotive clear", "car paint", "paint correction", "orange peel"])) return "clear_coat";
  if (includesAny(text, ["drywall", "joint compound", "spackle", "wall patch"])) return "drywall";
  if (includesAny(text, ["plastic", "acrylic", "pvc", "bumper", "epoxy", "resin"])) return "plastic";
  if (includesAny(text, ["stainless", "steel", "aluminum", "metal", "rust", "brass", "copper"])) return "metal";
  if (includesAny(text, ["wood", "grain", "veneer", "hardwood", "softwood", "table", "furniture", "stain"])) return "wood";
  if (includesAny(text, ["primer", "paint", "repaint", "between coats", "coating", "finish"])) return "paint_primer";
  return "general";
}

function surfaceQueryPrefix(surface) {
  switch (surface) {
    case "clear_coat": return "automotive wet sanding clear coat";
    case "drywall": return "drywall sanding";
    case "plastic": return "plastic sanding";
    case "metal": return "metal sanding";
    case "wood": return "wood sanding";
    case "paint_primer": return "paint primer sanding";
    default: return "sandpaper sanding";
  }
}

function buildVideoQuery(card) {
  const surface = inferCardSurface(card);
  const grits = getCardGrits(card);
  const parts = [surfaceQueryPrefix(surface)];
  const task = String(card.task || "").trim();
  const symptom = String(card.symptom || "").trim();
  const title = String(card.title || "").trim();

  if (task) parts.push(task);
  else if (symptom) parts.push(symptom);
  else if (title) parts.push(title);

  if (grits.length) parts.push(`${grits.slice(0, 5).join(" ")} grit`);
  parts.push("sandpaper tutorial");

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 140);
}

function surfaceTerms(surface) {
  switch (surface) {
    case "clear_coat": return ["clear coat", "clearcoat", "car paint", "automotive", "wet sand", "wet sanding", "paint correction", "buff"];
    case "drywall": return ["drywall", "joint compound", "spackle", "wall patch", "mud"];
    case "plastic": return ["plastic", "acrylic", "pvc", "bumper", "epoxy", "resin"];
    case "metal": return ["metal", "steel", "stainless", "aluminum", "rust", "brass", "copper"];
    case "wood": return ["wood", "woodworking", "furniture", "table", "grain", "stain", "veneer"];
    case "paint_primer": return ["paint", "primer", "repaint", "coating", "finish", "car paint", "auto body"];
    default: return ["sand", "sanding", "sandpaper", "grit"];
  }
}

function taskTerms(card) {
  const task = normalizeText([card.task, card.title, card.symptom, card.problem].join(" "));
  const terms = [];
  if (includesAny(task, ["scratch", "scratches", "lines", "swirl"])) terms.push("scratch", "scratches", "swirl", "scratch removal");
  if (includesAny(task, ["clog", "load", "loaded", "dust", "smear", "slurry"])) terms.push("clog", "loaded", "dust", "slurry", "smear");
  if (includesAny(task, ["grit selection", "choose", "what is", "used for", "assortment"])) terms.push("grit", "choose", "sandpaper grit", "which grit");
  if (includesAny(task, ["paint prep", "primer", "between coats", "repainting"])) terms.push("paint", "primer", "prep", "between coats");
  if (includesAny(task, ["wet sanding", "haze", "cloudy", "orange peel", "polishing"])) terms.push("wet sanding", "polish", "buff", "orange peel", "haze");
  if (includesAny(task, ["rough", "smooth", "surface refinement", "finish prep"])) terms.push("smooth", "rough", "finish", "surface");
  return unique(terms);
}

function getCardKeywords(card) {
  const grits = getCardGrits(card);
  const raw = [
    card.title,
    card.surface,
    card.task,
    card.symptom,
    card.problem,
    Array.isArray(card.search_phrases) ? card.search_phrases.slice(0, 2).join(" ") : "",
    ...grits.map((grit) => `${grit} grit`)
  ].join(" ");

  const stop = new Set([
    "the", "and", "with", "after", "before", "from", "that", "this", "into", "your", "for",
    "remain", "remains", "problem", "surface", "general", "paper", "sheet", "sheets", "still"
  ]);

  return unique(normalizeText(raw).split(" ")
    .filter((word) => word.length >= 3 && !stop.has(word))
    .slice(0, 28));
}

async function searchYouTube(apiKey, query, quotaLog, debugRun) {
  if (!canSpendQuota(quotaLog, CONFIG.SEARCH_COST_UNITS)) {
    throw new Error(`Quota budget reached before search. Used=${getTodayQuotaUsed(quotaLog)}, budget=${CONFIG.QUOTA_BUDGET_UNITS}`);
  }
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(Math.min(10, Math.max(1, CONFIG.MAX_RESULTS_PER_CARD))),
    videoEmbeddable: "true",
    safeSearch: CONFIG.SAFE_SEARCH,
    relevanceLanguage: CONFIG.RELEVANCE_LANGUAGE,
    regionCode: CONFIG.REGION_CODE,
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const json = await httpsGetJson(url);
  addQuota(quotaLog, CONFIG.SEARCH_COST_UNITS, "search.list", { query });
  debugRun.apiCalls.push({ at: new Date().toISOString(), endpoint: "search.list", units: CONFIG.SEARCH_COST_UNITS, query });
  return Array.isArray(json.items) ? json.items : [];
}

async function getVideoDetails(apiKey, ids, quotaLog, debugRun, reason) {
  const cleanIds = unique(ids).filter(Boolean);
  if (!cleanIds.length) return [];
  if (!canSpendQuota(quotaLog, CONFIG.VIDEO_DETAILS_COST_UNITS)) {
    throw new Error(`Quota budget reached before video details. Used=${getTodayQuotaUsed(quotaLog)}, budget=${CONFIG.QUOTA_BUDGET_UNITS}`);
  }
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics,status",
    id: cleanIds.join(","),
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  const json = await httpsGetJson(url);
  addQuota(quotaLog, CONFIG.VIDEO_DETAILS_COST_UNITS, "videos.list", { count: cleanIds.length, reason });
  debugRun.apiCalls.push({ at: new Date().toISOString(), endpoint: "videos.list", units: CONFIG.VIDEO_DETAILS_COST_UNITS, ids: cleanIds, reason });
  return Array.isArray(json.items) ? json.items : [];
}

function countApprovedUsage(cardVideos) {
  const usage = {};
  Object.keys(cardVideos || {}).forEach((cardId) => {
    const record = cardVideos[cardId];
    if (record && record.status === "approved" && record.youtubeId) {
      usage[record.youtubeId] = (usage[record.youtubeId] || 0) + 1;
    }
  });
  return usage;
}

function isRecentlyChecked(record) {
  if (!record || !record.checkedAt) return false;
  const checked = new Date(record.checkedAt).getTime();
  if (!Number.isFinite(checked)) return false;
  return Date.now() - checked < CONFIG.RETRY_DAYS * 24 * 60 * 60 * 1000;
}

function getReviewText(video) {
  const snippet = video.snippet || {};
  return `${snippet.title || ""} ${snippet.description || ""} ${snippet.channelTitle || ""}`;
}

function calculateQuality(card, video, usageByVideoId) {
  const snippet = video.snippet || {};
  const status = video.status || {};
  const statistics = video.statistics || {};
  const text = getReviewText(video);
  const normalized = normalizeText(text);
  const title = snippet.title || "";
  const videoId = video.id;
  const seconds = parseIsoDurationToSeconds(video.contentDetails && video.contentDetails.duration);
  const cardSurface = inferCardSurface(card);
  const cardSurfaceTerms = surfaceTerms(cardSurface);
  const cardTaskTerms = taskTerms(card);
  const keywords = getCardKeywords(card);
  const grits = getCardGrits(card);
  const reasons = [];
  const warnings = [];
  const matched = {
    keywords: [],
    grits: [],
    surface: [],
    task: [],
    salesTerms: [],
    strongSalesTerms: [],
    competitorBrands: []
  };

  let score = 0;
  let hardRejectReason = "";

  const embeddable = status.embeddable === true;
  const privacyStatus = status.privacyStatus || "unknown";
  const madeForKids = status.madeForKids === true;

  const isShortsLike = includesAny(text, ["#shorts", " shorts ", "tiktok"]) || String(title).toLowerCase().includes("#shorts");
  const isShortButAllowed = seconds >= CONFIG.MIN_HARD_VIDEO_SECONDS && seconds < CONFIG.SHORT_VIDEO_PENALTY_SECONDS;

  if (!embeddable) hardRejectReason = "not_embeddable";
  else if (privacyStatus !== "public") hardRejectReason = "not_public";
  else if (madeForKids) hardRejectReason = "made_for_kids";
  else if (isShortsLike) hardRejectReason = "shorts_like";
  else if (seconds < CONFIG.MIN_HARD_VIDEO_SECONDS) hardRejectReason = "too_short";
  else if (seconds > CONFIG.MAX_VIDEO_SECONDS) hardRejectReason = "too_long";

  const surfaceMatches = matchedTerms(text, cardSurfaceTerms);
  matched.surface = surfaceMatches;
  if (surfaceMatches.length) {
    score += Math.min(22, surfaceMatches.length * 7);
    reasons.push(`surface_match:${surfaceMatches.slice(0, 4).join("|")}`);
  }

  const taskMatches = matchedTerms(text, cardTaskTerms);
  matched.task = taskMatches;
  if (taskMatches.length) {
    score += Math.min(20, taskMatches.length * 6);
    reasons.push(`task_match:${taskMatches.slice(0, 4).join("|")}`);
  }

  keywords.forEach((word) => {
    if (word.length >= 3 && normalized.includes(word)) matched.keywords.push(word);
  });
  if (matched.keywords.length) {
    score += Math.min(28, matched.keywords.length * 2);
    reasons.push(`keyword_matches:${matched.keywords.slice(0, 8).join("|")}`);
  }

  grits.forEach((grit) => {
    const gritText = String(grit);
    if (
      normalized.includes(`${gritText} grit`) ||
      normalized.includes(`grit ${gritText}`) ||
      hasWholeWord(normalized, gritText)
    ) {
      matched.grits.push(gritText);
    }
  });
  if (matched.grits.length) {
    score += Math.min(24, matched.grits.length * 6);
    reasons.push(`grit_matches:${matched.grits.join("|")}`);
  }

  if (includesAny(text, ["how to", "tutorial", "guide", "tips", "demo", "beginner", "explained"])) {
    score += 10;
    reasons.push("educational_format");
  }
  if (includesAny(text, ["sand", "sanding", "sandpaper", "grit", "wet sand", "dry sand"])) {
    score += 12;
    reasons.push("sanding_terms_present");
  } else {
    score -= 20;
    warnings.push("missing_sanding_terms");
  }

  if (isShortButAllowed) {
    score -= CONFIG.SHORT_VIDEO_SCORE_PENALTY;
    warnings.push(`short_video_penalty:${seconds}s`);
  } else if (seconds >= 120 && seconds <= 900) {
    score += 8;
    reasons.push("good_duration");
  } else if (seconds >= CONFIG.SHORT_VIDEO_PENALTY_SECONDS && seconds < 120) {
    score += 2;
    warnings.push("acceptable_but_short_duration");
  } else if (seconds > 900 && seconds <= CONFIG.MAX_VIDEO_SECONDS) {
    score += 2;
    warnings.push("long_but_allowed");
  }

  if (Number(statistics.viewCount || 0) >= 10000) {
    score += 3;
    reasons.push("reasonable_view_count");
  }

  matched.salesTerms = matchedTerms(text, CONFIG.SALES_TERMS);
  matched.strongSalesTerms = matchedTerms(text, CONFIG.STRONG_SALES_TERMS);
  matched.competitorBrands = matchedTerms(text, CONFIG.COMPETITOR_BRANDS);

  // QC v4: sales/competitor signals reduce confidence but do not hard block educational videos.
  if (matched.strongSalesTerms.length) {
    score -= CONFIG.STRONG_SALES_PENALTY;
    warnings.push(`strong_sales_penalty:${matched.strongSalesTerms.slice(0, 4).join("|")}`);
  } else if (matched.salesTerms.length) {
    score -= CONFIG.SALES_PENALTY;
    warnings.push(`sales_penalty:${matched.salesTerms.slice(0, 4).join("|")}`);
  }

  if (matched.competitorBrands.length && matched.salesTerms.length) {
    score -= CONFIG.COMPETITOR_CONTEXT_PENALTY;
    warnings.push(`competitor_context_penalty:${matched.competitorBrands.slice(0, 4).join("|")}`);
  } else if (matched.competitorBrands.length) {
    score -= Math.floor(CONFIG.COMPETITOR_CONTEXT_PENALTY / 2);
    warnings.push(`minor_competitor_penalty:${matched.competitorBrands.slice(0, 4).join("|")}`);
  }

  // Surface match is required for specific surfaces, but general grit/paint-primer cards can pass with task/grit strength.
  const specificSurface = !["general", "paint_primer"].includes(cardSurface);
  if (!surfaceMatches.length && specificSurface) {
    hardRejectReason = hardRejectReason || "missing_surface_or_task_match";
  }

  const approvedUsage = Number(usageByVideoId[videoId] || 0);
  if (approvedUsage >= CONFIG.MAX_APPROVALS_PER_VIDEO_ID) {
    hardRejectReason = hardRejectReason || "video_usage_cap_reached";
    warnings.push(`video_usage:${approvedUsage}`);
  }

  const requiredScore = isShortButAllowed
    ? CONFIG.SHORT_VIDEO_AUTO_APPROVE_MIN_SCORE
    : CONFIG.AUTO_APPROVE_MIN_SCORE;

  const decision = hardRejectReason
    ? "rejected"
    : (score >= requiredScore ? "approved" : "rejected");

  const rejectReason = hardRejectReason || (decision === "rejected"
    ? (isShortButAllowed ? "short_video_score_below_threshold" : "score_below_auto_approve_threshold")
    : "");

  return {
    video,
    videoId,
    title,
    channel: snippet.channelTitle || "",
    durationSeconds: seconds,
    score,
    decision,
    rejectReason,
    requiredScore,
    isShortButAllowed,
    reasons,
    warnings,
    matched,
    cardSurface,
    embeddable,
    privacyStatus,
    madeForKids,
    statistics: {
      viewCount: Number(statistics.viewCount || 0),
      likeCount: Number(statistics.likeCount || 0),
      commentCount: Number(statistics.commentCount || 0)
    }
  };
}

function chooseBestEvaluation(evaluations) {
  const approvable = evaluations
    .filter((item) => item.decision === "approved")
    .sort((a, b) => b.score - a.score);
  if (approvable[0]) return approvable[0];
  return evaluations.slice().sort((a, b) => b.score - a.score)[0] || null;
}

function makeVideoRecord(query, evaluation) {
  const video = evaluation.video;
  const snippet = video.snippet || {};
  const thumbnails = snippet.thumbnails || {};
  const thumbnail = (thumbnails.high && thumbnails.high.url) ||
    (thumbnails.medium && thumbnails.medium.url) ||
    (thumbnails.default && thumbnails.default.url) ||
    `https://img.youtube.com/vi/${evaluation.videoId}/hqdefault.jpg`;

  return {
    status: "approved",
    youtubeId: evaluation.videoId,
    title: snippet.title || "",
    channel: snippet.channelTitle || "",
    thumbnail,
    watchUrl: `https://www.youtube.com/watch?v=${evaluation.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${evaluation.videoId}`,
    query,
    qualityScore: evaluation.score,
    requiredScore: evaluation.requiredScore,
    isShortButAllowed: evaluation.isShortButAllowed,
    durationSeconds: evaluation.durationSeconds,
    decision: "auto_approved",
    reasons: evaluation.reasons,
    warnings: evaluation.warnings,
    matched: evaluation.matched,
    checkedAt: todayKey(),
    source: "youtube_api",
    qcPolicy: CONFIG.QC_POLICY
  };
}

function makeRejectedRecord(query, evaluation, searchSummary) {
  return {
    status: "rejected",
    query,
    bestYoutubeId: evaluation ? evaluation.videoId : "",
    bestTitle: evaluation ? evaluation.title : "",
    bestChannel: evaluation ? evaluation.channel : "",
    bestScore: evaluation ? evaluation.score : 0,
    requiredScore: evaluation ? evaluation.requiredScore : CONFIG.AUTO_APPROVE_MIN_SCORE,
    isShortButAllowed: evaluation ? evaluation.isShortButAllowed : false,
    rejectReason: evaluation ? evaluation.rejectReason : "no_candidate_evaluated",
    reasons: evaluation ? evaluation.reasons : [],
    warnings: evaluation ? evaluation.warnings : [],
    matched: evaluation ? evaluation.matched : {},
    searchSummary: searchSummary || {},
    checkedAt: todayKey(),
    source: "youtube_api",
    qcPolicy: CONFIG.QC_POLICY
  };
}

function makeNoMatchRecord(query, searchSummary) {
  return {
    status: "no_match",
    query,
    searchSummary: searchSummary || {},
    checkedAt: todayKey(),
    source: "youtube_api",
    qcPolicy: CONFIG.QC_POLICY
  };
}

function shouldSkipRecord(record) {
  if (CONFIG.FORCE) return "";
  if (!record) return "";

  if (record.status === "approved" && record.youtubeId) return "already approved";
  if (record.status === "candidate" && CONFIG.REVIEW_EXISTING_CANDIDATES_FIRST) return "";
  if (record.status === "rejected") {
    if (CONFIG.RECHECK_REJECTED_WITH_OLD_QC && record.qcPolicy !== CONFIG.QC_POLICY) return "";
    return "already rejected by current QC";
  }
  if (record.status === "no_match") {
    if (CONFIG.RECHECK_NO_MATCH_WITH_OLD_QC && record.qcPolicy !== CONFIG.QC_POLICY) return "";
    if (isRecentlyChecked(record)) return `recent no_match (${record.checkedAt})`;
  }
  return "";
}

function classifyAction(card, record) {
  if (CONFIG.CARD_ID && card.id !== CONFIG.CARD_ID) return null;
  if (CONFIG.FORCE) return record && record.youtubeId ? "review_existing" : "fresh_search";
  if (!record) return "fresh_search";
  if (record.status === "candidate" && record.youtubeId && CONFIG.REVIEW_EXISTING_CANDIDATES_FIRST) return "review_existing";
  if (record.status === "rejected" && CONFIG.RECHECK_REJECTED_WITH_OLD_QC && record.qcPolicy !== CONFIG.QC_POLICY) return record.youtubeId || record.bestYoutubeId ? "review_existing_or_search" : "fresh_search";
  if (record.status === "no_match" && CONFIG.RECHECK_NO_MATCH_WITH_OLD_QC && record.qcPolicy !== CONFIG.QC_POLICY) return "fresh_search";
  return null;
}

function getSelectedCards(cards, cardVideos) {
  const validCards = cards.filter((card) => card && card.id);
  const skippedCounts = {};
  const candidates = [];
  const rechecks = [];
  const fresh = [];

  validCards.forEach((card) => {
    const record = cardVideos[card.id];
    const action = classifyAction(card, record);
    if (!action) {
      const reason = shouldSkipRecord(record) || "not actionable";
      skippedCounts[reason] = (skippedCounts[reason] || 0) + 1;
      return;
    }

    if (record && record.status === "candidate") candidates.push({ card, action });
    else if (record && record.status === "rejected") rechecks.push({ card, action });
    else fresh.push({ card, action });
  });

  let ordered = [];
  if (CONFIG.REVIEW_EXISTING_CANDIDATES_FIRST) ordered = ordered.concat(candidates);
  ordered = ordered.concat(rechecks).concat(fresh);

  const selected = ordered.slice(0, Math.max(1, Number(CONFIG.LIMIT || 1)));
  console.log(`Selection scan: totalCards=${validCards.length}, selected=${selected.length}, candidateRecordsAvailable=${candidates.length}, oldRejectedRecheckAvailable=${rechecks.length}, freshCardsAvailable=${fresh.length}`);
  Object.keys(skippedCounts).forEach((reason) => {
    console.log(`  skipped before selection: ${reason} = ${skippedCounts[reason]}`);
  });
  return selected;
}

function getExistingVideoId(record) {
  return record && (record.youtubeId || record.bestYoutubeId || "");
}

function evaluationToLogItem(ev) {
  return {
    videoId: ev.videoId,
    title: ev.title,
    channel: ev.channel,
    score: ev.score,
    decision: ev.decision,
    rejectReason: ev.rejectReason,
    requiredScore: ev.requiredScore,
    isShortButAllowed: ev.isShortButAllowed,
    durationSeconds: ev.durationSeconds,
    reasons: ev.reasons,
    warnings: ev.warnings,
    matched: ev.matched,
    cardSurface: ev.cardSurface,
    embeddable: ev.embeddable,
    privacyStatus: ev.privacyStatus,
    madeForKids: ev.madeForKids,
    statistics: ev.statistics
  };
}

async function processExistingVideo(card, record, apiKey, cardVideos, quotaLog, debugRun) {
  const videoId = getExistingVideoId(record);
  const query = record.query || buildVideoQuery(card);
  console.log(`REVIEW_EXISTING ${card.id}: ${videoId} | ${record.title || record.bestTitle || ""}`);

  const details = await getVideoDetails(apiKey, [videoId], quotaLog, debugRun, "review_existing");
  const usage = countApprovedUsage(cardVideos);
  if (record.status === "approved" && videoId) usage[videoId] = Math.max(0, Number(usage[videoId] || 0) - 1);

  const evaluations = details.map((video) => calculateQuality(card, video, usage));
  const best = chooseBestEvaluation(evaluations);
  const cardLog = {
    cardId: card.id,
    action: "review_existing",
    query,
    inputVideoId: videoId,
    evaluations: evaluations.map(evaluationToLogItem),
    selected: best ? evaluationToLogItem(best) : null
  };
  debugRun.cards.push(cardLog);

  if (best && best.decision === "approved") {
    cardVideos[card.id] = makeVideoRecord(query, best);
    console.log(`APPROVED ${card.id}: score=${best.score} | ${best.title}`);
    return { changed: true, status: "approved" };
  }

  cardVideos[card.id] = makeRejectedRecord(query, best, { reviewedExisting: true });
  console.log(`REJECTED ${card.id}: score=${best ? best.score : 0}; reason=${best ? best.rejectReason : "missing_video_details"} | ${best ? best.title : videoId}`);
  return { changed: true, status: "rejected" };
}

async function processFreshSearch(card, apiKey, cardVideos, quotaLog, debugRun) {
  const estimatedUnits = CONFIG.SEARCH_COST_UNITS + CONFIG.VIDEO_DETAILS_COST_UNITS;
  if (!canSpendQuota(quotaLog, estimatedUnits)) {
    console.log(`STOP quota budget reached: used=${getTodayQuotaUsed(quotaLog)}, budget=${CONFIG.QUOTA_BUDGET_UNITS}`);
    return { changed: false, stopped: true };
  }

  const query = buildVideoQuery(card);
  console.log(`SEARCH ${card.id}: ${query}`);

  const searchItems = await searchYouTube(apiKey, query, quotaLog, debugRun);
  const ids = unique(searchItems.map((item) => item && item.id && item.id.videoId ? item.id.videoId : "").filter(Boolean));
  console.log(`RAW_RESULTS ${card.id}: returned=${searchItems.length}, uniqueVideoIds=${ids.length}`);

  const searchSummary = { returned: searchItems.length, uniqueVideoIds: ids.length };
  const cardLog = {
    cardId: card.id,
    action: "fresh_search",
    query,
    cardSurface: inferCardSurface(card),
    grits: getCardGrits(card),
    rawResultsReturned: searchItems.length,
    uniqueVideoIds: ids.length,
    evaluations: [],
    selected: null
  };

  if (!ids.length) {
    cardVideos[card.id] = makeNoMatchRecord(query, searchSummary);
    cardLog.result = "no_match";
    cardLog.reason = "no_search_results";
    debugRun.cards.push(cardLog);
    console.log(`NO_MATCH ${card.id}: no search results`);
    return { changed: true, status: "no_match" };
  }

  const details = await getVideoDetails(apiKey, ids, quotaLog, debugRun, "fresh_search");
  const usage = countApprovedUsage(cardVideos);
  const evaluations = details.map((video) => calculateQuality(card, video, usage));
  const best = chooseBestEvaluation(evaluations);

  cardLog.detailsReturned = details.length;
  cardLog.evaluations = evaluations.map(evaluationToLogItem);
  cardLog.selected = best ? evaluationToLogItem(best) : null;
  debugRun.cards.push(cardLog);

  console.log(`EVALUATED ${card.id}: details=${details.length}, candidatesLogged=${evaluations.length}`);
  evaluations
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((item, index) => {
      const label = item.decision === "approved" ? "APPROVABLE" : item.rejectReason;
      console.log(`  ${index + 1}. score=${item.score} ${label} | ${item.title}`);
    });

  if (best && best.decision === "approved") {
    cardVideos[card.id] = makeVideoRecord(query, best);
    console.log(`APPROVED ${card.id}: score=${best.score} | ${best.title}`);
    return { changed: true, status: "approved" };
  }

  if (best) {
    cardVideos[card.id] = makeRejectedRecord(query, best, searchSummary);
    console.log(`REJECTED ${card.id}: bestScore=${best.score}; reason=${best.rejectReason}`);
    return { changed: true, status: "rejected" };
  }

  cardVideos[card.id] = makeNoMatchRecord(query, searchSummary);
  console.log(`NO_MATCH ${card.id}: no video details returned`);
  return { changed: true, status: "no_match" };
}

async function processCard(selection, apiKey, cardVideos, quotaLog, debugRun) {
  const card = selection.card;
  const record = cardVideos[card.id];

  if (selection.action === "review_existing" || selection.action === "review_existing_or_search") {
    const videoId = getExistingVideoId(record);
    if (videoId && canSpendQuota(quotaLog, CONFIG.VIDEO_DETAILS_COST_UNITS)) {
      return processExistingVideo(card, record, apiKey, cardVideos, quotaLog, debugRun);
    }
  }

  return processFreshSearch(card, apiKey, cardVideos, quotaLog, debugRun);
}

function cleanupApprovedDuplicates(cardVideos, debugRun) {
  const groups = {};
  Object.keys(cardVideos || {}).forEach((cardId) => {
    const record = cardVideos[cardId];
    if (record && record.status === "approved" && record.youtubeId) {
      if (!groups[record.youtubeId]) groups[record.youtubeId] = [];
      groups[record.youtubeId].push({ cardId, record });
    }
  });

  let demoted = 0;
  Object.keys(groups).forEach((videoId) => {
    const items = groups[videoId];
    if (items.length <= CONFIG.MAX_APPROVALS_PER_VIDEO_ID) return;

    const sorted = items.slice().sort((a, b) => {
      const scoreA = Number(a.record.qualityScore || a.record.score || 0);
      const scoreB = Number(b.record.qualityScore || b.record.score || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return String(a.cardId).localeCompare(String(b.cardId));
    });

    sorted.slice(CONFIG.MAX_APPROVALS_PER_VIDEO_ID).forEach((item) => {
      const old = item.record;
      cardVideos[item.cardId] = {
        status: "rejected",
        query: old.query || "",
        bestYoutubeId: old.youtubeId,
        bestTitle: old.title || "",
        bestChannel: old.channel || "",
        bestScore: Number(old.qualityScore || old.score || 0),
        rejectReason: "duplicate_video_usage_cap_cleanup",
        reasons: old.reasons || [],
        warnings: [...(old.warnings || []), `duplicate_cleanup:max_${CONFIG.MAX_APPROVALS_PER_VIDEO_ID}`],
        checkedAt: todayKey(),
        source: old.source || "youtube_api",
        qcPolicy: CONFIG.QC_POLICY
      };
      debugRun.duplicateCleanup.push({
        cardId: item.cardId,
        videoId,
        title: old.title || "",
        score: Number(old.qualityScore || old.score || 0),
        action: "demoted_to_rejected"
      });
      demoted += 1;
    });
  });

  if (demoted) {
    console.log(`DUPLICATE_CLEANUP demoted=${demoted}; max approvals per video=${CONFIG.MAX_APPROVALS_PER_VIDEO_ID}`);
  }
  return demoted;
}

function printRunConfig(selected, quotaLog, debugRun) {
  console.log("YouTube card video enrichment with automatic quality review");
  console.log(`Run ID: ${debugRun.runId}`);
  console.log(`Cards selected: ${selected.length}`);
  console.log(`Mode: ${CONFIG.WRITE ? "write" : "dry-run"}`);
  console.log(`Limit: ${CONFIG.LIMIT}`);
  console.log(`Card ID: ${CONFIG.CARD_ID || "all/actionable"}`);
  console.log(`Decision policy: approve >= ${CONFIG.AUTO_APPROVE_MIN_SCORE}; otherwise rejected/no_match`);
  console.log(`QC policy: ${CONFIG.QC_POLICY}; sales/competitor terms = score penalty; short videos 45-74 sec = penalty + score >= ${CONFIG.SHORT_VIDEO_AUTO_APPROVE_MIN_SCORE}`);
  console.log(`Max approvals per video: ${CONFIG.MAX_APPROVALS_PER_VIDEO_ID}`);
  console.log(`Delay: ${CONFIG.DELAY_MS}ms`);
  console.log(`Max results per card: ${CONFIG.MAX_RESULTS_PER_CARD}`);
  console.log(`Debug log: ${CONFIG.DEBUG_LOG_PATH}`);
  console.log(`Quota used today: ${getTodayQuotaUsed(quotaLog)}/${CONFIG.QUOTA_BUDGET_UNITS}`);
}

async function main() {
  loadEnv();
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY. Add it to .env locally or GitHub Actions secrets for workflow use.");
  }

  const cards = readJson(SOLUTION_CARDS_PATH, []);
  if (!Array.isArray(cards)) throw new Error("data/solution-cards.json must be a JSON array.");

  const cardVideos = readJson(CARD_VIDEOS_PATH, {});
  if (!cardVideos || Array.isArray(cardVideos) || typeof cardVideos !== "object") {
    throw new Error("data/card-videos.json must be a JSON object keyed by card id.");
  }

  const quotaLog = loadQuotaLog();
  const selected = getSelectedCards(cards, cardVideos);
  const debugRun = {
    runId: makeRunId(),
    startedAt: new Date().toISOString(),
    qcPolicy: CONFIG.QC_POLICY,
    configSnapshot: {
      limit: CONFIG.LIMIT,
      quotaBudgetUnits: CONFIG.QUOTA_BUDGET_UNITS,
      maxResultsPerCard: CONFIG.MAX_RESULTS_PER_CARD,
      autoApproveMinScore: CONFIG.AUTO_APPROVE_MIN_SCORE,
      maxApprovalsPerVideoId: CONFIG.MAX_APPROVALS_PER_VIDEO_ID,
      shortVideoAutoApproveMinScore: CONFIG.SHORT_VIDEO_AUTO_APPROVE_MIN_SCORE,
      minHardVideoSeconds: CONFIG.MIN_HARD_VIDEO_SECONDS,
      shortVideoPenaltySeconds: CONFIG.SHORT_VIDEO_PENALTY_SECONDS,
      shortVideoScorePenalty: CONFIG.SHORT_VIDEO_SCORE_PENALTY,
      salesPenalty: CONFIG.SALES_PENALTY,
      strongSalesPenalty: CONFIG.STRONG_SALES_PENALTY,
      competitorContextPenalty: CONFIG.COMPETITOR_CONTEXT_PENALTY
    },
    quotaAtStart: getTodayQuotaUsed(quotaLog),
    selectedCardIds: selected.map((item) => item.card.id),
    apiCalls: [],
    cards: [],
    duplicateCleanup: [],
    summary: {}
  };

  printRunConfig(selected, quotaLog, debugRun);

  const originalVideos = JSON.stringify(cardVideos);
  const originalQuota = JSON.stringify(quotaLog);
  let changedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let noMatchCount = 0;
  let stopped = false;

  for (const item of selected) {
    const result = await processCard(item, apiKey, cardVideos, quotaLog, debugRun);
    if (result.changed) changedCount += 1;
    if (result.status === "approved") approvedCount += 1;
    if (result.status === "rejected") rejectedCount += 1;
    if (result.status === "no_match") noMatchCount += 1;
    if (result.stopped) {
      stopped = true;
      break;
    }
    await sleep(CONFIG.DELAY_MS);
  }

  const duplicateCleanupCount = cleanupApprovedDuplicates(cardVideos, debugRun);
  if (duplicateCleanupCount) {
    changedCount += duplicateCleanupCount;
    rejectedCount += duplicateCleanupCount;
  }

  debugRun.finishedAt = new Date().toISOString();
  debugRun.quotaAtEnd = getTodayQuotaUsed(quotaLog);
  debugRun.summary = {
    changed: changedCount,
    approved: approvedCount,
    rejected: rejectedCount,
    no_match: noMatchCount,
    duplicate_cleanup: duplicateCleanupCount,
    stopped
  };

  const updatedVideos = JSON.stringify(cardVideos);
  const updatedQuota = JSON.stringify(quotaLog);

  if (CONFIG.WRITE && updatedVideos !== originalVideos) {
    writeJson(CARD_VIDEOS_PATH, cardVideos);
    console.log(`Written: ${path.relative(ROOT_DIR, CARD_VIDEOS_PATH)}`);
  } else if (!CONFIG.WRITE && updatedVideos !== originalVideos) {
    console.log("Dry run only. Set CONFIG.WRITE = true to save data/card-videos.json.");
  }

  if (CONFIG.WRITE && updatedQuota !== originalQuota) {
    writeJson(QUOTA_LOG_PATH, quotaLog);
    console.log(`Written: ${path.relative(ROOT_DIR, QUOTA_LOG_PATH)}`);
  }

  if (CONFIG.WRITE) {
    writeJson(DEBUG_LOG_PATH, debugRun);
    console.log(`Written: ${path.relative(ROOT_DIR, DEBUG_LOG_PATH)}`);
  }

  console.log(`Summary: changed=${changedCount}, approved=${approvedCount}, rejected=${rejectedCount}, no_match=${noMatchCount}, duplicate_cleanup=${duplicateCleanupCount}, stopped=${stopped}`);
  console.log(`Quota used today: ${getTodayQuotaUsed(quotaLog)}/${CONFIG.QUOTA_BUDGET_UNITS}`);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
});
