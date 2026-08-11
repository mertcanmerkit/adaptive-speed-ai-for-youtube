# Memory Freshness

This project uses repository files as durable AI memory. Memory is useful only while it reflects the actual project state.

## Last Review

- Date: 2026-07-01
- Reviewed by: Codex during chat-memory preservation pass
- Status: chat-derived product, UX, provider, transcript, token-saving, testing, and known-regression decisions distilled into `docs/08_product_decisions.md`; read order updated; validation rerun; private GitHub repo verified

## Refresh Triggers

Update `ai-project.yaml`, `docs/02_session_handoff_prompt.md`, `docs/03_validation.md`, this file, `docs/07_ai_orchestration_source_of_truth.md`, `docs/08_product_decisions.md`, and any affected source-of-truth manifests when:

- The objective, scope, architecture, active task, repo URL, or privacy state changes.
- Validation commands, test status, or deployment expectations change.
- New source material is added to `source_of_truth/` or existing source material becomes obsolete.
- External AI output is accepted into the project.
- Master/specialist responsibilities, approval gates, task boundaries, or definition-of-done rules change.
- A meaningful implementation checkpoint is committed.
- A handoff to a future AI session is prepared.
- `ai-project.yaml:freshness.last_reviewed` is older than `freshness.stale_after_days`.

## Required Updates

- `ai-project.yaml`: project status, next task, repo URL, validation commands, and `freshness.last_reviewed`.
- `docs/02_session_handoff_prompt.md`: current first task and any repo/thread instructions.
- `docs/03_validation.md`: last verified date, commands run, gaps, and blockers.
- `source_of_truth/README.md`: trusted input manifest.
- `docs/04_cross_ai_orchestration.md`: external AI dispatch status and returned outputs.
- `docs/07_ai_orchestration_source_of_truth.md`: master/specialist routing, approval gates, and definition-of-done rules.
- `docs/08_product_decisions.md`: durable product, UX, provider, transcript, playback, testing, and known-regression decisions created during chat work.

## Automation

Run:

```bash
python3 scripts/ai_project_check.py
```

The check verifies required memory files, adapter files, manifest structure, freshness date, common secret patterns, and GitHub remote privacy when a GitHub remote is present.
