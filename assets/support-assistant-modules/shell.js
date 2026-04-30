// assets/support-assistant-modules/shell.js
// Purpose: chat shell DOM helpers and UI state.
(function (shared) {
  if (!shared) {
    return;
  }

  function appendMessage() { return shared.appendMessage.apply(shared, arguments); }
  function isSupportLeaf() { return shared.isSupportLeaf.apply(shared, arguments); }


  function getShellContainer(shell) {
    if (!shell) {
      return null;
    }
    return shell.root || (shell.messages && shell.messages.closest(".chat-shell, [data-ai-chat], [data-solution-followup]"));
  }

  function isShellLocked(shell) {
    const container = getShellContainer(shell);
    return Boolean(container && container.classList.contains("support-chat-locked"));
  }

  function setShellControlsDisabled(shell, disabled) {
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

  function lockShellForLogin(shell) {
    const container = getShellContainer(shell);
    if (!container) {
      return;
    }
    container.classList.add("support-chat-locked");
    setShellControlsDisabled(shell, true);
    if (shell.input) {
      shell.input.placeholder = "Please log in to continue.";
    }
  }

  function renderPendingIndicator(node) {
    node.textContent = "";
    node.classList.add("chat-message-pending", "support-thinking-message");
  
    const label = document.createElement("span");
    label.className = "support-thinking-label";
    label.textContent = "Thinking";
    node.appendChild(label);
  
    const dots = document.createElement("span");
    dots.className = "support-thinking-dots";
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("span");
      dot.textContent = ".";
      dots.appendChild(dot);
    }
    node.appendChild(dots);
  }

  function clearPendingIndicator(node) {
    if (!node) {
      return;
    }
    node.classList.remove("chat-message-pending", "support-thinking-message");
  }

  function unlockShellAfterLogin(shell) {
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

  function buildAssistantShell(options) {
    const wrapper = document.createElement("div");
    wrapper.className = "support-assistant-panel";
    let descriptionNode = null;
  
    const title = document.createElement("h3");
    title.className = "support-assistant-title";
    title.textContent = options.title;
    wrapper.appendChild(title);
  
    if (options.description) {
      descriptionNode = document.createElement("p");
      descriptionNode.className = "support-assistant-description";
      descriptionNode.textContent = options.description;
      wrapper.appendChild(descriptionNode);
    }
  
    const shell = document.createElement("div");
    shell.className = "chat-shell support-chat-shell";
  
    const messages = document.createElement("div");
    messages.className = "chat-messages";
    messages.setAttribute("aria-live", "polite");
  
    const form = document.createElement("form");
    form.className = "chat-form";
  
    const label = document.createElement("label");
    label.className = "sr-only";
    label.textContent = options.label || "Ask a support question";
  
    const input = document.createElement("input");
    input.className = "chat-input";
    input.type = "text";
    input.placeholder = options.placeholder || "Ask a follow-up question";
    input.autocomplete = "off";
  
    const button = document.createElement("button");
    button.className = "chat-send";
    button.type = "submit";
    button.textContent = options.buttonText || "Send";
  
    label.appendChild(input);
    form.appendChild(label);
    form.appendChild(button);
  
    shell.appendChild(messages);
    shell.appendChild(form);
    wrapper.appendChild(shell);
  
    if (options.initialMessage) {
      appendMessage(messages, "assistant", options.initialMessage);
    }
  
    return {
      root: wrapper,
      form: form,
      input: input,
      messages: messages,
      setTitle: function (text) {
        title.textContent = text;
      },
      setDescription: function (text) {
        if (!descriptionNode) {
          descriptionNode = document.createElement("p");
          descriptionNode.className = "support-assistant-description";
          wrapper.insertBefore(descriptionNode, shell);
        }
        if (!descriptionNode) {
          return;
        }
        descriptionNode.textContent = text;
      },
    };
  }

  function parseExistingShell(shell) {
    if (!shell) {
      return null;
    }
  
    const form = shell.querySelector("[data-ai-form]") || shell.querySelector(".chat-form");
    const input = shell.querySelector("[data-ai-input]") || shell.querySelector(".chat-input");
    const messages =
      shell.querySelector("[data-ai-messages]") || shell.querySelector(".chat-messages");
  
    if (!form || !input || !messages) {
      return null;
    }
  
    return {
      root: shell,
      form: form,
      input: input,
      messages: messages,
      setTitle: function () {
        return;
      },
      setDescription: function () {
        return;
      },
    };
  }

  function readSolutionContextFromPage() {
    const node = document.querySelector('script[type="application/json"][data-solution-context]');
    if (!node) {
      return null;
    }
  
    try {
      const parsed = JSON.parse(node.textContent || "{}");
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function attachPageTopAssistant(basePath) {
    const isSolutionPage = /\/solutions\/[^/]+\/?$/.test(String(window.location.pathname || ""));
    if (isSolutionPage) {
      return null;
    }
  
    if (!isSupportLeaf(window.location.pathname, basePath)) {
      return null;
    }
  
    if (document.querySelector("[data-support-top-assistant]")) {
      return parseExistingShell(document.querySelector("[data-support-top-assistant]"));
    }
  
    const section = document.querySelector("main .section");
    if (!section) {
      return null;
    }
  
    const block = document.createElement("section");
    block.className = "answer-card support-top-assistant-card";
    block.setAttribute("data-support-top-assistant", "");
  
    const heading = document.createElement("h2");
    heading.textContent = "Ask about this issue";
    block.appendChild(heading);
  
    const intro = document.createElement("p");
    intro.className = "section-intro";
    intro.textContent =
      "Ask a follow-up question about this sanding problem, grit choice, surface, or next step.";
    block.appendChild(intro);
  
    const shell = buildAssistantShell({
      title: "Ask about this issue",
      description: "",
      placeholder: "Example: what grit should I use next?",
      initialMessage: "Pick a suggestion or ask your exact next-step question.",
    });
  
    const suggestions = document.createElement("div");
    suggestions.className = "support-suggestion-row";
    suggestions.setAttribute("data-support-suggestions", "");
    [
      "What should I do next?",
      "Which grit comes next?",
      "Should I sand wet or dry?",
    ].forEach(function (text) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "support-suggestion-button";
      button.textContent = text;
      suggestions.appendChild(button);
    });
    block.appendChild(suggestions);
  
    block.appendChild(shell.root.querySelector(".chat-shell"));
  
    const introNode = section.querySelector(".section-intro");
    const firstAnswerCard = section.querySelector(".answer-card");
  
    if (introNode) {
      introNode.insertAdjacentElement("afterend", block);
    } else if (firstAnswerCard) {
      firstAnswerCard.insertAdjacentElement("beforebegin", block);
    } else {
      section.appendChild(block);
    }
  
    return {
      root: block,
      form: shell.form,
      input: shell.input,
      messages: shell.messages,
      setTitle: shell.setTitle,
      setDescription: shell.setDescription,
      suggestionButtons: Array.prototype.slice.call(
        block.querySelectorAll(".support-suggestion-button"),
      ),
    };
  }

  Object.assign(shared, {
    getShellContainer: getShellContainer,
    isShellLocked: isShellLocked,
    setShellControlsDisabled: setShellControlsDisabled,
    lockShellForLogin: lockShellForLogin,
    unlockShellAfterLogin: unlockShellAfterLogin,
    updateSignedInStatus: updateSignedInStatus,
    renderPendingIndicator: renderPendingIndicator,
    clearPendingIndicator: clearPendingIndicator,
    appendLoginRequiredCard: appendLoginRequiredCard,
    buildAssistantShell: buildAssistantShell,
    parseExistingShell: parseExistingShell,
    readSolutionContextFromPage: readSolutionContextFromPage,
    attachPageTopAssistant: attachPageTopAssistant,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
