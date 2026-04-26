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