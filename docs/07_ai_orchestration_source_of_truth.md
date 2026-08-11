# AI Orchestration Source Of Truth

Use this file for master/specialist routing, durable memory rules, approval gates, bounded task dispatch, and definition of done.

## Durable Memory

- Chat history is temporary.
- Repository docs, committed files, decision logs, source-of-truth manifests, and structured handoffs are durable.
- Important decisions must be distilled into canonical docs.
- Living docs describe current truth. If history matters, keep it in a decision log with status such as accepted, superseded, rejected, or needs founder confirmation.
- If older context is unavailable or context compaction happened, state the limitation instead of claiming full coverage.

## Master Orchestrator Role

The master orchestrator is for:

- synthesis
- decision support
- prompt writing
- durable memory updates
- specialist output review
- gap identification
- next-step coordination

The master should not directly do specialist production work unless explicitly asked.

Specialist work belongs to specialist agents or project-scoped threads, such as coding, design, research, legal/risk, marketing, voice, video assembly, or thumbnail creation.

## Persistent Specialists And Temporary Workers

There are two worker types:

1. Persistent specialist threads: long-lived sidebar/project agents that preserve continuity for a specialty.
2. Temporary same-thread workers: short-lived workers used for bounded parallel analysis or execution.

For serious projects, use persistent specialist threads as the main structure. Use temporary workers inside a specialist thread only when they help with bounded work.

The user may explicitly ask for 3 or 5 subagents. Honor that request when multi-agent tooling is available, keep each worker bounded, and synthesize results into durable docs. If true subagents are unavailable, run separate bounded review passes and report that limitation.

Correct flow:

1. Master creates a bounded prompt.
2. Specialist thread executes.
3. Specialist returns durable output.
4. Master synthesizes.
5. Durable docs are updated.

## Bounded Task Rule

Avoid mega-prompts and uncontrolled autonomy.

Split work into bounded tasks with:

- clear goal
- scope
- non-goals
- source docs
- acceptance criteria
- tests/checks
- screenshot/design review when UI is involved
- expected output format
- escalation conditions

## Human Approval Gates

Ask for founder approval before:

- product direction changes
- UX/taste acceptance
- brand direction
- public publishing
- GitHub push/PR creation if not already approved
- legal/platform-risk decisions
- paid/public launch assumptions
- irreversible data changes
- credentials, secrets, or provider setup
- major source-of-truth changes

If unsure, document assumptions and continue only when risk is low.

## Git And Experiment Strategy

- Private GitHub is the durable backup and source-control home.
- Experiments should be isolated in a branch or separate folder.
- Do not push experiments unless explicitly approved.
- Do not merge failed experiments wholesale. Cherry-pick useful pieces after review.

## Automations

Automations are scheduled heartbeats, not completion events.

Use them for reminders, status checks, recurring review, or careful continuation of a known thread.

Avoid frequent automations for uncontrolled coding because they can create repeated prompts, context clutter, token waste, and drift.

## Design Inputs

Figma, Paper, Google Stitch, screenshots, competitor references, and generated mockups are visual inputs, not production truth.

Production truth is:

- repo docs
- accepted decisions
- design tokens
- component contracts
- coded implementation
- tests
- screenshot review

Competitor screenshots are inspiration only. Extract UX principles, but do not copy exact UI, branding, colors, typography, icons, wording, layout, trade dress, or product identity.

## Google Stitch Workflow

Use Stitch for exploration, high-fidelity candidates, product-surface concepts, and design-to-code handoff. Do not use Stitch canvas placement or generation order as the source of truth for the current design.

Required Stitch discipline:

- Keep `source_of_truth/stitch-map.md` current whenever Stitch is used.
- Record project ID, screen/resource ID, parent screen, generated screen, version label, timestamp, prompt used, status, and notes.
- Maintain exactly one `CURRENT` version per screen or flow. Mark older useful versions as `ARCHIVE`; mark unaccepted experiments as `CANDIDATE` or `REJECTED`.
- Tell MCP-driven agents to reuse the recorded project and screen IDs unless the user explicitly says `NEW PROJECT`.
- Use the highest available usable Stitch model by default, practically Pro. Use Flash only when the user explicitly says to use Flash for Google Stitch.
- Do not infer Flash from project labels such as MVP, prototype, quick draft, early version, cheap, or low importance.
- Ask for one screen/component and one or two changes per Stitch prompt.
- Preserve accepted visual rules in `DESIGN.md`, design-token docs, component contracts, or code before implementation.
- If Stitch listing tools disagree with known screen IDs, trust the recorded resource IDs until verified manually.

## UI Workflow

Product UI should move through:

1. Product docs and information architecture.
2. Visual direction reference.
3. Prototype contract.
4. UI tokens and components.
5. Fake-data coded prototype.
6. Screenshot review.
7. Approved pieces promoted to production structure.
8. Prototype-only routes deleted or isolated.
9. Real logic implemented as separate tasks.

A coded prototype should not silently become production logic.

## Production Coding Workflow

Production coding should happen issue-by-issue or task-by-task.

Each coding task should include:

- source docs to read
- exact scope
- domain/API contracts
- acceptance criteria
- tests
- lint/type/build checks
- migration/data safety notes
- screenshot review if UI is involved
- docs updates if behavior changes

A task is not complete because the code runs. It is complete only when agreed quality gates pass.

## Definition Of Done

Before calling work done, verify:

- relevant tests pass
- lint/type/build checks pass
- responsive behavior is checked for UI
- accessibility basics are checked
- screenshots are reviewed when UI is involved
- docs are updated when durable behavior or decisions changed
- known risks are recorded
- git state is clear and explainable

## Specialist Output Format

Every specialist output should include:

- what was done
- what files/docs were touched
- what decisions were made
- what assumptions were used
- what checks were run
- what failed or remains unverified
- risks or tradeoffs
- open questions
- recommended next step
- whether anything must be written back to durable docs

## Project Spawn Flow

When a high-level request starts in a master playground and should become a serious project:

1. Preserve the initial chat/request as source material in the new project.
2. Create or adopt a new local project folder.
3. Create a new private GitHub repo.
4. Register the folder as a visible Codex Project when Codex is the execution environment.
5. Create a project-scoped master thread with a proper title.
6. Write a plan and ask the user whether to implement or revise before launching specialist execution, unless the user already explicitly approved implementation.
7. After approval, execute from the new project-scoped master thread.
8. Dispatch bounded work to persistent specialist threads or project-scoped specialist chats.
9. Run work asynchronously where tool support allows, while keeping outputs bounded and reconciled.
10. Bring specialist outputs back into the project repo, update durable docs, validate, and report final paths.

For a YouTube video production request, typical specialist tracks are idea/script, visual storyboard/slides, voice, Remotion/video assembly, thumbnail, and QA.
