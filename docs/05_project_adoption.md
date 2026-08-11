# Project Adoption

## Origin Mode

`existing-project`

## Adoption Intent

This project started as an active Codex workspace for building a YouTube adaptive-speed Chrome extension. It is now adopted into the private AI project workflow so future sessions can resume from durable repo files instead of relying on chat history.

## Existing Context Used

- Working extension source under `outputs/adaptive-speed-ai-extension/`.
- Existing extension docs:
  - `outputs/adaptive-speed-ai-extension/README.md`
  - `outputs/adaptive-speed-ai-extension/ARCHITECTURE.md`
  - `outputs/adaptive-speed-ai-extension/MVP_REPORT.md`
- Packaged extension zip at `outputs/adaptive-speed-ai-extension.zip`.
- Local browser/test artifacts under `work/`.
- Research clone/material under `work/opencode/`.

## Detected Repo State

At adoption start, the workspace was not a Git repository.

```text
fatal: not a git repository (or any of the parent directories): .git
```

No existing Git remote was present. The intended private GitHub repo is:

`https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube`

## Detected Project Signals

- Chrome Manifest V3 extension.
- YouTube watch-page content script.
- Background service worker with provider auth and AI planning.
- BYOK provider support: OpenAI, OpenRouter, Google Gemini.
- Experimental ChatGPT Plus/Pro Codex auth path.
- Deterministic viewer-intent and relevance scoring layer.
- Quick dock and popup/options UI.
- Hidden transcript panel fallback.

## Preservation Rules

- Keep `outputs/adaptive-speed-ai-extension/` as the implementation source.
- Do not commit local Chrome profiles, browser storage, cookies, or OAuth material.
- Do not commit `work/opencode/`, `work/min-chrome-profile/`, `work/min-extension/`, or packaged zips unless explicitly requested.
- Preserve the user-visible product behavior described in `knowledge/README_FOR_AI.md`.

## Adoption Checklist

- [x] Existing implementation docs reviewed.
- [x] Durable project memory files created or updated.
- [x] `AGENTS.md` is the canonical portable instruction entry point.
- [x] `CLAUDE.md`, `.cursor/rules/project.mdc`, and `.github/copilot-instructions.md` delegate to `AGENTS.md`.
- [x] `ai-project.yaml` reflects intended repo URL, status, next task, read order, privacy policy, and freshness date.
- [x] Private GitHub repo created and pushed (`isPrivate=true`).
- [x] `python3 scripts/ai_project_check.py` passes.
- [x] Handoff prompt updated with current repo URL and next task.
- [x] Memory freshness reviewed in `docs/06_memory_freshness.md`.
- [x] AI orchestration source of truth reviewed in `docs/07_ai_orchestration_source_of_truth.md`.
- [x] Codex Project registration completed (`saved workspace root: True`).
- [x] Project registered in Mertcan Merkit AI Development Playground for future private dispatch.
