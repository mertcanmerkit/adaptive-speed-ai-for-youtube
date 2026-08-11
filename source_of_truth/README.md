# Source of Truth

Trusted project inputs and durable decision records live here. Most implementation truth currently lives in the extension source and docs under `outputs/adaptive-speed-ai-extension/`.

## Manifest

| Path | Source | Why It Matters | Last Checked |
| --- | --- | --- | --- |
| `outputs/adaptive-speed-ai-extension/README.md` | Existing extension docs | Current feature list, provider notes, local loading instructions, limitations | 2026-07-01 |
| `outputs/adaptive-speed-ai-extension/ARCHITECTURE.md` | Existing extension docs | Message boundaries, normalized transcript/speed segment shape, LLM contract | 2026-07-01 |
| `outputs/adaptive-speed-ai-extension/MVP_REPORT.md` | Existing extension docs | MVP scope, provider support, transcript strategy, playback strategy, known risks | 2026-07-01 |
| `docs/08_product_decisions.md` | Original build chat distilled into durable memory | Product thesis, UX decisions, provider/auth rules, token-saving rules, transcript strategy, playback planning policy, testing policy, and known regressions | 2026-07-01 |

## Local-Only Inputs

The following may be useful for context but should not be committed:

- `work/opencode/`: local research clone/material used to inspect provider/auth ideas.
- `work/min-chrome-profile/`: local Chrome test profile.
- `work/min-extension/`: local minimal test extension.
- `outputs/adaptive-speed-ai-extension.zip`: generated package artifact.

## Rules

- Do not commit credentials, tokens, cookies, browser profiles, or local-only secrets.
- Prefer original files plus a short summary over chat-only context.
- Update this manifest when adding or replacing trusted inputs.
- Run `python3 scripts/ai_project_check.py` after adding sensitive or externally sourced material.
