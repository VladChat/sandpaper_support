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

  function appendLoginRequiredCard(messages) {
    if (!messages) {
      return;
    }
    const existing = messages.querySelector(".support-login-card");
    if (existing) {
      return;
    }
    const card = document.createElement("div");
    card.className = "support-login-card";
    const title = document.createElement("div");
    title.className = "support-login-card-title";
    title.textContent = "Please log in to continue.";
    card.appendChild(title);
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
    renderPendingIndicator: renderPendingIndicator,
    clearPendingIndicator: clearPendingIndicator,
    appendLoginRequiredCard: appendLoginRequiredCard,
    buildAssistantShell: buildAssistantShell,
    parseExistingShell: parseExistingShell,
    readSolutionContextFromPage: readSolutionContextFromPage,
    attachPageTopAssistant: attachPageTopAssistant,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
