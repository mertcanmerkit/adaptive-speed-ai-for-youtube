# GitHub Copilot Instructions

Read `AGENTS.md` first and follow it as the canonical project instruction file.

Project rules:

- Use `ai-project.yaml` for read order, active status, privacy policy, and validation commands.
- Keep durable AI memory in `docs/`, `knowledge/`, and `source_of_truth/`.
- Keep `docs/02_session_handoff_prompt.md`, `docs/03_validation.md`, and `docs/06_memory_freshness.md` current after meaningful changes.
- Use `docs/07_ai_orchestration_source_of_truth.md` for master/specialist routing, approval gates, and definition of done.
- Run `python3 scripts/ai_project_check.py` before push or handoff.
- Treat GitHub repos and artifacts as private unless the user explicitly requests public visibility.
