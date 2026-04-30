// assets/support-assistant-modules/auth-ui-fixes.js
// Purpose: final email OTP auth gate behavior and signed-in status layout.
(function (shared) {
  if (!shared) {
    return;
  }

  function getShellContainer(shell) {
    if (shared.getShellContainer) {
      return shared.getShellContainer(shell);
    }
    return shell && (shell.root || (shell.messages && shell.messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]")));
  }

  function setShellControlsDisabled(shell, disabled) {
    if (shared.setShellControlsDisabled) {
      shared.setShellControlsDisabled(shell, disabled);
      return;
    }
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

  function unlockShellAfterLogin(shell) {
    if (shared.unlockShellAfterLogin) {
      shared.unlockShellAfterLogin(shell);
      return;
    }
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

  function getPolicyUrl(key) {
    const config = window.eQualleConfig || {};
    if (key === "terms") {
      return config.TERMS_URL || "https://equalle.com/policies/terms-of-service";
    }
    return config.PRIVACY_URL || "https://equalle.com/policies/privacy-policy";
  }

  function fullEmail(email) {
    return String(email || "").trim();
  }

  function removeAuthGates(container) {
    if (!container) {
      return;
    }
    Array.prototype.slice.call(container.querySelectorAll(".support-auth-gate")).forEach(function (node) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function renderSignedInStatus(container, email) {
    if (!container) {
      return;
    }

    const existing = container.querySelector(".support-auth-status");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const cleanEmail = fullEmail(email);
    if (!cleanEmail) {
      return;
    }

    const row = document.createElement("div");
    row.className = "support-auth-status";
    row.textContent = "Signed in as " + cleanEmail + " · ";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-auth-signout";
    button.textContent = "Sign out";
    button.addEventListener("click", function () {
      if (!window.eQualleSupabase || typeof window.eQualleSupabase.signOut !== "function") {
        return;
      }
      window.eQualleSupabase.signOut().then(function () {
        renderSignedInStatus(container, "");
      });
    });

    row.appendChild(button);

    const form = container.querySelector("[data-ai-form], .chat-form");
    if (form && form.parentNode) {
      form.insertAdjacentElement("afterend", row);
      return;
    }

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

      if (email) {
        removeAuthGates(container);
        unlockShellAfterLogin(shell);
      }

      renderSignedInStatus(container, email);
    }).catch(function () {
      return;
    });
  }

  function appendLoginRequiredCard(messages, options) {
    options = options || {};
    if (!messages) {
      return;
    }

    const shell = options.shell || null;
    const container = shell ? getShellContainer(shell) : messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]");

    if (container && window.eQualleSupabase && typeof window.eQualleSupabase.getSession === "function") {
      window.eQualleSupabase.getSession().then(function (result) {
        const session = result && result.session;
        const email = session && session.user && session.user.email ? session.user.email : "";
        if (email) {
          removeAuthGates(container);
          unlockShellAfterLogin(shell);
          renderSignedInStatus(container, email);
        }
      }).catch(function () {
        return;
      });
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

    const card = document.createElement("div");
    card.className = "support-login-card support-auth-gate";

    const title = document.createElement("div");
    title.className = "support-login-card-title";
    title.textContent = "Continue your chat";

    const text = document.createElement("p");
    text.className = "support-login-card-text";

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
      title.textContent = "Continue your chat";
      text.textContent = "Enter your email and we’ll send a 6-digit code.";
      card.appendChild(title);
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

      window.setTimeout(function () {
        input.focus();
      }, 60);
    }

    function renderCodeStep(email) {
      card.innerHTML = "";
      title.textContent = "Check your email";
      text.textContent = "Enter the 6-digit code sent to " + fullEmail(email) + ".";
      card.appendChild(title);
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

          if (container) {
            renderSignedInStatus(container, result.user && result.user.email ? result.user.email : email);
          }

          window.setTimeout(function () {
            if (card.parentNode) {
              card.parentNode.removeChild(card);
            }

            unlockShellAfterLogin(shell);
            updateSignedInStatus(shell);
          }, 450);
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
        }).catch(function () {
          showError("Code could not be sent.");
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

      window.setTimeout(function () {
        input.focus();
      }, 60);
    }

    renderEmailStep();
    messages.appendChild(card);
  }

  Object.assign(shared, {
    appendLoginRequiredCard: appendLoginRequiredCard,
    updateSignedInStatus: updateSignedInStatus,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
