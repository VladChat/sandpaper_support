// assets/support-auth-request-fix.js
// Purpose: keep email-authenticated AI requests using a fresh Supabase access token, preserve photo payloads, and expose safe image diagnostics.
(function () {
  var FIX_MARKER = "support-auth-session-request-fix-photo-v2";

  function getApi() {
    return window.eQualleSupabase || null;
  }

  function getConfig() {
    var config = window.eQualleConfig || {};
    return {
      url: String(config.SUPABASE_URL || "").replace(/\/$/, ""),
      anonKey: String(config.SUPABASE_ANON_KEY || ""),
    };
  }

  function hasImages(payload) {
    return Boolean(
      payload &&
        typeof payload === "object" &&
        Array.isArray(payload.images) &&
        payload.images.length > 0
    );
  }

  function setImageDebugAttributes(payload, result) {
    var count = hasImages(payload) ? payload.images.length : 0;
    var accepted = result && typeof result.imageAccepted !== "undefined"
      ? Boolean(result.imageAccepted)
      : false;
    var resultCount = result && Number.isFinite(result.imageCount)
      ? result.imageCount
      : count;

    try {
      document.documentElement.setAttribute("data-last-ai-image-client-sent", String(count > 0));
      document.documentElement.setAttribute("data-last-ai-image-client-count", String(count));
      document.documentElement.setAttribute("data-last-ai-image-accepted", String(accepted));
      document.documentElement.setAttribute("data-last-ai-image-count", String(resultCount));
    } catch (_error) {
      return;
    }
  }

  function postSupportAssistantDirect(payload) {
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({
        ok: false,
        error: "supabase_not_configured",
      });
    }

    var authToken = payload && payload.accessToken ? payload.accessToken : config.anonKey;

    return fetch(config.url + "/functions/v1/support-ai-chat", {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          var result = Object.assign({}, body || {}, {
            status: response.status,
          });

          if (typeof result.ok !== "boolean") {
            result.ok = response.ok;
          }

          setImageDebugAttributes(payload, result);
          return result;
        });
      })
      .catch(function () {
        setImageDebugAttributes(payload, { imageAccepted: false, imageCount: 0 });
        return {
          ok: false,
          error: "assistant_unavailable",
        };
      });
  }

  function getFreshAccessToken(api) {
    if (!api) {
      return Promise.resolve("");
    }

    if (typeof api.getSession === "function") {
      return Promise.resolve(api.getSession())
        .then(function (result) {
          var session = result && result.session;
          if (session && session.access_token) {
            return session.access_token;
          }

          if (typeof api.getAccessToken === "function") {
            return api.getAccessToken() || "";
          }

          return "";
        })
        .catch(function () {
          return typeof api.getAccessToken === "function" ? (api.getAccessToken() || "") : "";
        });
    }

    return Promise.resolve(typeof api.getAccessToken === "function" ? (api.getAccessToken() || "") : "");
  }

  function wrapAskSupportAssistant() {
    var api = getApi();
    if (!api || typeof api.askSupportAssistant !== "function" || api.__authRequestFixApplied === FIX_MARKER) {
      return Boolean(api && api.__authRequestFixApplied === FIX_MARKER);
    }

    var originalAsk = api.askSupportAssistant;

    api.askSupportAssistant = function (payload) {
      var nextPayload = payload && typeof payload === "object" ? Object.assign({}, payload) : payload;

      if (!nextPayload || typeof nextPayload !== "object") {
        return originalAsk.call(api, payload);
      }

      return getFreshAccessToken(api).then(function (accessToken) {
        if (accessToken) {
          nextPayload.accessToken = accessToken;
        }

        // Important: the older supabase-client request path may rebuild/trim the payload.
        // For photo requests, call the Edge Function directly so top-level images[] cannot be dropped.
        if (hasImages(nextPayload)) {
          setImageDebugAttributes(nextPayload, { imageAccepted: false, imageCount: nextPayload.images.length });
          return postSupportAssistantDirect(nextPayload);
        }

        return originalAsk.call(api, nextPayload);
      });
    };

    api.__authRequestFixApplied = FIX_MARKER;
    return true;
  }

  function getShellContainer(messages, options) {
    options = options || {};
    if (options.shell && options.shell.root) {
      return options.shell.root;
    }
    if (messages && messages.closest) {
      return messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
    }
    return null;
  }

  function hasSignedInStatus(container) {
    return Boolean(container && container.querySelector(".support-auth-status"));
  }

  function clearSignedInStatus(container) {
    if (!container) {
      return;
    }
    Array.prototype.slice.call(container.querySelectorAll(".support-auth-status")).forEach(function (node) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function appendSessionExpiredMessage(messages) {
    if (!messages || messages.querySelector("[data-auth-session-expired-message]")) {
      return;
    }

    var message = document.createElement("div");
    message.className = "chat-message chat-message-assistant chat-message-compact";
    message.setAttribute("data-auth-session-expired-message", "");
    message.textContent = "Your session expired. Please sign in again to continue.";
    messages.appendChild(message);
  }

  function signOutQuietly() {
    var api = getApi();
    if (!api || typeof api.signOut !== "function") {
      return;
    }
    Promise.resolve(api.signOut()).catch(function () {
      return null;
    });
  }

  function patchLoginRequiredGate() {
    var shared = window.eQualleSupportAssistantShared;
    if (!shared || typeof shared.appendLoginRequiredCard !== "function" || shared.__authLoginGateFixApplied === FIX_MARKER) {
      return Boolean(shared && shared.__authLoginGateFixApplied === FIX_MARKER);
    }

    var originalAppendLoginRequiredCard = shared.appendLoginRequiredCard;

    shared.appendLoginRequiredCard = function (messages, options) {
      options = options || {};
      var container = getShellContainer(messages, options);
      var wasSignedIn = hasSignedInStatus(container);

      if (wasSignedIn) {
        clearSignedInStatus(container);
        appendSessionExpiredMessage(messages);
        signOutQuietly();
      }

      return originalAppendLoginRequiredCard.call(shared, messages, options);
    };

    shared.__authLoginGateFixApplied = FIX_MARKER;
    return true;
  }

  function install() {
    var wrapped = wrapAskSupportAssistant();
    var patched = patchLoginRequiredGate();
    return wrapped && patched;
  }

  if (install()) {
    return;
  }

  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;
    if (install() || attempts >= 80) {
      window.clearInterval(timer);
    }
  }, 100);
})();
