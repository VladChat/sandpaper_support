// assets/support-assistant.js
// Purpose: bootstrap the modular support assistant while preserving window.eQualleSupportAssistant.init(options).
(function () {
  const MODULE_FILES = [
    "constants.js",
    "utils.js",
    "storage.js",
    "conversation.js",
    "prompt-builder.js",
    "knowledge.js",
    "renderers.js",
    "shell.js",
    "requester.js",
    "chat.js",
    "pages.js",
    "init.js",
  ];
  const CACHE_VERSION = "support-auth-otp-login-20260430-v2";

  const shared = window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {};
  const pendingInits = shared.pendingInits || [];
  shared.pendingInits = pendingInits;

  let activeInit = shared.init || null;
  let ready = Boolean(activeInit);

  window.eQualleSupportAssistant = window.eQualleSupportAssistant || {};
  window.eQualleSupportAssistant.__moduleLoaderStarted = true;
  window.eQualleSupportAssistant.init = function (options) {
    if (ready && typeof activeInit === "function") {
      return activeInit(options || {});
    }
    pendingInits.push(options || {});
    return null;
  };

  shared.registerInit = function (init) {
    activeInit = init;
    shared.init = init;
    ready = true;

    while (pendingInits.length) {
      activeInit(pendingInits.shift() || {});
    }
  };

  function getModuleBaseUrl() {
    const script = document.currentScript || document.getElementById("equalle-support-assistant-js");
    if (script && script.src) {
      return new URL("./support-assistant-modules/", script.src).toString();
    }
    return "/sandpaper_support/assets/support-assistant-modules/";
  }

  function loadModuleScript(baseUrl, fileName) {
    const scriptId = "equalle-support-assistant-module-" + fileName.replace(/[^a-z0-9_-]/gi, "-");
    const existing = document.getElementById(scriptId);
    if (existing && existing.getAttribute("data-loaded") === "true") {
      return Promise.resolve();
    }
    if (existing) {
      return new Promise(function (resolve) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { resolve(); });
      });
    }

    return new Promise(function (resolve) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = baseUrl + fileName + "?v=" + encodeURIComponent(CACHE_VERSION);
      script.defer = true;
      script.onload = function () {
        script.setAttribute("data-loaded", "true");
        resolve();
      };
      script.onerror = function () {
        console.error("Failed to load support assistant module:", fileName);
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  if (shared.modulesLoading) {
    return;
  }

  shared.modulesLoading = true;
  const moduleBaseUrl = getModuleBaseUrl();

  MODULE_FILES.reduce(function (chain, fileName) {
    return chain.then(function () {
      return loadModuleScript(moduleBaseUrl, fileName);
    });
  }, Promise.resolve()).finally(function () {
    shared.modulesLoading = false;
  });
})();
