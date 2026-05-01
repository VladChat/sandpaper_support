# tools/apply_voice_vocabulary_safety_fix.py
# Purpose: make browser voice vocabulary parsing and grit corrections safer, then refresh cache-busting.
from __future__ import annotations

import re
from pathlib import Path

VERSION = "support-voice-vocabulary-20260430-v2"
REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "data/voice-vocabulary.json",
    "assets/support-assistant-modules/voice-input.js",
    "assets/support-assistant.js",
    "assets/app.js",
    "index.html",
    "ask/index.html",
    "tools/apply_voice_vocabulary_patch.py",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def replace_exact(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        raise RuntimeError(f"Expected block not found in {label}.")
    return content.replace(old, new, 1)


def replace_regex(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content)
    if count == 0:
        raise RuntimeError(f"Pattern not found in {label}: {pattern}")
    return updated


def patch_voice_input() -> None:
    path = REPO_ROOT / "assets/support-assistant-modules/voice-input.js"
    content = read(path)

    old_unique = '''  function uniqueStrings(values) {\n    const seen = {};\n    return (Array.isArray(values) ? values : [])\n      .map(function (value) { return clean(value); })\n      .filter(function (value) {\n        const key = value.toLowerCase();\n        if (!value || seen[key]) {\n          return false;\n        }\n        seen[key] = true;\n        return true;\n      });\n  }\n'''
    new_unique = '''  function voiceTextValue(value) {\n    if (typeof value === "string" || typeof value === "number") {\n      return clean(value);\n    }\n    if (value && typeof value === "object") {\n      if (typeof value.phrase === "string" || typeof value.phrase === "number") {\n        return clean(value.phrase);\n      }\n      if (typeof value.term === "string" || typeof value.term === "number") {\n        return clean(value.term);\n      }\n      if (typeof value.value === "string" || typeof value.value === "number") {\n        return clean(value.value);\n      }\n    }\n    return "";\n  }\n\n  function uniqueStrings(values) {\n    const seen = {};\n    return (Array.isArray(values) ? values : [])\n      .map(voiceTextValue)\n      .filter(function (value) {\n        const key = value.toLowerCase();\n        if (!value || seen[key]) {\n          return false;\n        }\n        seen[key] = true;\n        return true;\n      });\n  }\n'''
    content = replace_exact(content, old_unique, new_unique, str(path))

    old_infer = '''  function inferCorrectionMode(pattern, replacement) {\n    const source = String(pattern || "").toLowerCase();\n    const target = String(replacement || "").toLowerCase();\n    if (target.indexOf("grit") !== -1 && /(degree|degrees|grid|great|greet|greed|grade)/.test(source)) {\n      return /\\\\d|\\[0-9\\]|\\(\\?\\:|\\(\\d/.test(source) ? "context" : "skip-dangerous";\n    }\n    return "always";\n  }\n'''
    new_infer = '''  function inferCorrectionMode(pattern, replacement) {\n    const source = String(pattern || "").toLowerCase();\n    const target = String(replacement || "").toLowerCase();\n    if (target.indexOf("grit") !== -1 && /(degree|degrees|grid|great|greet|greed|grade)/.test(source)) {\n      return /\\\\d|\\[0-9\\]|\\(\\?\\:|\\(\\d/.test(source) ? "gritNumberOnly" : "skip-dangerous";\n    }\n    return "always";\n  }\n\n  function isGritConfusionRule(rule) {\n    const source = String((rule && rule.pattern) || "").toLowerCase();\n    const target = String((rule && rule.replace) || "").toLowerCase();\n    return target.indexOf("grit") !== -1 && /(degree|degrees|grid|great|greet|greed|grade)/.test(source);\n  }\n'''
    content = replace_exact(content, old_infer, new_infer, str(path))

    old_apply_grit = '''  function applyGritNumberCorrections(value, vocabulary) {\n    let text = clean(value);\n    const gritNumbers = uniqueStrings((vocabulary && vocabulary.gritNumbers) || DEFAULT_GRIT_NUMBERS)\n      .filter(function (value) { return /^\\d{2,4}$/.test(value); });\n    if (!gritNumbers.length) {\n      return text;\n    }\n\n    const numberPattern = gritNumbers.sort(function (a, b) { return b.length - a.length; }).join("|");\n    const confusedGritWord = "degree|degrees|grid|grids|great|greet|greed|grade|grades";\n    const regex = new RegExp("\\\\b(" + numberPattern + ")\\\\s+(" + confusedGritWord + ")\\\\b", "gi");\n\n    text = text.replace(regex, function (match, number, _word, offset, whole) {\n      if (shouldKeepDegreeMeaning(whole, offset, match.length)) {\n        return match;\n      }\n      return number + " grit";\n    });\n\n    return text;\n  }\n'''
    new_apply_grit = '''  function applyGritNumberCorrections(value, vocabulary, contextAvailable) {\n    let text = clean(value);\n    const gritNumbers = uniqueStrings((vocabulary && vocabulary.gritNumbers) || DEFAULT_GRIT_NUMBERS)\n      .filter(function (value) { return /^\\d{2,4}$/.test(value); });\n    if (!gritNumbers.length) {\n      return text;\n    }\n\n    const numberPattern = gritNumbers.sort(function (a, b) { return b.length - a.length; }).join("|");\n    const confusedGritWord = "degree|degrees|grid|grids|great|greet|greed|grade|grades";\n    const regex = new RegExp("\\\\b(" + numberPattern + ")\\\\s+(" + confusedGritWord + ")\\\\b", "gi");\n\n    text = text.replace(regex, function (match, number, word, offset, whole) {\n      const normalizedWord = String(word || "").toLowerCase();\n      const isDegreeWord = normalizedWord === "degree" || normalizedWord === "degrees";\n      if (shouldKeepDegreeMeaning(whole, offset, match.length)) {\n        return match;\n      }\n      if (isDegreeWord && !contextAvailable) {\n        return match;\n      }\n      return number + " grit";\n    });\n\n    return text;\n  }\n'''
    content = replace_exact(content, old_apply_grit, new_apply_grit, str(path))

    old_apply_config = '''      if (rule.mode === "context" && !contextAvailable) {\n        return;\n      }\n      if (rule.mode === "gritNumberOnly") {\n        return;\n      }\n\n      try {\n'''
    new_apply_config = '''      if (rule.mode === "context" && !contextAvailable) {\n        return;\n      }\n      if (rule.mode === "gritNumberOnly" || isGritConfusionRule(rule)) {\n        return;\n      }\n\n      try {\n'''
    content = replace_exact(content, old_apply_config, new_apply_config, str(path))

    old_normalize = '''    let text = applyConfiguredCorrections(rawText, activeVocab, true);\n    const contextAvailable = hasSandpaperContext(text, activeVocab) || hasSandpaperContext(rawText, activeVocab);\n    text = applyGritNumberCorrections(text, activeVocab);\n    text = applyConfiguredCorrections(text, activeVocab, contextAvailable);\n    text = applyGritNumberCorrections(text, activeVocab);\n    return clean(text);\n'''
    new_normalize = '''    let text = applyConfiguredCorrections(rawText, activeVocab, false);\n    const contextAvailable = hasSandpaperContext(text, activeVocab) || hasSandpaperContext(rawText, activeVocab);\n    text = applyGritNumberCorrections(text, activeVocab, contextAvailable);\n    text = applyConfiguredCorrections(text, activeVocab, contextAvailable);\n    text = applyGritNumberCorrections(text, activeVocab, contextAvailable);\n    return clean(text);\n'''
    content = replace_exact(content, old_normalize, new_normalize, str(path))

    # Safety checks
    required = [
        "function voiceTextValue",
        "function isGritConfusionRule",
        "applyGritNumberCorrections(text, activeVocab, contextAvailable)",
        "isDegreeWord && !contextAvailable",
        "recognition.maxAlternatives = 3",
    ]
    missing = [item for item in required if item not in content]
    if missing:
        raise RuntimeError("voice-input.js missing expected safety snippets: " + ", ".join(missing))

    write(path, content)


def refresh_cache_busting() -> None:
    support_assistant = REPO_ROOT / "assets/support-assistant.js"
    content = read(support_assistant)
    content = replace_regex(content, r'const CACHE_VERSION = "[^"]+";', f'const CACHE_VERSION = "{VERSION}";', str(support_assistant))
    write(support_assistant, content)

    app_js = REPO_ROOT / "assets/app.js"
    content = read(app_js)
    content = re.sub(r'/assets/support-assistant\.css\?v=[^"\']+', f'/assets/support-assistant.css?v={VERSION}', content)
    content = re.sub(r'/assets/support-assistant\.js\?v=[^"\']+', f'/assets/support-assistant.js?v={VERSION}', content)
    write(app_js, content)

    for rel in ["index.html", "ask/index.html"]:
        path = REPO_ROOT / rel
        content = read(path)
        content = re.sub(r'/assets/app\.js\?v=[^"\']+', f'/assets/app.js?v={VERSION}', content)
        write(path, content)

    patch_script = REPO_ROOT / "tools/apply_voice_vocabulary_patch.py"
    content = read(patch_script)
    content = replace_regex(content, r'VERSION = "[^"]+"', f'VERSION = "{VERSION}"', str(patch_script))
    write(patch_script, content)


def main() -> None:
    missing = [item for item in REQUIRED_FILES if not (REPO_ROOT / item).exists()]
    if missing:
        raise FileNotFoundError("Missing required files:\n" + "\n".join(missing))

    patch_voice_input()
    refresh_cache_busting()

    print("Applied voice vocabulary safety fix.")
    print(f"Cache version: {VERSION}")
    print("Fixed object phrase parsing and safer degree/grid/great -> grit corrections.")


if __name__ == "__main__":
    main()
