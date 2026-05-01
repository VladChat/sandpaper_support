// assets/support-assistant-modules/pages.js
// Purpose: homepage, ask page, and solution follow-up setup.
(function (shared) {
  if (!shared) {
    return;
  }

  const STORAGE_KEYS = shared.STORAGE_KEYS;
  function clean() { return shared.clean.apply(shared, arguments); }
  function debounce() { return shared.debounce.apply(shared, arguments); }
  function normalizePath() { return shared.normalizePath.apply(shared, arguments); }
  function setStoredText() { return shared.setStoredText.apply(shared, arguments); }
  function setStoredJson() { return shared.setStoredJson.apply(shared, arguments); }
  function pushSessionArray() { return shared.pushSessionArray.apply(shared, arguments); }
  function recordClickedPage() { return shared.recordClickedPage.apply(shared, arguments); }
  function resetConversationForNewQuestion() { return shared.resetConversationForNewQuestion.apply(shared, arguments); }
  function compactSearchEntry() { return shared.compactSearchEntry.apply(shared, arguments); }
  function parseExistingShell() { return shared.parseExistingShell.apply(shared, arguments); }
  function createAssistantRequester() { return shared.createAssistantRequester.apply(shared, arguments); }
  function wireChat() { return shared.wireChat.apply(shared, arguments); }
  function readSolutionContextFromPage() { return shared.readSolutionContextFromPage.apply(shared, arguments); }
  function setupPhotoInputs() {
    if (typeof shared.setupPhotoInputs !== "function") {
      return;
    }
    return shared.setupPhotoInputs.apply(shared, arguments);
  }
  function savePendingPhotoFromElement() {
    if (typeof shared.savePendingPhotoFromElement !== "function") {
      return false;
    }
    return shared.savePendingPhotoFromElement.apply(shared, arguments);
  }
  function consumePendingPhoto() {
    if (typeof shared.consumePendingPhoto !== "function") {
      return [];
    }
    return shared.consumePendingPhoto.apply(shared, arguments);
  }


  function setupHomepageSearch(basePath, knowledge) {
    if (window.eQualleUseAlgoliaAutocomplete) {
      return;
    }
    const input = document.querySelector("[data-support-search]");
    const results = document.querySelector("[data-search-results]");
    const submitButton = document.querySelector("[data-support-search-submit]");
  
    if (
      (window.eQualleUseUnifiedAutocomplete === true ||
        window.eQualleUseAlgoliaAutocomplete === true) &&
      input
    ) {
      return;
    }
  
    if (!input || !results) {
      return;
    }

    setupPhotoInputs(input.closest(".support-search-shell") || document);
  
    const logRenderedSearch = debounce(function (query, resultCount) {
      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(query, resultCount, null);
      }
    }, 600);
  
    function isHomepageAnswerMatch(match) {
      const target = String((match && (match.target_url || match.targetUrl)) || "");
      if (target === "/solutions/") {
        return false;
      }
      return Boolean(
        match &&
          match.result_kind === "answer" &&
          target.indexOf("/solutions/") === 0
      );
    }
  
    function renderOutput(q, matches) {
      results.innerHTML = "";
      const visibleMatches = (Array.isArray(matches) ? matches : []).filter(isHomepageAnswerMatch);
  
      if (!q) {
        return;
      }
  
      if (!visibleMatches.length) {
        return;
      } else {
        visibleMatches.forEach(function (match) {
          const link = document.createElement("a");
          link.className = "result-link";
          link.href = normalizePath(basePath, match.target_url || match.targetUrl || "");
          const title = String(match.title || "").trim();
          const description = String(match.description || "").trim();
  
          const kindNode = document.createElement("span");
          kindNode.className = "result-kind result-kind-answer";
          kindNode.textContent = "Answer";
  
          const textNode = document.createElement("span");
          textNode.className = "result-text";
  
          const titleNode = document.createElement("span");
          titleNode.className = "result-title";
          titleNode.textContent = title || "";
          textNode.appendChild(titleNode);
  
          if (description) {
            const descriptionNode = document.createElement("span");
            descriptionNode.className = "result-description";
            descriptionNode.textContent = " - " + description;
            textNode.appendChild(descriptionNode);
          }
  
          link.appendChild(kindNode);
          link.appendChild(textNode);
  
          link.addEventListener("click", function () {
            if (window.eQualleSupabase) {
              window.eQualleSupabase.logSearch(q, visibleMatches.length, link.pathname);
            }
            recordClickedPage(link.pathname, match.title);
          });
  
          results.appendChild(link);
        });
      }
    }
  
    function render(query) {
      const q = clean(query).trim();
      const matches = q ? knowledge.findSearchMatches(q, 5, { answerOnly: true }) : [];
      const visibleMatches = matches.filter(isHomepageAnswerMatch);
  
      setStoredText(STORAGE_KEYS.lastQuery, q);
      setStoredJson(STORAGE_KEYS.lastMatches, visibleMatches.slice(0, 5).map(compactSearchEntry));
  
      pushSessionArray(
        STORAGE_KEYS.searchTrail,
        {
          query: q,
          resultCount: visibleMatches.length,
          at: new Date().toISOString(),
        },
        25,
      );
  
      if (!q) {
        results.innerHTML = "";
        return;
      }
  
      logRenderedSearch(q, visibleMatches.length);
  
      renderOutput(q, visibleMatches);
    }
  
    input.addEventListener("input", function (event) {
      render(event.target.value);
    });
  
    function redirectToAskPage(message) {
      window.location.href = normalizePath(basePath, "/ask/") + "?q=" + encodeURIComponent(message);
    }
  
    function runSearchAction() {
      const message = input.value.trim();
      if (!message) {
        input.focus();
        return;
      }
  
      const matches = knowledge.findSearchMatches(message, 5, { answerOnly: true });
      const visibleMatches = matches.filter(isHomepageAnswerMatch);
  
      setStoredText(STORAGE_KEYS.lastQuery, clean(message).trim());
      setStoredJson(STORAGE_KEYS.lastMatches, []);
      renderOutput(message, visibleMatches);
      resetConversationForNewQuestion(message);
      savePendingPhotoFromElement(input);
  
      if (window.eQualleSupabase) {
        window.eQualleSupabase.logSearch(message, visibleMatches.length, null);
      }
  
      redirectToAskPage(message);
    }
  
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      runSearchAction();
    });
  
    if (submitButton) {
      submitButton.addEventListener("click", function (event) {
        event.preventDefault();
        runSearchAction();
      });
    }
  
    input.value = "";
  }

  function setupAiAssistantPage(basePath, knowledge) {
    const shell = parseExistingShell(document.querySelector("[data-ai-chat]"));
    if (!shell) {
      return;
    }
  
    setupPhotoInputs(shell.root || document);
    const requester = createAssistantRequester(basePath, knowledge);
    const chat = wireChat(shell, requester, basePath, {
      source: "ai-assistant-page",
    });
    const params = new URLSearchParams(window.location.search);
    const q = String(params.get("q") || "").trim();
    if (q) {
      const pendingImages = consumePendingPhoto();
      resetConversationForNewQuestion(q);
      shell.input.value = "";
      shell.messages.innerHTML = "";
      chat.ask(q, { auto: true, images: pendingImages });
    }
  }

  function setupSupportFollowup(basePath, knowledge) {
    const followupRoot = document.querySelector("[data-solution-followup]");
    const form = document.querySelector("[data-solution-followup-form]");
    const input = document.querySelector("[data-solution-followup-input]");
    const messages = document.querySelector("[data-solution-followup-messages]");
    const solutionContext = readSolutionContextFromPage();
  
    if (!followupRoot || !form || !input || !messages || !solutionContext) {
      return;
    }
  
    const shell = {
      root: followupRoot,
      form: form,
      input: input,
      messages: messages,
    };
  
    setupPhotoInputs(followupRoot);
    const requester = createAssistantRequester(basePath, knowledge);
    wireChat(shell, requester, basePath, {
      source: "solution_followup",
      noAutoScroll: true,
      getRequestContext: function () {
        return {
          source: "solution_followup",
          solution_id: solutionContext.solution_id || "",
          solution_slug: solutionContext.solution_slug || "",
          solution_context: {
            title: solutionContext.title || "",
            problem: solutionContext.problem || "",
            surface: solutionContext.surface || "",
            task: solutionContext.task || "",
            symptom: solutionContext.symptom || "",
            quick_answer: solutionContext.quick_answer || "",
            best_grit_path: Array.isArray(solutionContext.best_grit_path)
              ? solutionContext.best_grit_path.slice(0, 10)
              : [],
            optional_starting_grits: Array.isArray(solutionContext.optional_starting_grits)
              ? solutionContext.optional_starting_grits.slice(0, 6)
              : [],
            steps: Array.isArray(solutionContext.steps)
              ? solutionContext.steps.slice(0, 10)
              : [],
            why_it_happens: solutionContext.why_it_happens || "",
            mistakes_to_avoid: Array.isArray(solutionContext.mistakes_to_avoid)
              ? solutionContext.mistakes_to_avoid.slice(0, 8)
              : [],
            success_check: solutionContext.success_check || "",
            wet_or_dry: solutionContext.wet_or_dry || "",
            related_solution_ids: Array.isArray(solutionContext.related_solution_ids)
              ? solutionContext.related_solution_ids.slice(0, 10)
              : [],
          },
        };
      },
    });
  }

  Object.assign(shared, {
    setupHomepageSearch: setupHomepageSearch,
    setupAiAssistantPage: setupAiAssistantPage,
    setupSupportFollowup: setupSupportFollowup,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
