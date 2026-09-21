---
name: troubleshoot-resume
description: >
  Catch up at the start of a new AI conversation on an existing troubleshooting
  project. Use when starting a fresh session and you need to get the bot up to
  speed on what has been done so far. Reads the project's .ai folder notes,
  optionally asks targeted catch-up questions, updates the notes, and reports
  findings plus recommended next steps. Use when the user says "resume this
  investigation," "catch up on this investigation," "troubleshoot-resume," or similar.
---

## Overview

This skill onboards a fresh AI conversation onto an existing troubleshooting project. It reads the standard `.ai` notes, asks the user what's changed since the notes were last written, re-reads as needed, updates the notes, and reports a concise summary with recommended next steps.

Goal: get oriented fast and conserve context. Do **not** read everything — use `07-known-facts.md` to retain decisive facts while skipping dead-end branches.

## When to invoke

- User starts a new conversation and wants the bot caught up on prior work
- User says "resume this investigation," "catch up on this investigation," "troubleshoot-resume," or similar
- The project already has a `.ai/` folder (if not, use `troubleshoot-init` instead)

## Steps

### 1. Get the project folder

Ask for the location of the troubleshooting folder (use `ask_user`). The `.ai/` subfolder lives inside it. If the user already gave the path, skip the question.

Confirm a `.ai/` folder exists. If it doesn't, tell the user and suggest `troubleshoot-init`.

### 2. First pass — read 00 and 07, then notes 01–06

Read these `.ai` notes to build context, in this order:

- `00-tracking.md` — overview, open loops, open questions, current hypothesis
- `07-known-facts.md` — primary relevance-ranked facts, test summaries, confidence, context, and evidence limits
- `01-initial-findings.md` — problem statement, symptoms, timeline
- `02-hypotheses.md` — POCs (possible causes), leading hypothesis
- `03-root-cause-analysis.md` — root cause work
- `04-trace-analysis.md` — trace/log analysis
- `05-next-steps.md` — prioritized next steps, open questions
- `06-assumptions.md` — assumptions made during analysis and their verification status

Read them in a single batch where possible. If `07-known-facts.md` is missing, treat the project as a legacy investigation and follow its existing structure. Do not backfill, renumber, or rewrite it. Some files may be skeletons — that's fine.

### 3. Ask catch-up questions (optional)

Offer these catch-up questions via `ask_user`, but make them **optional** — the user
may skip any or all of them (leave blank / decline) and you should proceed with what
the notes already tell you. Don't block on answers; treat them as a chance to add
context, not a gate.

1. **What has been done since the files were last updated?**
2. **Is there anything else you need to know?** (i.e., anything the notes don't capture)
3. **Are there any logs or error messages I should be aware of?**

Present them together (a single optional form is fine) and mark them clearly as
optional. If the user skips them, continue to step 4 using the existing notes.

### 4. Second pass — re-read and read selectively

Re-read 00 and 07 first, then notes 01–06 with the user's answers in mind. Read **any other** notes (08+, attachments) only if they're clearly relevant to the open loops, a fact source linked from 07, or the user's update.

**Be disciplined about context:**
- You do **not** have to read every file.
- Branches are often dead-ends. Don't fill context with notes that no longer matter.
- If a note is stale or superseded, skim or skip it.
- Do not drop a High-confidence fact from reasoning merely because its detailed source note was skipped. `07-known-facts.md` exists to prevent that.

### 5. Update the notes

Apply the `.ai` folder conventions from the user's global instructions:

- Update `00-tracking.md`: refresh current hypothesis, open loops, open questions, and the changelog. Keep the **Reference & Locations** section current — add any paths, endpoints, URLs, or IDs the user mentions so they don't have to re-enter them next session. Keep it a roadmap — links and brief descriptions, not detail.
- Add detail to the relevant numbered note (or a new numbered note 08+) capturing what's changed since last session.
- **Log assumptions in `06-assumptions.md`.** Whenever you notice you're making an assumption (in a hypothesis, root-cause reasoning, etc.), write it there. Don't go out of your way to exhaustively enumerate them — just capture the ones you're consciously aware of. A bad assumption is a sneaky failure mode; this doc is what the user reviews to catch them, and what we double-check when we run out of other leads.
- **Update `07-known-facts.md` after every meaningful result** when the investigation was created with the current schema. Keep facts sorted by current relevance. Each row must include confidence, exact execution context, what the evidence proves, what it does not prove, and a source link. Demote or supersede facts explicitly when later evidence changes them.
- Maintain the execution-context matrix in 07. Compare the failing product path with the nearest working control before treating user/VM/tool results as product-equivalent.
- Every new section/edit gets a date and model name. Sign edits with `[Date] - [Model Name] - [Description of Edit]`.
- `poc` = **possible cause**.

**Editing the .ai folder — it's okay to edit:**
- Notes **00–07 are living documents.** Edit, reorganize, and re-label them to stay readable and useful.
- **Never delete information that may be useful later** — especially hypotheses and assumptions. A wrong/busted hypothesis stays: knowing it's wrong *and why* is valuable. Mark it busted, don't remove it.
- If a doc gets bloated with large chunks you want out of the way, **offload them to another doc in the `.ai` folder** rather than deleting.
- The other docs (08+) are closer to **logs** than 00–07. They're still editable — just don't delete and lose info that may matter later.

### 6. Report

Tell the user, clearly and concisely (clarity over grammar; terse is fine):

- **Where things stand** — current leading hypothesis and what's been confirmed/ruled out
- **What changed** since the notes were last updated (from their answers)
- **Recommended next steps** — prioritized, actionable, drawn from `05-next-steps.md` and the new context
- **Assumptions worth checking** — flag any unverified assumptions from `06-assumptions.md` that could matter
- **Known facts driving the recommendation** — cite the top relevant rows from `07-known-facts.md`
- **Open questions** still unanswered

Keep it short. Conveying the information clearly and concisely matters more than completeness or grammar.

## Important rules (from global instructions)

- `poc` means **possible cause**, not proof of concept.
- Each note/section gets a date and model name.
- **Notes 00–07 are living investigation documents.** `07-known-facts.md` is the primary source of truth while investigating.
- Do not retrofit closed or legacy investigations. After closure, only `00`, `01`, and `03` need to carry durable value.
- **Log assumptions in `06-assumptions.md`** as you become aware of making them. The user reviews this doc to catch bad assumptions; it's also where we look when we run out of other leads.
- **Never delete useful info.** Keep busted hypotheses and assumptions (mark them wrong + why). Offload large unwanted chunks to another `.ai` doc instead of deleting. Sign edits: `[Date] - [Model Name] - [Description]`.
- Keep `00-tracking.md` as a roadmap (TOC + open loops + brief descriptions), not detailed content.
- Grade negative evidence by context fidelity. A passing nearby-context test weakens only the branch it actually exercised.
- Don't read files unnecessarily — conserve context, skip dead-end branches.
