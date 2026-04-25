async function loadJson(path) {
  const response = await fetch(path);
  return await response.json();
}

function clean(value) {
  return String(value || "").toLowerCase();
}

function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function debounce(callback, wait) {
  let timeoutId;
  return function () {
    const args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function () {
      callback.apply(null, args);
    }, wait);
  };
}

async function setupSearch() {
  const input = document.querySelector("[data-support-search]");
  const results = document.querySelector("[data-search-results]");

  if (!input || !results) {
    return;
  }

  const problems = await loadJson("/sandpaper_support/data/problem-tree.json").catch(
    () => loadJson("data/problem-tree.json"),
  );

  const logRenderedSearch = debounce(function (query, resultCount) {
    if (window.eQualleSupabase) {
      window.eQualleSupabase.logSearch(query, resultCount, null);
    }
  }, 600);

  function render(query) {
    const q = clean(query).trim();
    results.innerHTML = "";

    if (!q) {
      return;
    }

    const matches = problems
      .filter((problem) => {
        const hay = [
          problem.title,
          problem.description,
          ...(problem.aliases || []),
          ...(problem.qualifiers || []),
          ...(problem.solutions || []).map((solution) => solution.title),
        ]
          .join(" ")
          .toLowerCase();

        return (
          hay.includes(q) ||
          q.split(/\s+/).some((term) => term.length > 2 && hay.includes(term))
        );
      })
      .slice(0, 6);

    logRenderedSearch(q, matches.length);

    if (!matches.length) {
      results.innerHTML =
        '<div class="result-link">No exact match yet. Try: scratches, clogging, grit, haze, rough, swirl marks.</div>';
      return;
    }

    for (const problem of matches) {
      const link = document.createElement("a");
      link.className = "result-link";
      link.href = `/sandpaper_support/problems/${problem.id}/`;
      link.textContent = problem.title + " - " + problem.description;
      link.addEventListener("click", function () {
        if (window.eQualleSupabase) {
          window.eQualleSupabase.logSearch(q, matches.length, link.pathname);
        }
      });
      results.appendChild(link);
    }
  }

  input.addEventListener("input", (event) => render(event.target.value));
}

function setupFeedback() {
  const cards = document.querySelectorAll(".answer-card");

  if (!cards.length) {
    return;
  }

  cards.forEach(function (card) {
    if (card.querySelector("[data-feedback-panel]")) {
      return;
    }

    const panel = document.createElement("div");
    panel.className = "feedback-panel";
    panel.setAttribute("data-feedback-panel", "");
    panel.innerHTML =
      '<div class="feedback-title">Was this helpful?</div>' +
      '<div class="feedback-actions">' +
      '<button type="button" data-feedback-helpful>👍 Helpful</button>' +
      '<button type="button" data-feedback-not-helpful>👎 Not helpful</button>' +
      "</div>" +
      '<form class="feedback-detail" data-feedback-detail hidden>' +
      '<label for="feedback-message-' +
      card.id +
      '">What was missing?</label>' +
      '<textarea id="feedback-message-' +
      card.id +
      '" rows="3" placeholder="Optional details"></textarea>' +
      '<button type="submit">Submit feedback</button>' +
      "</form>" +
      '<div class="feedback-status" data-feedback-status aria-live="polite"></div>';

    const status = panel.querySelector("[data-feedback-status]");
    const detail = panel.querySelector("[data-feedback-detail]");
    const textarea = panel.querySelector("textarea");

    function showStatus(message) {
      status.textContent = message;
    }

    function submit(feedbackType, rating, message) {
      if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
        showStatus("Feedback is saved only when support logging is enabled.");
        return Promise.resolve();
      }

      return window.eQualleSupabase
        .submitFeedback({
          pagePath: window.location.pathname + window.location.hash,
          problemSlug: getProblemSlug(),
          feedbackType: feedbackType,
          rating: rating,
          message: message || "",
        })
        .then(function (result) {
          showStatus(
            result && result.ok
              ? "Thanks for the feedback."
              : "Feedback could not be sent right now.",
          );
        });
    }

    panel
      .querySelector("[data-feedback-helpful]")
      .addEventListener("click", function () {
        detail.hidden = true;
        submit("helpful", 5, "");
      });

    panel
      .querySelector("[data-feedback-not-helpful]")
      .addEventListener("click", function () {
        detail.hidden = false;
        textarea.focus();
      });

    detail.addEventListener("submit", function (event) {
      event.preventDefault();
      submit("not_helpful", 1, textarea.value);
      detail.hidden = true;
    });

    card.appendChild(panel);
  });
}

function getAssistantSessionToken() {
  try {
    const key = "equalle_ai_assistant_session";
    const existing = window.sessionStorage.getItem(key);

    if (existing) {
      return existing;
    }

    const token = "assistant-" + Math.random().toString(36).slice(2) + Date.now();
    window.sessionStorage.setItem(key, token);
    return token;
  } catch (_error) {
    return "assistant-" + Date.now();
  }
}

function setupAssistantChat() {
  const shell = document.querySelector("[data-ai-chat]");

  if (!shell) {
    return;
  }

  const form = shell.querySelector("[data-ai-form]");
  const input = shell.querySelector("[data-ai-input]");
  const messages = shell.querySelector("[data-ai-messages]");

  if (!form || !input || !messages) {
    return;
  }

  const sessionToken = getAssistantSessionToken();

  function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = "chat-message chat-message-" + role;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  function addLinks(pages) {
    if (!Array.isArray(pages) || !pages.length) {
      return;
    }

    const list = document.createElement("div");
    list.className = "chat-links";

    pages.forEach(function (page) {
      const href = page && (page.href || page.url || page.path);
      const label = (page && (page.title || page.label || href)) || "";

      if (!href || !label) {
        return;
      }

      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      list.appendChild(link);
    });

    if (list.children.length) {
      messages.appendChild(list);
      messages.scrollTop = messages.scrollHeight;
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const userMessage = input.value.trim();

    if (!userMessage) {
      return;
    }

    input.value = "";
    addMessage("user", userMessage);

    if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
      addMessage(
        "assistant",
        "The assistant is unavailable right now. The support pages still work.",
      );
      return;
    }

    const pending = addMessage("assistant", "Checking approved support content...");

    window.eQualleSupabase
      .askSupportAssistant({
        sessionToken: sessionToken,
        userMessage: userMessage,
        context: {
          currentPath: window.location.pathname,
        },
      })
      .then(function (result) {
        if (!result || !result.ok) {
          pending.textContent =
            "The assistant is unavailable right now. The support pages still work.";
          return;
        }

        pending.textContent = result.reply || "I need a little more detail.";

        if (result.clarifyingQuestion) {
          addMessage("assistant", result.clarifyingQuestion);
        }

        addLinks(result.matchedPages);
      });
  });
}

setupSearch();
setupFeedback();
setupAssistantChat();
