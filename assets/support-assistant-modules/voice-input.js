// assets/support-assistant-modules/voice-input.js
// Purpose: browser-native voice input with sandpaper-specific phrase biasing and safe local transcript cleanup.
(function (shared) {
  if (!shared) {
    return;
  }

  const SILENCE_TIMEOUT_MS = 3000;
  const VOICE_VOCABULARY_PATH = "data/voice-vocabulary.json";
  const VOICE_VOCABULARY_VERSION = "support-voice-vocabulary-20260430-v2";
  const MAX_PHRASE_BIASING_ITEMS = 250;
  const DEFAULT_GRIT_NUMBERS = [
    "60", "80", "100", "120", "150", "180", "220", "240", "280", "320", "360",
    "400", "500", "600", "800", "1000", "1200", "1500", "2000", "2500", "3000",
  ];
  const BUILT_IN_VOCABULARY = {
    phraseBiasing: [
      "sandpaper", "sand paper", "sanding", "grit", "grits", "60 grit", "80 grit", "120 grit",
      "180 grit", "220 grit", "320 grit", "400 grit", "600 grit", "800 grit", "1000 grit",
      "1500 grit", "2000 grit", "3000 grit", "wet sanding", "dry sanding", "wet or dry",
      "waterproof sandpaper", "silicon carbide", "aluminum oxide", "clear coat", "paint", "primer",
      "wood", "metal", "plastic", "drywall", "scratch", "scratches", "haze", "orange peel",
      "swirl marks", "sanding block", "orbital sander",
    ],
    contextTerms: [
      "sandpaper", "sand paper", "sanding", "grit", "grits", "abrasive", "sheet", "wet sanding",
      "dry sanding", "wet or dry", "silicon carbide", "aluminum oxide", "wood", "metal", "plastic",
      "paint", "primer", "clear coat", "drywall", "scratch", "scratches", "haze", "orange peel",
      "swirl", "clog", "clogs", "loaded", "polishing", "sanding block", "orbital sander",
    ],
    gritNumbers: DEFAULT_GRIT_NUMBERS,
    corrections: [
      { pattern: "\\bsand\\s+paper\\b", replace: "sandpaper", mode: "always" },
      { pattern: "\\bsome\\s+paper\\b", replace: "sandpaper", mode: "always" },
      { pattern: "\\bsame\\s+paper\\b", replace: "sandpaper", mode: "always" },
      { pattern: "\\bsample\\s+paper\\b", replace: "sandpaper", mode: "always" },
      { pattern: "\\bsanding\\s+paper\\b", replace: "sandpaper", mode: "always" },
      { pattern: "\\bwet\\s+sending\\b", replace: "wet sanding", mode: "always" },
      { pattern: "\\bwet\\s+standing\\b", replace: "wet sanding", mode: "always" },
      { pattern: "\\bwet\\s+sand\\s+in\\b", replace: "wet sanding", mode: "always" },
      { pattern: "\\bdry\\s+sending\\b", replace: "dry sanding", mode: "always" },
      { pattern: "\\bdry\\s+standing\\b", replace: "dry sanding", mode: "always" },
      { pattern: "\\bdry\\s+sand\\s+in\\b", replace: "dry sanding", mode: "always" },
      { pattern: "\\bsilicone\\s+carbide\\b", replace: "silicon carbide", mode: "always" },
      { pattern: "\\bsilicon\\s+carbon\\b", replace: "silicon carbide", mode: "always" },
      { pattern: "\\bsilicone\\s+carbon\\b", replace: "silicon carbide", mode: "always" },
      { pattern: "\\bclear\\s+code\\b", replace: "clear coat", mode: "always" },
      { pattern: "\\bclear\\s+coats\\b", replace: "clear coat", mode: "always" },
      { pattern: "\\borange\\s+pill\\b", replace: "orange peel", mode: "always" },
      { pattern: "\\boral\\s+peel\\b", replace: "orange peel", mode: "always" },
      { pattern: "\\bplay\\s+wood\\b", replace: "plywood", mode: "always" },
      { pattern: "\\bply\\s+wood\\b", replace: "plywood", mode: "always" },
      { pattern: "\\bhard\\s+wood\\b", replace: "hardwood", mode: "always" },
      { pattern: "\\bsoft\\s+wood\\b", replace: "softwood", mode: "always" },
      { pattern: "\\bdry\\s+wall\\b", replace: "drywall", mode: "always" },
      { pattern: "\\bstainless\\s+still\\b", replace: "stainless steel", mode: "always" },
      { pattern: "\\borbital\\s+sender\\b", replace: "orbital sander", mode: "always" },
      { pattern: "\\borbit\\s+sander\\b", replace: "orbital sander", mode: "always" },
      { pattern: "\\bsanding\\s+black\\b", replace: "sanding block", mode: "always" },
      { pattern: "\\bnine\\s+by\\s+eleven\\b", replace: "9x11", mode: "always" },
      { pattern: "\\bnine\\s+x\\s+eleven\\b", replace: "9x11", mode: "always" },
      { pattern: "\\b9\\s+by\\s+11\\b", replace: "9x11", mode: "always" },
      { pattern: "\\b9\\s+x\\s+11\\b", replace: "9x11", mode: "always" },
    ],
  };

  let activeRecognition = null;
  let activeButton = null;
  let activeInput = null;
  let activeBaseText = "";
  let activeTranscript = "";
  let activeSilenceTimer = null;
  let activeVocabulary = null;
  let observerStarted = false;
  let voiceVocabularyPromise = null;
  let loadedVoiceVocabulary = null;

  function installVoiceStyles() {
    const styleId = "equalle-support-voice-input-css";
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".support-mic-button[hidden]{display:none!important;}",
      ".support-mic-button{position:relative;}",
      ".support-mic-button.support-mic-button-listening,.support-mic-button[aria-pressed='true']{background:rgba(124,177,217,.18);color:#0d527a;box-shadow:inset 0 0 0 1px rgba(124,177,217,.38);}",
      ".support-mic-button.support-mic-button-listening::after{content:'';position:absolute;inset:4px;border:1px solid rgba(13,82,122,.34);border-radius:999px;animation:supportVoicePulse 1.1s ease-in-out infinite;}",
      ".support-mic-button.support-mic-button-error{background:#fff7ed;color:#9a3412;box-shadow:inset 0 0 0 1px #fed7aa;}",
      ".support-mic-button.support-mic-button-loading{opacity:.72;pointer-events:none;}",
      "@keyframes supportVoicePulse{0%{opacity:.35;transform:scale(.92)}50%{opacity:1;transform:scale(1)}100%{opacity:.35;transform:scale(.92)}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function getRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isVoiceSupported() {
    return typeof getRecognitionConstructor() === "function";
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function voiceTextValue(value) {
    if (typeof value === "string" || typeof value === "number") {
      return clean(value);
    }
    if (value && typeof value === "object") {
      if (typeof value.phrase === "string" || typeof value.phrase === "number") {
        return clean(value.phrase);
      }
      if (typeof value.term === "string" || typeof value.term === "number") {
        return clean(value.term);
      }
      if (typeof value.value === "string" || typeof value.value === "number") {
        return clean(value.value);
      }
    }
    return "";
  }

  function uniqueStrings(values) {
    const seen = {};
    return (Array.isArray(values) ? values : [])
      .map(voiceTextValue)
      .filter(function (value) {
        const key = value.toLowerCase();
        if (!value || seen[key]) {
          return false;
        }
        seen[key] = true;
        return true;
      });
  }

  function getSupportBasePath() {
    const pathname = String(window.location.pathname || "");
    const match = pathname.match(/^(.*?\/sandpaper_support)(?:\/|$)/);
    return match && match[1] ? match[1] : "/sandpaper_support";
  }

  function normalizeCorrectionRule(rule) {
    if (!rule || typeof rule !== "object" || typeof rule.pattern !== "string" || typeof rule.replace !== "string") {
      return null;
    }

    const flags = typeof rule.flags === "string" && rule.flags ? rule.flags : "gi";
    const mode = typeof rule.mode === "string" && rule.mode ? rule.mode : inferCorrectionMode(rule.pattern, rule.replace);

    return {
      pattern: rule.pattern,
      replace: rule.replace,
      flags: flags.indexOf("g") === -1 ? flags + "g" : flags,
      mode: mode,
    };
  }

  function inferCorrectionMode(pattern, replacement) {
    const source = String(pattern || "").toLowerCase();
    const target = String(replacement || "").toLowerCase();
    if (target.indexOf("grit") !== -1 && /(degree|degrees|grid|great|greet|greed|grade)/.test(source)) {
      return /\\d|\[0-9\]|\(\?\:|\(\d/.test(source) ? "gritNumberOnly" : "skip-dangerous";
    }
    return "always";
  }

  function isGritConfusionRule(rule) {
    const source = String((rule && rule.pattern) || "").toLowerCase();
    const target = String((rule && rule.replace) || "").toLowerCase();
    return target.indexOf("grit") !== -1 && /(degree|degrees|grid|great|greet|greed|grade)/.test(source);
  }

  function mergeVocabulary(remote) {
    const source = remote && typeof remote === "object" ? remote : {};
    const phraseBiasing = uniqueStrings([].concat(
      BUILT_IN_VOCABULARY.phraseBiasing,
      source.phraseBiasing || [],
      source.phrase_biasing || [],
      source.phrases || [],
    ));
    const contextTerms = uniqueStrings([].concat(
      BUILT_IN_VOCABULARY.contextTerms,
      source.contextTerms || [],
      source.context_terms || [],
      phraseBiasing,
    ));
    const gritNumbers = uniqueStrings([].concat(
      BUILT_IN_VOCABULARY.gritNumbers,
      source.gritNumbers || [],
      source.grit_numbers || [],
    ));
    const corrections = [].concat(
      BUILT_IN_VOCABULARY.corrections,
      Array.isArray(source.corrections) ? source.corrections : [],
    ).map(normalizeCorrectionRule).filter(Boolean);

    return {
      phraseBiasing: phraseBiasing,
      contextTerms: contextTerms,
      gritNumbers: gritNumbers.length ? gritNumbers : DEFAULT_GRIT_NUMBERS,
      corrections: corrections,
    };
  }

  function getVoiceVocabularyUrl() {
    const basePath = getSupportBasePath().replace(/\/$/, "");
    return basePath + "/" + VOICE_VOCABULARY_PATH + "?v=" + encodeURIComponent(VOICE_VOCABULARY_VERSION);
  }

  function loadVoiceVocabulary() {
    if (loadedVoiceVocabulary) {
      return Promise.resolve(loadedVoiceVocabulary);
    }
    if (voiceVocabularyPromise) {
      return voiceVocabularyPromise;
    }

    voiceVocabularyPromise = fetch(getVoiceVocabularyUrl(), { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Voice vocabulary could not be loaded.");
        }
        return response.json();
      })
      .then(function (body) {
        loadedVoiceVocabulary = mergeVocabulary(body);
        return loadedVoiceVocabulary;
      })
      .catch(function () {
        loadedVoiceVocabulary = mergeVocabulary(null);
        return loadedVoiceVocabulary;
      });

    return voiceVocabularyPromise;
  }

  function getVoiceLang(button) {
    const value =
      (button && button.getAttribute("data-voice-lang")) ||
      document.documentElement.getAttribute("lang") ||
      navigator.language ||
      "en-US";
    return String(value).toLowerCase() === "en" ? "en-US" : value;
  }

  function dispatchInput(input) {
    if (!input) {
      return;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function resolveInput(button) {
    if (!button) {
      return null;
    }

    const shell =
      button.closest(".support-search-shell") ||
      button.closest(".chat-shell") ||
      button.closest("[data-ai-chat]") ||
      button.closest("[data-solution-followup]") ||
      button.closest("form") ||
      document;

    return (
      shell.querySelector("[data-support-search]") ||
      shell.querySelector("[data-ai-input]") ||
      shell.querySelector("[data-solution-followup-input]") ||
      shell.querySelector(".chat-input") ||
      null
    );
  }

  function isLikelyEnglishQuestion(value) {
    const text = clean(value).toLowerCase();
    return /^(what|how|why|which|when|where|who|whom|whose|can|could|should|would|will|do|does|did|is|are|am|was|were|have|has|had)\b/.test(text);
  }

  function addQuestionMarkWhenSafe(value) {
    const text = clean(value);
    if (!text || /[.!?]$/.test(text)) {
      return text;
    }
    return isLikelyEnglishQuestion(text) ? text + "?" : text;
  }

  function wordBoundaryPattern(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  }

  function hasSandpaperContext(value, vocabulary) {
    const text = clean(value).toLowerCase();
    if (!text) {
      return false;
    }
    const terms = uniqueStrings((vocabulary && vocabulary.contextTerms) || BUILT_IN_VOCABULARY.contextTerms)
      .filter(function (term) {
        return term.length >= 4 && !/^\d+$/.test(term) && !/^p\d+$/i.test(term);
      })
      .slice(0, 220);

    return terms.some(function (term) {
      const pattern = new RegExp("(^|[^a-z0-9])" + wordBoundaryPattern(term.toLowerCase()) + "([^a-z0-9]|$)", "i");
      return pattern.test(text);
    });
  }

  function shouldKeepDegreeMeaning(wholeText, offset, matchLength) {
    const start = Math.max(0, offset - 34);
    const end = Math.min(wholeText.length, offset + matchLength + 34);
    const nearby = wholeText.slice(start, end).toLowerCase();
    return /\b(angle|angles|corner|corners|bevel|beveled|slope|incline|temperature|temp|fahrenheit|celsius|celcius|weather|hot|cold|heat)\b/.test(nearby);
  }

  function applyGritNumberCorrections(value, vocabulary, contextAvailable) {
    let text = clean(value);
    const gritNumbers = uniqueStrings((vocabulary && vocabulary.gritNumbers) || DEFAULT_GRIT_NUMBERS)
      .filter(function (value) { return /^\d{2,4}$/.test(value); });
    if (!gritNumbers.length) {
      return text;
    }

    const numberPattern = gritNumbers.sort(function (a, b) { return b.length - a.length; }).join("|");
    const confusedGritWord = "degree|degrees|grid|grids|great|greet|greed|grade|grades";
    const regex = new RegExp("\\b(" + numberPattern + ")\\s+(" + confusedGritWord + ")\\b", "gi");

    text = text.replace(regex, function (match, number, word, offset, whole) {
      const normalizedWord = String(word || "").toLowerCase();
      const isDegreeWord = normalizedWord === "degree" || normalizedWord === "degrees";
      if (shouldKeepDegreeMeaning(whole, offset, match.length)) {
        return match;
      }
      if (isDegreeWord && !contextAvailable) {
        return match;
      }
      return number + " grit";
    });

    return text;
  }

  function applyConfiguredCorrections(value, vocabulary, contextAvailable) {
    let text = clean(value);
    const corrections = Array.isArray(vocabulary && vocabulary.corrections) ? vocabulary.corrections : [];

    corrections.forEach(function (rule) {
      if (!rule || rule.mode === "skip-dangerous") {
        return;
      }
      if (rule.mode === "context" && !contextAvailable) {
        return;
      }
      if (rule.mode === "gritNumberOnly" || isGritConfusionRule(rule)) {
        return;
      }

      try {
        const regex = new RegExp(rule.pattern, rule.flags || "gi");
        text = text.replace(regex, rule.replace);
      } catch (_error) {
        return;
      }
    });

    return clean(text);
  }

  function normalizeVoiceTranscript(value, vocabulary) {
    const activeVocab = vocabulary || activeVocabulary || loadedVoiceVocabulary || mergeVocabulary(null);
    const rawText = clean(value);
    if (!rawText) {
      return "";
    }

    let text = applyConfiguredCorrections(rawText, activeVocab, false);
    const contextAvailable = hasSandpaperContext(text, activeVocab) || hasSandpaperContext(rawText, activeVocab);
    text = applyGritNumberCorrections(text, activeVocab, contextAvailable);
    text = applyConfiguredCorrections(text, activeVocab, contextAvailable);
    text = applyGritNumberCorrections(text, activeVocab, contextAvailable);
    return clean(text);
  }

  function scoreTranscriptCandidate(value, vocabulary) {
    const text = clean(value).toLowerCase();
    const normalized = normalizeVoiceTranscript(text, vocabulary).toLowerCase();
    let score = 0;

    if (/\bgrit\b/.test(normalized)) {
      score += 20;
    }
    if (/\b(p?\d{2,4})\s*grit\b/.test(normalized)) {
      score += 18;
    }
    if (/\bsandpaper\b/.test(normalized)) {
      score += 12;
    }
    if (/\bwet sanding\b|\bdry sanding\b/.test(normalized)) {
      score += 10;
    }
    if (hasSandpaperContext(normalized, vocabulary)) {
      score += 8;
    }
    if (/\bdegree(s)?\b/.test(text) && /\bgrit\b/.test(normalized)) {
      score += 7;
    }
    if (/\bdegree(s)?\b/.test(normalized) && !/\b(angle|corner|temperature|fahrenheit|celsius)\b/.test(normalized)) {
      score -= 6;
    }

    return score;
  }

  function chooseBestAlternative(result) {
    const vocabulary = activeVocabulary || loadedVoiceVocabulary || mergeVocabulary(null);
    const alternatives = [];
    if (!result) {
      return "";
    }

    for (let index = 0; index < result.length; index += 1) {
      if (result[index] && result[index].transcript) {
        alternatives.push(String(result[index].transcript || ""));
      }
    }

    if (!alternatives.length) {
      return "";
    }

    return alternatives
      .map(function (candidate) {
        return {
          text: candidate,
          score: scoreTranscriptCandidate(candidate, vocabulary),
        };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })[0].text;
  }

  function applyPhraseBiasing(recognition, vocabulary) {
    if (!recognition || !("phrases" in recognition)) {
      return;
    }

    const phrases = uniqueStrings((vocabulary && vocabulary.phraseBiasing) || [])
      .slice(0, MAX_PHRASE_BIASING_ITEMS);
    if (!phrases.length) {
      return;
    }

    try {
      recognition.phrases = phrases.map(function (phrase) {
        return { phrase: phrase, boost: 8.0 };
      });
    } catch (_error) {
      try {
        recognition.phrases = phrases;
      } catch (_secondError) {
        return;
      }
    }
  }

  function writeVoiceDebug(input, rawText, normalizedText) {
    const raw = clean(rawText).slice(0, 300);
    const normalized = clean(normalizedText).slice(0, 300);
    const corrected = raw && normalized && raw !== normalized ? "true" : "false";

    [input, document.documentElement].forEach(function (node) {
      if (!node || !node.setAttribute) {
        return;
      }
      node.setAttribute("data-last-voice-raw", raw);
      node.setAttribute("data-last-voice-normalized", normalized);
      node.setAttribute("data-last-voice-corrected", corrected);
    });
  }

  function clearSilenceTimer() {
    if (activeSilenceTimer) {
      window.clearTimeout(activeSilenceTimer);
      activeSilenceTimer = null;
    }
  }

  function scheduleSilenceStop() {
    clearSilenceTimer();
    activeSilenceTimer = window.setTimeout(function () {
      stopActiveRecognition();
    }, SILENCE_TIMEOUT_MS);
  }

  function setButtonIdle(button) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-listening", "support-mic-button-error", "support-mic-button-loading");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Start voice input");
    button.title = "Start voice input";
  }

  function setButtonListening(button) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-error", "support-mic-button-loading");
    button.classList.add("support-mic-button-listening");
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "Stop voice input");
    button.title = "Listening...";
  }

  function setButtonError(button, message) {
    if (!button) {
      return;
    }
    button.classList.remove("support-mic-button-listening", "support-mic-button-loading");
    button.classList.add("support-mic-button-error");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Voice input unavailable");
    button.title = message || "Voice input unavailable";
    window.setTimeout(function () {
      setButtonIdle(button);
    }, 2200);
  }

  function hideUnsupportedButton(button) {
    if (!button) {
      return;
    }
    button.hidden = true;
    button.disabled = true;
    button.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-label", "Voice input not supported in this browser");
    button.title = "Voice input not supported in this browser";
  }

  function stopActiveRecognition() {
    if (!activeRecognition) {
      return;
    }
    try {
      activeRecognition.stop();
    } catch (_error) {
      return;
    }
  }

  function clearActiveState() {
    clearSilenceTimer();
    setButtonIdle(activeButton);
    activeRecognition = null;
    activeButton = null;
    activeInput = null;
    activeBaseText = "";
    activeTranscript = "";
    activeVocabulary = null;
  }

  function applyTranscript(transcript, finalize) {
    if (!activeInput) {
      return;
    }

    const rawTranscript = clean(transcript);
    const normalizedTranscript = normalizeVoiceTranscript(rawTranscript, activeVocabulary);
    const spokenText = finalize ? addQuestionMarkWhenSafe(normalizedTranscript) : normalizedTranscript;
    const nextValue = clean([activeBaseText, spokenText].filter(Boolean).join(" "));
    activeInput.value = nextValue;
    writeVoiceDebug(activeInput, rawTranscript, spokenText);
    dispatchInput(activeInput);
  }

  function readTranscript(event) {
    const finalParts = [];
    const interimParts = [];
    const results = event && event.results ? event.results : [];

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const transcript = chooseBestAlternative(result);
      if (transcript) {
        if (result.isFinal) {
          finalParts.push(transcript);
        } else {
          interimParts.push(transcript);
        }
      }
    }

    return clean(finalParts.concat(interimParts).join(" "));
  }

  function bindStopOnSubmit(button) {
    const form = button && button.closest ? button.closest("form, .support-search-form") : null;
    if (!form || form.getAttribute("data-support-voice-stop-bound") === "true") {
      return;
    }

    form.setAttribute("data-support-voice-stop-bound", "true");
    form.addEventListener("submit", function () {
      stopActiveRecognition();
    });

    Array.prototype.slice.call(
      form.querySelectorAll("button[type='submit'], [data-support-search-submit], .support-search-button"),
    ).forEach(function (submitButton) {
      if (submitButton.classList && submitButton.classList.contains("support-mic-button")) {
        return;
      }
      submitButton.addEventListener("click", function () {
        stopActiveRecognition();
      });
    });
  }

  function startRecognition(button, input, vocabulary) {
    const Recognition = getRecognitionConstructor();
    const recognition = new Recognition();
    recognition.lang = getVoiceLang(button);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    applyPhraseBiasing(recognition, vocabulary);

    activeRecognition = recognition;
    activeButton = button;
    activeInput = input;
    activeBaseText = clean(input.value);
    activeTranscript = "";
    activeVocabulary = vocabulary || mergeVocabulary(null);

    recognition.onstart = function () {
      setButtonListening(button);
      input.focus();
      scheduleSilenceStop();
    };

    recognition.onresult = function (event) {
      activeTranscript = readTranscript(event);
      applyTranscript(activeTranscript, false);
      scheduleSilenceStop();
    };

    recognition.onerror = function (event) {
      const error = event && event.error ? String(event.error) : "";
      const message = error === "not-allowed" || error === "service-not-allowed"
        ? "Microphone permission is blocked"
        : "Voice input unavailable";
      clearSilenceTimer();
      setButtonError(button, message);
    };

    recognition.onend = function () {
      if (activeTranscript) {
        applyTranscript(activeTranscript, true);
      }
      clearActiveState();
    };

    try {
      recognition.start();
    } catch (_error) {
      setButtonError(button, "Voice input unavailable");
      clearActiveState();
    }
  }

  function startVoiceInput(button) {
    const Recognition = getRecognitionConstructor();
    const input = resolveInput(button);

    if (!Recognition) {
      hideUnsupportedButton(button);
      return;
    }

    if (!input || input.disabled) {
      setButtonError(button, "Voice input field is unavailable");
      return;
    }

    if (activeRecognition && activeButton === button) {
      stopActiveRecognition();
      return;
    }

    if (activeRecognition) {
      stopActiveRecognition();
      clearActiveState();
    }

    button.classList.add("support-mic-button-loading");
    loadVoiceVocabulary().then(function (vocabulary) {
      if (activeRecognition) {
        return;
      }
      startRecognition(button, input, vocabulary);
    }).catch(function () {
      startRecognition(button, input, mergeVocabulary(null));
    });
  }

  function bindButton(button) {
    if (!button || button.getAttribute("data-support-voice-bound") === "true") {
      return;
    }

    button.setAttribute("data-support-voice-bound", "true");

    if (!isVoiceSupported()) {
      hideUnsupportedButton(button);
      return;
    }

    button.hidden = false;
    button.disabled = false;
    button.removeAttribute("aria-hidden");
    setButtonIdle(button);
    bindStopOnSubmit(button);

    button.addEventListener("click", function (event) {
      event.preventDefault();
      startVoiceInput(button);
    });
  }

  function setupVoiceInput(root) {
    installVoiceStyles();
    loadVoiceVocabulary();
    const scope = root && root.querySelectorAll ? root : document;
    Array.prototype.slice.call(scope.querySelectorAll(".support-mic-button")).forEach(bindButton);

    if (observerStarted || !window.MutationObserver) {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches(".support-mic-button")) {
            bindButton(node);
          }
          if (node.querySelectorAll) {
            Array.prototype.slice.call(node.querySelectorAll(".support-mic-button")).forEach(bindButton);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  Object.assign(shared, {
    setupVoiceInput: setupVoiceInput,
    normalizeVoiceTranscript: normalizeVoiceTranscript,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
