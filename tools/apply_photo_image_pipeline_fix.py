# tools/apply_photo_image_pipeline_fix.py
# Purpose: apply the Add Photo image-pipeline fixes without touching secrets or database schema.
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "support-photo-diagnostics-20260430-v1"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"PATCH FAILED: marker not found for {label}")
    return text.replace(old, new, 1)


def replace_all_versions(text: str) -> str:
    old_versions = [
        "support-auth-status-spacing-20260430-v1",
        "support-auth-session-fix-20260430-v1",
        "support-voice-timeout-20260430-v1",
        "support-photo-unified-20260430-v1",
        "support-photo-upload-20260430-v1",
    ]
    for old in old_versions:
        text = text.replace(old, VERSION)
    return text


def patch_support_autocomplete() -> None:
    path = "assets/support-autocomplete.js"
    text = read(path)

    helper = '''\n  function saveAttachedPhotoBeforeRedirect(input) {\n    var shared = window.eQualleSupportAssistantShared || null;\n    if (\n      shared &&\n      typeof shared.savePendingPhotoFromElement === "function"\n    ) {\n      return shared.savePendingPhotoFromElement(input);\n    }\n    return false;\n  }\n'''

    if "function saveAttachedPhotoBeforeRedirect(input)" not in text:
      text = replace_once(
          text,
          "\n  function askCurrentQuery(state) {",
          helper + "\n  function askCurrentQuery(state) {",
          "support-autocomplete helper",
      )

    if "saveAttachedPhotoBeforeRedirect(state.input);" not in text:
      text = replace_once(
          text,
          "    resetFreshAskStorage(query);\n    window.location.href = normalizePath(\"/ask/\") + \"?q=\" + encodeURIComponent(query);",
          "    resetFreshAskStorage(query);\n    saveAttachedPhotoBeforeRedirect(state.input);\n    window.location.href = normalizePath(\"/ask/\") + \"?q=\" + encodeURIComponent(query);",
          "support-autocomplete save before redirect",
      )

    write(path, text)


def patch_requester() -> None:
    path = "assets/support-assistant-modules/requester.js"
    text = read(path)

    text = text.replace(
        "            imageAccepted: Boolean(result.imageAccepted),\n",
        "            imageAccepted: Boolean(result.imageAccepted),\n            imageCount: Number.isFinite(result.imageCount) ? result.imageCount : 0,\n",
    )

    write(path, text)


def patch_chat_debug_attrs() -> None:
    path = "assets/support-assistant-modules/chat.js"
    text = read(path)

    marker = '''        const combinedReply =\n          result.needsClarification && result.clarifyingQuestion'''
    block = '''        if (shell.root) {\n          shell.root.setAttribute("data-last-ai-image-accepted", String(Boolean(result.imageAccepted)));\n          shell.root.setAttribute(\n            "data-last-ai-image-count",\n            String(Number.isFinite(result.imageCount) ? result.imageCount : 0),\n          );\n          document.documentElement.setAttribute("data-last-ai-image-accepted", String(Boolean(result.imageAccepted)));\n          document.documentElement.setAttribute(\n            "data-last-ai-image-count",\n            String(Number.isFinite(result.imageCount) ? result.imageCount : 0),\n          );\n        }\n\n'''

    if "data-last-ai-image-accepted" not in text:
        text = replace_once(text, marker, block + marker, "chat image debug attributes")

    write(path, text)


def patch_html_and_cache_versions() -> None:
    paths = [
        "index.html",
        "ask/index.html",
        "assets/app.js",
    ]
    for path in paths:
        p = ROOT / path
        if p.exists():
            write(path, replace_all_versions(read(path)))


def patch_backend_safely() -> None:
    path = ROOT / "supabase/functions/support-ai-chat/index.ts"
    if not path.exists():
        raise SystemExit("PATCH FAILED: supabase/functions/support-ai-chat/index.ts not found")

    text = path.read_text(encoding="utf-8")

    # 1) Store image debug in existing retrieved_content JSON instead of adding new DB columns.
    if "imageDebug?: Record<string, unknown>;" not in text:
        text = replace_once(
            text,
            "  matchedPages?: Array<{ title: string; path: string }>;\n  request: Request;",
            "  matchedPages?: Array<{ title: string; path: string }>;\n  imageDebug?: Record<string, unknown>;\n  request: Request;",
            "insertAiRequestLog imageDebug type",
        )

    if "const retrievedContentForLog" not in text:
        text = replace_once(
            text,
            "  const sourceType = sanitizeString(payload.context.source, 64) || null;\n\n  const body = {",
            "  const sourceType = sanitizeString(payload.context.source, 64) || null;\n  const retrievedContentForLog = {\n    ...(payload.context.retrievedContent || {}),\n    image_debug: payload.imageDebug || {},\n  };\n\n  const body = {",
            "insertAiRequestLog retrievedContentForLog",
        )

    text = text.replace(
        "    retrieved_content: payload.context.retrievedContent || {},",
        "    retrieved_content: retrievedContentForLog,",
    )

    # 2) Add helper for safe image diagnostics.
    if "function buildImageDebug" not in text:
        helper = '''\nfunction buildImageDebug(images: ChatImageInput[] | undefined, openAiInputHasImage = false): Record<string, unknown> {\n  const first = Array.isArray(images) && images.length ? images[0] : null;\n  return {\n    image_count: Array.isArray(images) ? images.length : 0,\n    image_accepted: Boolean(first),\n    image_width: first && Number.isFinite(first.width) ? first.width : null,\n    image_height: first && Number.isFinite(first.height) ? first.height : null,\n    image_size_bytes: first && Number.isFinite(first.sizeBytes) ? first.sizeBytes : null,\n    openai_input_has_image: openAiInputHasImage,\n  };\n}\n'''
        text = replace_once(
            text,
            "function validateRequest(body: unknown): ChatRequest | string {",
            helper + "\nfunction validateRequest(body: unknown): ChatRequest | string {",
            "buildImageDebug helper",
        )

    # 3) Expose imageAccepted/imageCount in successful responses when the existing response object is returned.
    # This block is intentionally conservative and only patches the common final JSON response marker.
    if "imageAccepted:" not in text or "imageCount:" not in text:
        text = text.replace(
            "      requestLogId,",
            "      requestLogId,\n      imageAccepted: Boolean(parsedRequest.images && parsedRequest.images.length),\n      imageCount: parsedRequest.images ? parsedRequest.images.length : 0,",
            1,
        )

    # 4) Ensure OpenAI receives images in the call when the current file still has a 3-argument call.
    text = text.replace(
        "await callOpenAI(openAiApiKey, parsedRequest.userMessage, context)",
        "await callOpenAI(openAiApiKey, parsedRequest.userMessage, context, parsedRequest.images || [])",
    )

    # The current repository may already have image-aware callOpenAI. When it does not, Codex must inspect manually.
    if "images: ChatImageInput[] = []" not in text and "parsedRequest.images || []" in text:
        print("WARNING: callOpenAI signature may still need manual image parameter wiring. Inspect supabase/functions/support-ai-chat/index.ts before deploy.")

    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    patch_support_autocomplete()
    patch_requester()
    patch_chat_debug_attrs()
    patch_html_and_cache_versions()
    patch_backend_safely()
    print("Photo image pipeline patch applied.")
    print("Run: npm run build")
    print("Run: node scripts/validate-source-integrity.js")
    print("Run: node scripts/check-internal-links.js")


if __name__ == "__main__":
    main()
