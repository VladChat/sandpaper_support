(function (root, factory) {
  const api = factory();
  root.eQualleSearchCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const WEAK_TERMS = {
    sandpaper: true,
    sanding: true,
    sand: true,
    paper: true,
    grit: true,
    grits: true,
    abrasive: true,
    sheet: true,
    sheets: true,
    help: true,
    guide: true,
    use: true,
    using: true,
    problem: true,
    issue: true,
    need: true,
    want: true,
    for: true,
    with: true,
    after: true,
    before: true,
    and: true,
    or: true,
    to: true,
    the: true,
    a: true,
    an: true,
    me: true,
    my: true,
    too: true,
    where: true,
    how: true,
    why: true,
    what: true,
    which: true,
    when: true,
    can: true,
    do: true,
    does: true,
    should: true,
    is: true,
  };

  const SUPPORTED_GRITS = {
    60: true, 80: true, 100: true, 120: true, 150: true, 180: true, 220: true, 240: true,
    280: true, 320: true, 360: true, 400: true, 500: true, 600: true, 800: true, 1000: true,
    1200: true, 1500: true, 2000: true, 3000: true,
  };

  const QUESTION_STARTERS = {
    how: true,
    why: true,
    what: true,
    which: true,
    can: true,
    should: true,
    where: true,
    when: true,
    do: true,
    does: true,
    is: true,
  };

  const GENERIC_SUGGESTION_STARTERS = {
    sandpaper: true,
    sanding: true,
    abrasive: true,
    abrasives: true,
  };

  const LOW_VALUE_QUERY_TERMS = {
    there: true,
    this: true,
    that: true,
    these: true,
    those: true,
    small: true,
    smaller: true,
    size: true,
    sizes: true,
    get: true,
    have: true,
    has: true,
    any: true,
    some: true,
    one: true,
    ones: true,
    item: true,
    items: true,
    i: true,
    sheet: true,
    sheets: true,
  };

  const TYPO_NORMALIZATION = {
    snd: "sand",
    sanderpaper: "sandpaper",
    sandpapr: "sandpaper",
    sandpapaer: "sandpaper",
    sandpper: "sandpaper",
    wich: "which",
    wihch: "which",
    wht: "what",
    wat: "what",
    shoud: "should",
    shuld: "should",
    doesent: "does",
    dos: "does",
    nxt: "next",
    nezt: "next",
    gritt: "grit",
    gritd: "grit",
    clogd: "clogged",
    clogg: "clog",
    scrtch: "scratch",
    scrach: "scratch",
    hazey: "haze",
  };

  const SYNONYM_GROUPS = [
    ["sand", "sanding", "sandpaper", "abrasive", "abrasives"],
    ["clog", "clogs", "clogged", "clogging", "loaded", "loading", "gummed", "gum"],
    ["scratch", "scratches", "mark", "marks", "gouge", "gouges", "swirl", "swirls"],
    ["haze", "hazy", "cloudy", "dull", "foggy", "milky"],
    ["tear", "tears", "rip", "rips", "ripped", "fray", "frays"],
    ["wet", "water", "slurry"],
    ["dry", "dust"],
    ["grit", "grits", "grade", "sequence", "progression", "step"],
    ["wood", "hardwood", "softwood"],
    ["paint", "primer", "coating", "finish"],
    ["clearcoat", "clear", "coat", "clear coat"],
    ["plastic", "vinyl"],
    ["metal", "rust", "oxidation"],
    ["polish", "polishing", "gloss", "shine"],
    ["remove", "removal", "strip", "stripping"],
  ];

  const BLOCKED_SUGGESTION_IDS = { "search-how-to-use-80-to-3000-grit-sandpaper": true };
  const BLOCKED_SUGGESTION_TITLES = { "how to use 60 to 3000 grit sandpaper": true };

  const INTENT_ORDER = [
    "buy_intent",
    "product_intent",
    "problem_intent",
    "surface_intent",
    "grit_intent",
    "general_support",
  ];

  const BUY_TERMS = [
    "buy",
    "order",
    "purchase",
    "price",
    "prices",
    "cost",
    "shop",
    "store",
    "stores",
    "amazon",
    "walmart",
    "online",
    "available",
    "availability",
    "sale",
  ];

  const PRODUCT_TERMS = ["kit", "assorted", "assortment", "pack", "product", "equalle", "9x11"];
  const SURFACE_TERMS = [
    "wood",
    "paint",
    "primer",
    "clear coat",
    "clearcoat",
    "metal",
    "plastic",
    "drywall",
    "finish",
    "coating",
    "automotive",
  ];
  const PROBLEM_TERMS = [
    "clog",
    "clogs",
    "clogging",
    "loaded",
    "loading",
    "gums",
    "gummed",
    "scratches",
    "scratch",
    "marks",
    "swirl",
    "haze",
    "hazy",
    "rough",
    "tears",
    "ripped",
    "residue",
    "slow",
    "uneven",
    "dull",
    "cloudy",
    "white",
  ];

  function clean(value) {
    return String(value || "").toLowerCase();
  }

  function inferResultKind(targetUrl) {
    const url = clean(targetUrl || "");
    if (url.indexOf("/problems/") === 0 || url.indexOf("/solutions/") === 0) {
      return "answer";
    }
    if (url.indexOf("/surfaces/") === 0 || url === "/how-to/") {
      return "guide";
    }
    if (url.indexOf("/tools/") === 0) {
      return "tool";
    }
    if (url.indexOf("/products/") === 0) {
      return "product";
    }
    return "guide";
  }

  function normalizeSuggestionToken(token) {
    const normalized = clean(token).trim();
    if (!normalized) {
      return "";
    }
    return TYPO_NORMALIZATION[normalized] || normalized;
  }

  function uniqueValues(values) {
    const seen = {};
    const result = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      const normalized = String(value || "").trim();
      if (!normalized || seen[normalized]) {
        return;
      }
      seen[normalized] = true;
      result.push(normalized);
    });
    return result;
  }

  function normalizeList(values) {
    return uniqueValues((Array.isArray(values) ? values : [])
      .map(function (value) {
        return clean(value).trim();
      })
      .filter(Boolean));
  }

  function normalizeQuery(query) {
    return clean(query)
      .replace(/[\u2018\u2019']/g, "")
      .replace(/[-_/]+/g, " ")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeSmartText(text) {
    return normalizeQuery(text)
      .split(/\s+/)
      .map(function (token) {
        return normalizeSuggestionToken(token);
      })
      .filter(Boolean);
  }

  function expandTerms(terms) {
    const seedTerms = (Array.isArray(terms) ? terms : [])
      .map(function (term) {
        return normalizeSuggestionToken(term);
      })
      .filter(Boolean);

    const expanded = seedTerms.slice();

    seedTerms.forEach(function (term) {
      SYNONYM_GROUPS.forEach(function (group) {
        const groupTokens = [];
        group.forEach(function (item) {
          tokenizeSmartText(item).forEach(function (token) {
            groupTokens.push(token);
          });
        });

        if (groupTokens.indexOf(term) !== -1) {
          groupTokens.forEach(function (token) {
            expanded.push(token);
          });
        }
      });
    });

    return uniqueValues(expanded);
  }

  function editDistance(a, b) {
    const left = String(a || "");
    const right = String(b || "");

    if (left === right) {
      return 0;
    }
    if (!left.length) {
      return right.length;
    }
    if (!right.length) {
      return left.length;
    }

    const dp = Array(left.length + 1);
    for (let i = 0; i <= left.length; i += 1) {
      dp[i] = Array(right.length + 1).fill(0);
      dp[i][0] = i;
    }
    for (let j = 0; j <= right.length; j += 1) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }

    return dp[left.length][right.length];
  }

  function fuzzyTokenMatch(a, b) {
    const left = normalizeSuggestionToken(a);
    const right = normalizeSuggestionToken(b);

    if (!left || !right) {
      return false;
    }

    if (left === right) {
      return true;
    }

    if (left.length >= 3 && right.length >= 3) {
      if (left.indexOf(right) === 0 || right.indexOf(left) === 0) {
        return true;
      }
    }

    const longest = Math.max(left.length, right.length);
    const distance = editDistance(left, right);

    if (longest >= 7) {
      return distance <= 2;
    }

    if (longest >= 4 && longest <= 6) {
      return distance <= 1;
    }

    return false;
  }

  function textMatchesTerm(text, term) {
    const tokens = tokenizeSmartText(text);
    const target = normalizeSuggestionToken(term);
    if (!target) {
      return false;
    }

    return tokens.some(function (token) {
      return fuzzyTokenMatch(token, target);
    });
  }

  function suggestionToSearchResult(suggestion, score, intent) {
    return {
      id: suggestion.id,
      type: suggestion.type || "question_suggestion",
      title: suggestion.title || "",
      description: suggestion.description || "",
      target_url: suggestion.target_url || "",
      result_kind: suggestion.result_kind || inferResultKind(suggestion.target_url || ""),
      search_score: score,
      search_strong: score >= 120,
      search_intent: intent || "smart_suggestion",
    };
  }

  function containsAnyPhrase(query, phrases) {
    return phrases.some(function (phrase) {
      return query.indexOf(phrase) !== -1;
    });
  }

  function tokenizeQuery(query) {
    const normalized = normalizeQuery(query);
    const allTerms = normalized ? normalized.split(" ") : [];
    const gritNumbers = allTerms.filter(function (term) {
      return /^\d{2,4}$/.test(term);
    });
    const meaningfulTerms = allTerms.filter(function (term) {
      if (!term || WEAK_TERMS[term]) {
        return false;
      }
      if (/^\d{2,4}$/.test(term)) {
        return true;
      }
      return term.length > 1;
    });

    const expandedMeaningfulTerms = meaningfulTerms.slice();
    meaningfulTerms.forEach(function (term) {
      if (term === "clogging") {
        expandedMeaningfulTerms.push("clog");
      }
      if (term.endsWith("ing") && term.length > 5) {
        expandedMeaningfulTerms.push(term.replace(/ing$/, ""));
      }
    });

    const phraseFlags = {
      hasNearMe: normalized.indexOf("near me") !== -1,
      hasWhereToBuy: normalized.indexOf("where to buy") !== -1,
      hasWhatGrit: normalized.indexOf("what grit") !== -1 || normalized.indexOf("which grit") !== -1,
      hasVs: /\bvs\b|\bversus\b/.test(normalized),
      hasNotCutting: normalized.indexOf("not cutting") !== -1,
      hasTurnsWhite: normalized.indexOf("turns white") !== -1,
      hasSequence: normalized.indexOf("grit sequence") !== -1 || normalized.indexOf("progression") !== -1,
      hasBuilder: normalized.indexOf("builder") !== -1,
    };

    return {
      normalizedQuery: normalized,
      allTerms: allTerms,
      meaningfulTerms: expandedMeaningfulTerms,
      gritNumbers: gritNumbers,
      phraseFlags: phraseFlags,
      queryLength: normalized.length,
      wordCount: allTerms.length,
    };
  }

  function detectIntent(context) {
    const query = context.normalizedQuery;
    const terms = context.allTerms;
    const phraseFlags = context.phraseFlags;
    const intents = [];

    const hasBuyPhrase =
      phraseFlags.hasNearMe ||
      phraseFlags.hasWhereToBuy ||
      containsAnyPhrase(query, ["for sale"]) ||
      terms.some(function (term) {
        return BUY_TERMS.indexOf(term) !== -1;
      });

    const hasProductPhrase =
      containsAnyPhrase(query, ["60 3000", "60-3000"]) ||
      terms.some(function (term) {
        return PRODUCT_TERMS.indexOf(term) !== -1;
      });

    const hasProblemPhrase =
      phraseFlags.hasNotCutting ||
      phraseFlags.hasTurnsWhite ||
      terms.some(function (term) {
        return PROBLEM_TERMS.indexOf(term) !== -1;
      });

    const hasSurfacePhrase =
      terms.some(function (term) {
        return SURFACE_TERMS.indexOf(term) !== -1;
      }) ||
      containsAnyPhrase(query, ["clear coat", "paint primer"]);

    const hasGritPhrase =
      phraseFlags.hasWhatGrit ||
      phraseFlags.hasVs ||
      phraseFlags.hasSequence ||
      phraseFlags.hasBuilder ||
      containsAnyPhrase(query, ["next grit", "grit sequence", "grit progression"]) ||
      (context.gritNumbers.length > 0 &&
        (query.indexOf("grit") !== -1 || query.indexOf("after") !== -1 || query.indexOf("before") !== -1));

    if (hasBuyPhrase) {
      intents.push("buy_intent");
    }
    if (hasProductPhrase) {
      intents.push("product_intent");
    }
    if (hasProblemPhrase) {
      intents.push("problem_intent");
    }
    if (hasSurfacePhrase) {
      intents.push("surface_intent");
    }
    if (hasGritPhrase) {
      intents.push("grit_intent");
    }

    if (!intents.length) {
      intents.push("general_support");
    }

    intents.sort(function (a, b) {
      return INTENT_ORDER.indexOf(a) - INTENT_ORDER.indexOf(b);
    });

    return {
      mainIntent: intents[0],
      secondaryIntents: intents.slice(1),
      allIntents: intents,
    };
  }

  function classifyEntry(entry) {
    const targetUrl = clean(entry.target_url || entry.targetUrl || "");
    const type = clean(entry.type || "");
    const title = clean(entry.title || "");
    let category = "general";

    if (type === "product_support" || targetUrl.indexOf("/products/") === 0) {
      category = "product";
    } else if (targetUrl.indexOf("/tools/") === 0 || type === "tool") {
      category = "tools";
    } else if (
      type.indexOf("grit") !== -1 ||
      targetUrl.indexOf("/grits/") === 0 ||
      title.indexOf("grit sequence") !== -1 ||
      title.indexOf("progression") !== -1 ||
      title.indexOf(" vs ") !== -1
    ) {
      category = "grit";
    } else if (targetUrl.indexOf("/problems/") === 0) {
      category = "problem";
    } else if (targetUrl.indexOf("/solutions/") === 0) {
      category = "solution";
    } else if (targetUrl.indexOf("/surfaces/") === 0) {
      category = "surface";
    }

    return {
      entry: entry,
      category: category,
      type: type,
      targetUrl: targetUrl,
      title: clean(entry.title || ""),
      description: clean(entry.description || ""),
      customerPhrases: normalizeList(entry.customer_phrases),
      aliases: normalizeList(entry.aliases),
      surfaces: normalizeList(entry.surface),
      grits: normalizeList(entry.grits),
      methods: normalizeList(entry.method),
    };
  }

  function isBlockedFallbackEntry(entry) {
    const id = clean(entry && entry.id);
    const title = clean(entry && entry.title);
    return Boolean(BLOCKED_SUGGESTION_IDS[id] || BLOCKED_SUGGESTION_TITLES[title]);
  }

  function hasSurfaceSignal(context) {
    const q = context.normalizedQuery;
    const hasSurface = SURFACE_TERMS.some(function (term) {
      return q.indexOf(term) !== -1;
    });
    const hasSandingSignal = /\bsand|\bsanding|\bwet\b|\bdry\b/.test(q);
    return hasSurface || hasSandingSignal;
  }

  function hasProblemSignal(context) {
    const q = context.normalizedQuery;
    return PROBLEM_TERMS.some(function (term) {
      return q.indexOf(term) !== -1;
    });
  }

  function hasGritIntentSignal(context) {
    const q = context.normalizedQuery;
    const gritHit = context.gritNumbers.some(function (num) {
      return Boolean(SUPPORTED_GRITS[String(num)]);
    });
    return (
      gritHit ||
      q.indexOf("what grit") !== -1 ||
      q.indexOf("which grit") !== -1 ||
      q.indexOf("next grit") !== -1 ||
      q.indexOf("grit after") !== -1 ||
      (q.indexOf("after ") !== -1 && q.indexOf("grit") !== -1)
    );
  }

  function filterEntriesByIntent(intentContext, classified, queryContext) {
    const mainIntent = intentContext.mainIntent;
    const sequenceAsked = queryContext.phraseFlags.hasSequence || queryContext.phraseFlags.hasBuilder;

    if (mainIntent === "buy_intent") {
      if (classified.category === "product") {
        const buySignals = BUY_TERMS.concat(["where to buy", "for sale", "near me"]);
        const haystack = [classified.title, classified.description]
          .concat(classified.customerPhrases)
          .concat(classified.aliases)
          .join(" ");
        const isBuyRelevant = buySignals.some(function (signal) {
          return haystack.indexOf(signal) !== -1;
        });
        if (isBuyRelevant || classified.targetUrl === "/products/") {
          return true;
        }
      }
      if (classified.category === "tools" && sequenceAsked && !queryContext.phraseFlags.hasWhereToBuy) {
        return true;
      }
      return false;
    }

    if (mainIntent === "product_intent") {
      return classified.category === "product" || classified.category === "tools" || classified.category === "grit";
    }

    if (mainIntent === "problem_intent") {
      return (
        classified.type === "exact_scenario" ||
        classified.category === "problem" ||
        classified.category === "solution" ||
        classified.category === "surface"
      );
    }

    if (mainIntent === "surface_intent") {
      return (
        classified.category === "surface" ||
        classified.category === "problem" ||
        classified.category === "solution" ||
        classified.category === "product"
      );
    }

    if (mainIntent === "grit_intent") {
      return (
        classified.category === "grit" ||
        classified.category === "tools" ||
        classified.category === "solution" ||
        classified.category === "product" ||
        classified.category === "problem" ||
        classified.category === "surface"
      );
    }

    return true;
  }

  function hasPrefixWord(haystack, query) {
    if (!query) {
      return false;
    }
    return haystack.some(function (text) {
      if (!text) {
        return false;
      }
      if (text.indexOf(query) === 0) {
        return true;
      }
      return text.split(/\s+/).some(function (word) {
        return word.indexOf(query) === 0;
      });
    });
  }

  function scoreEntry(classified, queryContext, intentContext) {
    const query = queryContext.normalizedQuery;
    const meaningfulTerms = queryContext.meaningfulTerms;
    const multiWord = queryContext.wordCount > 1;
    const shortQuery = query.length >= 3 && query.length <= 4;
    let score = 0;
    let meaningfulSignals = 0;
    let exactPhraseMatch = false;
    let strongSignal = false;
    let descriptionOnly = false;

    if (shortQuery) {
      const shortMatch =
        hasPrefixWord([classified.title], query) ||
        hasPrefixWord(classified.customerPhrases, query) ||
        hasPrefixWord(classified.aliases, query) ||
        hasPrefixWord(classified.surfaces, query) ||
        hasPrefixWord(classified.grits, query);
      if (!shortMatch) {
        return null;
      }
      score += 35;
      strongSignal = true;
      meaningfulSignals += 1;
    }

    if (classified.title.indexOf(query) !== -1) {
      score += 120;
      exactPhraseMatch = true;
      strongSignal = true;
      meaningfulSignals += 1;
    }
    if (classified.customerPhrases.some(function (phrase) { return phrase.indexOf(query) !== -1; })) {
      score += 110;
      exactPhraseMatch = true;
      strongSignal = true;
      meaningfulSignals += 1;
    }
    if (classified.aliases.some(function (alias) { return alias.indexOf(query) !== -1; })) {
      score += 95;
      exactPhraseMatch = true;
      strongSignal = true;
      meaningfulSignals += 1;
    }

    meaningfulTerms.forEach(function (term) {
      let matched = false;
      if (classified.title.indexOf(term) !== -1) {
        score += 20;
        matched = true;
      }
      if (classified.customerPhrases.some(function (phrase) { return phrase.indexOf(term) !== -1; })) {
        score += 18;
        matched = true;
      }
      if (classified.aliases.some(function (alias) { return alias.indexOf(term) !== -1; })) {
        score += 16;
        matched = true;
      }
      if (classified.surfaces.indexOf(term) !== -1) {
        score += 12;
        matched = true;
      }
      if (classified.methods.indexOf(term) !== -1) {
        score += 8;
        matched = true;
      }
      if (
        queryContext.gritNumbers.indexOf(term) !== -1 &&
        classified.grits.indexOf(term) !== -1 &&
        ["grit_intent", "product_intent", "buy_intent"].indexOf(intentContext.mainIntent) !== -1
      ) {
        score += 10;
        matched = true;
      }
      if (!matched && classified.description.indexOf(term) !== -1) {
        score += 2;
        descriptionOnly = true;
      }
      if (matched) {
        meaningfulSignals += 1;
      }
    });

    if (intentContext.mainIntent === "buy_intent" && (classified.category === "problem" || classified.category === "solution")) {
      return null;
    }

    if (intentContext.mainIntent === "problem_intent" && classified.type === "exact_scenario") {
      score += 12;
    }
    if (["buy_intent", "product_intent"].indexOf(intentContext.mainIntent) !== -1) {
      if (classified.type === "product_support") {
        score += 45;
      }
      if (classified.targetUrl.indexOf("/products/") === 0) {
        score += 60;
      }
    }
    if (
      (queryContext.phraseFlags.hasSequence || queryContext.phraseFlags.hasBuilder) &&
      classified.targetUrl.indexOf("/tools/grit-sequence-builder/") === 0
    ) {
      score += 45;
    }

    if (classified.category === intentContext.mainIntent.replace("_intent", "")) {
      score += 50;
    } else if (
      (intentContext.mainIntent === "buy_intent" && classified.category !== "product") ||
      (intentContext.mainIntent === "problem_intent" && ["product", "tools"].indexOf(classified.category) !== -1) ||
      (intentContext.mainIntent === "grit_intent" && classified.category === "problem")
    ) {
      score -= 80;
    }

    intentContext.secondaryIntents.forEach(function (intent) {
      const key = intent.replace("_intent", "");
      if (classified.category === key) {
        score += 18;
      }
    });

    if (!strongSignal && descriptionOnly && meaningfulSignals < 2) {
      return null;
    }
    if (!exactPhraseMatch && meaningfulSignals === 0) {
      return null;
    }
    if (
      multiWord &&
      !exactPhraseMatch &&
      meaningfulSignals < 2 &&
      !(
        meaningfulSignals >= 1 &&
        ["surface_intent", "problem_intent", "grit_intent", "buy_intent", "product_intent"].indexOf(intentContext.mainIntent) !== -1
      )
    ) {
      return null;
    }
    if (score < 35) {
      return null;
    }

    return {
      score: score,
      meaningfulSignals: meaningfulSignals,
      exactPhraseMatch: exactPhraseMatch,
      entry: classified.entry,
      isStrong:
        exactPhraseMatch ||
        score >= 95 ||
        (meaningfulSignals >= 2 &&
          (intentContext.mainIntent === "problem_intent" ||
            intentContext.mainIntent === "buy_intent" ||
            intentContext.mainIntent === "grit_intent")),
    };
  }

  function scoreSuggestion(suggestion, queryContext, starter) {
    const query = queryContext.normalizedQuery;
    const expandedTerms = queryContext.expandedTerms || [];
    const usefulNonStarterTerms = queryContext.usefulNonStarterTerms || [];
    const isStarterQuery = Boolean(starter && QUESTION_STARTERS[starter]);
    const isMultiWordStarterQuery = Boolean(isStarterQuery && queryContext.wordCount > 1);
    const title = String(suggestion.title || "");
    const aliases = Array.isArray(suggestion.aliases) ? suggestion.aliases : [];
    const keywords = Array.isArray(suggestion.keywords) ? suggestion.keywords : [];
    const description = String(suggestion.description || "");
    const suggestionStarter = normalizeSuggestionToken(suggestion.question_word || "");

    let score = Number(suggestion.priority || 0) / 10;

    const normalizedTitle = normalizeQuery(title);
    const normalizedDescription = normalizeQuery(description);
    const normalizedAliases = aliases.map(function (item) { return normalizeQuery(item); }).filter(Boolean);
    const normalizedKeywords = keywords.map(function (item) { return normalizeSuggestionToken(item); }).filter(Boolean);

    if (query && normalizedTitle.indexOf(query) !== -1) {
      score += 120;
    }
    if (query && normalizedAliases.some(function (item) { return item.indexOf(query) !== -1; })) {
      score += 100;
    }
    if (query && normalizedKeywords.indexOf(normalizeSuggestionToken(query)) !== -1) {
      score += 70;
    }
    if (query && normalizedDescription.indexOf(query) !== -1) {
      score += 35;
    }

    expandedTerms.forEach(function (term) {
      if (!term) {
        return;
      }
      if (textMatchesTerm(title, term)) {
        score += 25;
      }
      if (aliases.some(function (alias) { return textMatchesTerm(alias, term); })) {
        score += 20;
      }
      if (normalizedKeywords.some(function (keyword) { return fuzzyTokenMatch(keyword, term); })) {
        score += 18;
      }
      if (textMatchesTerm(description, term)) {
        score += 6;
      }
    });

    if (starter) {
      if (suggestionStarter === starter) {
        score += 120;
      } else {
        score -= 80;
      }
    }

    let matchedNonStarterTerms = 0;
    let strongNonStarterMatches = 0;
    let weakNonStarterMatches = 0;

    if (isMultiWordStarterQuery) {
      const matchedTerms = {};

      usefulNonStarterTerms.forEach(function (term) {
        if (!term) {
          return;
        }
        const titleMatch = textMatchesTerm(title, term);
        const aliasMatch = aliases.some(function (alias) { return textMatchesTerm(alias, term); });
        const keywordMatch = normalizedKeywords.some(function (keyword) { return fuzzyTokenMatch(keyword, term); });
        const descriptionMatch = textMatchesTerm(description, term);

        if (!(titleMatch || aliasMatch || keywordMatch || descriptionMatch)) {
          return;
        }

        matchedTerms[term] = true;
        if (titleMatch || aliasMatch || keywordMatch) {
          strongNonStarterMatches += 1;
        } else if (descriptionMatch) {
          weakNonStarterMatches += 1;
        }
      });

      matchedNonStarterTerms = Object.keys(matchedTerms).length;
      if (!matchedNonStarterTerms) {
        return null;
      }

      if (usefulNonStarterTerms.length >= 3 && !(strongNonStarterMatches >= 1 || weakNonStarterMatches >= 2)) {
        return null;
      }
    }

    return {
      score: score,
      matchedNonStarterTerms: matchedNonStarterTerms,
      strongNonStarterMatches: strongNonStarterMatches,
      weakNonStarterMatches: weakNonStarterMatches,
    };
  }

  function rankSuggestionEntries(suggestionEntries, queryContext, maxResults) {
    const suggestions = Array.isArray(suggestionEntries) ? suggestionEntries : [];
    const queryTerms = (queryContext.allTerms || [])
      .map(function (term) { return normalizeSuggestionToken(term); })
      .filter(Boolean);
    const starter = queryTerms[0] || "";
    const isMultiWordStarterQuery = queryTerms.length > 1 && QUESTION_STARTERS[starter];
    const nonStarterTerms = queryTerms.filter(function (term) {
      return !QUESTION_STARTERS[term];
    });
    const usefulNonStarterTerms = nonStarterTerms.filter(function (term) {
      return !LOW_VALUE_QUERY_TERMS[term];
    });
    const expandedTerms = isMultiWordStarterQuery ? expandTerms(nonStarterTerms) : expandTerms(queryTerms);
    const normalizedQuery = queryContext.normalizedQuery;

    if (!suggestions.length || !queryTerms.length) {
      return [];
    }

    function sortByPriorityDesc(left, right) {
      return Number(right.priority || 0) - Number(left.priority || 0);
    }

    if (queryTerms.length === 1 && QUESTION_STARTERS[starter]) {
      return suggestions
        .filter(function (suggestion) {
          return normalizeSuggestionToken(suggestion.question_word) === starter;
        })
        .sort(sortByPriorityDesc)
        .slice(0, maxResults)
        .map(function (suggestion, index) {
          return suggestionToSearchResult(
            suggestion,
            300 - index * 3 + Number(suggestion.priority || 0) / 10,
            "starter_suggestion",
          );
        });
    }

    if (queryTerms.length === 1 && GENERIC_SUGGESTION_STARTERS[starter]) {
      return suggestions
        .filter(function (suggestion) {
          return normalizeSuggestionToken(suggestion.question_word) === "sandpaper";
        })
        .sort(sortByPriorityDesc)
        .slice(0, maxResults)
        .map(function (suggestion, index) {
          return suggestionToSearchResult(
            suggestion,
            290 - index * 3 + Number(suggestion.priority || 0) / 10,
            "generic_suggestion",
          );
        });
    }

    if (isMultiWordStarterQuery && !usefulNonStarterTerms.length) {
      return [];
    }

    const hasSandpaperSignal =
      queryTerms.some(function (term) { return GENERIC_SUGGESTION_STARTERS[term]; }) ||
      expandedTerms.some(function (term) {
        return ["sand", "sanding", "sandpaper", "abrasive", "abrasives"].indexOf(term) !== -1;
      }) ||
      normalizedQuery.indexOf("sand") !== -1;

    const ranked = suggestions
      .map(function (suggestion) {
        const suggestionStarter = normalizeSuggestionToken(suggestion.question_word || "");

        if (suggestionStarter === "sandpaper" && !hasSandpaperSignal && !GENERIC_SUGGESTION_STARTERS[starter]) {
          return null;
        }

        const suggestionContext = Object.assign({}, queryContext, {
          normalizedTerms: queryTerms,
          nonStarterTerms: nonStarterTerms,
          usefulNonStarterTerms: usefulNonStarterTerms,
          expandedTerms: expandedTerms,
        });

        const scoreInfo = scoreSuggestion(suggestion, suggestionContext, starter);
        if (!scoreInfo || scoreInfo.score < 35) {
          return null;
        }

        return {
          suggestion: suggestion,
          score: scoreInfo.score,
          priority: Number(suggestion.priority || 0),
        };
      })
      .filter(Boolean)
      .sort(function (left, right) {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.priority - left.priority;
      });

    const deduped = [];
    const seen = {};
    ranked.forEach(function (row) {
      const key = clean((row.suggestion.target_url || "") + "::" + (row.suggestion.title || ""));
      if (!key || seen[key]) {
        return;
      }
      seen[key] = true;
      deduped.push(suggestionToSearchResult(row.suggestion, row.score, "smart_suggestion"));
    });

    return deduped.slice(0, maxResults);
  }

  function rankIndexEntries(entries, queryContext, intentContext, maxResults) {
    if (!queryContext.normalizedQuery || queryContext.queryLength < 3) {
      return [];
    }

    const ranked = (Array.isArray(entries) ? entries : [])
      .filter(function (entry) {
        return !isBlockedFallbackEntry(entry);
      })
      .map(classifyEntry)
      .filter(function (classified) {
        const shouldPrioritizeGrit = hasGritIntentSignal(queryContext);
        const shouldPrioritizeSurface = hasSurfaceSignal(queryContext);
        const shouldPrioritizeProblem = hasProblemSignal(queryContext);

        if (shouldPrioritizeGrit) {
          if (["grit", "tools", "problem", "solution", "surface", "product"].indexOf(classified.category) === -1) {
            return false;
          }
        } else if (shouldPrioritizeSurface) {
          if (["surface", "problem", "solution", "grit", "tools"].indexOf(classified.category) === -1) {
            return false;
          }
        } else if (shouldPrioritizeProblem) {
          if (["problem", "solution", "surface"].indexOf(classified.category) === -1) {
            return false;
          }
        } else if (intentContext.mainIntent === "general_support") {
          return false;
        }
        return filterEntriesByIntent(intentContext, classified, queryContext);
      })
      .map(function (classified) {
        return scoreEntry(classified, queryContext, intentContext);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return clean(a.entry.title).localeCompare(clean(b.entry.title));
      });

    if (!ranked.length) {
      return [];
    }

    const top = ranked[0].score;
    let candidates = ranked;
    if (ranked.length > 1) {
      const second = ranked[1].score;
      const muchHigher = top >= 220 && second <= top * 0.4;
      if (muchHigher) {
        const clusterCutoff = Math.max(35, top * 0.45);
        candidates = ranked.filter(function (row) {
          return row.score >= clusterCutoff;
        });
      }
    }

    if (intentContext.mainIntent === "buy_intent" || intentContext.mainIntent === "product_intent") {
      const hasSpecificProduct = candidates.some(function (row) {
        const targetUrl = clean(row.entry.target_url || row.entry.targetUrl || "");
        return row.entry && targetUrl !== "/products/" && targetUrl.indexOf("/products/") === 0;
      });
      if (hasSpecificProduct) {
        candidates = candidates.filter(function (row) {
          const targetUrl = clean(row.entry.target_url || row.entry.targetUrl || "");
          const normalizedTitle = clean(row.entry.title || "");
          const isGenericProducts = targetUrl === "/products/" || normalizedTitle === "products";
          return !isGenericProducts;
        });
      }
    }

    return candidates.slice(0, maxResults).map(function (row) {
      const output = Object.assign({}, row.entry);
      output.search_score = row.score;
      output.search_strong = row.isStrong;
      output.search_intent = intentContext.mainIntent;
      output.result_kind = inferResultKind(output.target_url || output.targetUrl || "");
      return output;
    });
  }

  function searchEntries(entries, query, limit, suggestions) {
    const queryContext = tokenizeQuery(query);
    const intentContext = detectIntent(queryContext);
    const maxResults = Math.min(Math.max(limit || 5, 1), 5);
    const suggestionEntries = Array.isArray(suggestions) ? suggestions : [];
    const starter = normalizeSuggestionToken(queryContext.allTerms[0] || "");

    const suggestionResults = rankSuggestionEntries(suggestionEntries, queryContext, maxResults);

    if (queryContext.wordCount === 1 && (QUESTION_STARTERS[starter] || GENERIC_SUGGESTION_STARTERS[starter])) {
      return suggestionResults.slice(0, maxResults);
    }

    if (queryContext.queryLength < 3 && !suggestionResults.length) {
      return [];
    }

    if (!queryContext.meaningfulTerms.length && !queryContext.gritNumbers.length && !suggestionResults.length) {
      return [];
    }

    const rankedEntries = rankIndexEntries(entries, queryContext, intentContext, maxResults);
    if (!rankedEntries.length && !suggestionResults.length) {
      return [];
    }

    const combined = rankedEntries.concat(suggestionResults);
    const deduped = [];
    const seen = {};

    combined
      .sort(function (a, b) {
        const leftScore = Number(a.search_score || 0);
        const rightScore = Number(b.search_score || 0);
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return clean(a.title || "").localeCompare(clean(b.title || ""));
      })
      .forEach(function (item) {
        const key = clean((item.target_url || item.targetUrl || "") + "::" + (item.title || ""));
        if (!key || seen[key]) {
          return;
        }
        seen[key] = true;
        item.result_kind = item.result_kind || inferResultKind(item.target_url || item.targetUrl || "");
        deduped.push(item);
      });

    return deduped.slice(0, maxResults);
  }

  return {
    normalizeQuery: normalizeQuery,
    tokenizeQuery: tokenizeQuery,
    detectIntent: detectIntent,
    classifyEntry: classifyEntry,
    searchEntries: searchEntries,
  };
});
