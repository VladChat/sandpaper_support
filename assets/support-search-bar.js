// assets/support-search-bar.js
// Purpose: shared support search / follow-up input bar used across homepage, solution pages, and AI chat.
(function () {
  const VERSION = "support-photo-unified-20260430-v2";
  const processedNodes = new WeakSet();

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function boolAttr(node, name, fallback) {
    const value = clean(node && node.getAttribute(name));
    if (!value) {
      return fallback;
    }
    return !/^(false|0|no)$/i.test(value);
  }

  function createSvg(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }

  function createMicButton() {
    const button = document.createElement("button");
    button.className = "support-tool-button support-mic-button";
    button.type = "button";
    button.setAttribute("aria-label", "Start voice input");
    button.setAttribute("aria-pressed", "false");
    button.title = "Start voice input";
    button.appendChild(createSvg("M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3Zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7Z"));
    return button;
  }

  function createPhotoButton() {
    const button = document.createElement("button");
    button.className = "support-tool-button support-photo-button";
    button.type = "button";
    button.setAttribute("data-support-photo-button", "");
    button.setAttribute("aria-label", "Add photo");
    button.title = "Add photo";
    button.appendChild(createSvg("M19 5h-3.17l-1.84-2H10L8.17 5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm-7 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Zm0-1.8A3.2 3.2 0 1 0 12 9.8a3.2 3.2 0 0 0 0 6.4Z"));

    const label = document.createElement("span");
    label.textContent = "Add Photo";
    button.appendChild(label);

    return button;
  }

  function createInput(options) {
    const input = document.createElement("input");
    input.id = options.inputId || "support-search-" + Math.random().toString(36).slice(2);
    input.className = options.inputClass;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = options.placeholder;

    if (options.mode === "chat") {
      input.setAttribute("data-ai-input", "");
    } else {
      input.setAttribute("data-support-search", "");
    }

    return input;
  }

  function createForm(options) {
    const form = document.createElement(options.mode === "chat" ? "form" : "div");
    form.className = options.mode === "chat"
      ? "chat-form support-search-form support-followup-search-form"
      : "support-search-form";

    if (options.mode === "chat") {
      form.setAttribute("data-ai-form", "");
    } else {
      form.setAttribute("role", "search");
    }

    const input = createInput({
      mode: options.mode,
      inputId: options.inputId,
      inputClass: options.mode === "chat" ? "chat-input support-search-input" : "support-search-input",
      placeholder: options.placeholder,
    });

    const label = document.createElement("label");
    label.className = "sr-only";
    label.setAttribute("for", input.id);
    label.textContent = options.label;

    const submit = document.createElement("button");
    submit.className = options.mode === "chat" ? "chat-send support-search-button" : "support-search-button";
    submit.type = options.mode === "chat" ? "submit" : "button";
    submit.textContent = options.buttonText;

    if (options.mode !== "chat") {
      submit.setAttribute("data-support-search-submit", "");
    }

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(createMicButton());

    if (options.includePhoto) {
      form.appendChild(createPhotoButton());
    }

    form.appendChild(submit);

    return {
      form: form,
      input: input,
      submit: submit,
    };
  }

  function readOptions(node) {
    const mode = clean(node.getAttribute("data-mode")) === "chat" ? "chat" : "search";
    const defaultPlaceholder = mode === "chat" ? "Ask a follow-up question" : "Example: sandpaper clogs too fast";
    const defaultButtonText = mode === "chat" ? "Send" : "Get Answer";
    const defaultLabel = mode === "chat" ? "Ask a follow-up question" : "Ask a sanding question";

    return {
      mode: mode,
      inputId: clean(node.getAttribute("data-input-id")),
      placeholder: clean(node.getAttribute("data-placeholder")) || defaultPlaceholder,
      buttonText: clean(node.getAttribute("data-button-text")) || defaultButtonText,
      label: clean(node.getAttribute("data-label")) || defaultLabel,
      includePhoto: boolAttr(node, "data-include-photo", true),
    };
  }

  function announceReady(root) {
    try {
      document.dispatchEvent(new CustomEvent("support-search-bar:ready", {
        detail: {
          root: root || document,
          version: VERSION,
        },
      }));
    } catch (_error) {
      return;
    }
  }

  function renderSearchPlaceholder(node) {
    if (!node || processedNodes.has(node)) {
      return null;
    }
    processedNodes.add(node);

    const options = readOptions(node);
    const built = createForm(options);

    if (options.mode === "chat") {
      const wrapper = document.createElement("div");
      wrapper.className = "support-followup-bar-shell";
      wrapper.appendChild(built.form);
      node.replaceWith(wrapper);
      announceReady(wrapper);
      return built;
    }

    const shell = document.createElement("div");
    shell.className = "support-search-shell";

    const extraClass = clean(node.getAttribute("data-shell-class"));
    if (extraClass) {
      extraClass.split(/\s+/).forEach(function (className) {
        if (className) {
          shell.classList.add(className);
        }
      });
    }

    shell.appendChild(built.form);

    const results = document.createElement("div");
    results.className = "search-results";
    results.setAttribute("data-search-results", "");
    shell.appendChild(results);

    node.replaceWith(shell);
    announceReady(shell);
    return built;
  }

  function upgradeLegacyChatForm(form) {
    if (!form || processedNodes.has(form) || form.classList.contains("support-search-form")) {
      return;
    }

    if (!form.matches(".chat-form, [data-ai-form], [data-solution-followup-form]")) {
      return;
    }

    const input = form.querySelector("[data-ai-input], [data-solution-followup-input], .chat-input");
    const submit = form.querySelector("button[type='submit'], .chat-send");

    if (!input || !submit) {
      return;
    }

    processedNodes.add(form);
    form.classList.add("support-search-form", "support-followup-search-form");
    input.classList.add("support-search-input");
    submit.classList.add("support-search-button");

    if (!form.querySelector(".support-mic-button")) {
      form.insertBefore(createMicButton(), submit);
    }

    if (!form.querySelector(".support-photo-button")) {
      form.insertBefore(createPhotoButton(), submit);
    }

    announceReady(form);
  }

  function renderAll(root) {
    const scope = root && root.querySelectorAll ? root : document;

    Array.prototype.slice.call(scope.querySelectorAll("[data-support-search-bar]")).forEach(renderSearchPlaceholder);
    Array.prototype.slice.call(scope.querySelectorAll(".chat-form, [data-ai-form], [data-solution-followup-form]")).forEach(upgradeLegacyChatForm);
  }

  function startObserver() {
    if (!window.MutationObserver) {
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }

          if (node.matches && (node.matches("[data-support-search-bar]") || node.matches(".chat-form, [data-ai-form], [data-solution-followup-form]"))) {
            renderAll(node.parentNode || document);
            return;
          }

          if (node.querySelectorAll) {
            renderAll(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function boot() {
    renderAll(document);
    startObserver();
  }

  window.eQualleSupportSearchBar = {
    version: VERSION,
    renderAll: renderAll,
    createForm: createForm,
    createSearchForm: function (options) {
      return createForm(Object.assign({ mode: "search" }, options || {}));
    },
    createChatForm: function (options) {
      return createForm(Object.assign({ mode: "chat" }, options || {}));
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
