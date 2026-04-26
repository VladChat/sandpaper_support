function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function setupFeedback() {
  const cards = document.querySelectorAll(".answer-card");

  if (!cards.length) {
    return;
  }

  cards.forEach(function (card) {
    if (card.querySelector("[data-feedback-panel]")) {
      return;
    }

    const panel = document.createElement("div");
    panel.className = "feedback-panel";
    panel.setAttribute("data-feedback-panel", "");
    panel.innerHTML =
      '<div class="feedback-title">Was this helpful?</div>' +
      '<div class="feedback-actions">' +
      '<button type="button" data-feedback-helpful>Helpful</button>' +
      '<button type="button" data-feedback-not-helpful>Not helpful</button>' +
      "</div>" +
      '<form class="feedback-detail" data-feedback-detail hidden>' +
      '<label for="feedback-message-' +
      card.id +
      '">What was missing?</label>' +
      '<textarea id="feedback-message-' +
      card.id +
      '" rows="3" placeholder="Optional details"></textarea>' +
      '<button type="submit">Submit feedback</button>' +
      "</form>" +
      '<div class="feedback-status" data-feedback-status aria-live="polite"></div>';

    const status = panel.querySelector("[data-feedback-status]");
    const detail = panel.querySelector("[data-feedback-detail]");
    const textarea = panel.querySelector("textarea");

    function showStatus(message) {
      status.textContent = message;
    }

    function submit(feedbackType, rating, message) {
      if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
        showStatus("Feedback is saved only when support logging is enabled.");
        return Promise.resolve();
      }

      return window.eQualleSupabase
        .submitFeedback({
          pagePath: window.location.pathname + window.location.hash,
          problemSlug: getProblemSlug(),
          feedbackType: feedbackType,
          rating: rating,
          message: message || "",
        })
        .then(function (result) {
          showStatus(
            result && result.ok
              ? "Thanks for the feedback."
              : "Feedback could not be sent right now.",
          );
        });
    }

    panel
      .querySelector("[data-feedback-helpful]")
      .addEventListener("click", function () {
        detail.hidden = true;
        submit("helpful", 5, "");
      });

    panel
      .querySelector("[data-feedback-not-helpful]")
      .addEventListener("click", function () {
        detail.hidden = false;
        textarea.focus();
      });

    detail.addEventListener("submit", function (event) {
      event.preventDefault();
      submit("not_helpful", 1, textarea.value);
      detail.hidden = true;
    });

    card.appendChild(panel);
  });
}

function clean(value) {
  return String(value || "").toLowerCase().trim();
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

function normalizePath(basePath, target) {
  const value = String(target || "").trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.indexOf(basePath + "/") === 0 || value === basePath) {
    return value;
  }
  if (value.charAt(0) === "/") {
    return basePath + value;
  }
  return basePath + "/" + value;
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map(function (value) {
      return clean(value);
    })
    .filter(Boolean);
}

function queryTerms(query) {
  return clean(query)
    .split(/\s+/)
    .filter(function (term) {
      return term.length > 1;
    });
}

function phraseStartsWithQuery(values, query) {
  const q = clean(query);
  return normalizeList(values).some(function (value) {
    if (value.indexOf(q) === 0) {
      return true;
    }
    return value.split(/\s+/).some(function (word) {
      return word.indexOf(q) === 0;
    });
  });
}

function scoreSearchEntry(entry, query) {
  const q = clean(query);
  const terms = queryTerms(query);
  const title = clean(entry.title);
  const description = clean(entry.description);
  const customerPhrases = normalizeList(entry.customer_phrases);
  const aliases = normalizeList(entry.aliases);
  const surfaces = normalizeList(entry.surface);
  const grits = normalizeList(entry.grits);
  const methods = normalizeList(entry.method);
  const shortQuery = q.length <= 4;
  let score = 0;
  let meaningfulMatches = 0;
  let exactPhrase = false;

  if (!q || q.length < 3) {
    return 0;
  }

  if (shortQuery) {
    if (phraseStartsWithQuery([title], q)) {
      score += 60;
    }
    if (phraseStartsWithQuery(customerPhrases, q)) {
      score += 55;
    }
    if (phraseStartsWithQuery(aliases, q)) {
      score += 50;
    }
    if (surfaces.some(function (surface) { return surface.indexOf(q) === 0; })) {
      score += 45;
    }
    if (grits.indexOf(q) !== -1) {
      score += 45;
    }
    return score;
  }

  if (title.indexOf(q) !== -1) {
    score += 120;
    exactPhrase = true;
  }
  if (customerPhrases.some(function (phrase) { return phrase.indexOf(q) !== -1; })) {
    score += 110;
    exactPhrase = true;
  }
  if (aliases.some(function (alias) { return alias.indexOf(q) !== -1; })) {
    score += 95;
    exactPhrase = true;
  }

  terms.forEach(function (term) {
    if (title.indexOf(term) !== -1) {
      score += 18;
      meaningfulMatches += 1;
    } else if (customerPhrases.some(function (phrase) { return phrase.indexOf(term) !== -1; })) {
      score += 16;
      meaningfulMatches += 1;
    } else if (aliases.some(function (alias) { return alias.indexOf(term) !== -1; })) {
      score += 14;
      meaningfulMatches += 1;
    } else if (
      surfaces.some(function (surface) { return surface.indexOf(term) !== -1; }) ||
      grits.indexOf(term) !== -1 ||
      methods.some(function (method) { return method.indexOf(term) !== -1; })
    ) {
      score += 8;
      meaningfulMatches += 1;
    } else if (description.indexOf(term) !== -1) {
      score += 2;
    }
  });

  if (terms.length > 1 && !exactPhrase && meaningfulMatches < 2) {
    return 0;
  }

  if (entry.type === "exact_scenario") {
    score += 12;
  }

  return score;
}

function findMatches(entries, query) {
  return entries
    .map(function (entry) {
      return {
        entry: entry,
        score: scoreSearchEntry(entry, query),
      };
    })
    .filter(function (item) {
      return item.score > 0;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, 7)
    .map(function (item) {
      return item.entry;
    });
}

function renderMatches(container, matches, basePath) {
  container.innerHTML = "";

  matches.forEach(function (entry) {
    const link = document.createElement("a");
    link.className = "result-link";
    link.href = normalizePath(basePath, entry.target_url);
    link.textContent = entry.title || "Support page";
    link.addEventListener("click", function () {
      if (window.eQualleSupabase && window.eQualleSupabase.isConfigured()) {
        window.eQualleSupabase.logSearch(container.getAttribute("data-last-query") || "", matches.length, entry.target_url);
      }
    });
    container.appendChild(link);
  });
}

function renderEmpty(container) {
  container.innerHTML = '<div class="search-results-empty">No exact support page found. Press Enter to ask support.</div>';
}

function renderAssistantAnswer(container, result, basePath) {
  const panel = document.createElement("div");
  panel.className = "support-ai-answer";

  const title = document.createElement("div");
  title.className = "support-ai-answer-title";
  title.textContent = "Support answer";
  panel.appendChild(title);

  const body = document.createElement("div");
  body.className = "support-ai-answer-body";
  body.textContent = result && result.reply ? result.reply : "Support answer is unavailable right now.";
  panel.appendChild(body);

  if (result && Array.isArray(result.matchedPages) && result.matchedPages.length) {
    const links = document.createElement("div");
    links.className = "support-ai-answer-links";
    result.matchedPages.forEach(function (page) {
      if (!page || !page.path) {
        return;
      }
      const link = document.createElement("a");
      link.href = normalizePath(basePath, page.path);
      link.textContent = page.title || "Related support page";
      links.appendChild(link);
    });
    if (links.children.length) {
      panel.appendChild(links);
    }
  }

  container.innerHTML = "";
  container.appendChild(panel);
}

function setupSearch(basePath) {
  const input = document.querySelector("[data-support-search]");
  const results = document.querySelector("[data-search-results]");

  if (!input || !results) {
    return;
  }

  fetch(basePath + "/data/search-index.json", { cache: "no-cache" })
    .then(function (response) {
      return response.ok ? response.json() : [];
    })
    .then(function (entries) {
      const searchEntries = Array.isArray(entries) ? entries : [];

      const logSearch = debounce(function (query, count) {
        if (window.eQualleSupabase && window.eQualleSupabase.isConfigured()) {
          window.eQualleSupabase.logSearch(query, count, null);
        }
      }, 900);

      function updateResults() {
        const query = input.value.trim();
        results.setAttribute("data-last-query", query);

        if (query.length < 3) {
          results.innerHTML = "";
          return [];
        }

        const matches = findMatches(searchEntries, query);
        if (matches.length) {
          renderMatches(results, matches, basePath);
        } else {
          renderEmpty(results);
        }
        logSearch(query, matches.length);
        return matches;
      }

      const debouncedUpdate = debounce(updateResults, 120);

      input.addEventListener("input", debouncedUpdate);
      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        const query = input.value.trim();
        const matches = updateResults();

        if (!query || query.length < 3) {
          return;
        }

        if (matches.length) {
          window.location.href = normalizePath(basePath, matches[0].target_url);
          return;
        }

        if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
          renderEmpty(results);
          return;
        }

        results.innerHTML = '<div class="search-results-empty">Checking approved support guides...</div>';
        window.eQualleSupabase
          .askSupportAssistant({
            sessionToken: "support-search-session",
            userMessage: query,
            context: {
              currentPath: window.location.pathname,
              currentTitle: document.title,
              lastQuery: query,
              lastMatches: [],
              source: "main-search",
            },
          })
          .then(function (result) {
            renderAssistantAnswer(results, result, basePath);
          });
      });
    });
}

setupFeedback();
setupSearch("/sandpaper_support");
