# Project Brief

## Objective

Build and maintain a private Chrome MV3 extension that uses YouTube transcripts, video metadata, viewer intent, and AI providers to create adaptive playback-speed plans.

## Product Hypothesis

Many YouTube videos contain useful sections mixed with filler, sponsor reads, repeated setup, rambling transitions, CTAs, and context the viewer does not currently care about. A transcript-aware AI planner can save time by speeding up low-value regions without skipping content or accelerating the parts that answer the viewer's actual goal.

## Current MVP

The working extension lives in `outputs/adaptive-speed-ai-extension/`.

Implemented capabilities:

- local heuristic planner,
- BYOK providers for OpenAI, OpenRouter, and Google Gemini,
- experimental ChatGPT Plus/Pro Codex auth,
- transcript extraction from YouTube player response and timedtext tracks,
- hidden rendered-transcript fallback when timedtext is unavailable,
- metadata and viewer-intent based planning,
- popup/options defaults for viewer goal and custom prompt,
- per-video quick dock Goal popover,
- target speed and max speed up to `4x`,
- compact icon-first YouTube quick dock,
- native YouTube progress-bar speed coloring,
- planned and actual saved-time reporting.

## Scope

- Maintain the Chrome extension MVP.
- Improve relevance of speed plans so protected sections align with viewer intent.
- Keep BYOK and ChatGPT Plus/Pro auth paths working where possible.
- Keep UI compact enough for YouTube's action row.
- Keep project memory current so future AI sessions can resume without chat context.
- Publish and maintain the project in private GitHub.

## Non-Goals

- Do not publish publicly without explicit user approval.
- Do not commit API keys, ChatGPT tokens, cookies, Chrome profiles, or local browser storage.
- Do not rely on YouTube visual UI state unless transcript/timedtext data is unavailable.
- Do not skip video sections; playback speed changes only.

## Constraints

- YouTube internals are unstable and A/B tested.
- ChatGPT Plus/Pro path is experimental because it uses Codex-like auth and endpoint behavior.
- When the in-page AI Speed toggle is off, the extension must not read transcripts or send AI requests.
- Provider connection tests must still work even if the in-page AI Speed toggle is off.
- If the rendered transcript panel must be opened automatically, it should be hidden/off-screen and closed afterward so the page does not jump.

## Current Next Task

Continue real-video testing, refine speed-plan relevance, and keep extension packaging and project memory current.
