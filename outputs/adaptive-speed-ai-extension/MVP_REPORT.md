# MVP Report

## Scope

This MVP is a local Chrome MV3 extension for personal testing. It detects a YouTube watch page, extracts captions, generates an adaptive speed plan, and applies playback rates while the video plays.

## Provider support

- `heuristic`: no network or key required.
- `openai`: official OpenAI Responses API with BYOK.
- `openrouter`: OpenRouter chat completions with BYOK.
- `google`: Gemini generateContent with BYOK.
- `chatgpt`: experimental ChatGPT Plus/Pro auth based on Codex OAuth behavior observed in opencode.

The BYOK path is the reliable base. The ChatGPT Plus/Pro path is intentionally marked experimental because it uses Codex-specific OAuth and `chatgpt.com/backend-api/codex/responses`, not a normal public API contract for this extension.

## YouTube transcript strategy

The content layer tries these paths:

1. Main-world bridge reads `window.ytInitialPlayerResponse` or `ytcfg.PLAYER_RESPONSE`.
2. Inline watch page scripts are parsed with a balanced-brace fallback.
3. Current watch HTML is fetched and parsed.
4. Caption tracks are fetched through YouTube timedtext as `json3`, then `srv3`.
5. If timedtext fails, the rendered transcript panel is scraped as a last resort.

Videos without captions remain unsupported.

## Playback strategy

The planner creates stable speed runs instead of per-caption jitter. Runtime behavior includes:

- Rate quantization to familiar values.
- User-controlled `calm`, `reasonable`, and `aggressive` speed modes.
- User-controlled target speed and max speed from `1x` to `4x`.
- Minimum segment smoothing.
- Adjacent run merging.
- Short speed-change cooldown with manual hold when the user changes speed.
- 45 second manual hold when the user changes speed.
- No skipping, only playback speed changes.
- Saved-time tracking per video and total lifetime saved time.
- Native YouTube progress-bar coloring for the adaptive plan.

## Security posture

- API keys and ChatGPT refresh tokens stay in background/options contexts.
- `chrome.storage.local` is restricted to trusted extension contexts when Chrome supports `setAccessLevel`.
- Content scripts never receive provider secrets.
- The UI includes warnings for BYOK exposure, transcript sharing, and ChatGPT/Codex fragility.

Chrome extension storage is not an OS keychain. Use low-limit keys for testing.

## Known risks

- YouTube internals are private and A/B tested.
- The rendered transcript panel fallback is hidden/off-screen when opened by the extension, then closed after scraping.
- The ChatGPT Plus/Pro provider can fail due to endpoint changes, CORS, auth policy, model availability, or account restrictions.
- Browser OAuth uses a localhost redirect interception pattern; device-code auth is usually the more portable experimental path.
- This is not ready for Chrome Web Store publication without a privacy policy, optional permissions work, and stricter disclosure/consent UX.
- Current Chrome builds can block automated unpacked-extension loading via command-line flags; manual reload in `chrome://extensions` is the reliable local test path.

## Recommended next build step

Run a real-video test matrix:

- English manual captions.
- English auto captions.
- Turkish captions.
- Long video over 30 minutes.
- Video with no captions.
- BYOK OpenAI analysis.
- Heuristic-only analysis.
- ChatGPT device auth.

After that, split the single-file scripts into modules and add Playwright extension smoke tests.
