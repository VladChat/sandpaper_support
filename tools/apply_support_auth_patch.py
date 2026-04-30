# tools/apply_support_auth_patch.py
# Purpose: apply email OTP auth gate, signed-in chat state, AI request logs, and feedback link logging to sandpaper_support.

from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT_FILES = [
    "assets/supabase-client.js",
    "assets/support-assistant.js",
    "assets/support-assistant-modules/requester.js",
    "assets/support-assistant-modules/chat.js",
    "assets/support-assistant-modules/shell.js",
    "assets/support-assistant.css",
    "supabase/functions/support-ai-chat/index.ts",
]

MIGRATION_NAME = "20260430_support_ai_auth_logs.sql"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        fail(f"Missing required file: {path}")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        fail(f"Anchor not found for {label}")
    if new in content:
        return content
    return content.replace(old, new, 1)


def regex_replace_once(content: str, pattern: str, replacement: str, label: str, flags: int = re.S) -> str:
    if re.search(pattern, content, flags) is None:
        fail(f"Regex anchor not found for {label}")
    # Use a callable replacement to avoid backslash escape processing in replacement text.
    updated, count = re.subn(pattern, lambda _m: replacement, content, count=1, flags=flags)
    if count != 1:
        fail(f"Regex replacement failed for {label}")
    return updated


def regex_replace_once_callback(content: str, pattern: str, repl, label: str, flags: int = re.S) -> str:
    if re.search(pattern, content, flags) is None:
        fail(f"Regex anchor not found for {label}")
    updated, count = re.subn(pattern, repl, content, count=1, flags=flags)
    if count != 1:
        fail(f"Regex replacement failed for {label}")
    return updated


def ensure_after(content: str, anchor: str, insert: str, label: str) -> str:
    if insert.strip() in content:
        return content
    if anchor not in content:
        fail(f"Anchor not found for {label}")
    return content.replace(anchor, anchor + insert, 1)


def backup_files(repo: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = repo / f".support_auth_backup_{stamp}"
    backup_root.mkdir(parents=True, exist_ok=True)
    for rel in ROOT_FILES:
        source = repo / rel
        if source.exists():
            target = backup_root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    return backup_root


def copy_migration(repo: Path, package_root: Path) -> None:
    source = package_root / "supabase" / "migrations" / MIGRATION_NAME
    target = repo / "supabase" / "migrations" / MIGRATION_NAME
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    shutil.copy2(source, target)


def patch_loader(repo: Path) -> None:
    path = repo / "assets/support-assistant.js"
    content = read(path)
    content = content.replace(
        'const CACHE_VERSION = "support-assistant-modular-20260430";',
        'const CACHE_VERSION = "support-assistant-auth-otp-20260430";',
    )
    write(path, content)


def patch_supabase_client(repo: Path) -> None:
    path = repo / "assets/supabase-client.js"
    content = read(path)

    content = ensure_after(
        content,
        'var SUPPORT_SESSION_KEY = "equalle_support_session";\n',
        '  var SUPPORT_AUTH_SESSION_KEY = "equalle_support_auth_session";\n',
        "support auth session key",
    )

    helpers = r'''

  function saveSupportAuthSession(session) {
    try {
      if (session) {
        window.localStorage.setItem(SUPPORT_AUTH_SESSION_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(SUPPORT_AUTH_SESSION_KEY);
      }
    } catch (_error) {
      return;
    }
  }

  function readSupportAuthSession() {
    try {
      var raw = window.localStorage.getItem(SUPPORT_AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function readActiveSession() {
    return readSupportAuthSession() || readStoredSession();
  }
'''
    content = ensure_after(
        content,
        "  function readStoredSession() {\n    try {\n      var raw = window.localStorage.getItem(ADMIN_SESSION_KEY);\n      return raw ? JSON.parse(raw) : null;\n    } catch (_error) {\n      return null;\n    }\n  }\n",
        helpers,
        "support auth storage helpers",
    )

    otp_functions = r'''

  function refreshSupportAuthSession(session) {
    if (!session || !session.refresh_token) {
      saveSupportAuthSession(null);
      return Promise.resolve({ ok: false, session: null });
    }

    return authFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: {
        refresh_token: session.refresh_token,
      },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          if (!response.ok) {
            saveSupportAuthSession(null);
            return {
              ok: false,
              status: response.status,
              session: null,
              error: body.error_description || body.msg || body.message,
            };
          }

          var refreshed = normalizeSession(body);
          saveSupportAuthSession(refreshed);
          return { ok: true, session: refreshed };
        });
      })
      .catch(function () {
        return { ok: false, session: null, error: "Session refresh failed." };
      });
  }

  function getSupportAuthSession() {
    var session = readSupportAuthSession();

    if (!session || !session.access_token) {
      return Promise.resolve({ ok: true, session: null });
    }

    var expiresAt = Number(session.expires_at || 0);
    var shouldRefresh = Boolean(session.refresh_token && expiresAt && expiresAt * 1000 < Date.now() + 60000);

    if (shouldRefresh) {
      return refreshSupportAuthSession(session);
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
          if (response.ok) {
            session.user = body;
            saveSupportAuthSession(session);
            return { ok: true, session: session };
          }

          if (session.refresh_token) {
            return refreshSupportAuthSession(session);
          }

          saveSupportAuthSession(null);
          return { ok: false, status: response.status, session: null };
        });
      })
      .catch(function () {
        return { ok: false, session: session };
      });
  }

  function getAccessToken() {
    var session = readSupportAuthSession();
    return session && session.access_token ? session.access_token : "";
  }

  function getSupportUser() {
    var session = readSupportAuthSession();
    return session && session.user ? session.user : null;
  }

  function sendEmailCode(email) {
    var cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || cleanEmail.indexOf("@") < 1) {
      return Promise.resolve({ ok: false, error: "Enter a valid email." });
    }

    return authFetch("/auth/v1/otp", {
      method: "POST",
      body: {
        email: cleanEmail,
        create_user: true,
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
              error: body.error_description || body.msg || body.message || "Code could not be sent.",
            };
          }

          return { ok: true, email: cleanEmail };
        });
      })
      .catch(function () {
        return { ok: false, error: "Code could not be sent." };
      });
  }

  function verifyEmailCode(email, code) {
    var cleanEmail = String(email || "").trim().toLowerCase();
    var cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);

    if (!cleanEmail || cleanEmail.indexOf("@") < 1) {
      return Promise.resolve({ ok: false, error: "Enter a valid email." });
    }

    if (cleanCode.length !== 6) {
      return Promise.resolve({ ok: false, error: "Enter the 6-digit code." });
    }

    return authFetch("/auth/v1/verify", {
      method: "POST",
      body: {
        email: cleanEmail,
        token: cleanCode,
        type: "email",
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
              error: body.error_description || body.msg || body.message || "Code is incorrect or expired.",
            };
          }

          var session = normalizeSession(body);
          saveSupportAuthSession(session);
          return { ok: true, session: session, user: session ? session.user : null };
        });
      })
      .catch(function () {
        return { ok: false, error: "Code could not be verified." };
      });
  }
'''
    content = ensure_after(
        content,
        "  function normalizeSession(body) {\n    if (!body || !body.access_token) {\n      return null;\n    }\n\n    return {\n      access_token: body.access_token,\n      refresh_token: body.refresh_token || null,\n      expires_at: body.expires_at || null,\n      user: body.user || null,\n    };\n  }\n",
        otp_functions,
        "email OTP auth functions",
    )

    signout = r'''  function signOut() {
    var session = readSupportAuthSession() || readStoredSession();

    saveSupportAuthSession(null);
    saveSession(null);

    if (!session || !session.access_token) {
      return Promise.resolve({ ok: true });
    }

    return authFetch("/auth/v1/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
      },
    })
      .then(function (response) {
        return { ok: response.ok, status: response.status };
      })
      .catch(function () {
        return { ok: false };
      });
  }

'''
    content = regex_replace_once(
        content,
        r"  function signOut\(\) \{.*?\n  \}\n\n  function getSession\(\) \{",
        signout + "  function getSession() {",
        "signOut replacement",
    )

    get_session_body = r'''  function getSession() {
    return getSupportAuthSession().then(function (supportResult) {
      if (supportResult && supportResult.session) {
        return supportResult;
      }

      var session = readStoredSession();

      if (!session || !session.access_token) {
        return { ok: true, session: null };
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
    });
  }

'''
    content = regex_replace_once(
        content,
        r"  function getSession\(\) \{.*?\n  \}\n\n  function readTable\(table, params\) \{",
        get_session_body + "  function readTable(table, params) {",
        "getSession replacement",
    )

    feedback_helper = r'''

  function normalizeAiFeedbackType(type) {
    if (type === "helpful") {
      return "like";
    }
    if (type === "not_helpful") {
      return "dislike";
    }
    if (type === "like" || type === "dislike") {
      return type;
    }
    return type || null;
  }
'''
    content = ensure_after(content, "  function logSearch(query, resultCount, selectedPath) {", feedback_helper, "ai feedback helper")

    submit_feedback = r'''  function submitFeedback(input) {
    input = input || {};
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      return Promise.resolve({ ok: false, skipped: true, error: "Supabase is not configured." });
    }

    var requestLogId = input.requestLogId || input.request_log_id || "";
    if (!requestLogId && document.documentElement) {
      requestLogId = document.documentElement.getAttribute("data-last-ai-request-log-id") || "";
    }

    function attachAiFeedback(primaryResult) {
      var feedbackType = normalizeAiFeedbackType(input.feedbackType || null);
      if (!requestLogId || !feedbackType) {
        return primaryResult;
      }

      return post("ai_feedback", {
        request_log_id: requestLogId,
        feedback_type: feedbackType,
        comment: input.message || null,
        page_path: input.pagePath || window.location.pathname,
        problem_slug: input.problemSlug || null,
      }).then(function () {
        return primaryResult;
      }).catch(function () {
        return primaryResult;
      });
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
      .then(attachAiFeedback)
      .catch(function () {
        return { ok: false, error: "Feedback request failed." };
      });
  }

'''
    content = regex_replace_once(
        content,
        r"  function submitFeedback\(input\) \{.*?\n  \}\n\n  function readFeedbackPublicCounts\(pagePath\) \{",
        submit_feedback + "  function readFeedbackPublicCounts(pagePath) {",
        "submitFeedback replacement",
    )

    fetch_ai = r'''  function fetchAiChat(input, turnstileToken) {
    var config = getConfig();
    var tokenToSend = turnstileToken || input.turnstileToken || gateState.pendingTurnstileToken || "";

    if (tokenToSend && tokenToSend === gateState.pendingTurnstileToken) {
      gateState.pendingTurnstileToken = "";
    }

    return getSession().then(function (sessionResult) {
      var activeAccessToken = input.accessToken ||
        (sessionResult && sessionResult.session && sessionResult.session.access_token) ||
        "";

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
          accessToken: activeAccessToken || undefined,
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
    });
  }

'''
    content = regex_replace_once(
        content,
        r"  function fetchAiChat\(input, turnstileToken\) \{.*?\n  \}\n\n  function askSupportAssistant\(input\) \{",
        fetch_ai + "  function askSupportAssistant(input) {",
        "fetchAiChat replacement",
    )

    if "sendEmailCode: sendEmailCode" not in content:
        content = content.replace(
            "    signIn: signIn,\n    signOut: signOut,\n    getSession: getSession,",
            "    signIn: signIn,\n    sendEmailCode: sendEmailCode,\n    verifyEmailCode: verifyEmailCode,\n    getAccessToken: getAccessToken,\n    getSupportUser: getSupportUser,\n    signOut: signOut,\n    getSession: getSession,",
            1,
        )

    write(path, content)


def patch_requester(repo: Path) -> None:
    path = repo / "assets/support-assistant-modules/requester.js"
    content = read(path)
    if "requestLogId:" not in content:
        content = content.replace(
            "          remaining: Number.isFinite(result.remaining) ? result.remaining : null,\n",
            "          remaining: Number.isFinite(result.remaining) ? result.remaining : null,\n          requestLogId: result.requestLogId || result.request_log_id || \"\",\n",
            1,
        )
    write(path, content)


def patch_shell(repo: Path) -> None:
    path = repo / "assets/support-assistant-modules/shell.js"
    content = read(path)

    new_set_disabled = r'''  function setShellControlsDisabled(shell, disabled) {
    const container = getShellContainer(shell);
    if (!container) {
      return;
    }
    Array.prototype.slice.call(container.querySelectorAll("input, textarea, button[type='submit']")).forEach(function (element) {
      if (element.closest && element.closest(".support-auth-gate")) {
        return;
      }
      element.disabled = Boolean(disabled);
    });
  }
'''
    content = regex_replace_once(
        content,
        r"  function setShellControlsDisabled\(shell, disabled\) \{.*?\n  \}\n\n  function lockShellForLogin",
        new_set_disabled + "\n  function lockShellForLogin",
        "setShellControlsDisabled replacement",
    )

    new_login = r'''  function unlockShellAfterLogin(shell) {
    const container = getShellContainer(shell);
    if (!container) {
      return;
    }
    container.classList.remove("support-chat-locked");
    setShellControlsDisabled(shell, false);
    if (shell && shell.input) {
      shell.input.placeholder = "Ask a follow-up question";
    }
  }

  function maskEmail(email) {
    const value = String(email || "").trim();
    const parts = value.split("@");
    if (parts.length !== 2) {
      return value;
    }
    const name = parts[0];
    const domain = parts[1];
    const visible = name.slice(0, 1);
    return visible + "***@" + domain;
  }

  function getPolicyUrl(key) {
    const config = window.eQualleConfig || {};
    if (key === "terms") {
      return config.TERMS_URL || "https://equalle.com/policies/terms-of-service";
    }
    return config.PRIVACY_URL || "https://equalle.com/policies/privacy-policy";
  }

  function setSignedInStatus(container, email) {
    if (!container) {
      return;
    }
    const existing = container.querySelector(".support-auth-status");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    if (!email) {
      return;
    }

    const row = document.createElement("div");
    row.className = "support-auth-status";
    row.textContent = "Signed in as " + maskEmail(email) + " · ";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-auth-signout";
    button.textContent = "Sign out";
    button.addEventListener("click", function () {
      if (!window.eQualleSupabase || typeof window.eQualleSupabase.signOut !== "function") {
        return;
      }
      window.eQualleSupabase.signOut().then(function () {
        setSignedInStatus(container, "");
      });
    });

    row.appendChild(button);
    container.appendChild(row);
  }

  function updateSignedInStatus(shell) {
    const container = getShellContainer(shell);
    if (!container || !window.eQualleSupabase || typeof window.eQualleSupabase.getSession !== "function") {
      return;
    }

    window.eQualleSupabase.getSession().then(function (result) {
      const session = result && result.session;
      const user = session && session.user;
      const email = user && user.email ? user.email : "";
      setSignedInStatus(container, email);
    }).catch(function () {
      return;
    });
  }

  function appendLoginRequiredCard(messages, options) {
    options = options || {};
    if (!messages) {
      return;
    }

    const existing = messages.querySelector(".support-login-card");
    if (existing) {
      return;
    }

    const card = document.createElement("div");
    card.className = "support-login-card support-auth-gate";

    const title = document.createElement("div");
    title.className = "support-login-card-title";
    title.textContent = "Continue your chat";
    card.appendChild(title);

    const text = document.createElement("p");
    text.className = "support-login-card-text";
    text.textContent = "Enter your email and we’ll send a 6-digit code.";
    card.appendChild(text);

    const error = document.createElement("div");
    error.className = "support-auth-error";
    error.setAttribute("aria-live", "polite");
    error.hidden = true;

    function showError(message) {
      error.textContent = message || "Something went wrong. Try again.";
      error.hidden = false;
    }

    function clearError() {
      error.textContent = "";
      error.hidden = true;
    }

    function renderEmailStep() {
      card.innerHTML = "";
      card.appendChild(title);
      text.textContent = "Enter your email and we’ll send a 6-digit code.";
      card.appendChild(text);

      const form = document.createElement("form");
      form.className = "support-auth-form";

      const label = document.createElement("label");
      label.className = "support-auth-label";
      label.textContent = "Email";

      const input = document.createElement("input");
      input.className = "support-auth-input";
      input.type = "email";
      input.placeholder = "you@example.com";
      input.autocomplete = "email";
      input.required = true;
      label.appendChild(input);

      const button = document.createElement("button");
      button.type = "submit";
      button.className = "support-auth-button";
      button.textContent = "Send code";
      button.disabled = true;

      const legal = document.createElement("p");
      legal.className = "support-auth-legal";
      legal.append("By continuing, you agree to our ");
      const terms = document.createElement("a");
      terms.href = getPolicyUrl("terms");
      terms.target = "_blank";
      terms.rel = "noopener noreferrer";
      terms.textContent = "Terms";
      legal.appendChild(terms);
      legal.append(" and ");
      const privacy = document.createElement("a");
      privacy.href = getPolicyUrl("privacy");
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      privacy.textContent = "Privacy Policy";
      legal.appendChild(privacy);
      legal.append(".");

      input.addEventListener("input", function () {
        button.disabled = !/^\S+@\S+\.\S+$/.test(input.value.trim());
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearError();
        const email = input.value.trim().toLowerCase();
        button.disabled = true;
        button.textContent = "Sending code...";

        if (!window.eQualleSupabase || typeof window.eQualleSupabase.sendEmailCode !== "function") {
          button.disabled = false;
          button.textContent = "Send code";
          showError("Email sign-in is not available yet.");
          return;
        }

        window.eQualleSupabase.sendEmailCode(email).then(function (result) {
          if (!result || !result.ok) {
            button.disabled = false;
            button.textContent = "Send code";
            showError(result && result.error ? result.error : "Code could not be sent.");
            return;
          }
          renderCodeStep(email);
        }).catch(function () {
          button.disabled = false;
          button.textContent = "Send code";
          showError("Code could not be sent.");
        });
      });

      form.appendChild(label);
      form.appendChild(button);
      card.appendChild(form);
      card.appendChild(error);
      card.appendChild(legal);
      window.setTimeout(function () { input.focus(); }, 60);
    }

    function renderCodeStep(email) {
      card.innerHTML = "";
      title.textContent = "Check your email";
      card.appendChild(title);
      text.textContent = "Enter the 6-digit code sent to " + maskEmail(email) + ".";
      card.appendChild(text);

      const form = document.createElement("form");
      form.className = "support-auth-form";

      const label = document.createElement("label");
      label.className = "support-auth-label";
      label.textContent = "Code";

      const input = document.createElement("input");
      input.className = "support-auth-input support-auth-code-input";
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "one-time-code";
      input.pattern = "\\d{6}";
      input.maxLength = 6;
      input.placeholder = "123456";
      input.required = true;
      label.appendChild(input);

      const button = document.createElement("button");
      button.type = "submit";
      button.className = "support-auth-button";
      button.textContent = "Continue";
      button.disabled = true;

      input.addEventListener("input", function () {
        input.value = input.value.replace(/\D/g, "").slice(0, 6);
        button.disabled = input.value.length !== 6;
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearError();
        button.disabled = true;
        button.textContent = "Checking...";

        window.eQualleSupabase.verifyEmailCode(email, input.value).then(function (result) {
          if (!result || !result.ok) {
            button.disabled = false;
            button.textContent = "Continue";
            showError(result && result.error ? result.error : "Code is incorrect or expired.");
            return;
          }

          card.innerHTML = "";
          title.textContent = "You're all set";
          card.appendChild(title);

          const container = messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
          if (container) {
            setSignedInStatus(container, result.user && result.user.email ? result.user.email : email);
          }
          if (typeof options.onSuccess === "function") {
            window.setTimeout(function () {
              if (card.parentNode) {
                card.parentNode.removeChild(card);
              }
              options.onSuccess(result.session || null);
            }, 450);
          }
        }).catch(function () {
          button.disabled = false;
          button.textContent = "Continue";
          showError("Code could not be verified.");
        });
      });

      const links = document.createElement("div");
      links.className = "support-auth-links";

      const resend = document.createElement("button");
      resend.type = "button";
      resend.className = "support-auth-link";
      resend.disabled = true;
      let remaining = 60;
      resend.textContent = "Resend code in 60s";
      const timer = window.setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(timer);
          resend.disabled = false;
          resend.textContent = "Resend code";
          return;
        }
        resend.textContent = "Resend code in " + remaining + "s";
      }, 1000);
      resend.addEventListener("click", function () {
        clearError();
        resend.disabled = true;
        resend.textContent = "Sending code...";
        window.eQualleSupabase.sendEmailCode(email).then(function (result) {
          if (!result || !result.ok) {
            showError(result && result.error ? result.error : "Code could not be sent.");
          }
          renderCodeStep(email);
        });
      });

      const change = document.createElement("button");
      change.type = "button";
      change.className = "support-auth-link";
      change.textContent = "Change email";
      change.addEventListener("click", function () {
        renderEmailStep();
      });

      links.appendChild(resend);
      links.appendChild(change);

      form.appendChild(label);
      form.appendChild(button);
      card.appendChild(form);
      card.appendChild(error);
      card.appendChild(links);
      window.setTimeout(function () { input.focus(); }, 60);
    }

    renderEmailStep();
    messages.appendChild(card);
  }

'''
    content = regex_replace_once(
        content,
        r"  function appendLoginRequiredCard\(messages\) \{.*?\n  \}\n\n  function buildAssistantShell",
        new_login + "  function buildAssistantShell",
        "appendLoginRequiredCard replacement",
    )

    if "unlockShellAfterLogin: unlockShellAfterLogin" not in content:
        content = content.replace(
            "    lockShellForLogin: lockShellForLogin,\n    renderPendingIndicator: renderPendingIndicator,",
            "    lockShellForLogin: lockShellForLogin,\n    unlockShellAfterLogin: unlockShellAfterLogin,\n    updateSignedInStatus: updateSignedInStatus,\n    renderPendingIndicator: renderPendingIndicator:",
            1,
        )
        content = content.replace("renderPendingIndicator: renderPendingIndicator:", "renderPendingIndicator: renderPendingIndicator,")

    write(path, content)


def patch_chat(repo: Path) -> None:
    path = repo / "assets/support-assistant-modules/chat.js"
    content = read(path)

    if "function unlockShellAfterLogin()" not in content:
        content = content.replace(
            "  function appendLoginRequiredCard() { return shared.appendLoginRequiredCard.apply(shared, arguments); }\n",
            "  function appendLoginRequiredCard() { return shared.appendLoginRequiredCard.apply(shared, arguments); }\n  function unlockShellAfterLogin() { return shared.unlockShellAfterLogin.apply(shared, arguments); }\n  function updateSignedInStatus() { return shared.updateSignedInStatus.apply(shared, arguments); }\n",
            1,
        )

    content = ensure_after(content, "    let assistantReplyCount = 0;\n", "    updateSignedInStatus(shell);\n", "initial signed-in status")

    content = ensure_after(
        content,
        "      setShellControlsDisabled(shell, true);\n",
        "\n      const skipUserBubble = Boolean(meta && meta.skipUserBubble === true);\n",
        "skip user bubble flag",
    )

    old_user_block = r'''      pushSessionArray(
        STORAGE_KEYS.assistantMessages,
        {
          role: "user",
          text: message,
          at: new Date().toISOString(),
          source: source,
        },
        30,
      );
  
      appendMessage(shell.messages, "user", message, { noAutoScroll: noAutoScroll });
'''
    new_user_block = r'''      if (!skipUserBubble) {
        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "user",
            text: message,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );
    
        appendMessage(shell.messages, "user", message, { noAutoScroll: noAutoScroll });
      }
'''
    content = replace_once(content, old_user_block, new_user_block, "user bubble block")

    early_login = r'''        if (result.code === "login_required" || result.nextAction === "login_required") {
          if (pending && pending.parentNode) {
            pending.parentNode.removeChild(pending);
          }
          appendLoginRequiredCard(shell.messages, {
            shell: shell,
            onSuccess: function () {
              unlockShellAfterLogin(shell);
              sendMessage(message, {
                auto: Boolean(meta && meta.auto === true),
                skipUserBubble: true,
              });
            },
          });
          lockShellForLogin(shell);
          return;
        }
  
'''

    store_request_id = r'''        if (result.requestLogId && shell.root) {
          shell.root.setAttribute("data-last-ai-request-log-id", result.requestLogId);
          document.documentElement.setAttribute("data-last-ai-request-log-id", result.requestLogId);
        }
  
'''

    content = ensure_after(
        content,
        "          assistantReplyCount += 1;\n          return;\n        }\n  \n",
        early_login + store_request_id,
        "login retry and request log id block",
    )

    content = content.replace(
        "appendLoginRequiredCard(shell.messages);\n          lockShellForLogin(shell);",
        "appendLoginRequiredCard(shell.messages, { shell: shell });\n          lockShellForLogin(shell);",
    )

    write(path, content)


def patch_css(repo: Path) -> None:
    path = repo / "assets/support-assistant.css"
    content = read(path)
    block = r'''

/* Email OTP auth gate for AI chat continuation. */
.support-auth-gate {
  color: #0f172a;
  display: grid;
  gap: 10px;
  max-width: 360px;
}

.support-auth-form {
  display: grid;
  gap: 10px;
}

.support-auth-label {
  color: #334155;
  display: grid;
  font-size: 0.82rem;
  font-weight: 800;
  gap: 5px;
}

.support-auth-input {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #0f172a;
  font: inherit;
  padding: 9px 10px;
  width: 100%;
}

.support-auth-input:focus {
  border-color: #7cb1d9;
  box-shadow: 0 0 0 3px rgba(124, 177, 217, 0.22);
  outline: none;
}

.support-auth-code-input {
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-align: center;
}

.support-auth-button {
  align-items: center;
  background: #0d527a;
  border: 0;
  border-radius: 999px;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 800;
  justify-content: center;
  padding: 9px 14px;
}

.support-auth-button:disabled,
.support-auth-link:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.support-auth-error {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 10px;
  color: #9a3412;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 10px;
}

.support-auth-legal {
  color: #64748b;
  font-size: 0.75rem;
  line-height: 1.35;
  margin: 0;
}

.support-auth-legal a,
.support-auth-link,
.support-auth-signout {
  background: transparent;
  border: 0;
  color: #0d527a;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.support-auth-links {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.support-auth-status {
  color: #64748b;
  font-size: 0.78rem;
  margin: 8px 2px 0;
}

.support-chat-locked .support-auth-gate input,
.support-chat-locked .support-auth-gate button {
  opacity: 1;
}
'''
    if "Email OTP auth gate" not in content:
        content += block
    write(path, content)


def patch_edge_function(repo: Path) -> None:
    path = repo / "supabase/functions/support-ai-chat/index.ts"
    content = read(path)

    auth_types = r'''

type AuthenticatedSupportUser = {
  id: string;
  email: string | null;
};

type AiRequestLogInput = {
  sessionToken: string;
  userId?: string | null;
  userEmail?: string | null;
  question: string;
  answer?: string | null;
  context: ChatContext;
  assistantOutput?: AssistantOutput | null;
  ipAddress: string;
  ipHash?: string | null;
  userAgent?: string | null;
  status: "success" | "blocked" | "error";
  errorCode?: string | null;
  errorMessage?: string | null;
};
'''
    content = ensure_after(content, "type AssistantOutput = {\n  reply: string;\n  needsClarification: boolean;\n  clarifyingQuestion: string;\n  matchedPages: Array<{\n    title: string;\n    path: string;\n  }>;\n};\n", auth_types, "auth/log types")

    helpers = r'''

async function getAuthenticatedSupportUser(accessToken: string | undefined): Promise<AuthenticatedSupportUser | null> {
  if (!accessToken) {
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok || typeof body.id !== "string") {
    return null;
  }

  return {
    id: body.id,
    email: typeof body.email === "string" ? body.email : null,
  };
}

function pickMatchedCardId(context: ChatContext): string | null {
  if (context.solution_id) {
    return context.solution_id;
  }
  if (context.solution_slug) {
    return context.solution_slug;
  }

  const cards = context.retrievedContent && Array.isArray(context.retrievedContent.solutionCards)
    ? context.retrievedContent.solutionCards
    : [];
  const first = cards[0];
  return first && (first.id || first.slug) ? String(first.id || first.slug) : null;
}

async function insertAiRequestLog(input: AiRequestLogInput): Promise<string | null> {
  const body = {
    session_token: input.sessionToken,
    user_id: input.userId || null,
    user_email: input.userEmail || null,
    question: input.question,
    answer: input.answer || null,
    page_url: input.context.currentPath || null,
    page_title: input.context.currentTitle || null,
    source_type: input.context.source || null,
    solution_id: input.context.solution_id || null,
    solution_slug: input.context.solution_slug || null,
    matched_card_id: pickMatchedCardId(input.context),
    matched_pages: input.assistantOutput ? input.assistantOutput.matchedPages : [],
    retrieved_content: input.context.retrievedContent || {},
    ip_address: input.ipAddress || null,
    ip_hash: input.ipHash || null,
    user_agent: input.userAgent || null,
    status: input.status,
    error_code: input.errorCode || null,
    error_message: input.errorMessage || null,
  };

  const result = await supabaseRequest("/rest/v1/ai_request_logs", {
    method: "POST",
    prefer: "return=representation",
    body,
  });

  if (result.ok && Array.isArray(result.body) && result.body.length > 0 && isObject(result.body[0])) {
    const row = result.body[0] as Record<string, unknown>;
    return typeof row.id === "string" ? row.id : null;
  }

  return null;
}
'''
    content = ensure_after(content, "async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {", "", "verify anchor present")
    content = ensure_after(content, "  return response.ok && body.success === true;\n}\n", helpers, "auth/log helpers")

    content = replace_once(
        content,
        "  const ip = getClientIp(request);\n  const { state, stateId } = await getOrCreateLimitState(parsedRequest.sessionToken, ip);",
        "  const ip = getClientIp(request);\n  const { state, stateId } = await getOrCreateLimitState(parsedRequest.sessionToken, ip);",
        "noop checkRequestAccess anchor",
    )

    # Deno.serve request flow patch.
    if "const authUser = await getAuthenticatedSupportUser(parsed.accessToken);" not in content:
        content = replace_once(
            content,
            "    const context = sanitizeContext(parsed.context);\n",
            "    const context = sanitizeContext(parsed.context);\n    const clientIp = getClientIp(request);\n    const authUser = await getAuthenticatedSupportUser(parsed.accessToken);\n",
            "Deno serve auth user insertion",
        )

    content = replace_once(
        content,
        "    const access = await checkRequestAccess(parsed, request);\n",
        "    const access = authUser ? null : await checkRequestAccess(parsed, request);\n",
        "access decision authenticated bypass",
    )

    content = replace_once(
        content,
        "    if (!access.allowed) {\n      return access.response;\n    }\n",
        "    if (access && !access.allowed) {\n      return access.response;\n    }\n    const allowedAccess = access && access.allowed ? access : null;\n",
        "access blocked guard",
    )

    def replace_call_and_limit(match: re.Match) -> str:
        var_name = match.group(1)
        call_stmt = match.group(0).split("const limit = await markSuccessfulAiRequest(access);")[0]
        return (
            call_stmt
            + "const limit = allowedAccess\n"
            + "      ? await markSuccessfulAiRequest(allowedAccess)\n"
            + "      : { remaining: null as number | null };\n"
            + f"    const requestLogId = await insertAiRequestLog({{\n"
            + "      sessionToken: parsed.sessionToken,\n"
            + "      userId: authUser ? authUser.id : null,\n"
            + "      userEmail: authUser ? authUser.email : null,\n"
            + "      question: parsed.userMessage,\n"
            + f"      answer: {var_name}.reply,\n"
            + "      context,\n"
            + f"      assistantOutput: {var_name},\n"
            + "      ipAddress: clientIp,\n"
            + "      ipHash: await sha256Hex(clientIp),\n"
            + "      userAgent: request.headers.get(\"user-agent\"),\n"
            + "      status: \"success\",\n"
            + "    });\n"
        )

    if "const requestLogId = await insertAiRequestLog" not in content:
        content = regex_replace_once_callback(
            content,
            r"    const ([A-Za-z0-9_]+) = await callOpenAI\([\s\S]*?\);\n    const limit = await markSuccessfulAiRequest\(access\);\n",
            replace_call_and_limit,
            "callOpenAI + markSuccessfulAiRequest block",
            flags=0,
        )

    if "requestLogId," not in content:
        if "      ...limit," in content:
            content = content.replace("      ...limit,", "      requestLogId,\n      ...limit,", 1)
        elif "      remaining: limit.remaining," in content:
            content = content.replace("      remaining: limit.remaining,", "      requestLogId,\n      remaining: limit.remaining,", 1)
        else:
            fail("Could not insert requestLogId into Edge Function response")

    write(path, content)


def main() -> None:
    repo = Path.cwd()
    package_root = Path(__file__).resolve().parents[1]

    if not (repo / ".git").exists():
        fail("Run this script from the sandpaper_support repo root.")

    missing = [rel for rel in ROOT_FILES if not (repo / rel).exists()]
    if missing:
        fail("Missing required files:\n" + "\n".join(missing))

    backup_root = backup_files(repo)
    copy_migration(repo, package_root)

    patch_loader(repo)
    patch_supabase_client(repo)
    patch_requester(repo)
    patch_shell(repo)
    patch_chat(repo)
    patch_css(repo)
    patch_edge_function(repo)

    print("Support auth OTP patch applied.")
    print(f"Backup saved to: {backup_root}")
    print("Next commands:")
    print("  npm run build")
    print("  node scripts/validate-source-integrity.js")
    print("  node scripts/check-internal-links.js")
    print("  npx supabase db push --db-url \"$env:SUPABASE_DB_URL\"")


if __name__ == "__main__":
    main()
