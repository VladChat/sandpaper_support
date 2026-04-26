function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?$/);
  return match ? match[1] : null;
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
      '<button type="button" data-feedback-helpful><span class="feedback-button-label">👍 Helpful</span><span class="feedback-count" data-feedback-helpful-count></span></button>' +
      '<button type="button" data-feedback-not-helpful><span class="feedback-button-label">👎 Not helpful</span><span class="feedback-count" data-feedback-not-helpful-count></span></button>' +
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
    const helpfulCountNode = panel.querySelector("[data-feedback-helpful-count]");
    const notHelpfulCountNode = panel.querySelector("[data-feedback-not-helpful-count]");
    const helpfulButton = panel.querySelector("[data-feedback-helpful]");
    const notHelpfulButton = panel.querySelector("[data-feedback-not-helpful]");
    const pagePath = window.location.pathname + window.location.hash;
    let countState = {
      helpful: null,
      notHelpful: null,
    };
    let isSubmitting = false;

    function showStatus(message) {
      status.textContent = message;
    }

    function formatCount(value) {
      return Number.isFinite(value) && value >= 0 ? String(value) : "";
    }

    function renderCounts() {
      if (helpfulCountNode) {
        helpfulCountNode.textContent = formatCount(countState.helpful);
      }
      if (notHelpfulCountNode) {
        notHelpfulCountNode.textContent = formatCount(countState.notHelpful);
      }
    }

    function setSubmitting(submitting) {
      isSubmitting = submitting;
      if (helpfulButton) {
        helpfulButton.disabled = submitting;
      }
      if (notHelpfulButton) {
        notHelpfulButton.disabled = submitting;
      }
    }

    function incrementCount(feedbackType) {
      if (feedbackType === "helpful" && Number.isFinite(countState.helpful)) {
        countState.helpful += 1;
      }
      if (feedbackType === "not_helpful" && Number.isFinite(countState.notHelpful)) {
        countState.notHelpful += 1;
      }
      renderCounts();
    }

    function loadCounts() {
      if (
        !window.eQualleSupabase ||
        !window.eQualleSupabase.isConfigured() ||
        typeof window.eQualleSupabase.fetchFeedbackCounts !== "function"
      ) {
        countState.helpful = null;
        countState.notHelpful = null;
        renderCounts();
        return Promise.resolve();
      }

      return window.eQualleSupabase.fetchFeedbackCounts(pagePath).then(function (result) {
        if (!result || !result.ok) {
          countState.helpful = null;
          countState.notHelpful = null;
          renderCounts();
          return;
        }
        countState.helpful = Number.isFinite(result.helpful) ? result.helpful : 0;
        countState.notHelpful = Number.isFinite(result.notHelpful) ? result.notHelpful : 0;
        renderCounts();
      });
    }

    function submit(feedbackType, rating, message) {
      if (!window.eQualleSupabase || !window.eQualleSupabase.isConfigured()) {
        showStatus("Feedback is saved only when support logging is enabled.");
        return Promise.resolve();
      }

      setSubmitting(true);
      return window.eQualleSupabase
        .submitFeedback({
          pagePath: pagePath,
          problemSlug: getProblemSlug(),
          feedbackType: feedbackType,
          rating: rating,
          message: message || "",
        })
        .then(function (result) {
          const isSuccess = result && result.ok;
          showStatus(
            isSuccess
              ? "Thanks for the feedback."
              : "Feedback could not be sent right now.",
          );
          if (isSuccess) {
            incrementCount(feedbackType);
            return loadCounts();
          }
          return null;
        })
        .finally(function () {
          setSubmitting(false);
        });
    }

    helpfulButton.addEventListener("click", function () {
        if (isSubmitting) {
          return;
        }
        detail.hidden = true;
        submit("helpful", 5, "");
      });

    notHelpfulButton.addEventListener("click", function () {
        if (isSubmitting) {
          return;
        }
        detail.hidden = false;
        textarea.focus();
      });

    detail.addEventListener("submit", function (event) {
      event.preventDefault();
      if (isSubmitting) {
        return;
      }
      submit("not_helpful", 1, textarea.value);
      detail.hidden = true;
    });

    loadCounts();
    card.appendChild(panel);
  });
}

function loadSupportAssistantAssets() {
  const stylesheetId = "equalle-support-assistant-css";
  if (!document.getElementById(stylesheetId)) {
    const link = document.createElement("link");
    link.id = stylesheetId;
    link.rel = "stylesheet";
    link.href = "/sandpaper_support/assets/support-assistant.css";
    document.head.appendChild(link);
  }

  if (window.eQualleSupportAssistant && window.eQualleSupportAssistant.init) {
    return Promise.resolve();
  }

  const scriptId = "equalle-support-assistant-js";
  const existing = document.getElementById(scriptId);

  if (existing) {
    return new Promise(function (resolve) {
      existing.addEventListener("load", function () {
        resolve();
      });
      existing.addEventListener("error", function () {
        resolve();
      });
    });
  }

  return new Promise(function (resolve) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "/sandpaper_support/assets/support-assistant.js";
    script.defer = true;
    script.onload = function () {
      resolve();
    };
    script.onerror = function () {
      resolve();
    };
    document.body.appendChild(script);
  });
}

setupFeedback();

loadSupportAssistantAssets().then(function () {
  if (window.eQualleSupportAssistant && window.eQualleSupportAssistant.init) {
    window.eQualleSupportAssistant.init({
      basePath: "/sandpaper_support",
    });
  }
});
