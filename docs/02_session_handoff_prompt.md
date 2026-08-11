# Session Handoff Prompt

Use this repository as the durable project memory.

Repo: https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube
Local path: `<local-clone-path>` (your local checkout)

If you are creating a follow-up Codex thread, first register this local folder as a visible Codex Desktop Project:

```bash
codex app <local-clone-path>
```

Then create a project-scoped thread with `target.type = "project"` and `target.projectId = "<local-clone-path>"`. Do not use a projectless thread as a substitute.

Read these first:

1. `AGENTS.md`
2. `ai-project.yaml`
3. `knowledge/README_FOR_AI.md`
4. `docs/00_project_brief.md`
5. `docs/01_ai_operating_model.md`
6. `docs/02_session_handoff_prompt.md`
7. `docs/03_validation.md`
8. `docs/04_cross_ai_orchestration.md`
9. `docs/05_project_adoption.md`
10. `docs/06_memory_freshness.md`
11. `docs/07_ai_orchestration_source_of_truth.md`
12. `docs/08_product_decisions.md`
13. `source_of_truth/README.md`
14. `outputs/adaptive-speed-ai-extension/README.md`
15. `outputs/adaptive-speed-ai-extension/ARCHITECTURE.md`
16. `outputs/adaptive-speed-ai-extension/MVP_REPORT.md`

Operate with this policy:

- GitHub private by default.
- Preserve source-of-truth files in the repo.
- Commit and push meaningful checkpoints.
- Treat the user as a master AI operator: concise, technical, pragmatic.
- Use `AGENTS.md` as the portable instruction entry point for non-Codex agents.
- Keep `ai-project.yaml` current as the machine-readable manifest.
- Treat `docs/08_product_decisions.md` as the durable record of product, UX, provider, and testing decisions from the original chat.
- Run `python3 scripts/ai_project_check.py` before push or handoff.
- Use `docs/07_ai_orchestration_source_of_truth.md` for master/specialist routing, approval gates, bounded tasks, and definition of done.
- If this project was adopted from an existing repo or chat, read `docs/05_project_adoption.md` before assuming missing context.
- If the task depends on another specialist AI system, read `docs/04_cross_ai_orchestration.md` and dispatch bounded work according to that registry.
- Update `docs/06_memory_freshness.md` after meaningful implementation, validation, source-of-truth, or orchestration changes.
- The extension implementation lives in `outputs/adaptive-speed-ai-extension/`.
- Do not commit local browser profiles, cookies, provider secrets, `work/opencode/`, or packaged zip artifacts unless explicitly requested.

First task:

Continue real-video testing, refine speed-plan relevance, and keep extension packaging and project memory current.
