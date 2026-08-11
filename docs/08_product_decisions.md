# Product Decisions And Chat Memory

This file preserves reusable decisions from the original build chat. A future agent should not need the chat transcript to understand the product direction, UX decisions, provider assumptions, or failure modes.

Last reviewed: 2026-07-01.

## Core Product Thesis

- YouTube explored a similar adaptive-speed idea in beta, but the user found it poor. This project exists to build a more intentional personal version using per-video transcript, metadata, viewer intent, and user-controlled providers.
- The product is an AI-assisted YouTube playback-speed extension, not a summarizer and not a skipper.
- It should save time by speeding up low-value moments while still playing every section of the video.
- The user experience succeeds only when speed changes feel explainable. Random-feeling acceleration is a product failure even if time is saved.
- Transcript-only importance is insufficient. The planner must infer why the viewer is watching this video and protect sections that answer that goal.
- Prompt-only fixes are not enough. The product needs deterministic intent, relevance, normalization, and guardrail layers around provider output.

## Source Of Truth

- Implementation source: `outputs/adaptive-speed-ai-extension/`.
- Current manifest version at this memory review: `0.1.23`.
- Durable project memory starts at `AGENTS.md`, `ai-project.yaml`, and `knowledge/README_FOR_AI.md`.
- Temporary screenshots from the build chat were design inputs only. Their accepted decisions are distilled here and in the extension docs.
- Local research/test artifacts such as `work/opencode/`, local Chrome profiles, and generated zip packages are not durable source.

## Provider And Auth Decisions

- BYOK is the reliable provider path and must remain supported.
- Supported BYOK providers are OpenAI, OpenRouter, and Google Gemini.
- Experimental ChatGPT Plus/Pro auth is a priority feature because the user explicitly wants either BYOK or ChatGPT Plus/Pro auth.
- ChatGPT Plus/Pro support was informed by opencode/Codex-style auth behavior, including browser/device auth and Codex-like endpoints.
- The ChatGPT Plus/Pro path is experimental and can break because it is not a normal public OpenAI API contract for this extension.
- OpenAI API billing and ChatGPT Plus/Pro subscriptions are separate; docs and UI should not imply they are interchangeable.
- Provider setup must include a Test Connection button. It should send a minimal valid provider request and return a simple confirmation response.
- Provider connection tests must work even if the in-page AI Speed toggle is off.
- Content scripts must never receive provider secrets. API keys/tokens stay in extension background/options contexts.

## Token-Saving And Consent Rules

- If the YouTube in-page AI Speed toggle is off, do nothing expensive or intrusive.
- While AI Speed is off, do not open transcript panels, scrape rendered transcript, fetch captions for analysis, call AI providers, or spend tokens.
- Turning AI Speed off during analysis should abort active analysis work where possible.
- User can re-enable analysis by turning AI Speed on or explicitly clicking Analyze after it is on.
- Provider Test Connection is separate from video analysis and remains available from options/popup/provider settings.

## Transcript And Metadata Strategy

- Prefer YouTube player response and timedtext caption tracks over rendered UI scraping.
- Use rendered transcript panel scraping only as a fallback when caption tracks are unavailable or unreadable.
- If the extension opens the YouTube transcript panel automatically, hide it off-screen, read it, close it, and restore page/scroll state so the user is not disturbed.
- Manual user transcript opening must remain normal.
- Videos without usable captions are unsupported for now and should fail clearly.
- Metadata should participate in planning: title, channel, category, keywords, chapters, caption track details, entry/search context, and sanitized description signals.
- Description can be noisy, so use compact excerpts/signals rather than dumping raw description text into prompts.
- The user proposed using recent YouTube searches to infer intent. Current privacy-safe direction is to use current entry/search query when discoverable from page context, not broad browser history scraping by default.

## Viewer Intent Model

- The extension should answer: "What is this viewer trying to get from this specific video?"
- Explicit user intent beats inferred intent.
- Intent inputs, in rough priority order:
  1. Per-video Goal popover in the YouTube quick dock.
  2. Specific goal text.
  3. Optional custom prompt.
  4. Popup/options default watching goal.
  5. YouTube entry/search query if available.
  6. Video title.
  7. Channel/category/keywords/chapters/description signals.
  8. Transcript intro and local transcript evidence.
- Per-video Goal overrides must reset on YouTube navigation to a new video.
- Popup/options defaults persist globally.
- Optional custom prompt should refine speed planning but must not override JSON schema, provider safety, or protected-content rules.
- If the plan feels random, first inspect whether intent, relevance scores, and chunk hints are wrong before changing only the prompt.

## Playback Planning Decisions

- Never skip video segments. Change `video.playbackRate` only.
- "Target speed" means the user's normal desired baseline viewing speed. The planner should protect important chunks at this baseline.
- Max speed can go up to `4x`.
- Supported modes are `calm`, `reasonable`, and `aggressive`.
- Use semantic speed tiers instead of asking providers for arbitrary raw rates: `base`, `slight`, `medium`, `fast`, `max`.
- For a normal `1x` target and `1.75x` max, the intended ladder is approximately `1.0`, `1.15`, `1.25`, `1.5`, `1.75`.
- The planner should create granular micro-decisions, not two or three large speed blocks.
- Normal speech videos should usually be chunked around 8-10 seconds before planning.
- Typical speed regions should be short and explainable, often 1-4 chunks. Runs longer than about 5 chunks need a consistent repeated role/evidence pattern.
- Do not merge same-speed adjacent chunks merely because the numeric speed matches if their semantic reasons differ and the UI/diagnostics would lose useful explanation.
- Protect new concepts, steps, commands, code, examples, demos, data, warnings, mistakes, troubleshooting, conclusions, nuanced claims, named entities, jokes, emotional moments, music, lyrics, and performances.
- Accelerate greetings, agenda, housekeeping, sponsor reads, affiliate/coupon pitches, CTAs, merch/newsletter/platform promos, repeated recaps, filler, rambling transitions, obvious off-topic asides, and outro padding.
- Accelerate generally important but off-intent material when it does not serve the viewer's current goal.
- If evidence is mixed or confidence is low, prefer baseline or slight acceleration over fast/max.

## UI And YouTube Integration Decisions

- The YouTube quick dock must stay compact and fit in the action row.
- Use icons and tooltips instead of full text labels where space is tight.
- Long status text such as `Ready: provider-name` should not consume dock space. Put longer diagnostics in tooltip/popup/options.
- While Analyze is running, the Analyze button should become disabled and show an analyzing state.
- The `Ready` label in the dock was intentionally removed.
- Show planned saved time compactly as `S: 9:43` or similar, not as a long phrase that gets truncated.
- The quick dock needs access to Goal controls via a small popover/modal-style UI because full labels and inputs do not fit inline.
- Goal/custom prompt controls must also remain available in popup/options.
- Playback should be globally enabled. Do not make a separate optional Playback checkbox that can break AI provider connection or analysis flow.
- The dock should mount in the primary YouTube action area when possible and should not be hidden underneath Watch Later, playlist, or other YouTube overlays.
- If mounted in a secondary/right-column area, it should appear at the top and above competing YouTube panels.
- The native YouTube progress bar area should show speed-plan coloring because YouTube's own red progress bar can otherwise obscure custom indicators.
- Use the native player progress region for dynamic speed coloring rather than a separate hard-to-see line.
- The progress coloring should make fast/slow regions visible without making YouTube's own red progress impossible to read.

## Saved-Time Reporting

- The user wants both planned and actual saved-time feedback.
- Show how much time the current video plan is expected to save.
- Track how much time was actually saved on the current video.
- Track total lifetime saved time and show it when the extension is opened.
- The quick dock should use compact saved-time text; popup/options can show fuller labels.

## Testing Decisions

- Use Chrome for extension testing when the user asks for browser validation.
- Do not touch the user's Brave browser unless explicitly asked.
- Local extension reload is done through `chrome://extensions` for unpacked extension testing.
- Chrome 142+ may ignore command-line `--load-extension`; manual reload can be more reliable.
- Real-video test matrix should cover English manual captions, English auto captions, Turkish captions, long videos, no-caption videos, BYOK OpenAI, heuristic fallback, and ChatGPT device auth.

## AI Collaboration Decisions

- The user often asks for 3 or 5 subagents on difficult planning, prompt, or debugging work.
- When the environment provides multi-agent tools, use bounded specialists for parallel audits and synthesis.
- When true subagents are unavailable, simulate the same discipline with separate bounded review passes and document assumptions.
- Preserve accepted conclusions in repo docs, not only in the active chat.
- This project is registered in the user's private AI Development Playground, which can dispatch future project work back to this repo.

## Known Failure Modes To Guard Against

- `Unexpected end of JSON input` from provider output should not produce an empty plan without a useful status.
- `0 speed segments` should be treated as a failure or fallback condition, not a successful analysis.
- `Transcript was present but unreadable` should trigger alternate extraction paths or clear user feedback.
- Provider Test Connection must include all fields required by that provider path; a prior failure returned `HTTP 400: {"detail":"Instructions are required"}`.
- Long dock text can disappear due to shrinkage or YouTube layout changes.
- Opening the rendered transcript panel visibly can shift the page and annoy the user.
- Large uniform sections at `1.5x` or `2x` feel random and unprofessional; preserve micro-planning and relevance guardrails.
- YouTube layout and captions are unstable and A/B tested, so selectors and fallback paths need periodic real-video testing.

## Future Work

- Add better observability for why each chunk got its tier: intent source, relevance, novelty, hints, provider role/evidence, and final guardrail changes.
- Add a lightweight plan inspection/debug view for development without cluttering the user-facing dock.
- Consider privacy-safe ways to infer entry intent beyond the current page context, but do not scrape broad browser or YouTube history without explicit user approval.
- Add automated browser smoke tests for extension load, YouTube dock fit, AI Speed off behavior, hidden transcript fallback, provider test connection, and saved-time display.
- Split large extension scripts into modules after real-video behavior stabilizes.
