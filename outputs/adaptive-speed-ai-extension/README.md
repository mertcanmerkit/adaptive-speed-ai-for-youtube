# Adaptive Speed AI for YouTube

MVP Chrome Manifest V3 extension that reads YouTube captions, asks an LLM for an adaptive speed plan, and applies `video.playbackRate` while the video plays.

## What works

- Local heuristic mode with no API key.
- BYOK providers:
  - OpenAI Responses API.
  - OpenRouter chat completions.
  - Google Gemini generateContent.
- Experimental ChatGPT Plus/Pro auth:
  - Browser OAuth route modeled after opencode/Codex auth.
  - Device-code route modeled after opencode/Codex auth.
- YouTube caption extraction from `ytInitialPlayerResponse` caption tracks.
- If the extension must fall back to YouTube's rendered transcript panel, it opens the panel hidden, reads it off-screen, then closes it so the page does not jump.
- JSON speed plan cache in Chrome extension storage.
- Popup controls for provider, model, mode, target speed, max speed, viewer defaults, custom prompt, and saved-time stats.
- Popup and options controls for viewer intent, including preset watching goals, a custom specific goal, and an optional custom prompt.
- Options page with provider auth, model selects, test connection, and playback limits up to `4x`; playback is always globally enabled.
- In-page YouTube action-row control with compact icon buttons, status tooltip, and a per-video Goal popover.
- Native YouTube progress-bar overlay that shows speed-plan colors above the red playback bar.
- When AI Speed is toggled off, the content script does not read captions, open the transcript panel, call providers, or analyze until the user turns it back on.
- Provider connection tests continue to work even if the in-page AI Speed toggle is off; active analysis requests are aborted when the user turns AI Speed off.
- Prompt v3 speed planning:
  - The model must classify the video type and viewer task before assigning chunk speeds.
  - Plans use semantic speed tiers instead of arbitrary numeric speeds.
  - Guardrails protect steps, concepts, data, warnings, demos, music, jokes, and conclusions even if the model over-accelerates them.
  - Sponsor reads, repeated recaps, CTAs, filler, and off-topic sections can accelerate aggressively when confidence is high.
- Prompt v4 micro-planning:
  - Transcript chunks are smaller, usually 8-10 seconds for normal speech videos.
  - The model is asked for chunk-level micro-decisions instead of long section-level blocks.
  - Post-processing preserves semantic boundaries and no longer merges same-speed chunks just because the numeric speed matches.
  - Playback cooldown is shorter so detailed plans can actually change speed during playback.
- Prompt v5 intent planning:
  - The extension extracts compact YouTube metadata from the player response, including channel, category, keywords, description signals, chapters, caption source, and entry context.
  - A deterministic local intent layer derives the viewer goal before the provider call.
  - Each transcript chunk gets local relevance, novelty, and hint scores.
  - Normalization uses those scores to protect chunks aligned with the viewer goal and accelerate off-intent low-value chunks.
- Prompt v6 per-video intent controls:
  - The quick dock Goal popover can override watching goal and specific goal for the current video.
  - Per-video goal overrides reset when YouTube navigates to a new video.
  - Optional custom prompt from popup/options is sent as extra speed-planning guidance.

## Load locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this folder: `adaptive-speed-ai-extension`.
5. Open a YouTube video with captions.

## Provider notes

The safest MVP path is BYOK. API keys and ChatGPT tokens are stored in Chrome local extension storage on this machine.

The ChatGPT Plus/Pro path is experimental. It follows the Codex OAuth behavior visible in opencode, including the `auth.openai.com` device flow and `chatgpt.com/backend-api/codex/responses` endpoint. That endpoint is not a normal public OpenAI API contract for this extension and may break or be blocked. ChatGPT plans and OpenAI API billing are separate.

## Known limitations

- Videos without captions cannot be analyzed yet.
- Some YouTube pages delay or omit caption tracks until the player fully loads.
- Browser OAuth depends on Chrome catching the localhost redirect navigation. If it fails, use the device-code method.
- The extension changes playback speed only; it does not skip segments.
- Chrome 142+ may ignore command-line `--load-extension`; for local development, reload the unpacked extension from `chrome://extensions`.
- LLM output is smoothed, but bad transcript quality can still create imperfect plans.
- This is not affiliated with YouTube, Google, OpenAI, ChatGPT, or opencode.
