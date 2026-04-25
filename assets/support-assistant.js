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
  };

  function clean(value) {
    return String(value || "").toLowerCase();
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
      card.problem_slug,
      card.title,
      card.problem,
      card.likely_cause,
      card.recommended_grit,
      card.wet_or_dry,
      card.success_check,
      ...(card.steps || []),
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
      surface: Array.isArray(entry.surface) ? entry.surface[0] || "" : "",
      goal: "",
    };
  }

  function compactSolutionCard(card) {
    return {
      title: card.title || "",
      problem: card.problem || "",
      likely_cause: card.likely_cause || "",
      recommended_grit: card.recommended_grit || "",
      wet_or_dry: card.wet_or_dry || "",
      steps: Array.isArray(card.steps) ? card.steps.slice(0, 5) : [],
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
    ]).then(function (results) {
      const searchEntries = Array.isArray(results[0]) ? results[0] : [];
      const solutionCards = Array.isArray(results[1]) ? results[1] : [];
      const gritSequences = Array.isArray(results[2]) ? results[2] : [];
      const surfaceMap = Array.isArray(results[3]) ? results[3] : [];

      const solutionById = {};
      solutionCards.forEach(function (card) {
        if (card && card.id) {
          solutionById[card.id] = card;
        }
      });

      function findSearchMatches(query, limit) {
        const terms = toTerms(query);
        const loweredQuery = clean(query).trim();

        if (!loweredQuery) {
          return [];
        }

        return searchEntries
          .map(function (entry) {
            const haystack = buildSearchHaystack(entry);
            let score = scoreHaystack(haystack, loweredQuery, terms);

            if (entry.type === "exact_scenario") {
              score += 4;
            }

            return {
              score: score,
              entry: entry,
            };
          })
          .filter(function (item) {
            return item.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, limit || 7)
          .map(function (item) {
            return item.entry;
          });
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

  function appendMessage(messages, role, text) {
    const node = document.createElement("div");
    node.className = "chat-message chat-message-" + role;
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function appendLinks(messages, pages, basePath, onClick) {
    if (!Array.isArray(pages) || !pages.length) {
      return;
    }

    const list = document.createElement("div");
    list.className = "chat-links";

    pages.forEach(function (page) {
      const rawPath = page && (page.path || page.href || page.url);
      const title = (page && (page.title || page.label)) || rawPath;

      if (!rawPath || !title) {
        return;
      }

      const link = document.createElement("a");
      link.href = normalizePath(basePath, rawPath);
      link.textContent = title;
      link.addEventListener("click", function () {
        if (typeof onClick === "function") {
          onClick({
            path: link.pathname,
            title: title,
          });
        }
      });
      list.appendChild(link);
    });

    if (list.children.length) {
      messages.appendChild(list);
      messages.scrollTop = messages.scrollHeight;
    }
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

  function isSupportLeaf(pathname, basePath) {
    const scopedPath = String(pathname || "").replace(basePath, "");
    return /^\/(problems|solutions)\/[^/]+\/?$/.test(scopedPath);
  }

  function attachPageFollowup(basePath) {
    if (!isSupportLeaf(window.location.pathname, basePath)) {
      return null;
    }

    if (document.querySelector("[data-support-followup]")) {
      return parseExistingShell(document.querySelector("[data-support-followup]"));
    }

    const answerCard = document.querySelector(".answer-card:last-of-type");
    if (!answerCard) {
      return null;
    }

    const block = document.createElement("section");
    block.className = "answer-card support-followup-card";
    block.setAttribute("data-support-followup", "");

    const heading = document.createElement("h2");
    heading.textContent = "Need more help with this issue?";
    block.appendChild(heading);

    const intro = document.createElement("p");
    intro.className = "section-intro";
    intro.textContent =
      "Ask a short follow-up and the assistant will answer from approved support guides.";
    block.appendChild(intro);

    const shell = buildAssistantShell({
      title: "Need more help with this issue?",
      description: "",
      placeholder: "Example: what should I do next?",
      initialMessage: "Share what you tried, and I will suggest the next support step.",
    });

    block.appendChild(shell.root.querySelector(".chat-shell"));

    answerCard.insertAdjacentElement("afterend", block);

    return {
      root: block,
      form: shell.form,
      input: shell.input,
      messages: shell.messages,
      setTitle: shell.setTitle,
      setDescription: shell.setDescription,
    };
  }

  function createAssistantRequester(basePath, knowledge) {
    return function requestAssistant(userMessage, context) {
      const currentTitle = stripSiteTitle(document.title);
      const currentPath = window.location.pathname;
      const lastMatches = getStoredJson(STORAGE_KEYS.lastMatches, []);

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

      const payload = {
        sessionToken: getSessionToken(),
        userMessage: userMessage,
        context: {
          currentPath: currentPath,
          currentTitle: currentTitle,
          lastQuery: getStoredText(STORAGE_KEYS.lastQuery, ""),
          lastMatches: getStoredJson(STORAGE_KEYS.lastMatches, []),
          clickedPages: getStoredJson(STORAGE_KEYS.clickedPages, []),
          retrievedContent: retrievedContent,
          source: context && context.source ? context.source : "site",
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

        return {
          ok: true,
          reply: result.reply,
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

      appendMessage(shell.messages, "user", message);

      const pending = appendMessage(
        shell.messages,
        "assistant",
        "Checking approved support guides...",
      );

      requester(message, {
        source: source,
        mode: meta && meta.auto ? "auto" : "manual",
      }).then(function (result) {
        if (!result.ok) {
          pending.textContent =
            "Assistant response is unavailable right now. Approved support guides are still shown above.";

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
          return;
        }

        pending.textContent = result.reply || "I need one more detail to guide you.";

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

        if (result.needsClarification && result.clarifyingQuestion) {
          appendMessage(shell.messages, "assistant", result.clarifyingQuestion);
        }

        appendLinks(shell.messages, result.matchedPages, basePath, function (page) {
          recordClickedPage(page.path, page.title);
        });
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
    const input = document.querySelector("[data-support-search]");
    const results = document.querySelector("[data-search-results]");

    if (!input || !results) {
      return;
    }

    const requester = createAssistantRequester(basePath, knowledge);

    const assistantShell = buildAssistantShell({
      title: "Ask a follow-up question about this issue",
      description: "Use this to narrow the exact next step.",
      placeholder: "Ask a follow-up question about this issue",
      initialMessage: "Ask about your exact surface, grit, or next step.",
    });

    assistantShell.root.classList.add("support-assistant-home");
    assistantShell.root.hidden = true;
    results.insertAdjacentElement("afterend", assistantShell.root);

    const chat = wireChat(assistantShell, requester, basePath, {
      source: "homepage-search",
    });

    const logRenderedSearch = debounce(function (query, resultCount) {
      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(query, resultCount, null);
      }
    }, 600);

    const scheduleAutoAsk = debounce(function (query) {
      const autoQueries = getStoredJson(STORAGE_KEYS.autoSubmittedQueries, []);
      if (autoQueries.indexOf(query) !== -1) {
        return;
      }

      autoQueries.push(query);
      while (autoQueries.length > 40) {
        autoQueries.shift();
      }
      setStoredJson(STORAGE_KEYS.autoSubmittedQueries, autoQueries);

      chat.ask(query, { auto: true });
    }, 800);

    function render(query) {
      const q = clean(query).trim();
      const matches = q ? knowledge.findSearchMatches(q, 7) : [];

      results.innerHTML = "";
      setStoredText(STORAGE_KEYS.lastQuery, q);
      setStoredJson(STORAGE_KEYS.lastMatches, matches.slice(0, 7).map(compactSearchEntry));

      pushSessionArray(
        STORAGE_KEYS.searchTrail,
        {
          query: q,
          resultCount: matches.length,
          at: new Date().toISOString(),
        },
        25,
      );

      if (!q) {
        assistantShell.root.hidden = true;
        return;
      }

      logRenderedSearch(q, matches.length);

      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "result-link";
        empty.textContent =
          "No exact match yet. Try: scratches, clogging, grit, haze, rough, swirl marks.";
        results.appendChild(empty);

        assistantShell.root.hidden = false;
        assistantShell.setTitle("Ask a follow-up question about this issue");
        assistantShell.setDescription("No exact page matched yet. The assistant can help route you.");

        if (q.length >= 4) {
          scheduleAutoAsk(q);
        }

        return;
      }

      matches.forEach(function (match) {
        const link = document.createElement("a");
        link.className = "result-link";
        link.href = normalizePath(basePath, match.target_url || match.targetUrl || "");
        link.textContent = match.title + " - " + match.description;

        link.addEventListener("click", function () {
          if (window.eQualleSupabase) {
            window.eQualleSupabase.logSearch(q, matches.length, link.pathname);
          }
          recordClickedPage(link.pathname, match.title);
        });

        results.appendChild(link);
      });

      assistantShell.root.hidden = false;
      assistantShell.setTitle("Ask a follow-up question about this issue");
      assistantShell.setDescription("Matches are shown above. Ask for the next exact step if needed.");
    }

    input.addEventListener("input", function (event) {
      render(event.target.value);
    });

    const initial = getStoredText(STORAGE_KEYS.lastQuery, "");
    if (initial) {
      input.value = initial;
      render(initial);
    }
  }

  function setupAiAssistantPage(basePath, knowledge) {
    const shell = parseExistingShell(document.querySelector("[data-ai-chat]"));
    if (!shell) {
      return;
    }

    const requester = createAssistantRequester(basePath, knowledge);
    wireChat(shell, requester, basePath, {
      source: "ai-assistant-page",
    });
  }

  function setupSupportFollowup(basePath, knowledge) {
    const shell = attachPageFollowup(basePath);
    if (!shell) {
      return;
    }

    const requester = createAssistantRequester(basePath, knowledge);
    wireChat(shell, requester, basePath, {
      source: "support-page-followup",
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
