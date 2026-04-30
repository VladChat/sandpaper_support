import Fuse from "./vendor/fuse.min.mjs";

(function () {
  window.eQualleUseUnifiedAutocomplete = true;
  window.eQualleUseAlgoliaAutocomplete = true;

  const basePath = (function () {
    const pathname = String(window.location.pathname || "");
    const match = pathname.match(/^(.*?\/sandpaper_support)(?:\/|$)/);
    return match && match[1] ? match[1] : "/sandpaper_support";
  })();

  const MAX_RESULTS = 8;
  const GENERIC_FIX_PREFIX = "How do I fix ";
  const states = new WeakMap();
  let fuse = null;
  let suggestions = [];
  let dataReady = false;

  function clean(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function normalizePath(target) {
    const candidate = clean(target);
    if (!candidate) return "";
    if (/^https?:\/\//i.test(candidate)) return candidate;
    if (candidate.indexOf(basePath + "/") === 0 || candidate === basePath) return candidate;
    if (candidate.charAt(0) === "/") return basePath + candidate;
    return basePath + "/" + candidate;
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-cache" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + path);
      }
      return response.json();
    });
  }

  function loadSupportJson(path) {
    return loadJson(basePath + "/" + path).catch(function () {
      return loadJson(path);
    });
  }

  function toFixQuestion(rawTitle) {
    const phrase = clean(rawTitle)
      .replace(/\?+$/g, "")
      .replace(/^[Ww]hat\s+grit\s+should\s+I\s+use.*$/i, "")
      .replace(/^[Hh]ow\s+do\s+I\s+fix\s+/i, "")
      .replace(/^[Hh]ow\s+to\s+/i, "")
      .trim();

    if (!phrase) {
      return "";
    }

    return GENERIC_FIX_PREFIX + phrase.toLowerCase() + "?";
  }

  function buildVisibleTitle(entry) {
    const rawTitle = clean(entry.title);
    const description = clean(entry.description);

    if (!rawTitle) {
      return "";
    }

    if (
      /\?$/.test(rawTitle) ||
      /^how\s|^what\s|^which\s|^can\s|^should\s|^why\s|^is\s|^when\s|^where\s|^does\s|^do\s/i.test(rawTitle)
    ) {
      return rawTitle;
    }

    const manualMap = [
      { pattern: /paint clogs/i, title: "How do I fix clogged sandpaper?" },
      {
        pattern: /sheet feels smooth but stops cutting|stops cutting fast|worn sheet not cutting/i,
        title: "How do I fix sandpaper that stops cutting?",
      },
      {
        pattern: /primer dust loads paper|primer dust loading/i,
        title: "How do I fix primer dust loading the paper?",
      },
      { pattern: /wood dust clogs paper/i, title: "How do I fix wood dust clogging the paper?" },
      {
        pattern: /deep scratches remain after 80 grit|scratches too deep/i,
        title: "How do I remove deep sanding scratches?",
      },
      {
        pattern: /wet sanding haze remains|wet sanding haze|wet sanding leaves haze/i,
        title: "How do I reduce wet sanding haze?",
      },
      { pattern: /plastic still feels rough|plastic still rough/i, title: "How do I sand plastic smoother?" },
    ];

    for (const rule of manualMap) {
      if (rule.pattern.test(rawTitle) || rule.pattern.test(description)) {
        return rule.title;
      }
    }

    if (
      /clog|does not|won't|won t|remain|remains|still|too\s|fails|fail|problem|issue|rough|haze|scratches|tears|curls|stops cutting/i.test(
        rawTitle + " " + description,
      )
    ) {
      return toFixQuestion(rawTitle) || rawTitle;
    }

    if (/^what\s+grit\s+/i.test(rawTitle)) {
      return rawTitle.endsWith("?") ? rawTitle : rawTitle + "?";
    }

    return rawTitle;
  }

  function buildSuggestions(entries) {
    const list = [];
    const seen = new Set();

    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      const target_url = clean(entry && entry.target_url);
      const description = clean(entry && entry.description);
      const result_kind = clean(entry && entry.result_kind) || "answer";
      const visibleTitle = buildVisibleTitle(entry);

      if (!target_url || !visibleTitle) {
        return;
      }

      const key = target_url;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      list.push({
        visibleTitle: visibleTitle,
        description: description,
        target_url: target_url,
        result_kind: result_kind,
      });
    });

    return list;
  }

  function createFuse(list) {
    return new Fuse(list, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.35,
      minMatchCharLength: 1,
      keys: [{ name: "visibleTitle", weight: 1 }],
    });
  }

  function getPrefixMatches(query) {
    const q = lower(query);
    if (!q) return [];
    return suggestions
      .filter(function (item) {
        return lower(item.visibleTitle).startsWith(q);
      })
      .slice(0, 40);
  }

  function getContainsMatches(query) {
    const q = lower(query);
    if (!q) return [];
    return suggestions
      .filter(function (item) {
        const title = lower(item.visibleTitle);
        return !title.startsWith(q) && title.indexOf(q) !== -1;
      })
      .slice(0, 40);
  }

  function getFuzzyMatches(query) {
    if (!fuse) return [];
    return fuse.search(clean(query), { limit: 40 }).map(function (row) {
      return row.item;
    });
  }

  function rankResults(query) {
    const q = clean(query);
    if (!q) return [];
    const qLower = lower(q);
    const enforceFixOnly = qLower.startsWith("how to fix");

    const deduped = [];
    const seenTargets = new Set();

    const ordered = getPrefixMatches(q)
      .concat(getContainsMatches(q))
      .concat(getFuzzyMatches(q));

    ordered.forEach(function (item) {
      if (!item || !item.target_url || seenTargets.has(item.target_url)) {
        return;
      }
      if (enforceFixOnly && !lower(item.visibleTitle).startsWith("how do i fix")) {
        return;
      }
      seenTargets.add(item.target_url);
      deduped.push(item);
    });

    return deduped.slice(0, MAX_RESULTS);
  }

  function resolveSearchResultsNode(input) {
    const shell = input.closest(".support-search-shell");
    if (shell) {
      const inShell = shell.querySelector("[data-search-results]");
      if (inShell) return inShell;
    }

    const form = input.closest(".support-search-form");
    if (form && form.parentElement) {
      const nearForm = form.parentElement.querySelector("[data-search-results]");
      if (nearForm) return nearForm;
    }

    return document.querySelector("[data-search-results]");
  }

  function resolveSubmitButton(input) {
    const shell = input.closest(".support-search-shell");
    if (shell) {
      const inShell = shell.querySelector("[data-support-search-submit]");
      if (inShell) return inShell;
    }

    const form = input.closest(".support-search-form");
    if (form) {
      const inForm = form.querySelector("[data-support-search-submit]");
      if (inForm) return inForm;
    }

    return null;
  }

  function createResultNode(item) {
    const link = document.createElement("a");
    link.className = "result-link";
    link.href = normalizePath(item.target_url);

    const kind = document.createElement("span");
    kind.className = "result-kind result-kind-answer";
    kind.textContent = "Answer";

    const text = document.createElement("span");
    text.className = "result-text";

    const title = document.createElement("span");
    title.className = "result-title-link";
    title.textContent = item.visibleTitle;
    text.appendChild(title);

    if (item.description) {
      const description = document.createElement("span");
      description.className = "result-description";
      description.textContent = " - " + item.description;
      text.appendChild(description);
    }

    link.appendChild(kind);
    link.appendChild(text);
    return link;
  }

  function renderResults(state, query) {
    const q = clean(query);
    state.resultsNode.innerHTML = "";

    if (!q) {
      state.currentResults = [];
      return;
    }

    state.currentResults = rankResults(q);

    if (!state.currentResults.length) {
      const empty = document.createElement("div");
      empty.className = "result-link result-empty";
      empty.textContent = "No matching answers found.";
      state.resultsNode.appendChild(empty);
      return;
    }

    state.currentResults.forEach(function (item) {
      state.resultsNode.appendChild(createResultNode(item));
    });
  }

  function resetFreshAskStorage(query) {
    try {
      const cleanQuery = lower(query);
      window.sessionStorage.setItem("lastQuery", cleanQuery);
      window.sessionStorage.setItem("lastMatches", "[]");
      window.sessionStorage.setItem("clickedPages", "[]");
      window.sessionStorage.setItem(
        "eQualleAssistantConversationV2",
        JSON.stringify({
          sessionId: "conv-" + Math.random().toString(36).slice(2) + Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          initialQuestion: clean(query),
          lastPage: {
            path: window.location.pathname || "",
            title: document.title || "",
          },
          turns: [],
        }),
      );
    } catch (_error) {
      return;
    }
  }

  function askCurrentQuery(state) {
    const query = clean(state.input.value);
    if (!query) {
      state.input.focus();
      return;
    }

    resetFreshAskStorage(query);
    window.location.href = normalizePath("/ask/") + "?q=" + encodeURIComponent(query);
  }

  function bindSearchInput(input) {
    if (states.has(input)) {
      return;
    }

    const resultsNode = resolveSearchResultsNode(input);
    if (!resultsNode) {
      return;
    }

    const state = {
      input: input,
      resultsNode: resultsNode,
      submit: resolveSubmitButton(input),
      currentResults: [],
    };
    states.set(input, state);
    input.autocomplete = "off";

    input.addEventListener("input", function () {
      renderResults(state, input.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        askCurrentQuery(state);
      }
    });

    if (state.submit) {
      state.submit.addEventListener("click", function (event) {
        event.preventDefault();
        askCurrentQuery(state);
      });
    }
  }

  function bindAllInputs(root) {
    if (!dataReady) {
      return;
    }

    const scope = root && root.querySelectorAll ? root : document;
    Array.prototype.slice.call(scope.querySelectorAll("[data-support-search]")).forEach(function (input) {
      bindSearchInput(input);
    });
  }

  function setupDynamicBinding() {
    document.addEventListener("support-search-bar:ready", function (event) {
      bindAllInputs(event && event.detail && event.detail.root ? event.detail.root : document);
    });

    if (!window.MutationObserver) {
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches("[data-support-search]")) {
            bindAllInputs(node.parentNode || document);
            return;
          }
          if (node.querySelectorAll && node.querySelector("[data-support-search]")) {
            bindAllInputs(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  setupDynamicBinding();

  loadSupportJson("data/search-index.json")
    .then(function (entries) {
      suggestions = buildSuggestions(entries);
      fuse = createFuse(suggestions);
      dataReady = true;
      bindAllInputs(document);
      console.log("eQualle homepage autocomplete initialized");
    })
    .catch(function (error) {
      console.error("Failed to load data/search-index.json", error);
    });
})();
