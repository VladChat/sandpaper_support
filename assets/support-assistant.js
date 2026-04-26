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
        const shortQuery = loweredQuery.length <= 4;
        const vagueTerms = {
          help: true,
          issue: true,
          problem: true,
          sanding: true,
          sandpaper: true,
          sand: true,
          paper: true,
          guide: true,
          use: true,
        };
        const meaningfulTerms = terms.filter(function (term) {
          return term.length > 2 && !vagueTerms[term];
        });

        if (!loweredQuery || loweredQuery.length < 3) {
          return [];
        }

        return searchEntries
          .map(function (entry) {
            const title = clean(entry.title || "");
            const description = clean(entry.description || "");
            const aliases = normalizeList(entry.aliases);
            const customerPhrases = normalizeList(entry.customer_phrases);
            const surfaces = normalizeList(entry.surface);
            const grits = normalizeList(entry.grits);
            const methods = normalizeList(entry.method);

            let score = 0;
            let matchedTerms = 0;
            let meaningfulTermMatches = 0;
            let hasStrongSignal = false;
            const exactPhraseMatch =
              title.indexOf(loweredQuery) !== -1 ||
              customerPhrases.some(function (phrase) {
                return phrase.indexOf(loweredQuery) !== -1;
              }) ||
              aliases.some(function (alias) {
                return alias.indexOf(loweredQuery) !== -1;
              });

            if (shortQuery) {
              if (phraseStartsWithQuery([title], loweredQuery)) {
                score += 55;
                hasStrongSignal = true;
              }
              if (phraseStartsWithQuery(aliases, loweredQuery)) {
                score += 50;
                hasStrongSignal = true;
              }
              if (phraseStartsWithQuery(customerPhrases, loweredQuery)) {
                score += 50;
                hasStrongSignal = true;
              }
              if (grits.indexOf(loweredQuery) !== -1) {
                score += 48;
                hasStrongSignal = true;
              }

              if (!hasStrongSignal) {
                score = 0;
              }
            } else {
              if (title.indexOf(loweredQuery) !== -1) {
                score += 120;
                hasStrongSignal = true;
              }
              if (customerPhrases.some(function (phrase) {
                return phrase.indexOf(loweredQuery) !== -1;
              })) {
                score += 115;
                hasStrongSignal = true;
              }
              if (aliases.some(function (alias) {
                return alias.indexOf(loweredQuery) !== -1;
              })) {
                score += 108;
                hasStrongSignal = true;
              }

              if (phraseStartsWithQuery([title], loweredQuery)) {
                score += 70;
                hasStrongSignal = true;
              }
              if (phraseStartsWithQuery(customerPhrases, loweredQuery)) {
                score += 65;
                hasStrongSignal = true;
              }
              if (phraseStartsWithQuery(aliases, loweredQuery)) {
                score += 58;
                hasStrongSignal = true;
              }

              terms.forEach(function (term) {
                let termMatched = false;
                let strongMatch = false;
                let semanticMatch = false;

                if (title.indexOf(term) !== -1) {
                  score += 16;
                  termMatched = true;
                  strongMatch = true;
                  semanticMatch = true;
                } else if (customerPhrases.some(function (phrase) {
                  return phrase.indexOf(term) !== -1;
                })) {
                  score += 14;
                  termMatched = true;
                  strongMatch = true;
                  semanticMatch = true;
                } else if (aliases.some(function (alias) {
                  return alias.indexOf(term) !== -1;
                })) {
                  score += 12;
                  termMatched = true;
                  strongMatch = true;
                  semanticMatch = true;
                } else if (
                  grits.indexOf(term) !== -1 ||
                  surfaces.some(function (surface) {
                    return surface.indexOf(term) !== -1;
                  }) ||
                  methods.some(function (method) {
                    return method.indexOf(term) !== -1;
                  })
                ) {
                  score += 8;
                  termMatched = true;
                  semanticMatch = true;
                } else if (description.indexOf(term) !== -1) {
                  score += 3;
                  termMatched = true;
                }

                if (termMatched) {
                  matchedTerms += 1;
                  if (!vagueTerms[term] && (strongMatch || semanticMatch)) {
                    meaningfulTermMatches += 1;
                  }
                }
              });

              if (terms.length > 1) {
                score += matchedTerms * 6;
                if (matchedTerms === terms.length) {
                  score += 20;
                }
                if (matchedTerms < 2) {
                  score -= 25;
                }
              } else if (terms.length === 1 && vagueTerms[terms[0]] && !hasStrongSignal) {
                score -= 35;
              }

              if (matchedTerms === 1 && meaningfulTermMatches === 0 && !hasStrongSignal) {
                score -= 25;
              }
            }

            if (entry.type === "exact_scenario") {
              score += 12;
            }

            return {
              score: score,
              entry: entry,
              exactPhraseMatch: exactPhraseMatch,
              meaningfulTermMatches: meaningfulTermMatches,
            };
          })
          .filter(function (item) {
            if (item.score <= 0) {
              return false;
            }

            if (terms.length > 1) {
              if (item.exactPhraseMatch) {
                return true;
              }

              if (item.meaningfulTermMatches >= 2) {
                return true;
              }

              if (meaningfulTerms.length < 2) {
                return false;
              }

              return false;
            }

            return true;
          })
          .sort(function (a, b) {
            if (b.score !== a.score) {
              return b.score - a.score;
            }

            if (a.entry.type === "exact_scenario" && b.entry.type !== "exact_scenario") {
              return -1;
            }
            if (b.entry.type === "exact_scenario" && a.entry.type !== "exact_scenario") {
              return 1;
            }

            return 0;
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

  function attachPageTopAssistant(basePath) {
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
    const homepageConversation = [];

    const logRenderedSearch = debounce(function (query, resultCount) {
      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(query, resultCount, null);
      }
    }, 600);

    function addConversationEntry(role, text, links, pending) {
      homepageConversation.push({
        role: role,
        text: text,
        links: Array.isArray(links) ? links : [],
        pending: Boolean(pending),
      });
    }

    function logAssistantMessage(role, text) {
      pushSessionArray(
        STORAGE_KEYS.assistantMessages,
        {
          role: role,
          text: text,
          at: new Date().toISOString(),
          source: "homepage-search",
        },
        30,
      );
    }

    function renderConversationBlock() {
      if (!homepageConversation.length) {
        return null;
      }

      const block = document.createElement("div");
      block.className = "chat-shell support-home-conversation";

      const messages = document.createElement("div");
      messages.className = "chat-messages";
      messages.setAttribute("aria-live", "polite");

      homepageConversation.forEach(function (entry) {
        const message = appendMessage(messages, entry.role, entry.text);
        if (entry.pending) {
          message.classList.add("chat-message-pending");
        }

        if (entry.links && entry.links.length) {
          appendLinks(messages, entry.links, basePath, function (page) {
            recordClickedPage(page.path, page.title);
          });
        }
      });

      block.appendChild(messages);
      return block;
    }

    function renderOutput(q, matches) {
      results.innerHTML = "";

      if (!q) {
        return;
      }

      if (q.length < 3) {
        const hint = document.createElement("div");
        hint.className = "result-link";
        hint.textContent = "Type at least 3 characters to see matching support pages.";
        results.appendChild(hint);
      } else if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "result-link";
        empty.textContent =
          "No exact match yet. Press Enter to ask the assistant, or keep typing.";
        results.appendChild(empty);
      } else {
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
      }

      const conversation = renderConversationBlock();
      if (conversation) {
        results.appendChild(conversation);
      }
    }

    function sendAssistantQuery(userMessage, options) {
      const message = String(userMessage || "").trim();
      if (!message) {
        return;
      }

      const isAuto = Boolean(options && options.auto);

      addConversationEntry("user", message, [], false);
      logAssistantMessage("user", message);

      addConversationEntry("assistant", "Checking approved support guides...", [], true);

      const currentMatches = getStoredJson(STORAGE_KEYS.lastMatches, []);
      renderOutput(message, currentMatches);

      requester(message, {
        source: "homepage-search",
        mode: isAuto ? "auto" : "manual",
      }).then(function (result) {
        const pending = homepageConversation[homepageConversation.length - 1];
        if (!pending || pending.role !== "assistant" || !pending.pending) {
          return;
        }

        if (!result.ok) {
          pending.pending = false;
          pending.text =
            "Assistant response is unavailable right now. Approved support guides are still shown above.";
          logAssistantMessage("assistant", pending.text);
          renderOutput(message, currentMatches);
          return;
        }

        pending.pending = false;
        pending.text = result.reply || "I need one more detail to guide you.";
        pending.links = Array.isArray(result.matchedPages) ? result.matchedPages : [];
        logAssistantMessage("assistant", pending.text);

        if (result.needsClarification && result.clarifyingQuestion) {
          addConversationEntry(
            "assistant",
            result.clarifyingQuestion,
            [],
            false,
          );
          logAssistantMessage("assistant", result.clarifyingQuestion);
        }

        renderOutput(message, currentMatches);
      });
    }

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

      sendAssistantQuery(query, { auto: true });
    }, 800);

    function render(query) {
      const q = clean(query).trim();
      const matches = q && q.length >= 3 ? knowledge.findSearchMatches(q, 7) : [];

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
        results.innerHTML = "";
        return;
      }

      logRenderedSearch(q, matches.length);

      renderOutput(q, matches);

      if (!matches.length && q.length >= 4) {
        scheduleAutoAsk(q);
      }
    }

    input.addEventListener("input", function (event) {
      render(event.target.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      const message = input.value.trim();
      if (!message) {
        return;
      }

      sendAssistantQuery(message, { auto: false });
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
    return;
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
