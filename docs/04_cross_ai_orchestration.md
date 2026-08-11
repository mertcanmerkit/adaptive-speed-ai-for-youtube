# Cross-AI Orchestration

Use this file when this project should coordinate with other AI systems, specialist chats, or triads.

## Intent

Preserve the user's reusable AI-network knowledge: which AI systems exist, what each one is good at, where its GitHub-backed instructions live, what rules it follows, how to dispatch work to it, and how to bring the output back into this project.

Use `docs/07_ai_orchestration_source_of_truth.md` for master/specialist responsibilities, approval gates, bounded task requirements, and definition of done.

## AI System Registry

| AI System | Role | Source URL | Read First | Dispatch Status | Output Location |
| --- | --- | --- | --- | --- | --- |
| Mertcan Merkit AI Development Playground | Private master registry for Mertcan's AI projects and dispatch routing. This project is registered there so future master threads can find the repo, local path, role, usage notes, and read-first files. | `https://github.com/mertcanmerkit/mertcan-merkit-ai-development-playground` | In that repo: `docs/06_ai_system_registry.md`, `docs/10_registered_projects.md`, `source_of_truth/registered_projects.json` | Registered, no active dispatch | Playground registry entry points back to this repo: `https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube` |

## Triads

| Triad | Roles | Shared Inputs | Handoff Order | Validation Owner | Status |
| --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD |

## Dispatch Prompt Template

```text
You are being used as a specialist AI system for a GitHub-backed private project.

Current project:
- Repo: <current-project-repo-url>
- Local path: <current-project-local-path>
- Objective: <project-objective>

Read first:
1. <current-project-memory-file>
2. <relevant-source-of-truth-file>
3. <external-ai-system-rules-url-or-file>

Specialist role:
<role and boundaries>

Task:
<specific task>

Inputs:
<files, links, constraints, examples, style requirements>

Output:
- what was done
- files/docs touched
- decisions made
- assumptions used
- checks run
- failed or unverified items
- risks or tradeoffs
- open questions
- recommended next step
- whether anything must be written back to durable docs
- exact files, format, decision record, or artifact expected

Rules:
- Treat GitHub publishing and artifacts as private unless the user explicitly says public.
- Do not invent missing source material. Report missing access or ambiguity.
- Preserve reusable decisions in markdown, not only chat.
- Stay inside the bounded task. Escalate product direction, UX/taste, brand, public publishing, push/PR, legal/risk, paid-launch, irreversible data, credentials/provider, or major source-of-truth decisions.
- Return enough context for this project to update its memory files.
```

## Workflow

1. Read this project's memory files and `docs/07_ai_orchestration_source_of_truth.md` before dispatching external work.
2. Read the target AI system's source URL or local documentation.
3. Use the master thread for synthesis and dispatch; use specialist threads for bounded production work.
4. Create a project-scoped thread when the tool supports it.
5. Create a bounded dispatch prompt with inputs, role, output contract, validation expectations, and escalation conditions.
6. Save returned outputs under `source_of_truth/`, `docs/`, `artifacts/`, or `work/` as appropriate.
7. Update this file with dispatch status, output location, and next steps.

## Current Registration

- Registered project name: `Adaptive Speed AI for YouTube`.
- Registered local path: `<local-clone-path>`.
- Registered repo URL: `https://github.com/mertcanmerkit/adaptive-speed-ai-for-youtube`.
- Registration intent: dispatch extension code changes, provider/auth work, YouTube transcript extraction, speed-plan relevance tuning, quick-dock UI fixes, validation, and packaging back to this project.
- Registration status as of 2026-07-01: private playground registry entry exists from the previous registration pass.

## Guardrails

- Private by default applies to all linked repos, prompts, generated artifacts, and handoffs.
- Do not copy private source material into a public AI system.
- Do not let external chat memory become the only source of truth.
- Do not dispatch vague tasks; every dispatch needs a bounded output contract.
- For Google Stitch or AI design tool dispatches, require the specialist to update `source_of_truth/stitch-map.md` and return parent/new screen IDs, prompt used, accepted status, and any DESIGN.md/token changes.
- Do not use automations as completion events; treat them as scheduled heartbeats for a known thread.
