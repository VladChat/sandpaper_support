# tools/apply_voice_vocabulary_patch.py
# Purpose: apply browser-only voice vocabulary cache-busting and verify the local voice vocabulary file is present.
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
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def replace_or_fail(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content)
    if count == 0:
        raise RuntimeError(f"Pattern not found while updating {label}: {pattern}")
    return updated


def update_support_assistant_js() -> None:
    path = REPO_ROOT / "assets/support-assistant.js"
    content = read(path)
    content = replace_or_fail(
        content,
        r'const CACHE_VERSION = "support-voice-vocabulary-20260430-v2"]+";',
        f'const CACHE_VERSION = "support-voice-vocabulary-20260430-v2";',
        str(path),
    )
    write(path, content)


def update_app_js() -> None:
    path = REPO_ROOT / "assets/app.js"
    content = read(path)
    content = re.sub(
        r'/assets/support-assistant\.css\?v=[^"\']+',
        f'/assets/support-assistant.css?v={VERSION}',
        content,
    )
    content = re.sub(
        r'/assets/support-assistant\.js\?v=[^"\']+',
        f'/assets/support-assistant.js?v={VERSION}',
        content,
    )
    write(path, content)


def update_html(path: Path) -> None:
    content = read(path)
    content = re.sub(
        r'/assets/app\.js\?v=[^"\']+',
        f'/assets/app.js?v={VERSION}',
        content,
    )
    write(path, content)


def verify_voice_input() -> None:
    path = REPO_ROOT / "assets/support-assistant-modules/voice-input.js"
    content = read(path)
    required_snippets = [
        "VOICE_VOCABULARY_PATH",
        "loadVoiceVocabulary",
        "normalizeVoiceTranscript",
        "recognition.maxAlternatives = 3",
        "applyPhraseBiasing",
        "data-last-voice-raw",
    ]
    missing = [snippet for snippet in required_snippets if snippet not in content]
    if missing:
        raise RuntimeError("voice-input.js does not include expected vocabulary logic: " + ", ".join(missing))


def main() -> None:
    missing = [item for item in REQUIRED_FILES if not (REPO_ROOT / item).exists()]
    if missing:
        raise FileNotFoundError("Missing required files:\n" + "\n".join(missing))

    verify_voice_input()
    update_support_assistant_js()
    update_app_js()
    update_html(REPO_ROOT / "index.html")
    update_html(REPO_ROOT / "ask/index.html")

    print("Applied browser-only voice vocabulary patch.")
    print(f"Cache version: {VERSION}")
    print("Verified data/voice-vocabulary.json is present.")


if __name__ == "__main__":
    main()
