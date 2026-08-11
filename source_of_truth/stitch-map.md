# Google Stitch Screen Map

Use this file only when Google Stitch is part of the project workflow. It prevents future AI sessions from guessing which generated canvas item is current.

## Rules

- Do not infer the accepted screen from canvas position, generation order, or a vague "latest" label.
- Keep exactly one `CURRENT` version per screen or flow.
- Mark exploratory outputs as `CANDIDATE`, useful old versions as `ARCHIVE`, rejected outputs as `REJECTED`, and implementation-ready outputs as `HANDOFF`.
- Tell MCP-driven agents to reuse recorded project and screen IDs unless the user explicitly says `NEW PROJECT`.
- Use the highest available usable Stitch model by default, practically Pro.
- Use Flash only when the user explicitly says to use Flash for Google Stitch. Do not infer Flash from MVP/prototype wording.
- After accepting a Stitch change, distill durable rules into `DESIGN.md`, design tokens, component contracts, docs, or code.

## Projects

| Project Name | Stitch Project ID | Purpose | Status | Notes |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

## Screens

| Flow/Screen | Status | Version | Stitch Project ID | Screen/Resource ID | Parent Screen ID | Prompt Used | Timestamp | Handoff Target | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | CURRENT | v1 | TBD | TBD | TBD | TBD | 2026-06-15 | TBD | Replace this row when Stitch is first used. |

## Accepted Design Rules

| Rule | Source Screen/Version | Destination | Status |
| --- | --- | --- | --- |
| TBD | TBD | `DESIGN.md` / tokens / docs / code | TBD |

## MCP Prompt Guardrail

```text
Google Stitch workflow rules:
- Do not create a new Stitch project unless I explicitly say NEW PROJECT.
- Use the highest available usable Stitch model by default, practically Pro.
- Use Flash only if I explicitly say to use Flash for Google Stitch.
- Do not infer Flash from words like MVP, prototype, quick draft, cheap, or low importance.
- Reuse the project and screen IDs recorded in source_of_truth/stitch-map.md.
- Before generating, identify the target CURRENT screen from source_of_truth/stitch-map.md.
- Never decide latest/current by canvas position, generation order, or a generic latest label.
- Create one candidate variant per prompt unless asked otherwise.
- Report parent screen ID, new screen ID, version label, timestamp, prompt used, and recommended status.
- Update source_of_truth/stitch-map.md after the generation is accepted or rejected.
```
