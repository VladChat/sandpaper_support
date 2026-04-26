(function () {
  var api = window.eQualleSupabase;
  var loginPanel = document.querySelector("[data-admin-login]");
  var dashboard = document.querySelector("[data-admin-dashboard]");
  var form = document.querySelector("[data-admin-login-form]");
  var newDraftForm = document.querySelector("[data-new-draft-form]");
  var logoutButton = document.querySelector("[data-admin-logout]");
  var status = document.querySelector("[data-admin-status]");
  var draftRowsById = {};
  var currentSessionIsAdmin = false;

  function setStatus(message, isError) {
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.classList.toggle("admin-status-error", Boolean(isError));
  }

  function setProtectedView(session) {
    var isSignedIn = Boolean(session && session.access_token);

    if (loginPanel) {
      loginPanel.hidden = isSignedIn;
    }

    if (dashboard) {
      dashboard.hidden = !isSignedIn;
    }

    if (logoutButton) {
      logoutButton.hidden = !isSignedIn;
    }

    currentSessionIsAdmin = isSignedIn ? currentSessionIsAdmin : false;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleString();
  }

  function emptyRow(colspan, message) {
    return '<tr><td colspan="' + colspan + '">' + message + "</td></tr>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderTable(target, result, columns, rowTemplate) {
    var body = document.querySelector(target);

    if (!body) {
      return;
    }

    if (!result || !result.ok) {
      body.innerHTML = emptyRow(
        columns,
        "Could not load data. RLS may be blocking this admin account.",
      );
      return;
    }

    if (!result.data || !result.data.length) {
      body.innerHTML = emptyRow(columns, "No rows yet.");
      return;
    }

    body.innerHTML = result.data.slice(0, 25).map(rowTemplate).join("");
  }

  function renderSearchLogs(result) {
    renderTable("[data-search-logs-body]", result, 4, function (row) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(formatDate(row.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(row.query) +
        "</td>" +
        "<td>" +
        escapeHtml(row.result_count) +
        "</td>" +
        "<td>" +
        escapeHtml(row.selected_path || "") +
        "</td>" +
        "</tr>"
      );
    });
  }

  function renderZeroSearches(result) {
    renderTable("[data-zero-searches-body]", result, 3, function (row) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(formatDate(row.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(row.query) +
        "</td>" +
        "<td>" +
        escapeHtml(row.normalized_query || "") +
        "</td>" +
        "</tr>"
      );
    });
  }

  function renderFeedback(target, result) {
    renderTable(target, result, 5, function (row) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(formatDate(row.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(row.feedback_type || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.rating || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.page_path || row.problem_slug || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.message || "") +
        "</td>" +
        "</tr>"
      );
    });
  }

  function renderFeedbackSummary(result) {
    renderTable("[data-feedback-summary-body]", result, 5, function (row) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(row.page_path || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.helpful_count || 0) +
        "</td>" +
        "<td>" +
        escapeHtml(row.not_helpful_count || 0) +
        "</td>" +
        "<td>" +
        escapeHtml(row.total_count || 0) +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(row.latest_feedback_at || "")) +
        "</td>" +
        "</tr>"
      );
    });
  }

  function renderDrafts(result) {
    draftRowsById = {};
    getRows(result).forEach(function (row) {
      draftRowsById[row.id] = row;
    });

    renderTable("[data-drafts-body]", result, 6, function (row) {
      return (
        "<tr>" +
        "<td>" +
        escapeHtml(row.title) +
        "</td>" +
        "<td>" +
        escapeHtml(row.problem_slug || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.recommended_grit || "") +
        "</td>" +
        "<td>" +
        escapeHtml(row.status || "") +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(row.updated_at || row.created_at)) +
        "</td>" +
        '<td><div class="admin-action-row">' +
        '<button type="button" data-draft-action="view" data-draft-id="' +
        escapeHtml(row.id) +
        '">View</button>' +
        '<button type="button" data-draft-action="approve" data-draft-id="' +
        escapeHtml(row.id) +
        '">Approve</button>' +
        '<button type="button" data-draft-action="reject" data-draft-id="' +
        escapeHtml(row.id) +
        '">Reject</button>' +
        "</div></td>" +
        "</tr>"
      );
    });
  }

  function formatArrayValue(value) {
    if (Array.isArray(value)) {
      return value.join("\n");
    }

    if (value && typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return value || "";
  }

  function detailBlock(label, value) {
    return (
      '<div class="admin-draft-detail"><div class="label">' +
      escapeHtml(label) +
      '</div><pre class="value">' +
      escapeHtml(formatArrayValue(value)) +
      "</pre></div>"
    );
  }

  function showDraftDetails(id) {
    var row = draftRowsById[id];
    var panel = document.querySelector("[data-draft-panel]");
    var title = document.querySelector("[data-draft-panel-title]");
    var body = document.querySelector("[data-draft-panel-body]");

    if (!row || !panel || !title || !body) {
      setStatus("Draft details could not be shown.", true);
      return;
    }

    title.textContent = row.title || "Draft details";
    body.innerHTML =
      detailBlock("Title", row.title) +
      detailBlock("Likely cause", row.likely_cause) +
      detailBlock("Recommended grit", row.recommended_grit) +
      detailBlock("Method", row.method) +
      detailBlock("Steps", row.steps) +
      detailBlock("Avoid", row.avoid) +
      detailBlock("Success check", row.success_check) +
      detailBlock("Validation notes", row.validation_notes);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setDraftActionButtonsDisabled(id, disabled) {
    document
      .querySelectorAll("[data-draft-id]")
      .forEach(function (button) {
        if (button.getAttribute("data-draft-id") === id) {
          button.disabled = disabled;
        }
      });
  }

  function showAdminActionError(prefix, result) {
    setStatus(
      prefix +
        " " +
        ((result && result.error) || "RLS may be blocking this admin action."),
      true,
    );
  }

  function updateDraftStatus(id, nextStatus) {
    if (!api || !api.updateDraftSolutionCardStatus) {
      setStatus("Supabase admin actions are unavailable.", true);
      return Promise.resolve();
    }

    setDraftActionButtonsDisabled(id, true);
    setStatus("Updating draft...");

    return api.updateDraftSolutionCardStatus(id, nextStatus).then(function (result) {
      if (!result || !result.ok) {
        setDraftActionButtonsDisabled(id, false);
        showAdminActionError("Draft status could not be updated.", result);
        return null;
      }

      if (draftRowsById[id]) {
        draftRowsById[id].status = nextStatus;
      }

      return result;
    });
  }

  function approveDraft(id) {
    updateDraftStatus(id, "approved").then(function (result) {
      if (!result) {
        return;
      }

      setStatus("Queueing approved draft for publish...");

      api
        .enqueueContentSync("draft_solution_card", id, "publish")
        .then(function (queueResult) {
          setDraftActionButtonsDisabled(id, false);

          if (!queueResult || !queueResult.ok) {
            showAdminActionError(
              "Draft approved, but content sync could not be queued.",
              queueResult,
            );
            return;
          }

          setStatus("Draft approved and queued for publish.");
          loadDashboard(true);
        });
    });
  }

  function rejectDraft(id) {
    updateDraftStatus(id, "rejected").then(function (result) {
      setDraftActionButtonsDisabled(id, false);

      if (!result) {
        return;
      }

      setStatus("Draft rejected.");
      loadDashboard(true);
    });
  }

  function linesFromField(formElement, name) {
    var field = formElement.querySelector('[name="' + name + '"]');

    if (!field) {
      return [];
    }

    return field.value
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function valueFromField(formElement, name) {
    var field = formElement.querySelector('[name="' + name + '"]');
    return field ? field.value.trim() : "";
  }

  function saveNewDraft(formElement) {
    if (!api || !api.createDraftSolutionCard) {
      setStatus("Supabase draft creation is unavailable.", true);
      return;
    }

    if (!currentSessionIsAdmin) {
      setStatus("Sign in with an admin account before saving drafts.", true);
      return;
    }

    var submitButton = formElement.querySelector('[type="submit"]');
    var payload = {
      title: valueFromField(formElement, "title"),
      problem_slug: valueFromField(formElement, "problem_slug"),
      likely_cause: valueFromField(formElement, "likely_cause"),
      recommended_grit: valueFromField(formElement, "recommended_grit"),
      method: valueFromField(formElement, "method") || "unknown",
      steps: linesFromField(formElement, "steps"),
      avoid: linesFromField(formElement, "avoid"),
      success_check: valueFromField(formElement, "success_check"),
      validation_notes: valueFromField(formElement, "validation_notes"),
    };

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus("Saving draft solution card...");

    api.createDraftSolutionCard(payload).then(function (result) {
      if (submitButton) {
        submitButton.disabled = false;
      }

      if (!result || !result.ok) {
        showAdminActionError("Draft could not be saved.", result);
        return;
      }

      formElement.reset();
      setStatus("Draft solution card saved.");
      loadDashboard(true);
    });
  }

  function getRows(result) {
    return result && result.ok && Array.isArray(result.data) ? result.data : [];
  }

  function setText(selector, value) {
    var element = document.querySelector(selector);

    if (element) {
      element.textContent = String(value);
    }
  }

  function countBy(rows, getter) {
    return rows.reduce(function (counts, row) {
      var key = getter(row);

      if (!key) {
        return counts;
      }

      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function topEntries(rows, getter) {
    var counts = countBy(rows, getter);

    return Object.keys(counts)
      .map(function (label) {
        return {
          label: label,
          count: counts[label],
        };
      })
      .sort(function (a, b) {
        return b.count - a.count || a.label.localeCompare(b.label);
      })
      .slice(0, 5);
  }

  function renderIssueList(selector, entries) {
    var list = document.querySelector(selector);

    if (!list) {
      return;
    }

    if (!entries.length) {
      list.innerHTML = "<li>No rows yet.</li>";
      return;
    }

    list.innerHTML = entries
      .map(function (entry) {
        return (
          "<li><span>" +
          escapeHtml(entry.label) +
          '</span><strong>' +
          escapeHtml(entry.count) +
          "</strong></li>"
        );
      })
      .join("");
  }

  function renderMetrics(results) {
    var searchRows = getRows(results[0]);
    var zeroSearchRows = getRows(results[1]);
    var feedbackRows = getRows(results[2]);
    var notHelpfulRows = getRows(results[3]);
    var draftRows = getRows(results[4]);
    var helpfulRows = feedbackRows.filter(function (row) {
      return row.feedback_type === "helpful";
    });

    setText("[data-summary-total-searches]", searchRows.length);
    setText("[data-summary-zero-searches]", zeroSearchRows.length);
    setText("[data-summary-helpful-feedback]", helpfulRows.length);
    setText("[data-summary-not-helpful-feedback]", notHelpfulRows.length);
    setText("[data-summary-draft-cards]", draftRows.length);

    renderIssueList(
      "[data-top-zero-queries]",
      topEntries(zeroSearchRows, function (row) {
        return row.normalized_query || row.query;
      }),
    );
    renderIssueList(
      "[data-top-not-helpful-pages]",
      topEntries(notHelpfulRows, function (row) {
        return row.page_path || row.problem_slug;
      }),
    );
  }

  function loadDashboard(isAdmin) {
    if (!api) {
      setStatus("Supabase client is unavailable.", true);
      return;
    }

    setStatus("Loading admin data...");

    Promise.all([
      api.fetchSearchLogs({ limit: 1000 }),
      api.fetchSearchLogs({ result_count: "eq.0", limit: 1000 }),
      api.fetchFeedback({ limit: 1000 }),
      api.fetchFeedback({ feedback_type: "eq.not_helpful", limit: 1000 }),
      api.fetchDraftSolutionCards({ limit: 1000 }),
      api.fetchFeedbackSummary({ limit: 5000 }),
    ]).then(function (results) {
      renderMetrics(results);
      renderSearchLogs(results[0]);
      renderZeroSearches(results[1]);
      renderFeedback("[data-feedback-body]", results[2]);
      renderFeedback("[data-not-helpful-feedback-body]", results[3]);
      renderDrafts(results[4]);
      renderFeedbackSummary(results[5]);

      var blocked = !isAdmin || results.some(function (result) {
        return !result || !result.ok;
      });

      setStatus(
        !isAdmin
          ? "Signed in, but this user is not marked as admin. RLS may block dashboard access."
          : blocked
          ? "Some sections could not load. Confirm this user has the admin RLS policy."
          : "Dashboard loaded.",
        blocked,
      );
    });
  }

  function isAdminSession(session) {
    var metadata = (session && session.user && session.user.app_metadata) || {};
    return metadata.role === "admin";
  }

  function init() {
    if (!api) {
      setProtectedView(null);
      setStatus("Supabase client is unavailable.", true);
      return;
    }

    setProtectedView(null);

    api.getSession().then(function (result) {
      var session = result && result.session;
      currentSessionIsAdmin = isAdminSession(session);
      setProtectedView(session);

      if (session) {
        loadDashboard(currentSessionIsAdmin);
      }
    });
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var email = form.querySelector("[name=email]").value.trim();
      var password = form.querySelector("[name=password]").value;

      setStatus("Signing in...");

      api.signIn(email, password).then(function (result) {
        if (!result || !result.ok) {
          setProtectedView(null);
          setStatus(result.error || "Sign in failed.", true);
          return;
        }

        form.reset();
        currentSessionIsAdmin = isAdminSession(result.session);
        setProtectedView(result.session);
        loadDashboard(currentSessionIsAdmin);
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      api.signOut().then(function () {
        currentSessionIsAdmin = false;
        setProtectedView(null);
        setStatus("Signed out.");
      });
    });
  }

  if (newDraftForm) {
    newDraftForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveNewDraft(newDraftForm);
    });
  }

  document.addEventListener("click", function (event) {
    var closeButton = event.target.closest("[data-draft-panel-close]");
    var actionButton = event.target.closest("[data-draft-action]");

    if (closeButton) {
      var panel = document.querySelector("[data-draft-panel]");

      if (panel) {
        panel.hidden = true;
      }

      return;
    }

    if (!actionButton) {
      return;
    }

    var id = actionButton.getAttribute("data-draft-id");
    var action = actionButton.getAttribute("data-draft-action");

    if (action === "view") {
      showDraftDetails(id);
    } else if (action === "approve") {
      approveDraft(id);
    } else if (action === "reject") {
      rejectDraft(id);
    }
  });

  init();
})();
