# AI Operating Model

## User Working Style

The user works as a master AI operator. Treat projects as durable systems, not one-off chats.

## Operating Rules

- Be direct, technical, and pragmatic.
- Convert reusable context into files.
- Treat `AGENTS.md` as the canonical cross-tool agent instruction file.
- Keep `ai-project.yaml` current as the machine-readable project manifest.
- Keep source-of-truth artifacts in `source_of_truth/`.
- Commit and push meaningful checkpoints to private GitHub.
- Explain AI-use best practices when they materially improve the work.
- Validate outcomes with commands, tests, screenshots, or source checks when possible.
- Treat Google Stitch and similar AI design tools as controlled exploration inputs.
- For Stitch work, update `source_of_truth/stitch-map.md` with project ID, screen/resource IDs, parent/new version links, prompt used, timestamp, and status.
- Do not decide "current design" from Stitch canvas placement, generation order, or a generic latest label; use the repo registry.
- For Stitch model selection, use the highest available usable model by default, practically Pro. Use Flash only when the user explicitly says to use Flash for Google Stitch; the word MVP is not a sufficient reason.
- Keep accepted visual rules in `DESIGN.md`, design-token docs, component contracts, or code.
- Use the master thread for synthesis, dispatch prompts, memory updates, specialist review, gap identification, and next-step coordination.
- Use specialist threads or project-scoped chats for specialist production work such as coding, design, research, legal/risk, marketing, voice, video, or thumbnails.
- When the user explicitly requests 3 or 5 subagents, use available multi-agent tooling for bounded parallel audits or execution. If tooling is unavailable, run separate bounded review passes and state that limitation.
- Avoid mega-prompts and uncontrolled autonomy; split serious work into bounded tasks with acceptance criteria and checks.
- Ask for founder approval before product-direction, UX/taste, brand, public publishing, push/PR, legal/risk, paid-launch, irreversible data, credential/provider, or major source-of-truth changes unless already approved.
- When another specialist AI system can help, use `docs/04_cross_ai_orchestration.md` to define its source URL, rules, dispatch prompt, output contract, and return path.

## Default Privacy

All GitHub repos and shared artifacts are private unless the user explicitly says public.

## Durable Context Rules

- Prefer updating repo files over relying on chat memory.
- Put trusted inputs in `source_of_truth/` and summarize them in `source_of_truth/README.md`.
- Put temporary exploration notes in `work/` and promote only durable decisions into `docs/` or `knowledge/`.
- Keep `docs/02_session_handoff_prompt.md` accurate after meaningful changes.
- Keep `docs/06_memory_freshness.md` and `ai-project.yaml` accurate before push, handoff, or external AI dispatch.
- Keep `docs/07_ai_orchestration_source_of_truth.md` accurate when master/specialist routing, approval gates, or definition-of-done rules change.
- Run `python3 scripts/ai_project_check.py` before claiming the project is ready.
