# Agent Instructions

This file is the standard entry point for AI coding agents working in this repository.

## Project

- Name: Adaptive Speed AI for YouTube
- Objective: Build and maintain a private Chrome MV3 extension that uses transcripts, viewer intent, and AI providers to create adaptive YouTube playback speed plans.
- Origin mode: existing-project
- Repo URL: https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube
- Local path: `<local-clone-path>`
- Status: active

## Read First

1. `ai-project.yaml`
2. `knowledge/README_FOR_AI.md`
3. `docs/00_project_brief.md`
4. `docs/01_ai_operating_model.md`
5. `docs/02_session_handoff_prompt.md`
6. `docs/03_validation.md`
7. `docs/04_cross_ai_orchestration.md`
8. `docs/05_project_adoption.md`
9. `docs/06_memory_freshness.md`
10. `docs/07_ai_orchestration_source_of_truth.md`
11. `docs/08_product_decisions.md`
12. `source_of_truth/README.md`
13. `outputs/adaptive-speed-ai-extension/README.md`
14. `outputs/adaptive-speed-ai-extension/ARCHITECTURE.md`
15. `outputs/adaptive-speed-ai-extension/MVP_REPORT.md`

## Operating Rules

- Treat the repository as the source of truth, not the chat transcript.
- Preserve existing files, history, and user work when this is an adopted project.
- Keep trusted inputs in `source_of_truth/` and update `source_of_truth/README.md`.
- Keep temporary notes in `work/`; promote durable decisions into `docs/` or `knowledge/`.
- Keep generated deliverables in `artifacts/` when they should be versioned.
- Treat master orchestration as synthesis, dispatch, review, and durable memory updates.
- Send specialist production work to bounded specialist threads or project-scoped chats when the workflow requires it.
- Treat Google Stitch, Figma, screenshots, and generated mockups as design inputs, not production truth.
- When using Google Stitch, use `source_of_truth/stitch-map.md` as the current-version registry. Do not infer the accepted screen from canvas position, generation order, or a vague "latest" label.
- Tell MCP-driven design agents to reuse recorded Stitch project and screen IDs unless the user explicitly asks for a new project.
- For Google Stitch model choice, use the highest available usable model by default, practically Pro. Use Flash only when the user explicitly says to use Flash for Stitch; do not infer Flash from MVP, prototype, quick draft, or low-importance wording.
- Keep exactly one `CURRENT` Stitch version per screen or flow; mark older versions as `ARCHIVE` or `CANDIDATE`.
- Distill accepted Stitch changes into `DESIGN.md`, design tokens, component contracts, docs, or code before treating them as implementation truth.
- Use direct, technical, pragmatic communication.
- The extension source of truth is `outputs/adaptive-speed-ai-extension/`.
- Durable product and UX decisions from the original chat are preserved in `docs/08_product_decisions.md`; update it when a chat creates a reusable product decision.
- Do not treat `work/opencode`, local Chrome profiles, generated zip packages, or browser cache files as durable source. They are ignored local research/test artifacts.
- Keep the YouTube quick dock compact; prefer icons and tooltips over long text inside the dock.
- Preserve token-saving behavior: when the in-page AI Speed toggle is off, content scripts should not read transcript panels or call AI providers.
- Provider connection tests should remain available even when the in-page AI Speed toggle is off.

## Privacy And GitHub

- Private by default applies to repos, remotes, artifacts, prompts, and handoffs.
- Do not push to a public remote unless the user explicitly requested public publishing.
- Before pushing sensitive work, verify GitHub privacy with `gh repo view OWNER/REPO --json isPrivate,url,nameWithOwner`.
- Do not commit credentials, API keys, tokens, browser cookies, local env files, or unrelated user files.
- Run `python3 scripts/ai_project_check.py` before a commit, push, or handoff.

## Memory Freshness

Update `ai-project.yaml`, `docs/02_session_handoff_prompt.md`, `docs/03_validation.md`, `docs/06_memory_freshness.md`, and `docs/07_ai_orchestration_source_of_truth.md` when any of these happen:

- The objective, scope, architecture, active task, repo URL, privacy state, or validation commands change.
- New trusted source material is added, replaced, or invalidated.
- External AI output is accepted into the project.
- A meaningful implementation checkpoint is committed.
- A handoff to another AI session is prepared.
- Memory files are older than the freshness window in `ai-project.yaml`.
- Master/specialist responsibilities, approval gates, or definition-of-done rules change.

## Tool Adapters

- Claude-compatible instructions live in `CLAUDE.md`.
- Cursor rules live in `.cursor/rules/project.mdc`.
- GitHub Copilot instructions live in `.github/copilot-instructions.md`.
- Codex-specific project/thread registration guidance lives in `docs/02_session_handoff_prompt.md`.
- Master/specialist orchestration guidance lives in `docs/07_ai_orchestration_source_of_truth.md`.
- Non-Codex agents should follow this file and can ignore Codex Desktop registration unless they are explicitly asked to create a Codex Project.

## Validation

Start with:

```bash
python3 scripts/ai_project_check.py
git status --short --branch
```

Then run any project-specific checks listed in `docs/03_validation.md`.
