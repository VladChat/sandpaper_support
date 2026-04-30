// assets/support-assistant-modules/conversation.js
// Purpose: conversation memory and page context helpers.
(function (shared) {
  if (!shared) {
    return;
  }

  const STORAGE_KEYS = shared.STORAGE_KEYS;
  const CONVERSATION_CONFIG = shared.CONVERSATION_CONFIG;
  function clean() { return shared.clean.apply(shared, arguments); }
  function stripSiteTitle() { return shared.stripSiteTitle.apply(shared, arguments); }
  function setStoredText() { return shared.setStoredText.apply(shared, arguments); }
  function getStoredJson() { return shared.getStoredJson.apply(shared, arguments); }
  function setStoredJson() { return shared.setStoredJson.apply(shared, arguments); }
  function readSolutionContextFromPage() { return shared.readSolutionContextFromPage.apply(shared, arguments); }


  function createNewConversationState() {
    return {
      sessionId: "conv-" + Math.random().toString(36).slice(2) + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPage: {
        path: window.location.pathname || "",
        title: stripSiteTitle(document.title),
      },
      turns: [],
    };
  }

  function getConversationState() {
    const raw = getStoredJson(STORAGE_KEYS.conversationMemory, null);
    if (!raw || typeof raw !== "object") {
      return createNewConversationState();
    }
  
    const now = new Date().getTime();
    const updatedAt = new Date(raw.updatedAt || 0).getTime();
    const isExpired = now - updatedAt > CONVERSATION_CONFIG.expiryMs;
  
    if (isExpired) {
      return createNewConversationState();
    }
  
    if (!Array.isArray(raw.turns)) {
      raw.turns = [];
    }
  
    return raw;
  }

  function saveConversationState(state) {
    if (!state || typeof state !== "object") {
      return;
    }
    state.updatedAt = new Date().toISOString();
    setStoredJson(STORAGE_KEYS.conversationMemory, state);
  }

  function resetConversationForNewQuestion(question) {
    const state = createNewConversationState();
    state.initialQuestion = String(question || "").trim();
    saveConversationState(state);
    setStoredText(STORAGE_KEYS.lastQuery, clean(question).trim());
    setStoredJson(STORAGE_KEYS.lastMatches, []);
    setStoredJson(STORAGE_KEYS.clickedPages, []);
  }

  function addConversationTurn(role, text, extra) {
    const state = getConversationState();
    const pagePath = (extra && extra.pagePath) || window.location.pathname || "";
    const pageTitle = (extra && extra.pageTitle) || stripSiteTitle(document.title);
  
    const turn = {
      role: String(role || "user"),
      text: String(text || ""),
      pagePath: pagePath,
      pageTitle: pageTitle,
      at: new Date().toISOString(),
    };
  
    state.turns.push(turn);
  
    while (state.turns.length > CONVERSATION_CONFIG.maxTurns) {
      state.turns.shift();
    }
  
    state.lastPage = {
      path: pagePath,
      title: pageTitle,
    };
  
    saveConversationState(state);
  }

  function summarizeAssistantText(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return "";
    }
  
    const lines = raw.split(/\n+/);
    const important = [];
  
    for (let i = 0; i < lines.length && important.join("\n").length < 500; i++) {
      const line = lines[i].trim();
      if (
        /^(grit|wet|dry|tool|tool|avoid|warning|step|recommended)/i.test(line) ||
        /\d+/.test(line) ||
        (line.length > 15 && !line.endsWith(":"))
      ) {
        important.push(line);
      }
    }
  
    const summary = important.join(" ").trim().slice(0, 500);
    return summary || raw.slice(0, 500);
  }

  function getRecentConversationText() {
    const state = getConversationState();
    if (!Array.isArray(state.turns) || !state.turns.length) {
      return "";
    }
  
    const recentTurns = state.turns.slice(-8);
    const lines = [];
  
    recentTurns.forEach(function (turn) {
      const roleLabel = turn.role === "assistant" ? "Assistant" : "User";
      const text = String(turn.text || "").trim();
      if (text) {
        lines.push(roleLabel + ": " + text);
      }
    });
  
    return lines.join("\n\n");
  }

  function buildPageContext() {
    const solutionContext = readSolutionContextFromPage();
    const pathname = window.location.pathname || "";
    const solutionMatch = pathname.match(/\/solutions\/([^/]+)\/?$/);
    const problemMatch = pathname.match(/\/problems\/([^/]+)\/?$/);
  
    let context = {
      currentPagePath: pathname,
      currentPageTitle: stripSiteTitle(document.title),
      solutionSlug: solutionMatch ? solutionMatch[1] : "",
      problemSlug: problemMatch ? problemMatch[1] : "",
    };
  
    if (solutionContext && typeof solutionContext === "object") {
      context.solutionContext = {
        title: solutionContext.title || "",
        problem: solutionContext.problem || "",
        surface: solutionContext.surface || "",
        task: solutionContext.task || "",
        symptom: solutionContext.symptom || "",
        quick_answer: solutionContext.quick_answer || "",
      };
    }
  
    return context;
  }

  Object.assign(shared, {
    createNewConversationState: createNewConversationState,
    getConversationState: getConversationState,
    saveConversationState: saveConversationState,
    resetConversationForNewQuestion: resetConversationForNewQuestion,
    addConversationTurn: addConversationTurn,
    summarizeAssistantText: summarizeAssistantText,
    getRecentConversationText: getRecentConversationText,
    buildPageContext: buildPageContext,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
