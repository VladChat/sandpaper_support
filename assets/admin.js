(function () {
  var api = window.eQualleSupabase;
  var loginPanel = document.querySelector("[data-admin-login]");
  var dashboard = document.querySelector("[data-admin-dashboard]");
  var form = document.querySelector("[data-admin-login-form]");
  var logoutButton = document.querySelector("[data-admin-logout]");
  var status = document.querySelector("[data-admin-status]");

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

    body.innerHTML = result.data.map(rowTemplate).join("");
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

  function renderDrafts(result) {
    renderTable("[data-drafts-body]", result, 5, function (row) {
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
        "</tr>"
      );
    });
  }

  function loadDashboard(isAdmin) {
    if (!api) {
      setStatus("Supabase client is unavailable.", true);
      return;
    }

    setStatus("Loading admin data...");

    Promise.all([
      api.fetchSearchLogs(),
      api.fetchSearchLogs({ result_count: "eq.0", limit: 25 }),
      api.fetchFeedback(),
      api.fetchFeedback({ feedback_type: "eq.not_helpful", limit: 25 }),
      api.fetchDraftSolutionCards(),
    ]).then(function (results) {
      renderSearchLogs(results[0]);
      renderZeroSearches(results[1]);
      renderFeedback("[data-feedback-body]", results[2]);
      renderFeedback("[data-not-helpful-feedback-body]", results[3]);
      renderDrafts(results[4]);

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
      setProtectedView(session);

      if (session) {
        loadDashboard(isAdminSession(session));
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
        setProtectedView(result.session);
        loadDashboard(isAdminSession(result.session));
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      api.signOut().then(function () {
        setProtectedView(null);
        setStatus("Signed out.");
      });
    });
  }

  init();
})();
