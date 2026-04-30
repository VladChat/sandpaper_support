// assets/support-assistant-modules/chat.js
// Purpose: chat submit and response wiring.
(function (shared) {
  if (!shared) {
    return;
  }

  const STORAGE_KEYS = shared.STORAGE_KEYS;
  function clean() { return shared.clean.apply(shared, arguments); }
  function isOrderTrackingQuery() { return shared.isOrderTrackingQuery.apply(shared, arguments); }
  function appendMessage() { return shared.appendMessage.apply(shared, arguments); }
  function pushSessionArray() { return shared.pushSessionArray.apply(shared, arguments); }
  function recordClickedPage() { return shared.recordClickedPage.apply(shared, arguments); }
  function renderSupportAnswer() { return shared.renderSupportAnswer.apply(shared, arguments); }
  function renderCompactAssistantAnswer() { return shared.renderCompactAssistantAnswer.apply(shared, arguments); }
  function isShellLocked() { return shared.isShellLocked.apply(shared, arguments); }
  function setShellControlsDisabled() { return shared.setShellControlsDisabled.apply(shared, arguments); }
  function lockShellForLogin() { return shared.lockShellForLogin.apply(shared, arguments); }
  function renderPendingIndicator() { return shared.renderPendingIndicator.apply(shared, arguments); }
  function clearPendingIndicator() { return shared.clearPendingIndicator.apply(shared, arguments); }
  function appendLoginRequiredCard() { return shared.appendLoginRequiredCard.apply(shared, arguments); }
  function unlockShellAfterLogin() { return shared.unlockShellAfterLogin.apply(shared, arguments); }
  function updateSignedInStatus() { return shared.updateSignedInStatus.apply(shared, arguments); }

  function wireChat(shell, requester, basePath, options) {
    if (!shell) {
      return {
        ask: function () {
          return;
        },
      };
    }

    const source = options && options.source ? options.source : "chat";
    const noAutoScroll = Boolean(options && options.noAutoScroll === true);
    const getRequestContext =
      options && typeof options.getRequestContext === "function"
        ? options.getRequestContext
        : null;
    let assistantReplyCount = 0;
    updateSignedInStatus(shell);

    function sendMessage(userMessage, meta) {
      const message = String(userMessage || "").trim();
      if (!message || isShellLocked(shell)) {
        return;
      }

      setShellControlsDisabled(shell, true);

      const skipUserBubble = Boolean(meta && meta.skipUserBubble === true);

      if (!skipUserBubble) {
        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "user",
            text: message,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );

        appendMessage(shell.messages, "user", message, { noAutoScroll: noAutoScroll });
      }

      const pending = appendMessage(
        shell.messages,
        "assistant",
        "",
        { noAutoScroll: noAutoScroll },
      );
      renderPendingIndicator(pending);
      const shouldRenderStructuredAnswer =
        source === "ai-assistant-page" &&
        (assistantReplyCount === 0 || Boolean(meta && meta.auto === true));

      if (isOrderTrackingQuery(message)) {
        clearPendingIndicator(pending);
        pending.textContent =
          "I can’t track orders here. Please check your order confirmation email or the retailer where you purchased the sandpaper.";
        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "assistant",
            text: pending.textContent,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );
        setShellControlsDisabled(shell, false);
        assistantReplyCount += 1;
        return;
      }

      const dynamicContext = getRequestContext ? (getRequestContext() || {}) : {};
      requester(
        message,
        Object.assign(
          {
            source: source,
            mode: meta && meta.auto ? "auto" : "manual",
          },
          dynamicContext,
        ),
      ).then(function (result) {
        clearPendingIndicator(pending);

        if (!result.ok) {
          const fallbackReply =
            "Answer Summary: Assistant response is unavailable right now.\nNext Step: Use the links below or ask a more specific sanding question.";
          if (shouldRenderStructuredAnswer) {
            renderSupportAnswer(pending, fallbackReply, result.localMatches || [], basePath, function (page) {
              recordClickedPage(page.path, page.title);
            });
          } else {
            renderCompactAssistantAnswer(pending, fallbackReply, result.localMatches || []);
          }

          pushSessionArray(
            STORAGE_KEYS.assistantMessages,
            {
              role: "assistant",
              text: fallbackReply,
              at: new Date().toISOString(),
              source: source,
            },
            30,
          );
          setShellControlsDisabled(shell, false);
          assistantReplyCount += 1;
          return;
        }

        if (result.code === "login_required") {
          if (pending && pending.parentNode) {
            pending.parentNode.removeChild(pending);
          }
          appendLoginRequiredCard(shell.messages, {
            shell: shell,
            onSuccess: function () {
              unlockShellAfterLogin(shell);
              updateSignedInStatus(shell);
              sendMessage(message, {
                auto: Boolean(meta && meta.auto === true),
                skipUserBubble: true,
              });
            },
          });
          lockShellForLogin(shell);
          return;
        }

        if (result.requestLogId && shell.root) {
          shell.root.setAttribute("data-last-ai-request-log-id", result.requestLogId);
          document.documentElement.setAttribute("data-last-ai-request-log-id", result.requestLogId);
        }

        const combinedReply =
          result.needsClarification && result.clarifyingQuestion
            ? (result.reply &&
                clean(result.reply) !== clean(result.clarifyingQuestion) &&
                result.reply.trim().length > 0
                ? result.reply + "\n\n" + result.clarifyingQuestion
                : result.clarifyingQuestion)
            : (result.reply || "I need one more detail to guide you.");

        if (shouldRenderStructuredAnswer) {
          renderSupportAnswer(pending, combinedReply, result.matchedPages, basePath, function (page) {
            recordClickedPage(page.path, page.title);
          });
        } else {
          renderCompactAssistantAnswer(pending, combinedReply, result.matchedPages);
        }

        if (result.nextAction === "login_required") {
          appendLoginRequiredCard(shell.messages, { shell: shell });
          lockShellForLogin(shell);
        } else {
          setShellControlsDisabled(shell, false);
        }

        pushSessionArray(
          STORAGE_KEYS.assistantMessages,
          {
            role: "assistant",
            text: combinedReply,
            at: new Date().toISOString(),
            source: source,
          },
          30,
        );
        assistantReplyCount += 1;
      }).catch(function () {
        clearPendingIndicator(pending);
        pending.textContent = "Assistant response is unavailable right now.";
        setShellControlsDisabled(shell, false);
        assistantReplyCount += 1;
      });
    }

    shell.form.addEventListener("submit", function (event) {
      event.preventDefault();
      const userMessage = shell.input.value.trim();
      if (!userMessage) {
        return;
      }
      shell.input.value = "";
      sendMessage(userMessage, { auto: false });
    });

    return {
      ask: sendMessage,
    };
  }

  Object.assign(shared, {
    wireChat: wireChat,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
