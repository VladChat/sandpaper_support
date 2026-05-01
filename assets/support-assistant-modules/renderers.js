// assets/support-assistant-modules/renderers.js
// Purpose: structured and compact assistant answer rendering.
(function (shared) {
  if (!shared) {
    return;
  }

  function clean() { return shared.clean.apply(shared, arguments); }
  function normalizePath() { return shared.normalizePath.apply(shared, arguments); }


    const INTERNAL_PATH_PATTERN = /(?:https?:\/\/[^\s/]+)?(\/(?:tools|problems|solutions|surfaces|products|grits|how-to)\/[a-z0-9\-\/]*)/gi;
    const INTERNAL_PATH_FAMILIES = {
      "/tools/": true,
      "/problems/": true,
      "/solutions/": true,
      "/surfaces/": true,
      "/products/": true,
      "/grits/": true,
      "/how-to/": true,
    };
    const KNOWN_INTERNAL_TITLES = {
      "/tools/grit-sequence-builder/": "Grit Sequence Builder",
      "/grits/": "Grit Guide",
      "/products/": "Products",
      "/surfaces/": "Surfaces",
      "/problems/": "Problems",
      "/solutions/": "Solutions",
      "/how-to/": "How To",
    };
    const VISIBLE_FIRST_ANSWER_SECTIONS = {
      "answer summary": true,
      "recommended action": true,
      "steps": true,
      "recommended grit": true,
      "recommended grit sequence": true,
      "grit sequence": true,
      "surface material": true,
      "surface": true,
      "material": true,
      "wet or dry": true,
      "success check": true,
      "next step": true,
      "details": true,
    };

  function normalizeInternalSupportPath(path) {
    const raw = String(path || "").trim();
    if (!raw) {
      return "";
    }

    const baseMatch = raw.match(/(?:https?:\/\/[^\s/]+)?(\/(?:tools|problems|solutions|surfaces|products|grits|how-to)\/[a-z0-9\-\/]*)/i);
    if (!baseMatch || !baseMatch[1]) {
      return "";
    }

    let normalized = baseMatch[1].replace(/\/+/g, "/");
    if (normalized.charAt(0) !== "/") {
      normalized = "/" + normalized;
    }
    if (normalized.charAt(normalized.length - 1) !== "/") {
      normalized += "/";
    }
    return normalized;
  }

  function isInternalSupportPath(path) {
    const normalized = normalizeInternalSupportPath(path);
    return Object.keys(INTERNAL_PATH_FAMILIES).some(function (prefix) {
      return normalized.indexOf(prefix) === 0;
    });
  }

  function humanizeSupportPath(path) {
    const normalized = normalizeInternalSupportPath(path);
    if (!normalized) {
      return "Support Page";
    }
    if (KNOWN_INTERNAL_TITLES[normalized]) {
      return KNOWN_INTERNAL_TITLES[normalized];
    }

    const parts = normalized.replace(/^\/|\/$/g, "").split("/");
    const slug = parts[parts.length - 1] || parts[0] || "";
    const text = slug.replace(/-/g, " ").trim();
    if (!text) {
      return "Support Page";
    }

    return text
      .split(/\s+/)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function buildPageLookup(pages) {
    const lookup = {};
    (Array.isArray(pages) ? pages : []).forEach(function (page) {
      const rawPath = page && (page.path || page.href || page.url || page.target_url || page.targetUrl);
      const normalized = normalizeInternalSupportPath(rawPath);
      if (!normalized) {
        return;
      }
      const title = String((page && (page.title || page.label)) || "").trim();
      lookup[normalized] = title || humanizeSupportPath(normalized);
    });
    return lookup;
  }

  function rewriteInternalReferences(text, pageLookup) {
    const references = [];
    const seen = {};
    const rewritten = String(text || "").replace(INTERNAL_PATH_PATTERN, function (_match, pathToken) {
      const normalized = normalizeInternalSupportPath(pathToken);
      if (!isInternalSupportPath(normalized)) {
        return _match;
      }
      const title = pageLookup[normalized] || humanizeSupportPath(normalized);
      if (!seen[normalized]) {
        references.push({
          path: normalized,
          title: title,
        });
        seen[normalized] = true;
      }
      return title;
    });

    return {
      text: rewritten,
      references: references,
    };
  }

  function normalizeSectionTitle(title) {
    return clean(title)
      .replace(/[/&-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisibleFirstAnswerSection(title, index) {
    const normalized = normalizeSectionTitle(title || (index === 0 ? "Answer Summary" : ""));
    if (!normalized) {
      return index === 0;
    }
    if (/avoid|warning|mistake|related|suggested/.test(normalized)) {
      return false;
    }
    if (isSupportLinkSectionTitle(title)) {
      return false;
    }
    return Boolean(VISIBLE_FIRST_ANSWER_SECTIONS[normalized]);
  }

  function buildSupportSections(replyText) {
    const lines = String(replyText || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    const sections = [];
    let current = {
      title: "Answer Summary",
      lines: [],
    };

    lines.forEach(function (line) {
      const headingMatch = line.match(/^([A-Za-z][A-Za-z0-9 /&-]{2,40}):\s*(.*)$/);
      if (headingMatch) {
        if (current.lines.length) {
          sections.push(current);
        }
        current = {
          title: headingMatch[1].trim(),
          lines: headingMatch[2] ? [headingMatch[2].trim()] : [],
        };
        return;
      }
      current.lines.push(line);
    });

    if (current.lines.length) {
      sections.push(current);
    }

    return sections;
  }

  function appendSupportLinkBlock(parent, title, links, basePath, onClick) {
    if (!Array.isArray(links) || !links.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "support-answer-section";

    const heading = document.createElement("h4");
    heading.className = "support-answer-section-title";
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "support-answer-link-grid";

    links.forEach(function (item) {
      if (!item || !item.path || !item.title) {
        return;
      }
      const link = document.createElement("a");
      link.className = "support-answer-link";
      link.href = normalizePath(basePath, item.path);
      link.textContent = item.title;
      link.addEventListener("click", function () {
        if (typeof onClick === "function") {
          onClick({
            path: link.pathname,
            title: item.title,
          });
        }
      });
      grid.appendChild(link);
    });

    if (grid.children.length) {
      section.appendChild(grid);
      parent.appendChild(section);
    }
  }

  function isSupportLinkSectionTitle(title) {
    const normalized = clean(title).replace(/\s+/g, " " ).trim();

    return /^(recommended|related|suggested) (page|guide|link|resource)s?$/.test(normalized);
  }

  function dedupeSupportLinks(links) {
    const list = [];
    const seen = {};

    (Array.isArray(links) ? links : []).forEach(function (item) {
      const normalizedPath = normalizeInternalSupportPath(item && item.path);
      const title = String((item && item.title) || "").trim();

      if (!normalizedPath || !title || seen[normalizedPath]) {
        return;
      }

      seen[normalizedPath] = true;
      list.push({
        path: normalizedPath,
        title: title,
      });
    });

    return list;
  }

  function renderSupportAnswer(node, replyText, pages, basePath, onClick) {
    const pageLookup = buildPageLookup(pages);
    const rewritten = rewriteInternalReferences(replyText, pageLookup);
    const sections = buildSupportSections(rewritten.text);

    node.textContent = "";
    const wrapper = document.createElement("div");
    wrapper.className = "support-answer";

    sections.forEach(function (sectionData, index) {
      if (!isVisibleFirstAnswerSection(sectionData.title, index)) {
        return;
      }

      const section = document.createElement("section");
      section.className = "support-answer-section";

      const heading = document.createElement("h4");
      heading.className = "support-answer-section-title";
      heading.textContent = sectionData.title || (index === 0 ? "Answer Summary" : "Details");
      section.appendChild(heading);

      const lines = sectionData.lines.filter(Boolean);
      const stepLines = lines.filter(function (line) {
        return /^\d+[.)]\s+/.test(line);
      });

      if (stepLines.length >= 2) {
        const list = document.createElement("ol");
        list.className = "support-answer-steps";
        stepLines.forEach(function (line) {
          const item = document.createElement("li");
          item.textContent = line.replace(/^\d+[.)]\s+/, "");
          list.appendChild(item);
        });
        section.appendChild(list);
      } else if (lines.length >= 2) {
        const list = document.createElement("ul");
        list.className = "support-answer-list";
        lines.forEach(function (line) {
          const item = document.createElement("li");
          item.textContent = line.replace(/^[-*]\s+/, "");
          list.appendChild(item);
        });
        section.appendChild(list);
      } else if (lines.length === 1) {
        const paragraph = document.createElement("p");
        paragraph.textContent = lines[0];
        section.appendChild(paragraph);
      }

      if (/next step/i.test(sectionData.title)) {
        section.classList.add("support-answer-next-step");
      }

      wrapper.appendChild(section);
    });

    const matchedLinks = dedupeSupportLinks(Object.keys(pageLookup).map(function (path) {
      return {
        path: path,
        title: pageLookup[path],
      };
    }));

    if (matchedLinks.length) {
      appendSupportLinkBlock(wrapper, "Recommended Page", matchedLinks, basePath, onClick);
    }

    node.appendChild(wrapper);
  }

  function buildCompactAssistantText(replyText, pages) {
    const pageLookup = buildPageLookup(pages);
    const rewritten = rewriteInternalReferences(replyText, pageLookup);
    const sections = buildSupportSections(rewritten.text);

    if (!sections.length) {
      return String(rewritten.text || "").trim();
    }

    const chunks = [];

    sections.forEach(function (sectionData) {
      const title = clean(sectionData.title || "");
      const lines = (sectionData.lines || [])
        .map(function (line) {
          return String(line || "").trim();
        })
        .filter(Boolean);

      if (!lines.length) {
        return;
      }

      if (/recommended page|related guide/.test(title)) {
        return;
      }

      if (/^steps?$/.test(title)) {
        chunks.push(lines.join("\n"));
        return;
      }

      if (/avoid|warning|mistake/.test(title)) {
        return;
      }

      chunks.push(lines.join(" "));
    });

    return chunks.join("\n\n").trim() || String(rewritten.text || "").trim();
  }

  function renderCompactAssistantAnswer(node, replyText, pages) {
    node.textContent = buildCompactAssistantText(replyText, pages);
    node.classList.add("chat-message-compact");
  }

  Object.assign(shared, {
    normalizeInternalSupportPath: normalizeInternalSupportPath,
    isInternalSupportPath: isInternalSupportPath,
    humanizeSupportPath: humanizeSupportPath,
    buildPageLookup: buildPageLookup,
    rewriteInternalReferences: rewriteInternalReferences,
    normalizeSectionTitle: normalizeSectionTitle,
    isVisibleFirstAnswerSection: isVisibleFirstAnswerSection,
    buildSupportSections: buildSupportSections,
    appendSupportLinkBlock: appendSupportLinkBlock,
    isSupportLinkSectionTitle: isSupportLinkSectionTitle,
    dedupeSupportLinks: dedupeSupportLinks,
    renderSupportAnswer: renderSupportAnswer,
    buildCompactAssistantText: buildCompactAssistantText,
    renderCompactAssistantAnswer: renderCompactAssistantAnswer,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
