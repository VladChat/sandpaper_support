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

  function authFetch(path, options) {
    var config = getConfig();
    options = options || {};

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true });
    }

    return fetch(config.url + path, {
      method: options.method || "GET",
      headers: Object.assign(
        {
          apikey: config.anonKey,
          "Content-Type": "application/json",
        },
        options.headers || {},
      ),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  function saveSession(session) {
    try {
      if (session) {
        window.localStorage.setItem(
          "equalle_admin_session",
          JSON.stringify(session),
        );
      } else {
        window.localStorage.removeItem("equalle_admin_session");
      }
    } catch (_error) {
      return;
    }
  }

  function readStoredSession() {
    try {
      var raw = window.localStorage.getItem("equalle_admin_session");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function normalizeSession(body) {
    if (!body || !body.access_token) {
      return null;
    }

    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token || null,
      expires_at: body.expires_at || null,
      user: body.user || null,
    };
  }

  function signIn(email, password) {
    return authFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: {
        email: email,
        password: password,
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          if (!response.ok) {
            return {
              ok: false,
              status: response.status,
              error: body.error_description || body.msg || body.message,
            };
          }

          var session = normalizeSession(body);
          saveSession(session);
          return { ok: true, session: session };
        });
      })
      .catch(function () {
        return { ok: false, error: "Sign in failed." };
      });
  }

  function signOut() {
    var session = readStoredSession();

    if (!session || !session.access_token) {
      saveSession(null);
      return Promise.resolve({ ok: true });
    }

    return authFetch("/auth/v1/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
      },
    })
      .then(function (response) {
        saveSession(null);
        return { ok: response.ok, status: response.status };
      })
      .catch(function () {
        saveSession(null);
        return { ok: false };
      });
  }

  function getSession() {
    var session = readStoredSession();

    if (!session || !session.access_token) {
      return Promise.resolve({ ok: true, session: null });
    }

    return authFetch("/auth/v1/user", {
      headers: {
        Authorization: "Bearer " + session.access_token,
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          if (!response.ok) {
            saveSession(null);
            return { ok: false, status: response.status, session: null };
          }

          session.user = body;
          saveSession(session);
          return { ok: true, session: session };
        });
      })
      .catch(function () {
        return { ok: false, session: session };
      });
  }

  function buildQuery(params) {
    params = params || {};
    return Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }

  function readTable(table, params) {
    var session = readStoredSession();

    if (!session || !session.access_token) {
      return Promise.resolve({
        ok: false,
        status: 401,
        error: "Sign in before reading admin data.",
      });
    }

    var query = buildQuery(params);

    return authFetch("/rest/v1/" + table + (query ? "?" + query : ""), {
      headers: {
        Authorization: "Bearer " + session.access_token,
        Prefer: "count=exact",
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return [];
        }).then(function (body) {
          if (!response.ok) {
            return {
              ok: false,
              status: response.status,
              error: body.message || body.hint || "RLS may be blocking access.",
              data: [],
            };
          }

          return { ok: true, status: response.status, data: body };
        });
      })
      .catch(function () {
        return { ok: false, error: "Admin data could not be loaded.", data: [] };
      });
  }

  function writeTable(table, options) {
    var session = readStoredSession();
    options = options || {};

    if (!session || !session.access_token) {
      return Promise.resolve({
        ok: false,
        status: 401,
        error: "Sign in before changing admin data.",
      });
    }

    return authFetch("/rest/v1/" + table + (options.query || ""), {
      method: options.method || "POST",
      headers: Object.assign(
        {
          Authorization: "Bearer " + session.access_token,
          Prefer: options.prefer || "return=minimal",
        },
        options.headers || {},
      ),
      body: options.body || {},
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          if (!response.ok) {
            return {
              ok: false,
              status: response.status,
              error: body.message || body.hint || "RLS may be blocking this action.",
            };
          }

          return { ok: true, status: response.status, data: body };
        });
      })
      .catch(function () {
        return { ok: false, error: "Admin action could not be completed." };
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

  function readFeedbackRows(params) {
    var config = getConfig();
    var session = readStoredSession();
    var query = buildQuery(
      Object.assign(
        {
          select: "page_path,feedback_type,created_at",
          feedback_type: "in.(helpful,not_helpful)",
          order: "created_at.desc",
          limit: 1000,
        },
        params || {},
      ),
    );

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true, data: [] });
    }

    return fetch(config.url + "/rest/v1/support_feedback?" + query, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization:
          session && session.access_token
            ? "Bearer " + session.access_token
            : "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return [];
          })
          .then(function (body) {
            return {
              ok: response.ok,
              status: response.status,
              data: Array.isArray(body) ? body : [],
            };
          });
      })
      .catch(function () {
        return { ok: false, data: [] };
      });
  }

  function fetchFeedbackCounts(pagePath) {
    var normalizedPath = String(pagePath || "").trim();

    if (!normalizedPath) {
      return Promise.resolve({
        ok: false,
        error: "pagePath is required.",
        helpful: null,
        notHelpful: null,
        total: null,
        latestAt: null,
      });
    }

    return readFeedbackRows({
      page_path: "eq." + normalizedPath,
      limit: 2000,
    }).then(function (result) {
      var helpful = 0;
      var notHelpful = 0;
      var latestAt = null;

      if (!result || !result.ok) {
        return {
          ok: false,
          status: result ? result.status : null,
          helpful: null,
          notHelpful: null,
          total: null,
          latestAt: null,
        };
      }

      result.data.forEach(function (row) {
        if (row.feedback_type === "helpful") {
          helpful += 1;
        } else if (row.feedback_type === "not_helpful") {
          notHelpful += 1;
        }

        if (!latestAt && row.created_at) {
          latestAt = row.created_at;
        }
      });

      return {
        ok: true,
        status: result.status,
        helpful: helpful,
        notHelpful: notHelpful,
        total: helpful + notHelpful,
        latestAt: latestAt,
      };
    });
  }

  function fetchFeedbackSummary(params) {
    return readFeedbackRows(
      Object.assign(
        {
          limit: 5000,
        },
        params || {},
      ),
    ).then(function (result) {
      var byPage = {};

      if (!result || !result.ok) {
        return {
          ok: false,
          status: result ? result.status : null,
          data: [],
        };
      }

      result.data.forEach(function (row) {
        var pagePath = row.page_path || "(unknown)";
        if (!byPage[pagePath]) {
          byPage[pagePath] = {
            page_path: pagePath,
            helpful_count: 0,
            not_helpful_count: 0,
            total_count: 0,
            latest_feedback_at: null,
          };
        }

        if (row.feedback_type === "helpful") {
          byPage[pagePath].helpful_count += 1;
        } else if (row.feedback_type === "not_helpful") {
          byPage[pagePath].not_helpful_count += 1;
        }

        byPage[pagePath].total_count += 1;

        if (!byPage[pagePath].latest_feedback_at && row.created_at) {
          byPage[pagePath].latest_feedback_at = row.created_at;
        }
      });

      return {
        ok: true,
        status: result.status,
        data: Object.keys(byPage)
          .map(function (key) {
            return byPage[key];
          })
          .sort(function (a, b) {
            if (b.total_count !== a.total_count) {
              return b.total_count - a.total_count;
            }
            return a.page_path.localeCompare(b.page_path);
          }),
      };
    });
  }

  function askSupportAssistant(input) {
    input = input || {};
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true });
    }

    return fetch(config.url + "/functions/v1/support-ai-chat", {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionToken: input.sessionToken,
        userMessage: input.userMessage,
        context: input.context || {},
      }),
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          body.ok = response.ok;
          body.status = response.status;
          return body;
        });
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function fetchSearchLogs(params) {
    return readTable(
      "search_logs",
      Object.assign(
        {
          select: "id,query,normalized_query,result_count,selected_path,created_at",
          order: "created_at.desc",
          limit: 25,
        },
        params || {},
      ),
    );
  }

  function fetchFeedback(params) {
    return readTable(
      "support_feedback",
      Object.assign(
        {
          select:
            "id,page_path,problem_slug,feedback_type,rating,message,created_at",
          order: "created_at.desc",
          limit: 25,
        },
        params || {},
      ),
    );
  }

  function fetchDraftSolutionCards(params) {
    return readTable(
      "draft_solution_cards",
      Object.assign(
        {
          select:
            "id,problem_slug,title,likely_cause,recommended_grit,method,steps,avoid,success_check,validation_notes,status,updated_at,created_at",
          order: "updated_at.desc",
          limit: 25,
        },
        params || {},
      ),
    );
  }

  function createDraftSolutionCard(input) {
    input = input || {};

    if (!input.title) {
      return Promise.resolve({
        ok: false,
        error: "Draft title is required.",
      });
    }

    return writeTable("draft_solution_cards", {
      method: "POST",
      body: {
        source_session_id: null,
        problem_slug: input.problem_slug || null,
        title: input.title,
        likely_cause: input.likely_cause || null,
        recommended_grit: input.recommended_grit || null,
        method: input.method || "unknown",
        steps: Array.isArray(input.steps) ? input.steps : [],
        avoid: Array.isArray(input.avoid) ? input.avoid : [],
        success_check: input.success_check || null,
        validation_notes: input.validation_notes || null,
        status: "draft",
      },
    });
  }

  function updateDraftSolutionCardStatus(id, status) {
    if (!id || !status) {
      return Promise.resolve({
        ok: false,
        error: "Draft id and status are required.",
      });
    }

    return writeTable("draft_solution_cards", {
      method: "PATCH",
      query: "?id=eq." + encodeURIComponent(id),
      body: {
        status: status,
      },
    });
  }

  function enqueueContentSync(entityType, entityId, action) {
    if (!entityType || !entityId || !action) {
      return Promise.resolve({
        ok: false,
        error: "Entity type, entity id, and action are required.",
      });
    }

    return writeTable("content_sync_queue", {
      method: "POST",
      body: {
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        status: "pending",
      },
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
    askSupportAssistant: askSupportAssistant,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    fetchSearchLogs: fetchSearchLogs,
    fetchFeedback: fetchFeedback,
    fetchFeedbackCounts: fetchFeedbackCounts,
    fetchFeedbackSummary: fetchFeedbackSummary,
    fetchDraftSolutionCards: fetchDraftSolutionCards,
    createDraftSolutionCard: createDraftSolutionCard,
    updateDraftSolutionCardStatus: updateDraftSolutionCardStatus,
    enqueueContentSync: enqueueContentSync,
  };
})();
