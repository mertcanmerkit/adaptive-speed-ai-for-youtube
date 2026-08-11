# Claude Instructions

Read `AGENTS.md` first and follow it as the canonical project instruction file.

Claude-specific behavior:

- Treat `ai-project.yaml` as the machine-readable project manifest.
- Keep durable context in repository files rather than chat memory.
- Update `docs/06_memory_freshness.md` and `docs/02_session_handoff_prompt.md` before handing off.
- Use `docs/07_ai_orchestration_source_of_truth.md` for master/specialist routing, approval gates, and definition of done.
- Run `python3 scripts/ai_project_check.py` before reporting that the project is ready to push or hand off.
- Preserve private-by-default GitHub handling unless the user explicitly requests public visibility.
