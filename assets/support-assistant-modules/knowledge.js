// assets/support-assistant-modules/knowledge.js
// Purpose: local support knowledge loading and matching.
(function (shared) {
  if (!shared) {
    return;
  }

  function clean() { return shared.clean.apply(shared, arguments); }
  function loadSupportJson() { return shared.loadSupportJson.apply(shared, arguments); }
  function toTerms() { return shared.toTerms.apply(shared, arguments); }
  function scoreHaystack() { return shared.scoreHaystack.apply(shared, arguments); }


  function buildSearchHaystack(entry) {
    return [
      entry.id,
      entry.type,
      entry.title,
      entry.description,
      ...(entry.customer_phrases || []),
      ...(entry.aliases || []),
      ...(entry.surface || []),
      ...(entry.grits || []),
      ...(entry.method || []),
    ].join(" ");
  }

  function buildSolutionHaystack(card) {
    return [
      card.id,
      card.slug,
      card.problem_slug,
      card.title,
      card.problem,
      card.surface,
      card.task,
      card.symptom,
      card.quick_answer,
      ...(card.best_grit_path || []),
      ...(card.optional_starting_grits || []),
      card.likely_cause,
      card.recommended_grit,
      card.wet_or_dry,
      card.success_check,
      ...(card.steps || []),
      ...(card.mistakes_to_avoid || []),
      ...(card.search_phrases || []),
      card.avoid,
    ].join(" ");
  }

  function buildSequenceHaystack(item) {
    return [
      item.surface,
      item.goal,
      item.start_grit,
      item.wet_or_dry,
      item.avoid,
      ...(item.sequence || []),
      ...(item.related_solution_ids || []),
    ].join(" ");
  }

  function buildSurfaceHaystack(item) {
    return [
      item.id,
      item.title,
      item.description,
      ...(item.solution_card_ids || []),
    ].join(" ");
  }

  function compactSearchEntry(entry) {
    return {
      title: entry.title || "",
      target_url: entry.target_url || "",
      result_kind: entry.result_kind || "",
      search_intent: entry.search_intent || "",
      surface: Array.isArray(entry.surface) ? entry.surface[0] || "" : "",
      goal: "",
    };
  }

  function compactSolutionCard(card) {
    return {
      id: card.id || "",
      slug: card.slug || card.id || "",
      title: card.title || "",
      problem: card.problem || "",
      surface: card.surface || "",
      task: card.task || "",
      symptom: card.symptom || "",
      quick_answer: card.quick_answer || "",
      best_grit_path: Array.isArray(card.best_grit_path) ? card.best_grit_path.slice(0, 8) : [],
      optional_starting_grits: Array.isArray(card.optional_starting_grits)
        ? card.optional_starting_grits.slice(0, 4)
        : [],
      likely_cause: card.likely_cause || "",
      recommended_grit: card.recommended_grit || "",
      wet_or_dry: card.wet_or_dry || "",
      steps: Array.isArray(card.steps) ? card.steps.slice(0, 5) : [],
      mistakes_to_avoid: Array.isArray(card.mistakes_to_avoid)
        ? card.mistakes_to_avoid.slice(0, 5)
        : [],
      avoid: card.avoid || "",
      success_check: card.success_check || "",
      target_url: "/solutions/" + card.id + "/",
    };
  }

  function compactSequence(item) {
    return {
      surface: item.surface || "",
      goal: item.goal || "",
      sequence: Array.isArray(item.sequence) ? item.sequence.slice(0, 6) : [],
      wet_or_dry: item.wet_or_dry || "",
      avoid: item.avoid || "",
      target_url: item.related_surface_url || "",
    };
  }

  function buildKnowledge(basePath) {
    return Promise.all([
      loadSupportJson(basePath, "data/search-index.json"),
      loadSupportJson(basePath, "data/solution-cards.json"),
      loadSupportJson(basePath, "data/grit-sequences.json"),
      loadSupportJson(basePath, "data/surface-map.json"),
      loadSupportJson(basePath, "data/search-suggestions.json"),
    ]).then(function (results) {
      const searchEntries = Array.isArray(results[0]) ? results[0] : [];
      const solutionCards = Array.isArray(results[1]) ? results[1] : [];
      const gritSequences = Array.isArray(results[2]) ? results[2] : [];
      const surfaceMap = Array.isArray(results[3]) ? results[3] : [];
      const searchSuggestions = Array.isArray(results[4]) ? results[4] : [];
  
      const solutionById = {};
      solutionCards.forEach(function (card) {
        if (card && card.id) {
          solutionById[card.id] = card;
        }
      });
  
      function findSearchMatches(query, limit, options) {
        const loweredQuery = clean(query).trim();
        if (!loweredQuery) {
          return [];
        }
        if (window.eQualleSearchCore && typeof window.eQualleSearchCore.searchEntries === "function") {
          return window.eQualleSearchCore.searchEntries(
            searchEntries,
            loweredQuery,
            limit || 5,
            searchSuggestions,
            options || {},
          );
        }
        return [];
      }
  
      function getPageCards(pathname, title) {
        const items = [];
        const cleanPath = String(pathname || "");
  
        const solutionMatch = cleanPath.match(/\/solutions\/([^/]+)\/?$/);
        if (solutionMatch && solutionById[solutionMatch[1]]) {
          items.push(solutionById[solutionMatch[1]]);
        }
  
        const problemMatch = cleanPath.match(/\/problems\/([^/]+)\/?$/);
        if (problemMatch) {
          solutionCards.forEach(function (card) {
            if (card.problem_slug === problemMatch[1]) {
              items.push(card);
            }
          });
        }
  
        if (!items.length && title) {
          const titleTerms = toTerms(title);
          solutionCards.forEach(function (card) {
            const score = scoreHaystack(buildSolutionHaystack(card), title, titleTerms);
            if (score > 20) {
              items.push(card);
            }
          });
        }
  
        const unique = [];
        const seen = {};
        items.forEach(function (card) {
          if (!card || seen[card.id]) {
            return;
          }
          seen[card.id] = true;
          unique.push(card);
        });
  
        return unique;
      }
  
      function findSolutionCards(query, pathname, title, lastMatches, limit) {
        const terms = toTerms(query);
        const boostedCards = getPageCards(pathname, title);
        const boostedMap = {};
        boostedCards.forEach(function (card) {
          boostedMap[card.id] = true;
        });
  
        const queryHint = [
          query,
          title,
          (lastMatches || []).map(function (item) {
            return item && item.title;
          }).join(" "),
        ].join(" ");
  
        return solutionCards
          .map(function (card) {
            let score = scoreHaystack(buildSolutionHaystack(card), queryHint, terms);
  
            if (boostedMap[card.id]) {
              score += 35;
            }
  
            return {
              score: score,
              card: card,
            };
          })
          .filter(function (item) {
            return item.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, limit || 5)
          .map(function (item) {
            return item.card;
          });
      }
  
      function inferSurfaces(query, matchedSearch, matchedCards) {
        const surfaceScores = {};
        const queryTerms = toTerms(query);
  
        function addSurface(surface, points) {
          if (!surface) {
            return;
          }
          const key = clean(surface);
          surfaceScores[key] = (surfaceScores[key] || 0) + points;
        }
  
        matchedSearch.forEach(function (entry) {
          (entry.surface || []).forEach(function (surface) {
            addSurface(surface, 6);
          });
        });
  
        matchedCards.forEach(function (card) {
          surfaceMap.forEach(function (surfaceItem) {
            if ((surfaceItem.solution_card_ids || []).indexOf(card.id) !== -1) {
              addSurface(surfaceItem.title, 8);
            }
          });
        });
  
        surfaceMap.forEach(function (surfaceItem) {
          const score = scoreHaystack(
            buildSurfaceHaystack(surfaceItem),
            query,
            queryTerms,
          );
          if (score > 0) {
            addSurface(surfaceItem.title, score);
          }
        });
  
        return Object.keys(surfaceScores)
          .sort(function (a, b) {
            return (surfaceScores[b] || 0) - (surfaceScores[a] || 0);
          })
          .slice(0, 2);
      }
  
      function findGritSequences(query, matchedSearch, matchedCards, limit) {
        const terms = toTerms(query);
        const inferredSurfaces = inferSurfaces(query, matchedSearch, matchedCards);
  
        return gritSequences
          .map(function (item) {
            let score = scoreHaystack(buildSequenceHaystack(item), query, terms);
  
            const surfaceKey = clean(item.surface);
            if (inferredSurfaces.indexOf(surfaceKey) !== -1) {
              score += 18;
            }
  
            return {
              score: score,
              item: item,
            };
          })
          .filter(function (row) {
            return row.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, limit || 2)
          .map(function (row) {
            return row.item;
          });
      }
  
      return {
        findSearchMatches: findSearchMatches,
        findSolutionCards: findSolutionCards,
        findGritSequences: findGritSequences,
      };
    });
  }

  Object.assign(shared, {
    buildSearchHaystack: buildSearchHaystack,
    buildSolutionHaystack: buildSolutionHaystack,
    buildSequenceHaystack: buildSequenceHaystack,
    buildSurfaceHaystack: buildSurfaceHaystack,
    compactSearchEntry: compactSearchEntry,
    compactSolutionCard: compactSolutionCard,
    compactSequence: compactSequence,
    buildKnowledge: buildKnowledge,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
