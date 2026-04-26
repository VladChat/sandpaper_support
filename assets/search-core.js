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
  };
  const SUPPORTED_GRITS = {
    60: true, 80: true, 100: true, 120: true, 150: true, 180: true, 220: true, 240: true,
    280: true, 320: true, 360: true, 400: true, 500: true, 600: true, 800: true, 1000: true,
    1200: true, 1500: true, 2000: true, 3000: true,
  };
  const QUESTION_ONLY = { how: true, why: true, what: true, which: true };
  const POPULAR_QUESTION_SUGGESTIONS = [
    { title: "What grit should I use?", target_url: "/problems/not-sure-what-grit-to-use/", description: "Start with the right grit for your surface and stage." },
    { title: "Why does sandpaper clog?", target_url: "/problems/paper-clogs-too-fast/", description: "Find the main causes of loading and how to prevent it." },
    { title: "How do I sand plastic?", target_url: "/surfaces/plastic/", description: "Plastic-specific sanding guidance and common issues." },
    { title: "Which grit comes next?", target_url: "/tools/grit-sequence-builder/", description: "Use the sequence builder to choose your next grit." },
  ];
  const GENERAL_SANDPAPER_SUGGESTIONS = [
    { title: "Sandpaper Clogs Too Fast", target_url: "/problems/paper-clogs-too-fast/", description: "Dust, paint, finish, or residue loads into the abrasive and stops cutting." },
    { title: "Sandpaper Grit Sequence", target_url: "/tools/grit-sequence-builder/", description: "Recommended grit progression for sanding tasks by surface and goal." },
    { title: "What Grit Should I Use?", target_url: "/problems/not-sure-what-grit-to-use/", description: "Choose a grit based on surface, material removal, prep, or finish sanding." },
    { title: "Sandpaper Tears Early", target_url: "/problems/paper-tears-early/", description: "The sheet rips, catches, or wears through during use." },
    { title: "Scratches Are Too Deep", target_url: "/problems/scratches-too-deep/", description: "Visible sanding marks, gouges, or scratches remain after sanding." },
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

  function normalizeList(values) {
    return (Array.isArray(values) ? values : [])
      .map(function (value) {
        return clean(value).trim();
      })
      .filter(Boolean);
  }

  function pickTop(entries, limit, query) {
    return entries.slice(0, Math.min(Math.max(limit || 5, 1), 5)).map(function (entry) {
      const out = Object.assign({}, entry);
      out.search_score = Number.isFinite(out.search_score) ? out.search_score : 120;
      out.search_strong = out.search_strong !== false;
      out.search_intent = out.search_intent || "general_support";
      if (query) {
        out.search_query = query;
      }
      return out;
    });
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
      q.indexOf("after ") !== -1 && q.indexOf("grit") !== -1
    );
  }

  function questionOnlySuggestions(context, maxResults) {
    if (context.wordCount !== 1 || !QUESTION_ONLY[context.normalizedQuery]) {
      return null;
    }
    return pickTop(
      POPULAR_QUESTION_SUGGESTIONS.map(function (item, index) {
        const row = Object.assign({}, item);
        row.search_score = 200 - index * 5;
        row.search_intent = "question_suggestions";
        row.search_strong = true;
        return row;
      }),
      maxResults,
      context.normalizedQuery,
    );
  }

  function generalSandpaperSuggestions(context, maxResults) {
    const genericQueries = {
      sandpaper: true,
      sanding: true,
      abrasive: true,
      abrasives: true,
    };

    if (context.wordCount !== 1 || !genericQueries[context.normalizedQuery]) {
      return null;
    }

    return pickTop(
      GENERAL_SANDPAPER_SUGGESTIONS.map(function (item, index) {
        const row = Object.assign({}, item);
        row.search_score = 190 - index * 5;
        row.search_intent = "general_sandpaper_suggestions";
        row.search_strong = false;
        return row;
      }),
      maxResults,
      context.normalizedQuery,
    );
  }

  function containsAnyPhrase(query, phrases) {
    return phrases.some(function (phrase) {
      return query.indexOf(phrase) !== -1;
    });
  }

  function normalizeQuery(query) {
    return clean(query)
      .replace(/[\u2018\u2019']/g, "")
      .replace(/[-_/]+/g, " ")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
    const allTexts = [classified.title].concat(classified.customerPhrases).concat(classified.aliases);
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
    if (
      classified.customerPhrases.some(function (phrase) {
        return phrase.indexOf(query) !== -1;
      })
    ) {
      score += 110;
      exactPhraseMatch = true;
      strongSignal = true;
      meaningfulSignals += 1;
    }
    if (
      classified.aliases.some(function (alias) {
        return alias.indexOf(query) !== -1;
      })
    ) {
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
      if (
        classified.customerPhrases.some(function (phrase) {
          return phrase.indexOf(term) !== -1;
        })
      ) {
        score += 18;
        matched = true;
      }
      if (
        classified.aliases.some(function (alias) {
          return alias.indexOf(term) !== -1;
        })
      ) {
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

  function searchEntries(entries, query, limit) {
    const queryContext = tokenizeQuery(query);
    const intentContext = detectIntent(queryContext);
    const maxResults = Math.min(Math.max(limit || 5, 1), 5);

    if (queryContext.queryLength < 3) {
      return [];
    }

    const questionSuggestions = questionOnlySuggestions(queryContext, maxResults);
    if (questionSuggestions) {
      return questionSuggestions;
    }

    const generalSuggestions = generalSandpaperSuggestions(queryContext, maxResults);
    if (generalSuggestions) {
      return generalSuggestions;
    }

    if (!queryContext.meaningfulTerms.length && !queryContext.gritNumbers.length) {
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
      return output;
    });
  }

  return {
    normalizeQuery: normalizeQuery,
    tokenizeQuery: tokenizeQuery,
    detectIntent: detectIntent,
    classifyEntry: classifyEntry,
    searchEntries: searchEntries,
  };
});
