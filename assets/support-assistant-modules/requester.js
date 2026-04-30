// assets/support-assistant-modules/requester.js
// Purpose: Supabase assistant request payload construction.
(function (shared) {
  if (!shared) {
    return;
  }

  const STORAGE_KEYS = shared.STORAGE_KEYS;
  function stripSiteTitle() { return shared.stripSiteTitle.apply(shared, arguments); }
  function getStoredText() { return shared.getStoredText.apply(shared, arguments); }
  function getStoredJson() { return shared.getStoredJson.apply(shared, arguments); }
  function getSessionToken() { return shared.getSessionToken.apply(shared, arguments); }
  function addConversationTurn() { return shared.addConversationTurn.apply(shared, arguments); }
  function buildAssistantPrompt() { return shared.buildAssistantPrompt.apply(shared, arguments); }
  function compactSearchEntry() { return shared.compactSearchEntry.apply(shared, arguments); }
  function compactSolutionCard() { return shared.compactSolutionCard.apply(shared, arguments); }
  function compactSequence() { return shared.compactSequence.apply(shared, arguments); }

  function isBlockedBeforeAssistant(result) {
    return Boolean(result && result.code === "login_required");
  }

  function createAssistantRequester(basePath, knowledge) {
    return function requestAssistant(userMessage, context) {
      const currentTitle = stripSiteTitle(document.title);
      const currentPath = window.location.pathname;
      const contextInput = context && typeof context === "object" ? context : {};
      const useConversationContext = contextInput.mode === "manual";
      const lastMatches = useConversationContext
        ? getStoredJson(STORAGE_KEYS.lastMatches, [])
        : [];

      const searchEntries = knowledge.findSearchMatches(userMessage, 5);
      const solutionCards = knowledge.findSolutionCards(
        userMessage,
        currentPath,
        currentTitle,
        lastMatches,
        5,
      );
      const gritSequences = knowledge.findGritSequences(
        userMessage,
        searchEntries,
        solutionCards,
        2,
      );

      const retrievedContent = {
        searchEntries: searchEntries.slice(0, 5).map(compactSearchEntry),
        solutionCards: solutionCards.slice(0, 5).map(compactSolutionCard),
        gritSequences: gritSequences.slice(0, 2).map(compactSequence),
      };

      const contextualPrompt = buildAssistantPrompt(userMessage, {
        compactFollowup: useConversationContext,
        includeRecentConversation: useConversationContext,
      });

      const payload = {
        sessionToken: getSessionToken(),
        userMessage: contextualPrompt,
        accessToken:
          window.eQualleSupabase &&
          typeof window.eQualleSupabase.getAccessToken === "function"
            ? window.eQualleSupabase.getAccessToken()
            : "",
        context: {
          currentPath: currentPath,
          currentTitle: currentTitle,
          lastQuery: useConversationContext ? getStoredText(STORAGE_KEYS.lastQuery, "") : "",
          lastMatches: useConversationContext ? getStoredJson(STORAGE_KEYS.lastMatches, []) : [],
          clickedPages: useConversationContext ? getStoredJson(STORAGE_KEYS.clickedPages, []) : [],
          retrievedContent: retrievedContent,
          source: contextInput.source ? contextInput.source : "site",
          solution_id: contextInput.solution_id || "",
          solution_slug: contextInput.solution_slug || "",
          solution_context: contextInput.solution_context || null,
        },
      };

      if (Array.isArray(contextInput.images) && contextInput.images.length > 0) {
        payload.images = contextInput.images.slice(0, 1);
      }

      if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
        return Promise.resolve({
          ok: false,
          error: "supabase_not_configured",
          localMatches: payload.context.lastMatches,
        });
      }

      return window.eQualleSupabase.askSupportAssistant(payload).then(function (result) {
        if (!result || !result.ok) {
          return {
            ok: false,
            error: "assistant_unavailable",
            localMatches: payload.context.lastMatches,
          };
        }

        if (isBlockedBeforeAssistant(result)) {
          return {
            ok: true,
            reply: result.reply || "",
            needsClarification: false,
            clarifyingQuestion: "",
            matchedPages: [],
            draftCreated: false,
            code: result.code || "",
            nextAction: result.nextAction || "",
            remaining: Number.isFinite(result.remaining) ? result.remaining : null,
            requestLogId: result.requestLogId || result.request_log_id || "",
          };
        }

        const replyText = result.reply || "";

        addConversationTurn("user", userMessage, {
          pagePath: currentPath,
          pageTitle: currentTitle,
        });

        addConversationTurn("assistant", replyText, {
          pagePath: currentPath,
          pageTitle: currentTitle,
        });

        return {
          ok: true,
          reply: replyText,
          needsClarification: Boolean(result.needsClarification),
          clarifyingQuestion: result.clarifyingQuestion || "",
          matchedPages: Array.isArray(result.matchedPages) ? result.matchedPages : [],
          draftCreated: Boolean(result.draftCreated),
          code: result.code || "",
          nextAction: result.nextAction || "",
          remaining: Number.isFinite(result.remaining) ? result.remaining : null,
          requestLogId: result.requestLogId || result.request_log_id || "",
        };
      });
    };
  }

  Object.assign(shared, {
    createAssistantRequester: createAssistantRequester,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
