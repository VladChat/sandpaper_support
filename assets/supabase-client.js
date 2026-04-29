(function () {
  var ADMIN_SESSION_KEY = "equalle_admin_session";
  var SUPPORT_SESSION_KEY = "equalle_support_session";
  var gateState = {
    pendingTurnstileToken: "",
    activeChallengePromise: null,
    activeChallengeNode: null,
  };

  function getConfig() {
    var config = window.eQualleConfig || {};
    return {
      url: String(config.SUPABASE_URL || "").replace(/\/$/, ""),
      anonKey: String(config.SUPABASE_ANON_KEY || ""),
      turnstileSiteKey: String(config.TURNSTILE_SITE_KEY || ""),
    };
  }

  function buildQuery(params) {
    params = params || {};
    return Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }

  function isConfigured() {
    var config = getConfig();
    return Boolean(config.url && config.anonKey);
  }

  function getSessionToken() {
    try {
      var existing = window.sessionStorage.getItem(SUPPORT_SESSION_KEY);
      if (existing) {
        return existing;
      }
      var token = "session-" + Math.random().toString(36).slice(2) + Date.now();
      window.sessionStorage.setItem(SUPPORT_SESSION_KEY, token);
      return token;
    } catch (_error) {
      return null;
    }
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
        window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(ADMIN_SESSION_KEY);
      }
    } catch (_error) {
      return;
    }
  }

  function readStoredSession() {
    try {
      var raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
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

  function readTable(table, params) {
    var session = readStoredSession();

    if (!session || !session.access_token) {
      return Promise.resolve({
        ok: false,
        status: 401,
        error: "Sign in before reading admin data.",
        data: [],
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
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true, error: "Supabase is not configured." });
    }

    return fetch(config.url + "/rest/v1/support_feedback", {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        page_path: input.pagePath || window.location.pathname,
        problem_slug: input.problemSlug || null,
        feedback_type: input.feedbackType || null,
        rating: Number.isFinite(input.rating) ? input.rating : null,
        message: input.message || null,
        user_agent: window.navigator ? window.navigator.userAgent : null,
      }),
    })
      .then(function (response) {
        if (response.ok) {
          return {
            ok: true,
            status: response.status,
            data: [],
            error: null,
          };
        }

        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          return {
            ok: false,
            status: response.status,
            data: [],
            error: (body && (body.message || body.error_description || body.error || body.hint)) || "Feedback request failed.",
          };
        });
      })
      .catch(function () {
        return { ok: false, error: "Feedback request failed." };
      });
  }

  function readFeedbackPublicCounts(pagePath) {
    var config = getConfig();
    var normalizedPath = String(pagePath || "").trim();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true, data: [] });
    }

    if (!normalizedPath) {
      return Promise.resolve({ ok: false, error: "pagePath is required.", data: [] });
    }

    var query = buildQuery({
      select: "feedback_type,created_at",
      page_path: "eq." + normalizedPath,
      feedback_type: "in.(helpful,not_helpful)",
      order: "created_at.desc",
      limit: 2000,
    });

    return fetch(config.url + "/rest/v1/support_feedback_public_counts?" + query, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return [];
        }).then(function (body) {
          return {
            ok: response.ok,
            status: response.status,
            data: Array.isArray(body) ? body : [],
            error: response.ok ? null : (body && (body.message || body.error || body.hint)) || "Count query failed.",
          };
        });
      })
      .catch(function () {
        return { ok: false, data: [], error: "Count query failed." };
      });
  }

  function readFeedbackPublicCountsLegacy(pagePath) {
    var config = getConfig();
    var normalizedPath = String(pagePath || "").trim();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true, data: [] });
    }

    if (!normalizedPath) {
      return Promise.resolve({ ok: false, error: "pagePath is required.", data: [] });
    }

    var query = buildQuery({
      select: "feedback_type,created_at",
      page_path: "eq." + normalizedPath,
      feedback_type: "in.(helpful,not_helpful)",
      order: "created_at.desc",
      limit: 2000,
    });

    return fetch(config.url + "/rest/v1/support_feedback?" + query, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return [];
        }).then(function (body) {
          return {
            ok: response.ok,
            status: response.status,
            data: Array.isArray(body) ? body : [],
            error: response.ok ? null : (body && (body.message || body.error || body.hint)) || "Legacy count query failed.",
          };
        });
      })
      .catch(function () {
        return { ok: false, data: [], error: "Legacy count query failed." };
      });
  }

  function readFeedbackRows(params) {
    return readTable("support_feedback", Object.assign(
      {
        select: "page_path,feedback_type,created_at",
        feedback_type: "in.(helpful,not_helpful)",
        order: "created_at.desc",
        limit: 1000,
      },
      params || {},
    ));
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

    return readFeedbackPublicCounts(normalizedPath).then(function (result) {
      if (result && !result.ok && result.status === 404) {
        return readFeedbackPublicCountsLegacy(normalizedPath);
      }
      return result;
    }).then(function (result) {
      var helpful = 0;
      var notHelpful = 0;
      var latestAt = null;

      if (!result || !result.ok) {
        return {
          ok: false,
          status: result ? result.status : null,
          error: result ? result.error : "Count query failed.",
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
          error: result ? result.error : "Feedback summary query failed.",
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

  function findActiveMessages() {
    var active = document.activeElement;
    var shell = active && active.closest ? active.closest(".chat-shell, [data-ai-chat]") : null;
    var messages = shell ? shell.querySelector("[data-ai-messages], .chat-messages, [data-solution-followup-messages]") : null;

    if (messages) {
      return messages;
    }

    var all = Array.prototype.slice.call(
      document.querySelectorAll("[data-ai-messages], .solution-followup-messages, .chat-messages"),
    );

    return all.length ? all[all.length - 1] : null;
  }

  function setChatLocked(messages, locked) {
    if (!messages) {
      return;
    }

    var shell = messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
    if (!shell) {
      return;
    }

    shell.classList.toggle("support-chat-locked", Boolean(locked));
    Array.prototype.slice.call(shell.querySelectorAll("input, textarea, button[type='submit']")).forEach(function (element) {
      element.disabled = Boolean(locked);
    });
  }

  function createGateCard(kind, title, text) {
    var card = document.createElement("div");
    card.className = "support-" + kind + "-card";

    var titleNode = document.createElement("div");
    titleNode.className = "support-" + kind + "-card-title";
    titleNode.textContent = title;
    card.appendChild(titleNode);

    var textNode = document.createElement("p");
    textNode.className = "support-" + kind + "-card-text";
    textNode.textContent = text;
    card.appendChild(textNode);

    return card;
  }

  function loadTurnstileApi() {
    if (window.turnstile && typeof window.turnstile.render === "function") {
      return Promise.resolve(window.turnstile);
    }

    return new Promise(function (resolve, reject) {
      var existing = document.getElementById("cloudflare-turnstile-api");
      if (existing) {
        existing.addEventListener("load", function () {
          resolve(window.turnstile);
        });
        existing.addEventListener("error", function () {
          reject(new Error("Turnstile could not be loaded."));
        });
        return;
      }

      var script = document.createElement("script");
      script.id = "cloudflare-turnstile-api";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = function () {
        resolve(window.turnstile);
      };
      script.onerror = function () {
        reject(new Error("Turnstile could not be loaded."));
      };
      document.head.appendChild(script);
    });
  }

  function renderTurnstileChallenge(options) {
    options = options || {};

    if (gateState.activeChallengePromise) {
      return gateState.activeChallengePromise;
    }

    var config = getConfig();
    var messages = findActiveMessages();
    var siteKey = config.turnstileSiteKey;

    gateState.activeChallengePromise = new Promise(function (resolve, reject) {
      if (!messages) {
        gateState.activeChallengePromise = null;
        reject(new Error("Chat container was not found."));
        return;
      }

      if (!siteKey || siteKey === "PASTE_PUBLIC_TURNSTILE_SITE_KEY") {
        var missingCard = createGateCard(
          "verification",
          "Verification Required",
          "Turnstile is not configured yet. Add the public Turnstile site key in assets/config.js.",
        );
        messages.appendChild(missingCard);
        gateState.activeChallengeNode = missingCard;
        setChatLocked(messages, true);
        gateState.activeChallengePromise = null;
        reject(new Error("TURNSTILE_SITE_KEY is not configured."));
        return;
      }

      if (gateState.activeChallengeNode && gateState.activeChallengeNode.parentNode) {
        gateState.activeChallengeNode.parentNode.removeChild(gateState.activeChallengeNode);
      }

      var card = createGateCard(
        "verification",
        "Quick Verification",
        options.text || "To continue asking questions, please complete this quick verification.",
      );
      var widget = document.createElement("div");
      widget.className = "support-turnstile-widget";
      card.appendChild(widget);

      var status = document.createElement("div");
      status.className = "support-verification-status";
      status.textContent = "Waiting for verification...";
      card.appendChild(status);

      messages.appendChild(card);
      gateState.activeChallengeNode = card;
      setChatLocked(messages, true);

      loadTurnstileApi()
        .then(function (turnstile) {
          if (!turnstile || typeof turnstile.render !== "function") {
            throw new Error("Turnstile render function is unavailable.");
          }

          turnstile.render(widget, {
            sitekey: siteKey,
            callback: function (token) {
              gateState.pendingTurnstileToken = token;
              status.textContent = "Verification complete. You can continue.";
              setChatLocked(messages, false);
              gateState.activeChallengePromise = null;
              resolve(token);
            },
            "error-callback": function () {
              status.textContent = "Verification failed. Please try again.";
            },
            "expired-callback": function () {
              gateState.pendingTurnstileToken = "";
              status.textContent = "Verification expired. Please verify again.";
            },
          });
        })
        .catch(function (error) {
          status.textContent = error && error.message ? error.message : "Verification could not be loaded.";
          setChatLocked(messages, false);
          gateState.activeChallengePromise = null;
          reject(error);
        });
    });

    return gateState.activeChallengePromise;
  }

  function renderSimpleGate(kind, title, text) {
    var messages = findActiveMessages();
    if (!messages) {
      return;
    }
    messages.appendChild(createGateCard(kind, title, text));
  }

  function displayReplyForBlockedResponse(code, message, status) {
    if (code === "login_required") {
      renderSimpleGate("login", "Email Login Required", message || "Sign in with email to continue.");
      return {
        ok: true,
        status: status || 403,
        reply: "Answer Summary: Sign in with email to continue.\nNext Step: Email login is required before more AI questions.",
        needsClarification: false,
        clarifyingQuestion: "",
        matchedPages: [],
        draftCreated: false,
        code: code,
      };
    }

    if (code === "rate_limited") {
      renderSimpleGate("rate-limit", "Please Wait", message || "Please wait a few minutes before asking again.");
      return {
        ok: true,
        status: status || 429,
        reply: "Answer Summary: Please wait a few minutes before asking again.\nNext Step: Try again shortly.",
        needsClarification: false,
        clarifyingQuestion: "",
        matchedPages: [],
        draftCreated: false,
        code: code,
      };
    }

    return {
      ok: false,
      status: status || 500,
      error: code || "assistant_unavailable",
      message: message || "Assistant response is unavailable right now.",
    };
  }

  function fetchAiChat(input, turnstileToken) {
    var config = getConfig();
    var tokenToSend = turnstileToken || input.turnstileToken || gateState.pendingTurnstileToken || "";

    if (tokenToSend && tokenToSend === gateState.pendingTurnstileToken) {
      gateState.pendingTurnstileToken = "";
    }

    return fetch(config.url + "/functions/v1/support-ai-chat", {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionToken: input.sessionToken || getSessionToken(),
        userMessage: input.userMessage,
        context: input.context || {},
        turnstileToken: tokenToSend || undefined,
        accessToken: input.accessToken || undefined,
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
      });
  }

  function askSupportAssistant(input) {
    input = input || {};
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true });
    }

    function handleBody(body, retryAllowed) {
      if (body && body.ok) {
        if (body.nextAction === "turnstile_required") {
          window.setTimeout(function () {
            renderTurnstileChallenge({
              text: "To continue asking questions, please complete this quick verification.",
            }).catch(function () {
              return;
            });
          }, 80);
        }

        if (body.nextAction === "login_required") {
          window.setTimeout(function () {
            renderSimpleGate("login", "Email Login Required", "Sign in with email to continue.");
          }, 80);
        }

        return body;
      }

      if (body && body.code === "turnstile_required" && retryAllowed) {
        return renderTurnstileChallenge({
          text: body.message || "Please complete the verification to continue.",
        }).then(function (token) {
          return fetchAiChat(input, token).then(function (retryBody) {
            if (retryBody && retryBody.ok) {
              return handleBody(retryBody, false);
            }
            return displayReplyForBlockedResponse(
              retryBody && retryBody.code,
              retryBody && retryBody.message,
              retryBody && retryBody.status,
            );
          });
        }).catch(function (error) {
          return displayReplyForBlockedResponse(
            "turnstile_required",
            error && error.message ? error.message : "Please complete the verification to continue.",
            403,
          );
        });
      }

      if (body && (body.code === "login_required" || body.code === "rate_limited")) {
        return displayReplyForBlockedResponse(body.code, body.message, body.status);
      }

      return {
        ok: false,
        status: body ? body.status : null,
        error: (body && (body.error || body.code)) || "assistant_unavailable",
        message: body && body.message,
      };
    }

    return fetchAiChat(input, "")
      .then(function (body) {
        return handleBody(body, true);
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
