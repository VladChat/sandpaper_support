// assets/support-assistant-modules/constants.js
// Purpose: shared storage keys and conversation limits.
(function (shared) {
  if (!shared) {
    return;
  }

  shared.STORAGE_KEYS = {
    sessionToken: "sessionToken",
    searchTrail: "searchTrail",
    lastQuery: "lastQuery",
    lastMatches: "lastMatches",
    clickedPages: "clickedPages",
    currentPage: "currentPage",
    assistantMessages: "assistantMessages",
    autoSubmittedQueries: "autoSubmittedQueries",
    conversationMemory: "eQualleAssistantConversationV2",
  };

  shared.CONVERSATION_CONFIG = {
    maxTurns: 10,
    expiryMs: 2 * 60 * 60 * 1000,
  };

  Object.assign(shared, {
    STORAGE_KEYS: shared.STORAGE_KEYS,
    CONVERSATION_CONFIG: shared.CONVERSATION_CONFIG,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
