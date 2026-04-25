(function () {
  function getConfig() {
    var config = window.eQualleConfig || {};
    return {
      url: String(config.SUPABASE_URL || "").replace(/\/$/, ""),
      anonKey: String(config.SUPABASE_ANON_KEY || ""),
    };
  }

  function post(table, payload) {
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ skipped: true });
    }

    return fetch(config.url + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return { ok: response.ok, status: response.status };
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function isConfigured() {
    var config = getConfig();
    return Boolean(config.url && config.anonKey);
  }

  function logSearch(query, resultCount, selectedPath) {
    var cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
      return Promise.resolve({ skipped: true });
    }

    return post("search_logs", {
      query: cleanQuery,
      normalized_query: cleanQuery.toLowerCase(),
      result_count: Number.isFinite(resultCount) ? resultCount : null,
      selected_path: selectedPath || null,
      session_token: getSessionToken(),
      user_agent: window.navigator ? window.navigator.userAgent : null,
    });
  }

  function submitFeedback(input) {
    input = input || {};

    return post("support_feedback", {
      page_path: input.pagePath || window.location.pathname,
      problem_slug: input.problemSlug || null,
      feedback_type: input.feedbackType || null,
      rating: Number.isFinite(input.rating) ? input.rating : null,
      message: input.message || null,
      user_agent: window.navigator ? window.navigator.userAgent : null,
    });
  }

  function getSessionToken() {
    try {
      var key = "equalle_support_session";
      var existing = window.sessionStorage.getItem(key);

      if (existing) {
        return existing;
      }

      var token = "session-" + Math.random().toString(36).slice(2) + Date.now();
      window.sessionStorage.setItem(key, token);
      return token;
    } catch (_error) {
      return null;
    }
  }

  window.eQualleSupabase = {
    isConfigured: isConfigured,
    logSearch: logSearch,
    submitFeedback: submitFeedback,
  };
})();
