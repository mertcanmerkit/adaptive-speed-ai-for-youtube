# Read This First

Project: Adaptive Speed AI for YouTube

Repo: `https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube`

## What This Is

This is a private Chrome MV3 extension project. The extension analyzes YouTube transcripts and metadata, infers what the viewer wants from the video, asks an AI or local heuristic for a granular speed plan, then applies playback-rate changes while the video plays.

The implementation source lives in:

- `outputs/adaptive-speed-ai-extension/`

Read these implementation docs after this file:

- `docs/08_product_decisions.md`
- `outputs/adaptive-speed-ai-extension/README.md`
- `outputs/adaptive-speed-ai-extension/ARCHITECTURE.md`
- `outputs/adaptive-speed-ai-extension/MVP_REPORT.md`

## Current Product Rules

- User wants time saved without skipping content.
- Speed changes should feel explainable, not random.
- Viewer intent matters more than generic transcript importance.
- Prompt-only fixes are not enough; deterministic relevance and guardrail layers are part of the product.
- Use `docs/08_product_decisions.md` as the durable record of product, UX, provider, and testing decisions imported from the original chat.
- The YouTube quick dock must stay compact; use icons and tooltips instead of long labels.
- If AI Speed is toggled off in the YouTube dock, do not open transcript, scrape captions, call AI, or spend tokens until the user turns it on again.
- Provider connection tests must remain available even if the in-page AI Speed toggle is off.
- If the extension opens YouTube's transcript panel automatically, hide it off-screen, read it, close it, and restore page scroll. Manual user transcript opening must remain normal.

## Current Extension State

Latest local manifest version at registration time: `0.1.23`.

Key files:

- `background.js`: settings, provider auth, prompt building, deterministic intent/relevance layer, speed-plan normalization.
- `content.js`: YouTube page integration, transcript extraction, quick dock UI, playback-rate application, saved-time tracking.
- `content.css`: quick dock, progress bar, hidden transcript fallback CSS.
- `popup.*`: compact extension popup settings and stats.
- `options.*`: provider setup, keys/auth, playback and intent defaults.
- `page-bridge.js`: main-world YouTube player response bridge.

## Current Decision Record

The complete reusable decision log from the original chat lives in `docs/08_product_decisions.md`. It covers the product thesis, provider/auth choices, token-saving rules, transcript fallback behavior, viewer-intent model, granular speed-planning policy, YouTube quick dock UX, saved-time reporting, testing policy, and known regressions to guard against.

## Provider Paths

- `heuristic`: local fallback, no network key.
- `openai`: OpenAI Responses API with BYOK.
- `openrouter`: OpenRouter chat completions with BYOK.
- `google`: Gemini generateContent with BYOK.
- `chatgpt`: experimental ChatGPT Plus/Pro auth using Codex-style endpoint behavior.

## Validation Commands

```bash
python3 scripts/ai_project_check.py
node --check outputs/adaptive-speed-ai-extension/background.js
node --check outputs/adaptive-speed-ai-extension/content.js
node --check outputs/adaptive-speed-ai-extension/popup.js
node --check outputs/adaptive-speed-ai-extension/options.js
python3 -m json.tool outputs/adaptive-speed-ai-extension/manifest.json
unzip -tq outputs/adaptive-speed-ai-extension.zip
```

## Do Not Commit

- API keys, OAuth tokens, cookies, browser profiles, Chrome local state.
- `work/opencode/`, `work/min-chrome-profile/`, `work/min-extension/`.
- packaged zip artifacts unless explicitly requested.
- unrelated local test caches or research clones.

## Next AI Session

Start with `AGENTS.md`, `ai-project.yaml`, this file, then the three extension docs. Check status, run the validation commands, and only then implement the next requested product change.
