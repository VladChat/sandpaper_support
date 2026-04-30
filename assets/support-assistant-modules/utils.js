// assets/support-assistant-modules/utils.js
// Purpose: generic utility helpers.
(function (shared) {
  if (!shared) {
    return;
  }

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

  function isSupportLeaf(pathname, basePath) {
    const scopedPath = String(pathname || "").replace(basePath, "");
    return /^\/(problems|solutions)\/[^/]+\/?$/.test(scopedPath);
  }

  Object.assign(shared, {
    clean: clean,
    isOrderTrackingQuery: isOrderTrackingQuery,
    debounce: debounce,
    parseJson: parseJson,
    normalizePath: normalizePath,
    stripSiteTitle: stripSiteTitle,
    loadJson: loadJson,
    loadSupportJson: loadSupportJson,
    toTerms: toTerms,
    normalizeList: normalizeList,
    phraseStartsWithQuery: phraseStartsWithQuery,
    scoreHaystack: scoreHaystack,
    appendMessage: appendMessage,
    isSupportLeaf: isSupportLeaf,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
