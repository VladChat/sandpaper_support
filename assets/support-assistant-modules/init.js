// assets/support-assistant-modules/init.js
// Purpose: public assistant initializer registration.
(function (shared) {
  if (!shared) {
    return;
  }

  function getSessionToken() { return shared.getSessionToken.apply(shared, arguments); }
  function setCurrentPage() { return shared.setCurrentPage.apply(shared, arguments); }
  function buildKnowledge() { return shared.buildKnowledge.apply(shared, arguments); }
  function setupHomepageSearch() { return shared.setupHomepageSearch.apply(shared, arguments); }
  function setupAiAssistantPage() { return shared.setupAiAssistantPage.apply(shared, arguments); }
  function setupSupportFollowup() { return shared.setupSupportFollowup.apply(shared, arguments); }


  function init(options) {
    const basePath = (options && options.basePath) || "/sandpaper_support";
  
    setCurrentPage();
    getSessionToken();
  
    buildKnowledge(basePath)
      .then(function (knowledge) {
        setupHomepageSearch(basePath, knowledge);
        setupSupportFollowup(basePath, knowledge);
        setupAiAssistantPage(basePath, knowledge);
      })
      .catch(function () {
        return;
      });
  }

  Object.assign(shared, {
    init: init,
  });
  
  if (typeof shared.registerInit === "function") {
    shared.registerInit(init);
  } else {
    shared.init = init;
  }
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
