(function () {
  const STORAGE_KEYS = {
    sessionToken: "sessionToken",
    searchTrail: "searchTrail",
    lastQuery: "lastQuery",
    lastMatches: "lastMatches",
    clickedPages: "clickedPages",
    currentPage: "currentPage",
    assistantMessages: "assistantMessages",
    autoSubmittedQueries: "autoSubmittedQueries",
    conversationMemory: "eQualleAssistantConversationV2",
  };

  const CONVERSATION_CONFIG = {
    maxTurns: 10,
    expiryMs: 2 * 60 * 60 * 1000,
  };

  function clean(value) {
    return String(value || "").toLowerCase();
  }

  function isOrderTrackingQuery(message) {
    const text = clean(message).trim();
    if (!text) {
      return false;
    }
    const phrases = [
      "where is my order",
      "track my order",
      "tracking number",
      "order status",
      "shipping status",
      "my shipment",
      "delivery status",
      "when will it arrive",
    ];
    if (phrases.some(function (phrase) { return text.indexOf(phrase) !== -1; })) {
      return true;
    }
    return /\bpackage\b/.test(text);
  }

  function debounce(callback, wait) {
    let timeoutId;
    return function () {
      const args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        callback.apply(null, args);
      }, wait);
    };
  }

  function parseJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function getStoredText(key, fallback) {
    try {
      const value = window.sessionStorage.getItem(key);
      return value || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function setStoredText(key, value) {
    try {
      window.sessionStorage.setItem(key, String(value));
    } catch (_error) {
      return;
    }
  }

  function getStoredJson(key, fallback) {
    return parseJson(getStoredText(key, ""), fallback);
  }

  function setStoredJson(key, value) {
    setStoredText(key, JSON.stringify(value));
  }

  function getSessionToken() {
    const existing = getStoredText(STORAGE_KEYS.sessionToken, "");

    if (existing) {
      return existing;
    }

    const token = "session-" + Math.random().toString(36).slice(2) + Date.now();
    setStoredText(STORAGE_KEYS.sessionToken, token);
    return token;
  }

  function createNewConversationState() {
    return {
      sessionId: "conv-" + Math.random().toString(36).slice(2) + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPage: {
        path: window.location.pathname || "",
        title: stripSiteTitle(document.title),
      },
      turns: [],
    };
  }

  function getConversationState() {
    const raw = getStoredJson(STORAGE_KEYS.conversationMemory, null);
    if (!raw || typeof raw !== "object") {
      return createNewConversationState();
    }

    const now = new Date().getTime();
    const updatedAt = new Date(raw.updatedAt || 0).getTime();
    const isExpired = now - updatedAt > CONVERSATION_CONFIG.expiryMs;

    if (isExpired) {
      return createNewConversationState();
    }

    if (!Array.isArray(raw.turns)) {
      raw.turns = [];
    }

    return raw;
  }

  function saveConversationState(state) {
    if (!state || typeof state !== "object") {
      return;
    }
    state.updatedAt = new Date().toISOString();
    setStoredJson(STORAGE_KEYS.conversationMemory, state);
  }

  function addConversationTurn(role, text, extra) {
    const state = getConversationState();
    const pagePath = (extra && extra.pagePath) || window.location.pathname || "";
    const pageTitle = (extra && extra.pageTitle) || stripSiteTitle(document.title);

    const turn = {
      role: String(role || "user"),
      text: String(text || ""),
      pagePath: pagePath,
      pageTitle: pageTitle,
      at: new Date().toISOString(),
    };

    state.turns.push(turn);

    while (state.turns.length > CONVERSATION_CONFIG.maxTurns) {
      state.turns.shift();
    }

    state.lastPage = {
      path: pagePath,
      title: pageTitle,
    };

    saveConversationState(state);
  }

  function summarizeAssistantText(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return "";
    }

    const lines = raw.split(/\n+/);
    const important = [];

    for (let i = 0; i < lines.length && important.join("\n").length < 500; i++) {
      const line = lines[i].trim();
      if (
        /^(grit|wet|dry|tool|tool|avoid|warning|step|recommended)/i.test(line) ||
        /\d+/.test(line) ||
        (line.length > 15 && !line.endsWith(":"))
      ) {
        important.push(line);
      }
    }

    const summary = important.join(" ").trim().slice(0, 500);
    return summary || raw.slice(0, 500);
  }

  function getRecentConversationText() {
    const state = getConversationState();
    if (!Array.isArray(state.turns) || !state.turns.length) {
      return "";
    }

    const recentTurns = state.turns.slice(-8);
    const lines = [];

    recentTurns.forEach(function (turn) {
      const roleLabel = turn.role === "assistant" ? "Assistant" : "User";
      const text = String(turn.text || "").trim();
      if (text) {
        lines.push(roleLabel + ": " + text);
      }
    });

    return lines.join("\n\n");
  }

  function buildPageContext() {
    const solutionContext = readSolutionContextFromPage();
    const pathname = window.location.pathname || "";
    const solutionMatch = pathname.match(/\/solutions\/([^/]+)\/?$/);
    const problemMatch = pathname.match(/\/problems\/([^/]+)\/?$/);

    let context = {
      currentPagePath: pathname,
      currentPageTitle: stripSiteTitle(document.title),
      solutionSlug: solutionMatch ? solutionMatch[1] : "",
      problemSlug: problemMatch ? problemMatch[1] : "",
    };

    if (solutionContext && typeof solutionContext === "object") {
      context.solutionContext = {
        title: solutionContext.title || "",
        problem: solutionContext.problem || "",
        surface: solutionContext.surface || "",
        task: solutionContext.task || "",
        symptom: solutionContext.symptom || "",
        quick_answer: solutionContext.quick_answer || "",
      };
    }

    return context;
  }

  function buildAssistantPrompt(currentUserMessage) {
    const state = getConversationState();
    const pageContext = buildPageContext();
    const recentConversation = getRecentConversationText();

    const pageContextText = [
      pageContext.currentPagePath ? "Current page: " + pageContext.currentPagePath : "",
      pageContext.currentPageTitle ? "Page title: " + pageContext.currentPageTitle : "",
      pageContext.solutionContext && pageContext.solutionContext.title
        ? "Solution: " + pageContext.solutionContext.title
        : "",
      pageContext.solutionContext && pageContext.solutionContext.problem
        ? "Problem: " + pageContext.solutionContext.problem
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const recentText = recentConversation
      ? "Recent conversation:\n" + recentConversation
      : "";

    const systemPrompt = [
      "You are a technical sandpaper troubleshooting specialist.",
      "Your role is practical support, not sales.",
      "Do not promote the brand or repeatedly mention eQualle.",
      "Mention eQualle only when the user directly asks about the brand, product identity, packaging, listing, order, or seller-specific support.",
      "Focus on sandpaper and related surface-preparation work: grit choice, wet/dry sanding, wood, metal, plastic, paint, primer, clear coat, scratches, clogging, cutting/trimming sheets, safe technique, and next steps.",
      "",
      "Use the conversation context below when the current user question is a follow-up, clarification, pronoun reference, short question, or depends on the previous answer.",
      "",
      "Do not reinterpret a follow-up as a new unrelated topic.",
      "If the user clearly changes topic, answer the new topic normally.",
      "",
      pageContextText ? "Current page context:\n" + pageContextText : "",
      "",
      recentText,
      "",
      "Current user question:",
      currentUserMessage,
      "",
      "Answer rules:",
      "- Answer the current user question directly.",
      "- Resolve short follow-ups using the recent conversation.",
      "- Keep the answer anchored to sandpaper, sanding, grit choice, wet/dry use, cutting/trimming sheets, surface prep, wood, metal, plastic, paint, primer, clear coat, scratches, clogging, and safe technique when that is the active topic.",
      "- Use a neutral technical support tone; do not sound like a sales or brand-promotion bot.",
      "- Do not mention eQualle unless the user directly asks about eQualle, the product listing, packaging, order, or seller-specific support.",
      "- Do not switch to a different topic just because the short follow-up contains a word with another meaning.",
      "- Use this structure:",
      "",
      "Answer Summary:",
      "[1-2 short sentences]",
      "",
      "Recommended Action:",
      "[action/tool/material]",
      "",
      "Steps:",
      "1. [step]",
      "2. [step]",
      "3. [step]",
      "",
      "Avoid:",
      "[short warning]",
      "",
      "Recommended Page:",
      "[only include a relevant internal page title when truly useful]",
    ]
      .filter(Boolean)
      .join("\n");

    return systemPrompt;
  }

  function normalizePath(basePath, target) {
    const candidate = String(target || "").trim();

    if (!candidate) {
      return "";
    }

    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }

    if (candidate.indexOf(basePath + "/") === 0 || candidate === basePath) {
      return candidate;
    }

    if (candidate.charAt(0) === "/") {
      return basePath + candidate;
    }

    return basePath + "/" + candidate;
  }

  function stripSiteTitle(title) {
    return String(title || "").replace(/\s*\|\s*eQualle Support\s*$/i, "").trim();
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-cache" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + path);
      }
      return response.json();
    });
  }

  function loadSupportJson(basePath, path) {
    return loadJson(basePath + "/" + path).catch(function () {
      return loadJson(path);
    });
  }

  function toTerms(query) {
    return clean(query)
      .split(/\s+/)
      .filter(function (term) {
        return term.length > 1;
      });
  }

  function normalizeList(values) {
    return (Array.isArray(values) ? values : [])
      .map(function (value) {
        return clean(value).trim();
      })
      .filter(function (value) {
        return Boolean(value);
      });
  }

  function phraseStartsWithQuery(phrases, query) {
    const lowered = clean(query).trim();
    if (!lowered) {
      return false;
    }

    return normalizeList(phrases).some(function (phrase) {
      if (phrase.indexOf(lowered) === 0) {
        return true;
      }
      return phrase.split(/\s+/).some(function (word) {
        return word.indexOf(lowered) === 0;
      });
    });
  }

  function scoreHaystack(haystack, query, terms) {
    const loweredHaystack = clean(haystack);
    const loweredQuery = clean(query).trim();
    let score = 0;

    if (!loweredQuery) {
      return 0;
    }

    if (loweredHaystack.indexOf(loweredQuery) !== -1) {
      score += 30;
    }

    terms.forEach(function (term) {
      if (term.length > 2 && loweredHaystack.indexOf(term) !== -1) {
        score += 4;
      }
    });

    return score;
  }

  function buildSearchHaystack(entry) {
    return [
      entry.id,
      entry.type,
      entry.title,
      entry.description,
      ...(entry.customer_phrases || []),
      ...(entry.aliases || []),
      ...(entry.surface || []),
      ...(entry.grits || []),
      ...(entry.method || []),
    ].join(" ");
  }

  function buildSolutionHaystack(card) {
    return [
      card.id,
      card.slug,
      card.problem_slug,
      card.title,
      card.problem,
      card.surface,
      card.task,
      card.symptom,
      card.quick_answer,
      ...(card.best_grit_path || []),
      ...(card.optional_starting_grits || []),
      card.likely_cause,
      card.recommended_grit,
      card.wet_or_dry,
      card.success_check,
      ...(card.steps || []),
      ...(card.mistakes_to_avoid || []),
      ...(card.search_phrases || []),
      card.avoid,
    ].join(" ");
  }

  function buildSequenceHaystack(item) {
    return [
      item.surface,
      item.goal,
      item.start_grit,
      item.wet_or_dry,
      item.avoid,
      ...(item.sequence || []),
      ...(item.related_solution_ids || []),
    ].join(" ");
  }

  function buildSurfaceHaystack(item) {
    return [
      item.id,
      item.title,
      item.description,
      ...(item.solution_card_ids || []),
    ].join(" ");
  }

  function compactSearchEntry(entry) {
    return {
      title: entry.title || "",
      target_url: entry.target_url || "",
      result_kind: entry.result_kind || "",
      search_intent: entry.search_intent || "",
      surface: Array.isArray(entry.surface) ? entry.surface[0] || "" : "",
      goal: "",
    };
  }

  function compactSolutionCard(card) {
    return {
      id: card.id || "",
      slug: card.slug || card.id || "",
      title: card.title || "",
      problem: card.problem || "",
      surface: card.surface || "",
      task: card.task || "",
      symptom: card.symptom || "",
      quick_answer: card.quick_answer || "",
      best_grit_path: Array.isArray(card.best_grit_path) ? card.best_grit_path.slice(0, 8) : [],
      optional_starting_grits: Array.isArray(card.optional_starting_grits)
        ? card.optional_starting_grits.slice(0, 4)
        : [],
      likely_cause: card.likely_cause || "",
      recommended_grit: card.recommended_grit || "",
      wet_or_dry: card.wet_or_dry || "",
      steps: Array.isArray(card.steps) ? card.steps.slice(0, 5) : [],
      mistakes_to_avoid: Array.isArray(card.mistakes_to_avoid)
        ? card.mistakes_to_avoid.slice(0, 5)
        : [],
      avoid: card.avoid || "",
      success_check: card.success_check || "",
      target_url: "/solutions/" + card.id + "/",
    };
  }

  function compactSequence(item) {
    return {
      surface: item.surface || "",
      goal: item.goal || "",
      sequence: Array.isArray(item.sequence) ? item.sequence.slice(0, 6) : [],
      wet_or_dry: item.wet_or_dry || "",
      avoid: item.avoid || "",
      target_url: item.related_surface_url || "",
    };
  }

  function buildKnowledge(basePath) {
    return Promise.all([
      loadSupportJson(basePath, "data/search-index.json"),
      loadSupportJson(basePath, "data/solution-cards.json"),
      loadSupportJson(basePath, "data/grit-sequences.json"),
      loadSupportJson(basePath, "data/surface-map.json"),
      loadSupportJson(basePath, "data/search-suggestions.json"),
    ]).then(function (results) {
      const searchEntries = Array.isArray(results[0]) ? results[0] : [];
      const solutionCards = Array.isArray(results[1]) ? results[1] : [];
      const gritSequences = Array.isArray(results[2]) ? results[2] : [];
      const surfaceMap = Array.isArray(results[3]) ? results[3] : [];
      const searchSuggestions = Array.isArray(results[4]) ? results[4] : [];

      const solutionById = {};
      solutionCards.forEach(function (card) {
        if (card && card.id) {
          solutionById[card.id] = card;
        }
      });

      function findSearchMatches(query, limit, options) {
        const loweredQuery = clean(query).trim();
        if (!loweredQuery) {
          return [];
        }
        if (window.eQualleSearchCore && typeof window.eQualleSearchCore.searchEntries === "function") {
          return window.eQualleSearchCore.searchEntries(
            searchEntries,
            loweredQuery,
            limit || 5,
            searchSuggestions,
            options || {},
          );
        }
        return [];
      }

      function getPageCards(pathname, title) {
        const items = [];
        const cleanPath = String(pathname || "");

        const solutionMatch = cleanPath.match(/\/solutions\/([^/]+)\/?$/);
        if (solutionMatch && solutionById[solutionMatch[1]]) {
          items.push(solutionById[solutionMatch[1]]);
        }

        const problemMatch = cleanPath.match(/\/problems\/([^/]+)\/?$/);
        if (problemMatch) {
          solutionCards.forEach(function (card) {
            if (card.problem_slug === problemMatch[1]) {
              items.push(card);
            }
          });
        }

        if (!items.length && title) {
          const titleTerms = toTerms(title);
          solutionCards.forEach(function (card) {
            const score = scoreHaystack(buildSolutionHaystack(card), title, titleTerms);
            if (score > 20) {
              items.push(card);
            }
          });
        }

        const unique = [];
        const seen = {};
        items.forEach(function (card) {
          if (!card || seen[card.id]) {
            return;
          }
          seen[card.id] = true;
          unique.push(card);
        });

        return unique;
      }

      function findSolutionCards(query, pathname, title, lastMatches, limit) {
        const terms = toTerms(query);
        const boostedCards = getPageCards(pathname, title);
        const boostedMap = {};
        boostedCards.forEach(function (card) {
          boostedMap[card.id] = true;
        });

        const queryHint = [
          query,
          title,
          (lastMatches || []).map(function (item) {
            return item && item.title;
          }).join(" "),
        ].join(" ");

        return solutionCards
          .map(function (card) {
            let score = scoreHaystack(buildSolutionHaystack(card), queryHint, terms);

            if (boostedMap[card.id]) {
              score += 35;
            }

            return {
              score: score,
              card: card,
            };
          })
          .filter(function (item) {
            return item.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, limit || 5)
          .map(function (item) {
            return item.card;
          });
      }

      function inferSurfaces(query, matchedSearch, matchedCards) {
        const surfaceScores = {};
        const queryTerms = toTerms(query);

        function addSurface(surface, points) {
          if (!surface) {
            return;
          }
          const key = clean(surface);
          surfaceScores[key] = (surfaceScores[key] || 0) + points;
        }

        matchedSearch.forEach(function (entry) {
          (entry.surface || []).forEach(function (surface) {
            addSurface(surface, 6);
          });
        });

        matchedCards.forEach(function (card) {
          surfaceMap.forEach(function (surfaceItem) {
            if ((surfaceItem.solution_card_ids || []).indexOf(card.id) !== -1) {
              addSurface(surfaceItem.title, 8);
            }
          });
        });

        surfaceMap.forEach(function (surfaceItem) {
          const score = scoreHaystack(
            buildSurfaceHaystack(surfaceItem),
            query,
            queryTerms,
          );
          if (score > 0) {
            addSurface(surfaceItem.title, score);
          }
        });

        return Object.keys(surfaceScores)
          .sort(function (a, b) {
            return (surfaceScores[b] || 0) - (surfaceScores[a] || 0);
          })
          .slice(0, 2);
      }

      function findGritSequences(query, matchedSearch, matchedCards, limit) {
        const terms = toTerms(query);
        const inferredSurfaces = inferSurfaces(query, matchedSearch, matchedCards);

        return gritSequences
          .map(function (item) {
            let score = scoreHaystack(buildSequenceHaystack(item), query, terms);

            const surfaceKey = clean(item.surface);
            if (inferredSurfaces.indexOf(surfaceKey) !== -1) {
              score += 18;
            }

            return {
              score: score,
              item: item,
            };
          })
          .filter(function (row) {
            return row.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, limit || 2)
          .map(function (row) {
            return row.item;
          });
      }

      return {
        findSearchMatches: findSearchMatches,
        findSolutionCards: findSolutionCards,
        findGritSequences: findGritSequences,
      };
    });
  }

  function appendMessage(messages, role, text, options) {
    const node = document.createElement("div");
    node.className = "chat-message chat-message-" + role;
    node.textContent = text;
    messages.appendChild(node);
    if (!options || options.noAutoScroll !== true) {
      messages.scrollTop = messages.scrollHeight;
    }
    return node;
  }

  const INTERNAL_PATH_PATTERN = /(?:https?:\/\/[^\s/]+)?(?:\/sandpaper_support)?(\/(?:tools|problems|solutions|surfaces|products|grits|how-to)\/[a-z0-9\-\/]*)/gi;
  const INTERNAL_PATH_FAMILIES = {
    "/tools/": true,
    "/problems/": true,
    "/solutions/": true,
    "/surfaces/": true,
    "/products/": true,
    "/grits/": true,
    "/how-to/": true,
  };
  const KNOWN_INTERNAL_TITLES = {
    "/tools/grit-sequence-builder/": "Grit Sequence Builder",
    "/grits/": "Grit Guide",
    "/products/": "Products",
    "/surfaces/": "Surfaces",
    "/problems/": "Problems",
    "/solutions/": "Solutions",
    "/how-to/": "How To",
  };

  function normalizeInternalSupportPath(path) {
    const raw = String(path || "").trim();
    if (!raw) {
      return "";
    }

    const baseMatch = raw.match(/(?:https?:\/\/[^\s/]+)?(?:\/sandpaper_support)?(\/(?:tools|problems|solutions|surfaces|products|grits|how-to)\/[a-z0-9\-\/]*)/i);
    if (!baseMatch || !baseMatch[1]) {
      return "";
    }

    let normalized = baseMatch[1].replace(/\/+/g, "/");
    if (normalized.charAt(0) !== "/") {
      normalized = "/" + normalized;
    }
    if (normalized.charAt(normalized.length - 1) !== "/") {
      normalized += "/";
    }
    return normalized;
  }

  function isInternalSupportPath(path) {
    const normalized = normalizeInternalSupportPath(path);
    return Object.keys(INTERNAL_PATH_FAMILIES).some(function (prefix) {
      return normalized.indexOf(prefix) === 0;
    });
  }

  function humanizeSupportPath(path) {
    const normalized = normalizeInternalSupportPath(path);
    if (!normalized) {
      return "Support Page";
    }
    if (KNOWN_INTERNAL_TITLES[normalized]) {
      return KNOWN_INTERNAL_TITLES[normalized];
    }

    const parts = normalized.replace(/^\/|\/$/g, "").split("/");
    const slug = parts[parts.length - 1] || parts[0] || "";
    const text = slug.replace(/-/g, " ").trim();
    if (!text) {
      return "Support Page";
    }

    return text
      .split(/\s+/)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function buildPageLookup(pages) {
    const lookup = {};
    (Array.isArray(pages) ? pages : []).forEach(function (page) {
      const rawPath = page && (page.path || page.href || page.url || page.target_url || page.targetUrl);
      const normalized = normalizeInternalSupportPath(rawPath);
      if (!normalized) {
        return;
      }
      const title = String((page && (page.title || page.label)) || "").trim();
      lookup[normalized] = title || humanizeSupportPath(normalized);
    });
    return lookup;
  }

  function rewriteInternalReferences(text, pageLookup) {
    const references = [];
    const seen = {};
    const rewritten = String(text || "").replace(INTERNAL_PATH_PATTERN, function (_match, pathToken) {
      const normalized = normalizeInternalSupportPath(pathToken);
      if (!isInternalSupportPath(normalized)) {
        return _match;
      }
      const title = pageLookup[normalized] || humanizeSupportPath(normalized);
      if (!seen[normalized]) {
        references.push({
          path: normalized,
          title: title,
        });
        seen[normalized] = true;
      }
      return title;
    });

    return {
      text: rewritten,
      references: references,
    };
  }

  function buildSupportSections(replyText) {
    const lines = String(replyText || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    const sections = [];
    let current = {
      title: "Answer Summary",
      lines: [],
    };

    lines.forEach(function (line) {
      const headingMatch = line.match(/^([A-Za-z][A-Za-z0-9 ]{2,40}):\s*(.*)$/);
      if (headingMatch) {
        if (current.lines.length) {
          sections.push(current);
        }
        current = {
          title: headingMatch[1].trim(),
          lines: headingMatch[2] ? [headingMatch[2].trim()] : [],
        };
        return;
      }
      current.lines.push(line);
    });

    if (current.lines.length) {
      sections.push(current);
    }

    return sections;
  }

  function appendSupportLinkBlock(parent, title, links, basePath, onClick) {
    if (!Array.isArray(links) || !links.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "support-answer-section";

    const heading = document.createElement("h4");
    heading.className = "support-answer-section-title";
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "support-answer-link-grid";

    links.forEach(function (item) {
      if (!item || !item.path || !item.title) {
        return;
      }
      const link = document.createElement("a");
      link.className = "support-answer-link";
      link.href = normalizePath(basePath, item.path);
      link.textContent = item.title;
      link.addEventListener("click", function () {
        if (typeof onClick === "function") {
          onClick({
            path: link.pathname,
            title: item.title,
          });
        }
      });
      grid.appendChild(link);
    });

    if (grid.children.length) {
      section.appendChild(grid);
      parent.appendChild(section);
    }
  }

  function renderSupportAnswer(node, replyText, pages, basePath, onClick) {
    const pageLookup = buildPageLookup(pages);
    const rewritten = rewriteInternalReferences(replyText, pageLookup);
    const sections = buildSupportSections(rewritten.text);

    node.textContent = "";
    const wrapper = document.createElement("div");
    wrapper.className = "support-answer";

    sections.forEach(function (sectionData, index) {
      const section = document.createElement("section");
      section.className = "support-answer-section";

      const heading = document.createElement("h4");
      heading.className = "support-answer-section-title";
      heading.textContent = sectionData.title || (index === 0 ? "Answer Summary" : "Details");
      section.appendChild(heading);

      const lines = sectionData.lines.filter(Boolean);
      const stepLines = lines.filter(function (line) {
        return /^\d+[.)]\s+/.test(line);
      });

      if (stepLines.length >= 2) {
        const list = document.createElement("ol");
        list.className = "support-answer-steps";
        stepLines.forEach(function (line) {
          const item = document.createElement("li");
          item.textContent = line.replace(/^\d+[.)]\s+/, "");
          list.appendChild(item);
        });
        section.appendChild(list);
      } else if (lines.length >= 2) {
        const list = document.createElement("ul");
        list.className = "support-answer-list";
        lines.forEach(function (line) {
          const item = document.createElement("li");
          item.textContent = line.replace(/^[-*]\s+/, "");
          list.appendChild(item);
        });
        section.appendChild(list);
      } else if (lines.length === 1) {
        const paragraph = document.createElement("p");
        paragraph.textContent = lines[0];
        section.appendChild(paragraph);
      }

      if (/next step/i.test(sectionData.title)) {
        section.classList.add("support-answer-next-step");
      }

      wrapper.appendChild(section);
    });

    const matchedLinks = Object.keys(pageLookup).map(function (path) {
      return {
        path: path,
        title: pageLookup[path],
      };
    });

    if (matchedLinks.length) {
      appendSupportLinkBlock(wrapper, "Recommended Page", matchedLinks, basePath, onClick);
    }
    if (rewritten.references.length) {
      appendSupportLinkBlock(wrapper, "Related Guide", rewritten.references, basePath, onClick);
    }

    node.appendChild(wrapper);
  }


  function buildCompactAssistantText(replyText, pages) {
    const pageLookup = buildPageLookup(pages);
    const rewritten = rewriteInternalReferences(replyText, pageLookup);
    const sections = buildSupportSections(rewritten.text);

    if (!sections.length) {
      return String(rewritten.text || "").trim();
    }

    const chunks = [];

    sections.forEach(function (sectionData) {
      const title = clean(sectionData.title || "");
      const lines = (sectionData.lines || [])
        .map(function (line) {
          return String(line || "").trim();
        })
        .filter(Boolean);

      if (!lines.length) {
        return;
      }

      if (/recommended page|related guide/.test(title)) {
        return;
      }

      if (/^steps?$/.test(title)) {
        chunks.push(lines.join("\n"));
        return;
      }

      if (/avoid|warning|mistake/.test(title)) {
        chunks.push("Avoid: " + lines.join(" "));
        return;
      }

      chunks.push(lines.join(" "));
    });

    return chunks.join("\n\n").trim() || String(rewritten.text || "").trim();
  }

  function renderCompactAssistantAnswer(node, replyText, pages) {
    node.textContent = buildCompactAssistantText(replyText, pages);
    node.classList.add("chat-message-compact");
  }

  function pushSessionArray(key, value, maxItems) {
    const list = getStoredJson(key, []);
    list.push(value);
    while (list.length > maxItems) {
      list.shift();
    }
    setStoredJson(key, list);
    return list;
  }

  function setCurrentPage() {
    setStoredJson(STORAGE_KEYS.currentPage, {
      path: window.location.pathname,
      title: stripSiteTitle(document.title),
      at: new Date().toISOString(),
    });
  }

  function recordClickedPage(path, title) {
    const normalizedPath = String(path || "");
    const normalizedTitle = String(title || "");

    if (!normalizedPath) {
      return;
    }

    const current = getStoredJson(STORAGE_KEYS.clickedPages, []);
    const withoutDup = current.filter(function (item) {
      return item.path !== normalizedPath;
    });

    withoutDup.push({
      path: normalizedPath,
      title: normalizedTitle,
      at: new Date().toISOString(),
    });

    while (withoutDup.length > 15) {
      withoutDup.shift();
    }

    setStoredJson(STORAGE_KEYS.clickedPages, withoutDup);
  }

  function buildAssistantShell(options) {
    const wrapper = document.createElement("div");
    wrapper.className = "support-assistant-panel";
    let descriptionNode = null;

    const title = document.createElement("h3");
    title.className = "support-assistant-title";
    title.textContent = options.title;
    wrapper.appendChild(title);

    if (options.description) {
      descriptionNode = document.createElement("p");
      descriptionNode.className = "support-assistant-description";
      descriptionNode.textContent = options.description;
      wrapper.appendChild(descriptionNode);
    }

    const shell = document.createElement("div");
    shell.className = "chat-shell support-chat-shell";

    const messages = document.createElement("div");
    messages.className = "chat-messages";
    messages.setAttribute("aria-live", "polite");

    const form = document.createElement("form");
    form.className = "chat-form";

    const label = document.createElement("label");
    label.className = "sr-only";
    label.textContent = options.label || "Ask a support question";

    const input = document.createElement("input");
    input.className = "chat-input";
    input.type = "text";
    input.placeholder = options.placeholder || "Ask a follow-up question";
    input.autocomplete = "off";

    const button = document.createElement("button");
    button.className = "chat-send";
    button.type = "submit";
    button.textContent = options.buttonText || "Send";

    label.appendChild(input);
    form.appendChild(label);
    form.appendChild(button);

    shell.appendChild(messages);
    shell.appendChild(form);
    wrapper.appendChild(shell);

    if (options.initialMessage) {
      appendMessage(messages, "assistant", options.initialMessage);
    }

    return {
      root: wrapper,
      form: form,
      input: input,
      messages: messages,
      setTitle: function (text) {
        title.textContent = text;
      },
      setDescription: function (text) {
        if (!descriptionNode) {
          descriptionNode = document.createElement("p");
          descriptionNode.className = "support-assistant-description";
          wrapper.insertBefore(descriptionNode, shell);
        }
        if (!descriptionNode) {
          return;
        }
        descriptionNode.textContent = text;
      },
    };
  }

  function parseExistingShell(shell) {
    if (!shell) {
      return null;
    }

    const form = shell.querySelector("[data-ai-form]") || shell.querySelector(".chat-form");
    const input = shell.querySelector("[data-ai-input]") || shell.querySelector(".chat-input");
    const messages =
      shell.querySelector("[data-ai-messages]") || shell.querySelector(".chat-messages");

    if (!form || !input || !messages) {
      return null;
    }

    return {
      root: shell,
      form: form,
      input: input,
      messages: messages,
      setTitle: function () {
        return;
      },
      setDescription: function () {
        return;
      },
    };
  }

  function readSolutionContextFromPage() {
    const node = document.querySelector('script[type="application/json"][data-solution-context]');
    if (!node) {
      return null;
    }

    try {
      const parsed = JSON.parse(node.textContent || "{}");
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function isSupportLeaf(pathname, basePath) {
    const scopedPath = String(pathname || "").replace(basePath, "");
    return /^\/(problems|solutions)\/[^/]+\/?$/.test(scopedPath);
  }

  function attachPageTopAssistant(basePath) {
    const isSolutionPage = /\/solutions\/[^/]+\/?$/.test(String(window.location.pathname || ""));
    if (isSolutionPage) {
      return null;
    }

    if (!isSupportLeaf(window.location.pathname, basePath)) {
      return null;
    }

    if (document.querySelector("[data-support-top-assistant]")) {
      return parseExistingShell(document.querySelector("[data-support-top-assistant]"));
    }

    const section = document.querySelector("main .section");
    if (!section) {
      return null;
    }

    const block = document.createElement("section");
    block.className = "answer-card support-top-assistant-card";
    block.setAttribute("data-support-top-assistant", "");

    const heading = document.createElement("h2");
    heading.textContent = "Ask about this issue";
    block.appendChild(heading);

    const intro = document.createElement("p");
    intro.className = "section-intro";
    intro.textContent =
      "Ask a follow-up question about this sanding problem, grit choice, surface, or next step.";
    block.appendChild(intro);

    const shell = buildAssistantShell({
      title: "Ask about this issue",
      description: "",
      placeholder: "Example: what grit should I use next?",
      initialMessage: "Pick a suggestion or ask your exact next-step question.",
    });

    const suggestions = document.createElement("div");
    suggestions.className = "support-suggestion-row";
    suggestions.setAttribute("data-support-suggestions", "");
    [
      "What should I do next?",
      "Which grit comes next?",
      "Should I sand wet or dry?",
    ].forEach(function (text) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "support-suggestion-button";
      button.textContent = text;
      suggestions.appendChild(button);
    });
    block.appendChild(suggestions);

    block.appendChild(shell.root.querySelector(".chat-shell"));

    const introNode = section.querySelector(".section-intro");
    const firstAnswerCard = section.querySelector(".answer-card");

    if (introNode) {
      introNode.insertAdjacentElement("afterend", block);
    } else if (firstAnswerCard) {
      firstAnswerCard.insertAdjacentElement("beforebegin", block);
    } else {
      section.appendChild(block);
    }

    return {
      root: block,
      form: shell.form,
      input: shell.input,
      messages: shell.messages,
      setTitle: shell.setTitle,
      setDescription: shell.setDescription,
      suggestionButtons: Array.prototype.slice.call(
        block.querySelectorAll(".support-suggestion-button"),
      ),
    };
  }

  function createAssistantRequester(basePath, knowledge) {
    return function requestAssistant(userMessage, context) {
      const currentTitle = stripSiteTitle(document.title);
      const currentPath = window.location.pathname;
      const lastMatches = getStoredJson(STORAGE_KEYS.lastMatches, []);
      const contextInput = context && typeof context === "object" ? context : {};

      addConversationTurn("user", userMessage, {
        pagePath: currentPath,
        pageTitle: currentTitle,
      });

      const searchEntries = knowledge.findSearchMatches(userMessage, 5);
      const solutionCards = knowledge.findSolutionCards(
        userMessage,
        currentPath,
        currentTitle,
        lastMatches,
        5,
      );
      const gritSequences = knowledge.findGritSequences(
        userMessage,
        searchEntries,
        solutionCards,
        2,
      );

      const retrievedContent = {
        searchEntries: searchEntries.slice(0, 5).map(compactSearchEntry),
        solutionCards: solutionCards.slice(0, 5).map(compactSolutionCard),
        gritSequences: gritSequences.slice(0, 2).map(compactSequence),
      };

      const contextualPrompt = buildAssistantPrompt(userMessage);

      const payload = {
        sessionToken: getSessionToken(),
        userMessage: contextualPrompt,
        context: {
          currentPath: currentPath,
          currentTitle: currentTitle,
          lastQuery: getStoredText(STORAGE_KEYS.lastQuery, ""),
          lastMatches: getStoredJson(STORAGE_KEYS.lastMatches, []),
          clickedPages: getStoredJson(STORAGE_KEYS.clickedPages, []),
          retrievedContent: retrievedContent,
          source: contextInput.source ? contextInput.source : "site",
          solution_id: contextInput.solution_id || "",
          solution_slug: contextInput.solution_slug || "",
          solution_context: contextInput.solution_context || null,
        },
      };

      if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
        return Promise.resolve({
          ok: false,
          error: "supabase_not_configured",
          localMatches: payload.context.lastMatches,
        });
      }

      return window.eQualleSupabase.askSupportAssistant(payload).then(function (result) {
        if (!result || !result.ok) {
          return {
            ok: false,
            error: "assistant_unavailable",
            localMatches: payload.context.lastMatches,
          };
        }

        const replyText = result.reply || "";
        addConversationTurn("assistant", replyText, {
          pagePath: currentPath,
          pageTitle: currentTitle,
        });

        return {
          ok: true,
          reply: replyText,
          needsClarification: Boolean(result.needsClarification),
          clarifyingQuestion: result.clarifyingQuestion || "",
          matchedPages: Array.isArray(result.matchedPages) ? result.matchedPages : [],
          draftCreated: Boolean(result.draftCreated),
        };
      });
    };
  }

  function wireChat(shell, requester, basePath, options) {
    if (!shell) {
      return {
        ask: function () {
          return;
        },
      };
    }

    const source = options && options.source ? options.source : "chat";
    const noAutoScroll = Boolean(options && options.noAutoScroll === true);
    const getRequestContext =
      options && typeof options.getRequestContext === "function"
        ? options.getRequestContext
        : null;
    let assistantReplyCount = 0;

    function sendMessage(userMessage, meta) {
      const message = String(userMessage || "").trim();
      if (!message) {
        return;
      }

      pushSessionArray(
        STORAGE_KEYS.assistantMessages,
        {
          role: "user",
          text: message,
          at: new Date().toISOString(),
          source: source,
        },
        30,
      );

      appendMessage(shell.messages, "user", message, { noAutoScroll: noAutoScroll });

      const pending = appendMessage(
        shell.messages,
        "assistant",
        "Checking approved support guides...",
        { noAutoScroll: noAutoScroll },
      );
      const shouldRenderStructuredAnswer =
        source === "ai-assistant-page" && assistantReplyCount === 0;

      if (isOrderTrackingQuery(message)) {
        pending.textContent =
          "I can’t track orders here. Please check your order confirmation email or the retailer where you purchased the sandpaper.";
        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "assistant",
            text: pending.textContent,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );
        assistantReplyCount += 1;
        return;
      }

      const dynamicContext = getRequestContext ? (getRequestContext() || {}) : {};
      requester(
        message,
        Object.assign(
          {
            source: source,
            mode: meta && meta.auto ? "auto" : "manual",
          },
          dynamicContext,
        ),
      ).then(function (result) {
        if (!result.ok) {
          const fallbackReply =
            "Answer Summary: Assistant response is unavailable right now.\nNext Step: Use the links below or ask a more specific sanding question.";
          if (shouldRenderStructuredAnswer) {
            renderSupportAnswer(pending, fallbackReply, result.localMatches || [], basePath, function (page) {
              recordClickedPage(page.path, page.title);
            });
          } else {
            renderCompactAssistantAnswer(pending, fallbackReply, result.localMatches || []);
          }

          pushSessionArray(
            STORAGE_KEYS.assistantMessages,
            {
              role: "assistant",
              text: fallbackReply,
              at: new Date().toISOString(),
              source: source,
            },
            30,
          );
          assistantReplyCount += 1;
          return;
        }

        const combinedReply =
          result.needsClarification && result.clarifyingQuestion
            ? (result.reply &&
                clean(result.reply) !== clean(result.clarifyingQuestion) &&
                result.reply.trim().length > 0
                ? result.reply + "\n\n" + result.clarifyingQuestion
                : result.clarifyingQuestion)
            : (result.reply || "I need one more detail to guide you.");

        if (shouldRenderStructuredAnswer) {
          renderSupportAnswer(pending, combinedReply, result.matchedPages, basePath, function (page) {
            recordClickedPage(page.path, page.title);
          });
        } else {
          renderCompactAssistantAnswer(pending, combinedReply, result.matchedPages);
        }

        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "assistant",
            text: combinedReply,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );
        assistantReplyCount += 1;
      });
    }

    shell.form.addEventListener("submit", function (event) {
      event.preventDefault();
      const userMessage = shell.input.value.trim();
      if (!userMessage) {
        return;
      }
      shell.input.value = "";
      sendMessage(userMessage, { auto: false });
    });

    return {
      ask: sendMessage,
    };
  }

  function setupHomepageSearch(basePath, knowledge) {
    if (window.eQualleUseAlgoliaAutocomplete) {
      return;
    }
    const input = document.querySelector("[data-support-search]");
    const results = document.querySelector("[data-search-results]");
    const submitButton = document.querySelector("[data-support-search-submit]");

    if (
      (window.eQualleUseUnifiedAutocomplete === true ||
        window.eQualleUseAlgoliaAutocomplete === true) &&
      input
    ) {
      return;
    }

    if (!input || !results) {
      return;
    }

    const logRenderedSearch = debounce(function (query, resultCount) {
      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(query, resultCount, null);
      }
    }, 600);

    function isHomepageAnswerMatch(match) {
      const target = String((match && (match.target_url || match.targetUrl)) || "");
      if (target === "/solutions/") {
        return false;
      }
      return Boolean(
        match &&
          match.result_kind === "answer" &&
          target.indexOf("/solutions/") === 0
      );
    }

    function renderOutput(q, matches) {
      results.innerHTML = "";
      const visibleMatches = (Array.isArray(matches) ? matches : []).filter(isHomepageAnswerMatch);

      if (!q) {
        return;
      }

      if (!visibleMatches.length) {
        return;
      } else {
        visibleMatches.forEach(function (match) {
          const link = document.createElement("a");
          link.className = "result-link";
          link.href = normalizePath(basePath, match.target_url || match.targetUrl || "");
          const title = String(match.title || "").trim();
          const description = String(match.description || "").trim();

          const kindNode = document.createElement("span");
          kindNode.className = "result-kind result-kind-answer";
          kindNode.textContent = "Answer";

          const textNode = document.createElement("span");
          textNode.className = "result-text";

          const titleNode = document.createElement("span");
          titleNode.className = "result-title";
          titleNode.textContent = title || "";
          textNode.appendChild(titleNode);

          if (description) {
            const descriptionNode = document.createElement("span");
            descriptionNode.className = "result-description";
            descriptionNode.textContent = " - " + description;
            textNode.appendChild(descriptionNode);
          }

          link.appendChild(kindNode);
          link.appendChild(textNode);

          link.addEventListener("click", function () {
            if (window.eQualleSupabase) {
              window.eQualleSupabase.logSearch(q, visibleMatches.length, link.pathname);
            }
            recordClickedPage(link.pathname, match.title);
          });

          results.appendChild(link);
        });
      }
    }

    function render(query) {
      const q = clean(query).trim();
      const matches = q ? knowledge.findSearchMatches(q, 5, { answerOnly: true }) : [];
      const visibleMatches = matches.filter(isHomepageAnswerMatch);

      setStoredText(STORAGE_KEYS.lastQuery, q);
      setStoredJson(STORAGE_KEYS.lastMatches, visibleMatches.slice(0, 5).map(compactSearchEntry));

      pushSessionArray(
        STORAGE_KEYS.searchTrail,
        {
          query: q,
          resultCount: visibleMatches.length,
          at: new Date().toISOString(),
        },
        25,
      );

      if (!q) {
        results.innerHTML = "";
        return;
      }

      logRenderedSearch(q, visibleMatches.length);

      renderOutput(q, visibleMatches);
    }

    input.addEventListener("input", function (event) {
      render(event.target.value);
    });

    function redirectToAskPage(message) {
      window.location.href = normalizePath(basePath, "/ask/") + "?q=" + encodeURIComponent(message);
    }

    function runSearchAction() {
      const message = input.value.trim();
      if (!message) {
        input.focus();
        return;
      }
      const matches = knowledge.findSearchMatches(message, 5, { answerOnly: true });
      const visibleMatches = matches.filter(isHomepageAnswerMatch);
      const topMatch = visibleMatches.length ? visibleMatches[0] : null;
      const topHref = topMatch ? normalizePath(basePath, topMatch.target_url || topMatch.targetUrl || "") : "";
      const isStrongTopMatch = Boolean(
        topMatch &&
          (topMatch.search_strong ||
            (Number.isFinite(topMatch.search_score) && topMatch.search_score >= 90)),
      );

      setStoredText(STORAGE_KEYS.lastQuery, clean(message).trim());
      setStoredJson(STORAGE_KEYS.lastMatches, visibleMatches.slice(0, 5).map(compactSearchEntry));
      renderOutput(message, visibleMatches);

      if (isStrongTopMatch && topHref && isHomepageAnswerMatch(topMatch)) {
        try {
          const parsed = new URL(topHref, window.location.origin);
          if (window.eQualleSupabase) {
            window.eQualleSupabase.logSearch(message, visibleMatches.length, parsed.pathname);
          }
          recordClickedPage(parsed.pathname, topMatch.title || "");
        } catch (_error) {
          if (window.eQualleSupabase) {
            window.eQualleSupabase.logSearch(message, matches.length, null);
          }
        }
        window.location.href = topHref;
        return;
      }

      if (visibleMatches.length) {
        if (window.eQualleSupabase) {
          window.eQualleSupabase.logSearch(message, visibleMatches.length, null);
        }
        return;
      }

      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(message, 0, null);
      }
      redirectToAskPage(message);
    }

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      runSearchAction();
    });

    if (submitButton) {
      submitButton.addEventListener("click", function (event) {
        event.preventDefault();
        runSearchAction();
      });
    }

    input.value = "";
  }

  function setupAiAssistantPage(basePath, knowledge) {
    const shell = parseExistingShell(document.querySelector("[data-ai-chat]"));
    if (!shell) {
      return;
    }

    const requester = createAssistantRequester(basePath, knowledge);
    const chat = wireChat(shell, requester, basePath, {
      source: "ai-assistant-page",
    });
    const params = new URLSearchParams(window.location.search);
    const q = String(params.get("q") || "").trim();
    if (q) {
      shell.input.value = "";
      shell.messages.innerHTML = "";
      chat.ask(q, { auto: true });
    }
  }

  function setupSupportFollowup(basePath, knowledge) {
    const followupRoot = document.querySelector("[data-solution-followup]");
    const form = document.querySelector("[data-solution-followup-form]");
    const input = document.querySelector("[data-solution-followup-input]");
    const messages = document.querySelector("[data-solution-followup-messages]");
    const solutionContext = readSolutionContextFromPage();

    if (!followupRoot || !form || !input || !messages || !solutionContext) {
      return;
    }

    const shell = {
      root: followupRoot,
      form: form,
      input: input,
      messages: messages,
    };

    const requester = createAssistantRequester(basePath, knowledge);
    wireChat(shell, requester, basePath, {
      source: "solution_followup",
      noAutoScroll: true,
      getRequestContext: function () {
        return {
          source: "solution_followup",
          solution_id: solutionContext.solution_id || "",
          solution_slug: solutionContext.solution_slug || "",
          solution_context: {
            title: solutionContext.title || "",
            problem: solutionContext.problem || "",
            surface: solutionContext.surface || "",
            task: solutionContext.task || "",
            symptom: solutionContext.symptom || "",
            quick_answer: solutionContext.quick_answer || "",
            best_grit_path: Array.isArray(solutionContext.best_grit_path)
              ? solutionContext.best_grit_path.slice(0, 10)
              : [],
            optional_starting_grits: Array.isArray(solutionContext.optional_starting_grits)
              ? solutionContext.optional_starting_grits.slice(0, 6)
              : [],
            steps: Array.isArray(solutionContext.steps)
              ? solutionContext.steps.slice(0, 10)
              : [],
            why_it_happens: solutionContext.why_it_happens || "",
            mistakes_to_avoid: Array.isArray(solutionContext.mistakes_to_avoid)
              ? solutionContext.mistakes_to_avoid.slice(0, 8)
              : [],
            success_check: solutionContext.success_check || "",
            wet_or_dry: solutionContext.wet_or_dry || "",
            related_solution_ids: Array.isArray(solutionContext.related_solution_ids)
              ? solutionContext.related_solution_ids.slice(0, 10)
              : [],
          },
        };
      },
    });
  }

  function init(options) {
    const basePath = (options && options.basePath) || "/sandpaper_support";

    setCurrentPage();
    getSessionToken();

    buildKnowledge(basePath)
      .then(function (knowledge) {
        setupHomepageSearch(basePath, knowledge);
        setupSupportFollowup(basePath, knowledge);
        setupAiAssistantPage(basePath, knowledge);
      })
      .catch(function () {
        return;
      });
  }

  window.eQualleSupportAssistant = {
    init: init,
  };
})();

