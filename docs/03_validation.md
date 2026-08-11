# Validation

## Baseline Project Checks

```bash
python3 scripts/ai_project_check.py
git status --short --branch
```

## Extension Static Checks

```bash
node --check outputs/adaptive-speed-ai-extension/background.js
node --check outputs/adaptive-speed-ai-extension/content.js
node --check outputs/adaptive-speed-ai-extension/popup.js
node --check outputs/adaptive-speed-ai-extension/options.js
python3 -m json.tool outputs/adaptive-speed-ai-extension/manifest.json
```

## Package Checks

```bash
unzip -tq outputs/adaptive-speed-ai-extension.zip
unzip -p outputs/adaptive-speed-ai-extension.zip manifest.json | python3 -m json.tool
```

## Browser Checks

When a browser tool is available and the user permits it, test in Chrome rather than Brave:

1. Reload the unpacked extension from `chrome://extensions`.
2. Open a YouTube watch page with captions.
3. Confirm the compact quick dock fits without overflow.
4. Confirm AI Speed off does not read transcript or call AI.
5. Confirm Analyze runs when AI Speed is on.
6. Confirm the Goal popover applies per-video intent and resets on navigation.
7. Confirm rendered transcript fallback stays hidden if timedtext is unavailable.
8. Confirm the quick dock uses compact labels/icons and shows planned savings as `S: mm:ss`.
9. Confirm per-video Goal controls reset on navigation and do not persist to the next video unless saved globally from popup/options.

## Privacy Checks

```bash
gh repo view mertcanmerkit/adaptive-speed-ai-for-youtube --json isPrivate,url,nameWithOwner
```

Expected: `isPrivate=true`.

Do not push if the remote is public.

## Last Verified

- Date: 2026-07-01
- Project memory check: passed after refreshing chat-derived decision memory.
- Local static checks: passed for `background.js`, `content.js`, `popup.js`, and `options.js`.
- Manifest JSON check: passed for `outputs/adaptive-speed-ai-extension/manifest.json`.
- Package check: passed for `outputs/adaptive-speed-ai-extension.zip`.
- GitHub privacy: verified private with `gh repo view mertcanmerkit/adaptive-speed-ai-for-youtube --json isPrivate,url,nameWithOwner`.
