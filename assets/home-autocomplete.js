import Fuse from "./vendor/fuse.min.mjs";

(function () {
  window.eQualleUseAlgoliaAutocomplete = true;

  const basePath = (function () {
    const pathname = String(window.location.pathname || "");
    const match = pathname.match(/^(.*?\/sandpaper_support)(?:\/|$)/);
    return match && match[1] ? match[1] : "/sandpaper_support";
  })();

  function clean(value) {
    return String(value || "").trim();
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

  function toSlug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildSearchDocuments(searchEntries, solutionCards, problemTree) {
    const docs = [];
    const seen = new Set();

    const cardById = new Map();
    solutionCards.forEach(function (card) {
      if (card && card.id) {
        cardById.set(String(card.id), card);
      }
    });

    (Array.isArray(searchEntries) ? searchEntries : []).forEach(function (entry) {
      if (!entry) return;
      const target = String(entry.target_url || "");
      if (!target.startsWith("/solutions/")) return;

      const id = String(entry.id || entry.slug || target).trim();
      if (!id || seen.has(id)) return;
      seen.add(id);

      const solutionIdMatch = target.match(/\/solutions\/([^/]+)\/?$/);
      const card = solutionIdMatch ? cardById.get(solutionIdMatch[1]) : null;

      docs.push({
        id: id,
        type: "Answer",
        title: clean(entry.title) || clean(card && card.title),
        description: clean(entry.description) || clean(card && card.problem),
        tags: (card && Array.isArray(card.search_phrases) ? card.search_phrases : []),
        surface: clean(card && card.surface),
        grit: clean(card && card.recommended_grit),
        category: clean(card && card.task) || "support answer",
        target_url: target,
      });
    });

    (Array.isArray(problemTree) ? problemTree : []).forEach(function (group) {
      if (!group || !group.id || !group.title) return;
      const target = "/problems/" + String(group.id).replace(/^\/+|\/+$/g, "") + "/";
      const uniqueId = "problem-" + String(group.id);
      if (seen.has(uniqueId)) return;
      seen.add(uniqueId);

      docs.push({
        id: uniqueId,
        type: "Problem",
        title: clean(group.title),
        description: clean(group.description || "Problem guide with related sanding answers."),
        tags: Array.isArray(group.search_terms) ? group.search_terms : [],
        surface: "",
        grit: "",
        category: "problem guide",
        target_url: target,
      });
    });

    return docs.filter(function (doc) {
      return doc.title && doc.target_url;
    });
  }

  function createFuse(docs) {
    return new Fuse(docs, {
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      threshold: 0.42,
      minMatchCharLength: 1,
      keys: [
        { name: "title", weight: 0.45 },
        { name: "tags", weight: 0.2 },
        { name: "surface", weight: 0.12 },
        { name: "grit", weight: 0.12 },
        { name: "description", weight: 0.08 },
        { name: "category", weight: 0.03 },
      ],
    });
  }

  function renderResultItem(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "result-link";

    const kindNode = document.createElement("span");
    kindNode.className = "result-kind result-kind-answer";
    kindNode.textContent = item.type || "Answer";

    const textNode = document.createElement("span");
    textNode.className = "result-text";

    const titleNode = document.createElement("a");
    titleNode.className = "result-title-link";
    titleNode.href = normalizePath(item.target_url || "");
    titleNode.textContent = item.title;

    textNode.appendChild(titleNode);

    if (item.description) {
      const descriptionNode = document.createElement("span");
      descriptionNode.className = "result-description";
      descriptionNode.textContent = " - " + item.description;
      textNode.appendChild(descriptionNode);
    }

    wrapper.appendChild(kindNode);
    wrapper.appendChild(textNode);

    return wrapper;
  }

  function initAutocomplete(docs, fuse) {
    const container = document.querySelector("[data-search-results]");
    const input = document.querySelector("[data-support-search]");
    const submitButton = document.querySelector("[data-support-search-submit]");

    if (!container || !input) {
      return;
    }

    const algoliaAutocomplete =
      window["@algolia/autocomplete-js"] && window["@algolia/autocomplete-js"].autocomplete;

    if (typeof algoliaAutocomplete !== "function") {
      return;
    }

    function runSearch(query) {
      const q = clean(query);
      if (!q) return [];
      return fuse.search(q, { limit: 8 }).map(function (row) {
        return row.item;
      });
    }

    function goToTarget(item) {
      const href = normalizePath(item && item.target_url ? item.target_url : "");
      if (!href) return;
      window.location.href = href;
    }

    const instance = algoliaAutocomplete({
      container: container,
      placeholder: input.getAttribute("placeholder") || "Describe the problem",
      openOnFocus: true,
      detachedMediaQuery: "none",
      defaultActiveItemId: 0,
      autoFocus: false,
      initialState: { query: "" },
      onSubmit: function (params) {
        const state = params.state;
        const active = state.collections && state.collections[0] && state.collections[0].items
          ? state.collections[0].items[state.activeItemId || 0]
          : null;
        if (active) {
          goToTarget(active);
          return;
        }
        const first = runSearch(state.query)[0];
        if (first) {
          goToTarget(first);
          return;
        }
        if (state.query) {
          window.location.href = normalizePath("/ask/") + "?q=" + encodeURIComponent(state.query);
        }
      },
      getSources: function (params) {
        const query = params.query;
        if (!clean(query)) {
          return [];
        }
        return [
          {
            sourceId: "local-support-results",
            getItems: function () {
              return runSearch(query);
            },
            onSelect: function (selectParams) {
              goToTarget(selectParams.item);
            },
            templates: {
              item: function (templateParams) {
                return renderResultItem(templateParams.item);
              },
              noResults: function () {
                const node = document.createElement("div");
                node.className = "result-link result-empty";
                node.textContent = "No matching answers found.";
                return node;
              },
            },
          },
        ];
      },
    });

    input.addEventListener("input", function () {
      instance.setQuery(input.value);
      instance.refresh();
      if (!clean(input.value)) {
        instance.setIsOpen(false);
      }
    });

    input.addEventListener("focus", function () {
      instance.setIsOpen(true);
      instance.refresh();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        instance.setIsOpen(true);
        instance.refresh();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        instance.submit();
      }
      if (event.key === "Escape") {
        instance.setIsOpen(false);
      }
    });

    if (submitButton) {
      submitButton.addEventListener("click", function (event) {
        event.preventDefault();
        instance.submit();
      });
    }
  }

  Promise.all([
    loadSupportJson("data/search-index.json"),
    loadSupportJson("data/solution-cards.json"),
    loadSupportJson("data/problem-tree.json"),
  ])
    .then(function (results) {
      const docs = buildSearchDocuments(results[0], results[1], results[2]);
      const fuse = createFuse(docs);
      initAutocomplete(docs, fuse);
    })
    .catch(function () {
      return;
    });
})();
