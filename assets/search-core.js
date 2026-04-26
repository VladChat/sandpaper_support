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
  };

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
      meaningfulTerms: meaningfulTerms,
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
        return true;
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
      return classified.category === "grit" || classified.category === "tools" || classified.category === "solution" || classified.category === "product";
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

    if (multiWord && !exactPhraseMatch && meaningfulSignals < 2) {
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

    if (!queryContext.meaningfulTerms.length && !queryContext.gritNumbers.length) {
      return [];
    }

    const ranked = (Array.isArray(entries) ? entries : [])
      .map(classifyEntry)
      .filter(function (classified) {
        if (intentContext.mainIntent === "general_support") {
          return true;
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
