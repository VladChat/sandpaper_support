// assets/support-assistant-modules/voice-input.js
// Purpose: browser-native voice input for supported search boxes.
(function (shared) {
  if (!shared) {
    return;
  }

  let activeRecognition = null;
  let activeButton = null;
  let activeInput = null;
  let activeBaseText = "";
  let observerStarted = false;


  function installVoiceStyles() {
    const styleId = "equalle-support-voice-input-css";
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".support-mic-button[hidden]{display:none!important;}",
      ".support-mic-button{position:relative;}",
      ".support-mic-button.support-mic-button-listening,.support-mic-button[aria-pressed='true']{background:rgba(124,177,217,.18);color:#0d527a;box-shadow:inset 0 0 0 1px rgba(124,177,217,.38);}",
      ".support-mic-button.support-mic-button-listening::after{content:'';position:absolute;inset:4px;border:1px solid rgba(13,82,122,.34);border-radius:999px;animation:supportVoicePulse 1.1s ease-in-out infinite;}",
      ".support-mic-button.support-mic-button-error{background:#fff7ed;color:#9a3412;box-shadow:inset 0 0 0 1px #fed7aa;}",
      "@keyframes supportVoicePulse{0%{opacity:.35;transform:scale(.92)}50%{opacity:1;transform:scale(1)}100%{opacity:.35;transform:scale(.92)}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function getRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isVoiceSupported() {
    return typeof getRecognitionConstructor() === "function";
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getVoiceLang(button) {
    const value =
      (button && button.getAttribute("data-voice-lang")) ||
      document.documentElement.getAttribute("lang") ||
      navigator.language ||
      "en-US";
    return String(value).toLowerCase() === "en" ? "en-US" : value;
  }

  function dispatchInput(input) {
    if (!input) {
      return;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function resolveInput(button) {
    if (!button) {
      return null;
    }

    const shell =
      button.closest(".support-search-shell") ||
      button.closest(".chat-shell") ||
      button.closest("[data-ai-chat]") ||
      button.closest("[data-solution-followup]") ||
      button.closest("form") ||
      document;

    return (
      shell.querySelector("[data-support-search]") ||
      shell.querySelector("[data-ai-input]") ||
      shell.querySelector("[data-solution-followup-input]") ||
      shell.querySelector(".chat-input") ||
      null
    );
  }

  function setButtonIdle(button) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-listening", "support-mic-button-error");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Start voice input");
    button.title = "Start voice input";
  }

  function setButtonListening(button) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-error");
    button.classList.add("support-mic-button-listening");
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "Stop voice input");
    button.title = "Listening...";
  }

  function setButtonError(button, message) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-listening");
    button.classList.add("support-mic-button-error");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Voice input unavailable");
    button.title = message || "Voice input unavailable";
    window.setTimeout(function () {
      setButtonIdle(button);
    }, 2200);
  }

  function hideUnsupportedButton(button) {
    if (!button) {
      return;
    }
    button.hidden = true;
    button.disabled = true;
    button.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-label", "Voice input not supported in this browser");
    button.title = "Voice input not supported in this browser";
  }

  function stopActiveRecognition() {
    if (!activeRecognition) {
      return;
    }
    try {
      activeRecognition.stop();
    } catch (_error) {
      return;
    }
  }

  function clearActiveState() {
    setButtonIdle(activeButton);
    activeRecognition = null;
    activeButton = null;
    activeInput = null;
    activeBaseText = "";
  }

  function applyTranscript(transcript) {
    if (!activeInput) {
      return;
    }

    const spokenText = clean(transcript);
    const nextValue = clean([activeBaseText, spokenText].filter(Boolean).join(" "));
    activeInput.value = nextValue;
    dispatchInput(activeInput);
  }

  function readTranscript(event) {
    const parts = [];
    const results = event && event.results ? event.results : [];
    const start = Number.isFinite(event && event.resultIndex) ? event.resultIndex : 0;

    for (let index = start; index < results.length; index += 1) {
      const result = results[index];
      if (result && result[0] && result[0].transcript) {
        parts.push(result[0].transcript);
      }
    }

    return parts.join(" ");
  }

  function startVoiceInput(button) {
    const Recognition = getRecognitionConstructor();
    const input = resolveInput(button);

    if (!Recognition) {
      hideUnsupportedButton(button);
      return;
    }

    if (!input || input.disabled) {
      setButtonError(button, "Voice input field is unavailable");
      return;
    }

    if (activeRecognition && activeButton === button) {
      stopActiveRecognition();
      return;
    }

    if (activeRecognition) {
      stopActiveRecognition();
      clearActiveState();
    }

    const recognition = new Recognition();
    recognition.lang = getVoiceLang(button);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    activeRecognition = recognition;
    activeButton = button;
    activeInput = input;
    activeBaseText = clean(input.value);

    recognition.onstart = function () {
      setButtonListening(button);
      input.focus();
    };

    recognition.onresult = function (event) {
      applyTranscript(readTranscript(event));
    };

    recognition.onerror = function (event) {
      const error = event && event.error ? String(event.error) : "";
      const message = error === "not-allowed" || error === "service-not-allowed"
        ? "Microphone permission is blocked"
        : "Voice input unavailable";
      setButtonError(button, message);
    };

    recognition.onend = function () {
      clearActiveState();
    };

    try {
      recognition.start();
    } catch (_error) {
      setButtonError(button, "Voice input unavailable");
      clearActiveState();
    }
  }

  function bindButton(button) {
    if (!button || button.getAttribute("data-support-voice-bound") === "true") {
      return;
    }

    button.setAttribute("data-support-voice-bound", "true");

    if (!isVoiceSupported()) {
      hideUnsupportedButton(button);
      return;
    }

    button.hidden = false;
    button.disabled = false;
    button.removeAttribute("aria-hidden");
    setButtonIdle(button);

    button.addEventListener("click", function (event) {
      event.preventDefault();
      startVoiceInput(button);
    });
  }

  function setupVoiceInput(root) {
    installVoiceStyles();
    const scope = root && root.querySelectorAll ? root : document;
    Array.prototype.slice.call(scope.querySelectorAll(".support-mic-button")).forEach(bindButton);

    if (observerStarted || !window.MutationObserver) {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches(".support-mic-button")) {
            bindButton(node);
          }
          if (node.querySelectorAll) {
            Array.prototype.slice.call(node.querySelectorAll(".support-mic-button")).forEach(bindButton);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  Object.assign(shared, {
    setupVoiceInput: setupVoiceInput,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
