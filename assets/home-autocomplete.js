import Fuse from "./vendor/fuse.min.mjs";

(function () {
  window.eQualleUseAlgoliaAutocomplete = true;

  const input = document.querySelector("[data-support-search]");
  const results = document.querySelector("[data-search-results]");
  const submit = document.querySelector("[data-support-search-submit]");

  if (!input || !results) {
    return;
  }

  const basePath = (function () {
    const pathname = String(window.location.pathname || "");
    const match = pathname.match(/^(.*?\/sandpaper_support)(?:\/|$)/);
    return match && match[1] ? match[1] : "/sandpaper_support";
  })();

  const MAX_RESULTS = 8;
  let currentResults = [];
  let fuse = null;
  let searchEntries = [];

  function clean(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function normalizePath(target) {
    const candidate = clean(target);
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

  function textFromArray(value) {
    return Array.isArray(value)
      ? value.map(function (item) { return clean(item); }).filter(Boolean)
      : [];
  }

  function toDoc(entry, index) {
    return {
      id: clean(entry.id) || "entry-" + String(index),
      title: clean(entry.title),
      description: clean(entry.description),
      customer_phrases: textFromArray(entry.customer_phrases),
      aliases: textFromArray(entry.aliases),
      surface: textFromArray(entry.surface),
      grits: textFromArray(entry.grits),
      method: textFromArray(entry.method),
      target_url: clean(entry.target_url),
      result_kind: clean(entry.result_kind) || "answer",
    };
  }

  function buildIndex(entries) {
    const docs = [];
    const seen = new Set();

    (Array.isArray(entries) ? entries : []).forEach(function (entry, index) {
      const doc = toDoc(entry, index);
      if (!doc.title || !doc.target_url) {
        return;
      }

      const dedupeKey = doc.target_url + "::" + doc.title;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      docs.push(doc);
    });

    return docs;
  }

  function createFuse(docs) {
    return new Fuse(docs, {
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      threshold: 0.4,
      minMatchCharLength: 1,
      keys: [
        { name: "title", weight: 0.4 },
        { name: "customer_phrases", weight: 0.23 },
        { name: "aliases", weight: 0.14 },
        { name: "description", weight: 0.12 },
        { name: "surface", weight: 0.05 },
        { name: "grits", weight: 0.03 },
        { name: "method", weight: 0.03 },
      ],
    });
  }

  function getBoostScore(doc, query) {
    const q = lower(query);
    if (!q) {
      return 0;
    }

    const title = lower(doc.title);
    const phrases = (doc.customer_phrases || []).map(lower);

    let boost = 0;
    if (title.startsWith(q)) {
      boost += 50;
    }
    if (title.indexOf(q) !== -1) {
      boost += 25;
    }
    if (phrases.some(function (p) { return p.indexOf(q) !== -1; })) {
      boost += 20;
    }
    return boost;
  }

  function rankResults(query) {
    const q = clean(query);
    if (!q || !fuse) {
      return [];
    }

    const boosted = searchEntries
      .map(function (doc) {
        return {
          doc: doc,
          score: getBoostScore(doc, q),
        };
      })
      .filter(function (row) {
        return row.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (row) {
        return row.doc;
      });

    const fuzzy = fuse.search(q, { limit: 40 }).map(function (row) {
      return row.item;
    });

    const deduped = [];
    const seenTargets = new Set();

    boosted.concat(fuzzy).forEach(function (doc) {
      const key = clean(doc.target_url);
      if (!key || seenTargets.has(key)) {
        return;
      }
      seenTargets.add(key);
      deduped.push(doc);
    });

    return deduped.slice(0, MAX_RESULTS);
  }

  function createResultNode(doc) {
    const link = document.createElement("a");
    link.className = "result-link";
    link.href = normalizePath(doc.target_url);

    const kind = document.createElement("span");
    kind.className = "result-kind result-kind-answer";
    kind.textContent = "Answer";

    const text = document.createElement("span");
    text.className = "result-text";

    const title = document.createElement("span");
    title.className = "result-title-link";
    title.textContent = doc.title;

    text.appendChild(title);

    if (doc.description) {
      const description = document.createElement("span");
      description.className = "result-description";
      description.textContent = " - " + doc.description;
      text.appendChild(description);
    }

    link.appendChild(kind);
    link.appendChild(text);

    return link;
  }

  function renderResults(query) {
    const q = clean(query);
    results.innerHTML = "";

    if (!q) {
      currentResults = [];
      return;
    }

    currentResults = rankResults(q);

    if (!currentResults.length) {
      const empty = document.createElement("div");
      empty.className = "result-link result-empty";
      empty.textContent = "No matching answers found.";
      results.appendChild(empty);
      return;
    }

    currentResults.forEach(function (doc) {
      results.appendChild(createResultNode(doc));
    });
  }

  function openFirstOrAsk() {
    const query = clean(input.value);
    if (!query) {
      input.focus();
      return;
    }

    if (!currentResults.length) {
      currentResults = rankResults(query);
    }

    if (currentResults.length) {
      window.location.href = normalizePath(currentResults[0].target_url);
      return;
    }

    window.location.href = normalizePath("/ask/") + "?q=" + encodeURIComponent(query);
  }

  function bindEvents() {
    input.autocomplete = "off";

    input.addEventListener("input", function () {
      renderResults(input.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        openFirstOrAsk();
      }
    });

    if (submit) {
      submit.addEventListener("click", function (event) {
        event.preventDefault();
        openFirstOrAsk();
      });
    }
  }

  loadSupportJson("data/search-index.json")
    .then(function (entries) {
      searchEntries = buildIndex(entries);
      fuse = createFuse(searchEntries);
      bindEvents();
      console.log("eQualle homepage autocomplete initialized");
    })
    .catch(function (error) {
      console.error("Failed to load data/search-index.json", error);
    });
})();
