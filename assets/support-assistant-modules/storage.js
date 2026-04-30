// assets/support-assistant-modules/storage.js
// Purpose: session storage and page tracking helpers.
(function (shared) {
  if (!shared) {
    return;
  }

  const STORAGE_KEYS = shared.STORAGE_KEYS;
  function parseJson() { return shared.parseJson.apply(shared, arguments); }
  function stripSiteTitle() { return shared.stripSiteTitle.apply(shared, arguments); }


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

  Object.assign(shared, {
    getStoredText: getStoredText,
    setStoredText: setStoredText,
    getStoredJson: getStoredJson,
    setStoredJson: setStoredJson,
    getSessionToken: getSessionToken,
    pushSessionArray: pushSessionArray,
    setCurrentPage: setCurrentPage,
    recordClickedPage: recordClickedPage,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
