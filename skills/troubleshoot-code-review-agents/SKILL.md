---
name: troubleshoot-code-review-agents
description: >
  Triage a troubleshooting investigation's next-steps/questions, identify which
  ones can be answered purely by static code review (reading repo/EV2/ARM/Bicep/
  pipeline artifacts — no live cloud or on-node access), then spin up code-review
  agents to actually do that work and write findings back into the .ai folder.
  Use when the user wants to know which investigation actions an agent can do via
  code review, or asks to dispatch agents to chase down those static-analysis items.
---

## Overview

This skill bridges a troubleshooting investigation (a `.ai` folder, typically from
`troubleshoot-init`) and the **source artifacts** that can answer some of its open
questions. It does two things:

1. **Triage** the actions and questions in the investigation's next-steps note,
   sorting them into: doable by static code review, partially doable, or not
   (requires live cloud / on-node / human decision).
2. **Dispatch** one or more code-review agents against a folder the user chooses to
   actually accomplish the code-review-doable items, then fold their findings back
   into the `.ai` notes as new numbered notes.

"Code review" here means **static analysis of source and artifacts** — reading
EV2/ARM/Bicep/pipeline/templates/scripts to trace wiring, ownership, and behavior.
It explicitly does **not** include live Azure queries, on-node inspection, or
operational changes. Items needing those are flagged as out of scope.

## When to invoke

- User says "which of these can an agent do via code review," "dispatch a code-review
  agent for the static items," "turn the next-steps into code-review agents," or similar.
- An existing `.ai` folder with a next-steps note (e.g., `05-next-steps.md`) is present.

## Step 1 — Locate the investigation (.ai) folder and next-steps note

Determine the `.ai` folder and the next-steps note to triage:

1. If the user referenced a folder, project, or specific file (e.g.,
   `@...\.ai\05-next-steps.md`), use it.
2. If a project folder is given, append `.ai` and look for the highest-numbered
   `NN-next-steps.md` (commonly `05-next-steps.md`).
3. If nothing is given, use `ask_user` to ask for the `.ai` folder or next-steps file.

Verify the folder exists and contains numbered notes (`00-tracking.md`, etc.). If it
does not, tell the user and suggest `troubleshoot-init` first. Do not scaffold here.

Read the next-steps note and `00-tracking.md`. For investigations created with the current schema, also read `07-known-facts.md`. Do not create or backfill it in legacy investigations.

## Step 2 — Triage actions and questions

Classify every action and question in the next-steps note into three buckets:

- **✅ Code-review-doable** — answerable purely by reading source/artifacts (trace a
  protected `fileUris`/parameter to its generator, find which rollout spec owns a
  payload, read a script to see what it installs, grep templates for a pattern, etc.).
- **🟡 Partially doable** — has a static half (readable from source) and a live half
  (needs the running system). Capture exactly which half the agent can do.
- **❌ Not code-review** — requires live cloud queries, on-node access, or a human
  decision (deploy/apply, map live node→instance, run `dotnet --list-runtimes` on a
  box, retry/remove-node decisions, waiting on a coworker).

Before dispatch, apply this decision rule:

- **Static review can establish:** code paths, policy mechanics, defaults,
  configuration ownership, provisioning/import/startup wiring, and possible
  branches.
- **Static review cannot establish:** the effective runtime value, exact failing
  request, process/container store contents, cache state, network namespace, or
  whether a mechanism actually fired.

Do not dispatch an agent to answer a live-only question indirectly. State the
exact live discriminator instead.

Present this triage to the user as a compact table before dispatching anything, so
they can confirm or adjust scope. Note the key access caveat: a code-review agent can
only do the ✅/🟡-static items **if it can actually see the relevant source** (a repo
or a build drop/`ServiceGroupRoot` mounted on the machine, or a GitHub repo it can
read). State this explicitly.

## Step 3 — Ask which folder to review

Use `ask_user` to ask **which folder (or repo) the code-review agent(s) should read**.
This is the source/artifact location — distinct from the `.ai` folder. Examples to
offer when relevant:

- A local build drop / `ServiceGroupRoot` path the user pastes.
- The git repo root that builds those artifacts.
- A specific subfolder (e.g., the EV2/rollout/`Bin` folder).

Allow freeform (the path is user-specific). If the user says the artifacts are on a
**different machine** that isn't accessible here, tell them the dispatch can't run and
offer to instead produce a ready-to-run agent prompt + search commands they can use on
that machine. Do not try to reverse-engineer around missing access.

After getting the path, verify it exists (e.g., `Test-Path`). If it doesn't exist on
this machine, stop and surface that to the user rather than guessing.

## Step 4 — Ask which model(s) to use

Use `ask_user` (multiple choice, allow freeform) to ask which model(s) should run the
code-review agent(s). Offer a curated list, for example:

- `claude-opus-4.8 (strong reasoning — default)`
- `gpt-5.5`
- `gpt-5.3-codex (code-focused)`
- `claude-sonnet-4.6 (faster)`
- `Same model as this session`
- `Let me pick another` (freeform)

If there are several independent code-review items, you may offer to run **multiple
agents in parallel** (optionally on different models) — one per item or one per
logical cluster of items. If the user picks "same model," omit the `model` override.
Map any named choice to a concrete model id from the `task` tool's model list; if it's
unavailable, say so and let them pick again.

## Step 5 — Dispatch the code-review agent(s)

For each code-review-doable item (or cluster), launch a sub-agent with the `task` tool:

- `agent_type`: `code-review` for pure read-only critique/tracing, or
  `general-purpose` if the agent must also **write findings into the `.ai` folder**.
  Prefer `general-purpose` when you want the agent to both investigate **and** record
  results; use `code-review` when you only want analysis returned to you.
- `model`: the chosen model id (omit for "same model").
- `mode`: `background` for thorough work (you'll be notified on completion); launch
  multiple in parallel when items are independent. Use `sync` only if the user waits.
- `name`: descriptive, e.g. `cr-fileuris-wiring`.

Each agent prompt must be **complete and self-contained** (agents don't share your
context) and include:

1. **The absolute path to the source/artifact folder** to review (from Step 3).
2. **The absolute path to the `.ai` folder** (so it can read context and write notes).
3. **The exact action(s)/question(s)** from the next-steps note it must answer, quoted.
4. **Scope guardrails**: static code review only — read files, trace wiring, cite exact
   file paths + line numbers. Do NOT run live cloud commands, do NOT attempt on-node
   access, do NOT make deployment changes. If the answer genuinely requires the live
   system, say so and stop rather than guessing.
5. **Context and causality guardrails**:
   - Read `07-known-facts.md` before forming conclusions when it exists.
   - Trace product-path equivalence: exact request/operation, endpoint, process,
     host/container, identity, and validation policy.
   - Distinguish "the mechanism exists" from "the mechanism fired."
   - Identify the nearest working control and the smallest configuration or
     provisioning difference visible statically.
   - For each finding, state what it proves and what it does not prove.
6. **The `.ai` folder conventions** for any notes it writes (these come from the
   workspace `instructions.md`):
   - `poc` means **possible cause**, not proof of concept.
   - Each note is a numbered file `NN-title.md`; the number increments. Add a **new**
     note (next free number) rather than rewriting existing analysis.
   - Prefer adding new notes/sections over editing prior entries. If updating an
     existing entry, leave the original and add a dated, signed correction — never
     silently overwrite.
   - Every new note/section gets a date and the **model name**. Sign edits as
     `YYYY-MM-DD - <model name> - <description>`.
   - Update `00-tracking.md`: add the new note to the TOC, refresh open loops / open
     questions if the findings resolve or change them (leave prior reasoning, add
     dated signed updates), and add a changelog line. Keep `00-tracking.md` a roadmap
     (links + brief descriptions), not detailed analysis.
   - Use clear headings and bullets; cite evidence (file:line).
   - Update `07-known-facts.md` only when it already exists and only with facts established by the review. Include
    confidence, context, proves/does-not-prove, source, and relevance rank.
7. **A deliverable instruction**: return a concise report stating, for each assigned
   item, the answer (or "needs live system, can't answer statically"), the supporting
   evidence (file paths + lines), and exactly which `.ai` files it created or edited.

Tell the user which agent(s) you launched, on which model(s), and against which folder.
If running in background, end your turn and wait for the completion notification(s).

## Step 6 — Fold in results and report back

When agent(s) finish (use `read_agent` after each completion notification):

1. Read each agent's report. Spot-check that the new `.ai` note(s) exist and that
   `00-tracking.md` was updated.
2. If you ran `code-review`-type agents (which don't write), record their findings
   yourself into a new numbered `.ai` note following the conventions in Step 5.
3. Give the user a tight summary:
   - Which item(s) each agent resolved, and the answer/evidence.
   - Any item that turned out to need the live system after all.
   - Updated status the user should reflect in the next-steps note (offer to update it).
   - The list of `.ai` files created/edited.

## Notes and guardrails

- This skill **does not modify deployment artifacts or touch live systems** — it reads
  source and writes investigation notes only.
- Be honest about access: if the source isn't reachable on this machine, produce a
  portable agent prompt + grep/search commands instead of guessing.
- Never delete prior analysis; the audit trail is part of the value.
- You can run multiple agents (different models) in parallel for independent items;
  have each write its own numbered note so they don't collide.
- Respect the workspace rule that reverse-engineering internal formats is a red flag —
  if an item would require that, flag it and ask rather than hacking around it.
- Prefer a **working-control diff agent** when a passing environment/context exists.
  Its job is to compare provisioning and effective code/config dimensions, not to
  brainstorm unrelated causes.
