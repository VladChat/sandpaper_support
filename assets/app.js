function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function getSupportBasePath() {
  const pathname = String(window.location.pathname || "");
  const match = pathname.match(/^(.*?\/sandpaper_support)(?:\/|$)/);
  return match && match[1] ? match[1] : "/sandpaper_support";
}

function loadJson(path) {
  return fetch(path, { cache: "no-cache" }).then(function (response) {
    if (!response.ok) {
      throw new Error("Failed to load " + path);
    }
    return response.json();
  });
}

function setupSolutionVideoStyles() {
  const stylesheetId = "equalle-solution-video-css";
  if (document.getElementById(stylesheetId)) {
    return;
  }

  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = getSupportBasePath() + "/assets/solution-video.css?v=solution-video-guide-fullwidth-v2-20260428";
  document.head.appendChild(link);
}

function formatVideoDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "";
  }

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return String(hours) + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  return String(minutes) + ":" + String(secs).padStart(2, "0");
}

function cleanVideoText(value) {
  return String(value == null ? "" : value).trim();
}

function buildYouTubeEmbedUrl(video) {
  const providedEmbed = cleanVideoText(video && video.embedUrl);
  if (providedEmbed) {
    return providedEmbed;
  }

  const youtubeId = cleanVideoText(video && video.youtubeId);
  return youtubeId ? "https://www.youtube.com/embed/" + encodeURIComponent(youtubeId) : "";
}

function buildYouTubeThumbnail(video) {
  const providedThumbnail = cleanVideoText(video && video.thumbnail);
  if (providedThumbnail) {
    return providedThumbnail;
  }

  const youtubeId = cleanVideoText(video && video.youtubeId);
  return youtubeId ? "https://i.ytimg.com/vi/" + encodeURIComponent(youtubeId) + "/hqdefault.jpg" : "";
}

function isApprovedVideo(video) {
  if (!video || video.status !== "approved") {
    return false;
  }

  return Boolean(cleanVideoText(video.youtubeId) || cleanVideoText(video.embedUrl));
}

function createSolutionVideoBlock(video) {
  const titleText = cleanVideoText(video.title) || "Sanding technique video";
  const channelText = cleanVideoText(video.channel);
  const durationText = formatVideoDuration(video.durationSeconds);
  const thumbnailUrl = buildYouTubeThumbnail(video);
  const embedUrl = buildYouTubeEmbedUrl(video);

  if (!embedUrl) {
    return null;
  }

  const block = document.createElement("section");
  block.className = "solution-video-block";
  block.setAttribute("data-solution-video-block", "");
  block.setAttribute("aria-label", "Video guide");

  const header = document.createElement("div");
  header.className = "solution-video-header";

  const headerText = document.createElement("div");

  const label = document.createElement("div");
  label.className = "solution-video-label";
  label.textContent = "Video guide";

  const heading = document.createElement("h3");
  heading.className = "solution-video-heading";
  heading.textContent = titleText;

  headerText.appendChild(label);
  headerText.appendChild(heading);
  header.appendChild(headerText);
  block.appendChild(header);

  const card = document.createElement("div");
  card.className = "solution-video-card";

  const media = document.createElement("div");
  media.className = "solution-video-media";

  const thumbButton = document.createElement("button");
  thumbButton.className = "solution-video-thumb-button";
  thumbButton.type = "button";
  thumbButton.setAttribute("aria-label", "Play video: " + titleText);

  if (thumbnailUrl) {
    const image = document.createElement("img");
    image.className = "solution-video-thumbnail";
    image.src = thumbnailUrl;
    image.alt = "";
    image.loading = "lazy";
    thumbButton.appendChild(image);
  }

  const overlay = document.createElement("span");
  overlay.className = "solution-video-play";
  overlay.setAttribute("aria-hidden", "true");
  overlay.textContent = "▶";
  thumbButton.appendChild(overlay);

  media.appendChild(thumbButton);
  card.appendChild(media);

  const metaParts = [];
  if (channelText) {
    metaParts.push("Channel: " + channelText);
  }
  if (durationText) {
    metaParts.push("Duration: " + durationText);
  }

  if (metaParts.length) {
    const content = document.createElement("div");
    content.className = "solution-video-content";

    const meta = document.createElement("div");
    meta.className = "solution-video-meta";
    meta.textContent = metaParts.join(" · ");
    content.appendChild(meta);
    card.appendChild(content);
  }

  function loadEmbed() {
    if (media.querySelector("iframe")) {
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "solution-video-frame";
    iframe.src = embedUrl + (embedUrl.indexOf("?") === -1 ? "?" : "&") + "autoplay=1&rel=0&modestbranding=1";
    iframe.title = titleText;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;

    media.textContent = "";
    media.appendChild(iframe);
    block.classList.add("solution-video-loaded");
  }

  thumbButton.addEventListener("click", loadEmbed);

  block.appendChild(card);

  return block;
}

function insertSolutionVideoBlock(card, video) {
  if (!card || card.querySelector("[data-solution-video-block]")) {
    return;
  }

  const block = createSolutionVideoBlock(video);
  if (!block) {
    return;
  }

  const feedbackPanel = card.querySelector("[data-feedback-panel]");
  if (feedbackPanel) {
    card.insertBefore(block, feedbackPanel);
    return;
  }

  card.appendChild(block);
}

function setupSolutionVideos() {
  const cards = document.querySelectorAll(".answer-card[id]");
  if (!cards.length) {
    return Promise.resolve();
  }

  setupSolutionVideoStyles();

  const basePath = getSupportBasePath();
  return loadJson(basePath + "/data/card-videos.json")
    .catch(function () {
      return {};
    })
    .then(function (videoMap) {
      cards.forEach(function (card) {
        const cardId = cleanVideoText(card.id);
        const video = videoMap && videoMap[cardId];
        if (isApprovedVideo(video)) {
          insertSolutionVideoBlock(card, video);
        }
      });
    });
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
              : (result && result.error)
                ? "Feedback could not be sent: " + result.error
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
    link.href = "/sandpaper_support/assets/support-assistant.css?v=support-auth-status-spacing-20260430-v1";
    document.head.appendChild(link);
  }

  if (window.eQualleSupportAssistant && window.eQualleSupportAssistant.init) {
    return Promise.resolve();
  }

  function loadScript(scriptId, src) {
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
      script.src = src;
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

  return loadScript(
    "equalle-search-core-js",
    "/sandpaper_support/assets/search-core.js?v=structured-answer-20260427",
  ).then(function () {
    return loadScript(
      "equalle-support-assistant-js",
      "/sandpaper_support/assets/support-assistant.js?v=support-auth-status-spacing-20260430-v1",
    );
  });
}

function setupSupportToolButtons() {
  document.querySelectorAll(".support-tool-button").forEach(function (button) {
    if (button.classList.contains("support-mic-button")) {
      return;
    }
    button.addEventListener("click", function () {
      const shell = button.closest(".support-search-shell") || document;
      const input = shell.querySelector("[data-support-search]");
      if (input) {
        input.focus();
      }
    });
  });
}

setupSolutionVideos();
setupFeedback();
setupSupportToolButtons();

loadSupportAssistantAssets().then(function () {
  if (window.eQualleSupportAssistant && window.eQualleSupportAssistant.init) {
    window.eQualleSupportAssistant.init({
      basePath: "/sandpaper_support",
    });
  }
});
