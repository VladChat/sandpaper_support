# tools/apply_post_login_auth_ui_patch.py
# Purpose: apply the post-login auth-gate cleanup and softer email OTP UI patch.
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path.cwd()
CACHE_OLD = "support-auth-otp-login-20260430-v2"
CACHE_NEW = "support-auth-otp-login-20260430-v3"


def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        raise FileNotFoundError(f"Missing expected file: {path}")
    return p.read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    p = ROOT / path
    p.write_text(text, encoding="utf-8", newline="\n")


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Could not find expected block for: {label}")
    return text.replace(old, new, 1)


def patch_chat_js() -> None:
    path = "assets/support-assistant-modules/chat.js"
    text = read(path)

    old = '''          appendLoginRequiredCard(shell.messages, {
            shell: shell,
            onSuccess: function () {
              unlockShellAfterLogin(shell);
              sendMessage(message, {
                auto: Boolean(meta && meta.auto === true),
                skipUserBubble: true,
              });
            },
          });'''
    new = '''          appendLoginRequiredCard(shell.messages, {
            shell: shell,
            onSuccess: function () {
              unlockShellAfterLogin(shell);
              updateSignedInStatus(shell);
            },
          });'''
    text = replace_exact(text, old, new, "remove auto-retry after login in chat.js")
    write(path, text)


def patch_shell_js() -> None:
    path = "assets/support-assistant-modules/shell.js"
    text = read(path)

    old_update = '''  function updateSignedInStatus(shell) {
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
'''
    new_update = '''  function removeAuthGate(container) {
    if (!container) {
      return;
    }
    Array.prototype.slice.call(container.querySelectorAll(".support-auth-gate, .support-login-card")).forEach(function (node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
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
      if (email) {
        removeAuthGate(container);
        unlockShellAfterLogin(shell);
      }
    }).catch(function () {
      return;
    });
  }
'''
    text = replace_exact(text, old_update, new_update, "updateSignedInStatus removes gate when signed in")

    old_existing = '''    const existing = messages.querySelector(".support-login-card");
    if (existing) {
      if (existing.classList.contains("support-auth-gate")) {
        return;
      }
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    const card = document.createElement("div");'''
    new_existing = '''    const container = messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
    if (
      window.eQualleSupabase &&
      typeof window.eQualleSupabase.getAccessToken === "function" &&
      window.eQualleSupabase.getAccessToken()
    ) {
      removeAuthGate(container || messages);
      unlockShellAfterLogin(options.shell || { root: container });
      updateSignedInStatus(options.shell || { root: container });
      return;
    }

    const existing = messages.querySelector(".support-login-card");
    if (existing) {
      if (existing.classList.contains("support-auth-gate")) {
        return;
      }
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    const card = document.createElement("div");'''
    text = replace_exact(text, old_existing, new_existing, "skip auth gate if already signed in")

    old_success = '''          const container = messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
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
          }'''
    new_success = '''          const container = messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");
          if (container) {
            setSignedInStatus(container, result.user && result.user.email ? result.user.email : email);
          }
          window.setTimeout(function () {
            if (card.parentNode) {
              card.parentNode.removeChild(card);
            }
            removeAuthGate(container || messages);
            unlockShellAfterLogin(options.shell || { root: container });
            updateSignedInStatus(options.shell || { root: container });
            if (typeof options.onSuccess === "function") {
              options.onSuccess(result.session || null);
            }
          }, 250);'''
    text = replace_exact(text, old_success, new_success, "always remove auth gate after verify success")

    # Export helper for future modules/tests if needed.
    old_export = '''    unlockShellAfterLogin: unlockShellAfterLogin,
    updateSignedInStatus: updateSignedInStatus,'''
    new_export = '''    unlockShellAfterLogin: unlockShellAfterLogin,
    removeAuthGate: removeAuthGate,
    updateSignedInStatus: updateSignedInStatus,'''
    text = replace_exact(text, old_export, new_export, "export removeAuthGate")

    write(path, text)


def patch_css() -> None:
    path = "assets/support-assistant.css"
    text = read(path)
    marker = "/* Post-login auth gate cleanup and softer email OTP UI. */"
    if marker in text:
        return

    append = r'''

/* Post-login auth gate cleanup and softer email OTP UI. */
.support-auth-gate {
  border-color: #dbe7f1;
  box-shadow: 0 8px 22px rgba(11, 12, 14, 0.04);
  color: #1e293b;
  font-weight: 400;
  gap: 9px;
  max-width: 340px;
  padding: 13px 14px;
}

.support-auth-gate .support-login-card-title,
.support-login-card.support-auth-gate .support-login-card-title {
  color: #0f172a;
  font-size: 0.98rem;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.25;
  margin: 0;
  text-transform: none;
}

.support-auth-gate .support-login-card-text,
.support-login-card.support-auth-gate .support-login-card-text {
  color: #475569;
  font-size: 0.9rem;
  font-weight: 400;
  line-height: 1.42;
  margin: 0;
}

.support-auth-label {
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

.support-auth-input {
  border-color: #d7e2ec;
  border-radius: 9px;
  font-size: 0.92rem;
  padding: 8px 10px;
}

.support-auth-code-input {
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: 0.18em;
}

.support-auth-button {
  background: #0f638e;
  border-radius: 11px;
  font-size: 0.92rem;
  font-weight: 650;
  padding: 8px 13px;
}

.support-auth-button:hover:not(:disabled) {
  background: #0d527a;
}

.support-auth-error {
  font-size: 0.82rem;
  font-weight: 500;
}

.support-auth-legal {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 400;
}

.support-auth-legal a,
.support-auth-link,
.support-auth-signout {
  font-weight: 600;
}

.support-auth-status {
  align-items: center;
  border-top: 1px solid #edf2f7;
  color: #64748b;
  display: flex;
  flex-wrap: wrap;
  font-size: 0.76rem;
  gap: 3px;
  line-height: 1.35;
  margin: 10px 0 0;
  padding: 8px 2px 0;
}

.support-chat-locked .support-auth-status,
.support-chat-locked .support-auth-status button {
  opacity: 1;
}
'''
    write(path, text.rstrip() + append + "\n")


def bump_cache_versions() -> None:
    targets = [
        "assets/support-assistant.js",
        "index.html",
        "ask/index.html",
        "templates/solution-page.html",
        "scripts/build-product-pages.js",
        "scripts/build-surface-pages.js",
    ]
    for path in targets:
        p = ROOT / path
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        if CACHE_OLD in text:
            text = text.replace(CACHE_OLD, CACHE_NEW)
            p.write_text(text, encoding="utf-8", newline="\n")


def append_ops_log() -> None:
    path = ROOT / "docs/operations-log.md"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    entry = """

## 2026-04-30 - Post-login auth gate cleanup

- Removed automatic retry/resubmit after successful email OTP login.
- Email login gate now disappears after a valid session is detected.
- Chat input is unlocked after login and keeps the user in control of the next question.
- Softened email OTP auth card styling: no uppercase title, lighter text weight, calmer button and compact signed-in status row.
""".strip()
    if "Post-login auth gate cleanup" not in text:
        path.write_text(text.rstrip() + "\n\n" + entry + "\n", encoding="utf-8", newline="\n")


def main() -> int:
    required = [
        "assets/support-assistant-modules/chat.js",
        "assets/support-assistant-modules/shell.js",
        "assets/support-assistant.css",
        "assets/support-assistant.js",
    ]
    missing = [p for p in required if not (ROOT / p).exists()]
    if missing:
        print("Missing files:", ", ".join(missing), file=sys.stderr)
        return 1

    patch_chat_js()
    patch_shell_js()
    patch_css()
    bump_cache_versions()
    append_ops_log()

    print("Post-login auth UI patch applied.")
    print(f"Cache version bumped to {CACHE_NEW}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
