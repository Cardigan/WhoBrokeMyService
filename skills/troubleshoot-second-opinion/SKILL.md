---
name: troubleshoot-second-opinion
description: >
  Get a second opinion on a troubleshooting investigation. Spins up a review
  agent (a model the user chooses — a different model or the same one) that reads
  the project's .ai folder, critiques the logic, updates the .ai notes as needed,
  and reports back. Use when the user asks for a second opinion, a peer/critique
  review, or wants another model to sanity-check an investigation.
---

## Overview

This skill runs an independent review pass over an existing `.ai` investigation folder. It lets the user pick which model performs the review, launches a sub-agent that critiques the reasoning and updates the notes, then summarizes the findings for the user.

The goal is an honest second opinion: confirm what holds up, challenge weak assumptions, surface missed possibilities, and improve the notes — not just agree with the existing conclusion.

## When to invoke

- User says "troubleshoot-second-opinion," "get a second opinion," "peer review this investigation," "have another model check my logic," or similar.
- An existing `.ai` folder is present (typically created by `troubleshoot-init`) and the user wants it reviewed.

## Step 1 — Locate the .ai folder

Determine the `.ai` folder to review:

1. If the user referenced a folder or project (e.g., `@justNotes\Projects\0601-ppvnet-deployment-failure\.ai\`), use that.
2. If the path points at a project folder, append `.ai`.
3. If nothing is given, use `ask_user` to ask for the project folder or `.ai` path.

Verify the folder exists and contains numbered notes (e.g., `00-tracking.md`). If it does not exist, tell the user and suggest running `troubleshoot-init` first. Do not scaffold a new folder here — this skill reviews an existing one.

## Step 2 — Let the user choose the review model

Use `ask_user` (multiple choice, but allow freeform) to ask which model should perform the second opinion. Frame the choice clearly: a *different* model usually gives the most independent critique, but the same model is fine for a fresh-context pass.

Offer a curated list, for example:

- `claude-opus-4.8 (different model — strong reasoning)`
- `gpt-5.5 (different model — independent perspective)`
- `gpt-5.3-codex (different model)`
- `Same model as this session`
- `Let me pick another` (freeform)

Map the user's choice to a concrete model id from the `task` tool's available model list. If the user picks "same model," omit the `model` override so the agent runs on the session default. If the user names a model that is not available, tell them and let them pick again.

## Step 3 — Ask for a focus area

Before launching, use `ask_user` to ask whether there's anything in particular the review should focus on (e.g., "Is the leading hypothesis sound?", "Did we miss an alternative cause?", "Sanity-check the assumptions," "Just a general review"). Allow freeform and offer "No, general review" as a default choice.

If the user provides a focus, fold it into the agent prompt as a **priority emphasis** — the agent should still do a full review, but weight its attention and report toward that focus. If the user has no preference, proceed with a general review.

## Step 4 — Launch the review agent

Launch a sub-agent with the `task` tool:

- `agent_type`: `general-purpose` (it must be able to read **and edit** files).
- `model`: the chosen model id (omit for "same model").
- `mode`: `background` for a thorough review; you'll be notified on completion. Use `sync` only if the user wants to wait inline.
- `name`: something like `second-opinion`.

Give the agent a complete, self-contained prompt (it does not share your context). The prompt must include:

1. **The absolute path** to the `.ai` folder under review.
2. **The task**: read `00-tracking.md` and, when present, `07-known-facts.md` first, then every numbered note needed to understand the current problem statement, hypotheses, evidence, RCA, assumptions, and next steps. If 07 is absent, treat the project as legacy and follow its existing structure. Do not backfill, renumber, or rewrite it.
3. **The critique mandate** — use Skeptical, Optimistic, and Judge perspectives:
   - Skeptical attacks assumptions, context equivalence, causality, weak negative evidence, and confirmation bias.
   - Optimistic identifies what holds up and which practices should be retained.
   - Judge balances both, makes the final assessment, and is the only perspective allowed to edit the `.ai` folder.
   - Check whether the leading hypothesis is actually supported by the cited evidence.
   - Look for logic gaps, unjustified leaps, conflated correlation/causation, and confirmation bias.
   - Flag assumptions marked "Verified" that are really only "Assumed," and vice versa.
   - Surface plausible alternative causes that were dismissed too early or never considered.
   - Note any evidence that contradicts the current conclusion.
   - Call out the single highest-value next check that would most cheaply confirm or kill the leading theory.
   - Identify the nearest working control and the comparison with the fewest differing execution-context dimensions.
   - Reject "the mechanism exists in code" as proof that it fired at runtime.
   - Review decisive tests for exact host/container, process identity, endpoint/SNI, store/cache/network namespace, and validation policy.
   - Require every finding to state what it proves and what it does not prove.
   - Apply a red-herring budget: after two failed causal discriminators or absent request correlation, park the lead until direct evidence appears.
4. **The .ai folder conventions** the agent MUST follow when writing (these come from the workspace `instructions.md`):
   - `poc` means **possible cause**, not proof of concept.
   - Each note is a numbered file: `NN-title.md`; the number increments with each new note. Add a **new** note for the second opinion (the next free number, e.g. `12-second-opinion-<model>.md`) rather than rewriting existing analysis.
   - Prefer adding new notes/sections over editing prior entries. If an existing entry is updated, leave the original text and add a dated, signed correction — do not silently overwrite.
   - Every new section/note gets a date and the **model name** that generated it. Sign edits as `YYYY-MM-DD - <model name> - <description>`.
   - Update `00-tracking.md`: add the new note to the table of contents, refresh open loops / open questions / current hypothesis if the review changes them, and add a changelog line. Keep `00-tracking.md` a roadmap (links + brief descriptions), not detailed analysis.
   - Update `07-known-facts.md` when it exists: preserve established facts across sessions, re-rank them by relevance, and correct confidence/context/proves limits when needed.
   - Use clear headings and bullet points; keep notes on-topic.
5. **A deliverable instruction**: at the end, the agent returns a concise report covering: what holds up, what is weak or wrong, what's missing, the recommended next step, and exactly which files it created or edited.

Tell the user you've launched the review and which model is running it. If running in background, end your turn and wait for the completion notification.

## Step 5 — Report back

When the agent finishes (use `read_agent` after the completion notification):

1. Read the agent's returned report.
2. Optionally spot-check the `.ai` folder to confirm the new note exists and `00-tracking.md` was updated.
3. Give the user a short summary:
   - Which model gave the second opinion.
   - The key agreements and the key challenges/disagreements.
   - The single most valuable recommended next step.
   - The list of files created/updated in the `.ai` folder.

Keep your summary tight — surface the signal (bugs in the logic, missed causes, the next check) rather than restating the whole investigation.

## Notes and guardrails

- This skill **reviews and improves** an existing investigation; it does not start one. For a brand-new investigation, use `troubleshoot-init`.
- The reviewer should be willing to disagree. A second opinion that only validates the first is low value — instruct the agent accordingly.
- Never delete prior analysis. The audit trail of how the thinking evolved is part of the value.
- When multiple perspectives or agents are used, keep Skeptical and Optimistic reviewers read-only; the Judge is the only writer.
- If the user wants more than one second opinion, you can launch multiple review agents (different models) in parallel; have each write its own numbered note so they don't collide.
