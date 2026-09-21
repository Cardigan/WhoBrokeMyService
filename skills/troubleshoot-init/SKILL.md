---
name: troubleshoot-init
description: >
  Initialize a .ai investigation folder for a troubleshooting project.
  Use this skill when asked to start a new troubleshooting investigation,
  create a .ai folder, or set up investigation notes for a project.
  Takes a project folder path or project name as input.
---

## Overview

This skill scaffolds a `.ai` investigation folder inside a troubleshooting project directory. It creates the 8 standard documents (00–07) with proper templates, then walks the user through getting started.

## When to invoke

- User says "start a new investigation," "troubleshoot-init," "create a .ai folder," or similar
- User has a new troubleshooting project and needs the standard note structure

## Required input

You need **one** of these from the user. If not provided, use `ask_user` to prompt:

1. **Project folder path** — an existing folder where evidence files (logs, traces, exports) already live. The `.ai/` subfolder will be created inside it.
2. **Project name** — a short description of the issue. A new project folder named `MMDD-<kebab-case-name>/` will be created. Then ask where to save it — the default is a subfolder in the current working directory. The user may specify a different path.

## Gather context before scaffolding

After determining the project folder, prompt the user for these (use `ask_user` for each):

1. **One-line problem statement** — "What's the issue in one sentence?" (e.g., "Gateway refreshes fail after ~5 minutes with 'missing credentials'")
2. **Environment** — "What environment/region is this in?" (e.g., "US Gov Canary", "Prod East US", etc.)
3. **Key identifiers** — "Any IDs to track? (gateway ID, tenant, session, incident #, etc.)" — freeform, optional
4. **Any initial hypotheses?** — "Do you already suspect something?" — freeform, optional
5. **Failing execution context** — "Where does the failing operation actually run?" Include host/container, process identity, endpoint, and environment if known — freeform, optional
6. **Nearest working control** — "What is the closest similar context where the same operation works?" — freeform, optional

These answers populate the templates so they're useful from the start, not just empty skeletons.

## What to create

Create the `.ai/` directory and these 8 files inside it. Use the gathered context to fill in headers and initial content.

### 00-tracking.md

```markdown
# 00 — Tracking: <problem statement short title>

**Date Started:** <today's date>
**Environment:** <environment from user>
**Key IDs:** <identifiers from user, or "TBD">

---

## Table of Contents

| # | File | Description |
|---|------|-------------|
| 01 | [01-initial-findings.md](01-initial-findings.md) | Problem statement, symptoms, timeline |
| 02 | [02-hypotheses.md](02-hypotheses.md) | POCs (possible causes) and current leading hypothesis |
| 03 | [03-root-cause-analysis.md](03-root-cause-analysis.md) | Root cause analysis (updated as understanding deepens) |
| 04 | [04-trace-analysis.md](04-trace-analysis.md) | Trace/log walkthrough and raw data analysis |
| 05 | [05-next-steps.md](05-next-steps.md) | Prioritized next steps and unanswered questions |
| 06 | [06-assumptions.md](06-assumptions.md) | Tracked assumptions with verification status |
| 07 | [07-known-facts.md](07-known-facts.md) | Primary relevance-ranked facts and test results with confidence |

---

## Current Hypothesis

_No leading hypothesis yet. Update this as the investigation progresses._

---

## Reference & Locations

_Quick-reference for paths, endpoints, URLs, and IDs so they don't have to be re-entered each session. Not exhaustive — just the handy ones._

| Type | Name / Description | Value |
|------|--------------------|-------|
| Folder | Project / evidence folder | <path> |
| Endpoint | _e.g._ API base URL | _TBD_ |
| URL | _e.g._ dashboard, incident, repo | _TBD_ |
| ID | _e.g._ gateway / tenant / session | _TBD_ |

---

## Open Loops

- [ ] Review initial evidence and populate 01-initial-findings.md

## Open Questions

- _Add questions as they arise during the investigation._

---

## Changelog

​```
<today's date> - <model name> - Created investigation folder via troubleshoot-init
​```
```

### 01-initial-findings.md

```markdown
# 01 — Initial Findings

**Date:** <today's date>
**Model:** <model name>

---

## Problem Statement

<user's one-line problem statement>

## Environment

<environment details from user>

## Key Identifiers

<identifiers from user>

## Timeline

| Time | Event | Source |
|------|-------|--------|
| _TBD_ | _Fill in as evidence is reviewed_ | |

## Initial Observations

_Review the evidence files in the project folder and document first observations here._

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 02-hypotheses.md

```markdown
# 02 — Hypotheses

**Date:** <today's date>
**Model:** <model name>

---

## Current Leading Hypothesis

_No leading hypothesis yet._

---

## POC 1: <initial hypothesis from user, or "TBD">

**Status:** Needs investigation

<user's initial hypothesis if provided, otherwise: "No initial hypothesis provided. Add POCs as the investigation progresses.">

---

## Previous Hypotheses

_None yet._

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 03-root-cause-analysis.md

```markdown
# 03 — Root Cause Analysis

**Date:** <today's date>
**Model:** <model name>

---

_This document will be populated once a leading hypothesis emerges and is supported by evidence._

## Root Cause

_TBD_

## Evidence

_TBD_

## Failure Chain

_TBD_

## Proposed Fix

_TBD_

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 04-trace-analysis.md

```markdown
# 04 — Trace Analysis

**Date:** <today's date>
**Model:** <model name>

---

_This document will be populated when trace/log data is reviewed._

## Queries Used

_Document Kusto queries, log commands, or other data retrieval methods here._

## Key Observations

_TBD_

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 05-next-steps.md

```markdown
# 05 — Next Steps

**Date:** <today's date>
**Model:** <model name>

---

## Priority 1 — Initial Investigation

| # | Action | Detail | Status |
|---|--------|--------|--------|
| 1 | Review evidence files | Look through all files in the project folder | Pending |
| 2 | Populate initial findings | Document symptoms, timeline, environment in 01 | Pending |
| 3 | Form initial hypotheses | Based on evidence, add POCs to 02 | Pending |

---

## Unanswered Questions

| Question | Which step answers it |
|----------|-----------------------|
| _Add questions as they arise_ | |

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 06-assumptions.md

```markdown
# 06 — Assumptions

**Date:** <today's date>
**Model:** <model name>

---

_Log assumptions here as you become aware of making them during analysis — in hypotheses, root-cause reasoning, anywhere. No need to exhaustively enumerate; just capture the ones you consciously notice. The user reviews this list to catch bad assumptions (a sneaky failure mode), and it's where we look when we run out of other leads._

## Tracked Assumptions

| # | Assumption | Status | Source | Used In | Risk if Wrong | How to Verify |
|---|-----------|--------|--------|---------|---------------|---------------|
| _1_ | _Add assumptions as they arise_ | 🟡 Assumed | | | | |

**Status key:** 🟢 Verified · 🟡 Assumed · 🔴 Busted · ⚪ Superseded

---

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

### 07-known-facts.md

```markdown
# 07 — Known Facts

**Date:** <today's date>
**Model:** <model name>
**Purpose:** Primary source of truth for later reasoning and new sessions

---

## Usage rules

- Track only observed or strongly supported facts, not hypotheses.
- Sort by current relevance to the terminal failure, highest first.
- Keep each entry short enough to scan quickly.
- Record the exact execution context. Nearby contexts are not equivalent.
- Include what the evidence proves and what it does not prove.
- Update confidence or relevance when later evidence changes interpretation.
- Link detailed notes rather than copying large evidence dumps.

## Execution-context matrix

| Context | Environment | Host/container | Process/identity | Endpoint/SNI | Store/cache/network namespace | Result | Source |
|---|---|---|---|---|---|---|---|
| Failing product path | <environment> | <failing context or TBD> | <process/identity or TBD> | <endpoint/SNI or TBD> | TBD | <symptom> | User report |
| Nearest working control | <nearest working control or TBD> | TBD | TBD | TBD | TBD | TBD | User report |

## Known facts

| Rank | Fact / short test result | Confidence | Relevance | Context | Proves | Does not prove | Source |
|---|---|---|---|---|---|---|---|
| 1 | <problem statement / terminal symptom> | High | Direct | <exact or TBD> | The observed failure exists | Root cause | [01](01-initial-findings.md) |

**Confidence:** High = directly observed/reproduced; Medium = supported but context or causality gap remains; Low = weak proxy or incomplete provenance.

## Evidence gaps

| Missing fact | Why it matters | Cheapest way to obtain it |
|---|---|---|
| Exact failing execution context | Prevents nearby-context tests from being overgeneralized | Trace product request/process/container |

## Changelog

​```
<today's date> - <model name> - Created from troubleshoot-init
​```
```

## After scaffolding — teach the user

After creating all files, display this guide to the user:

---

**✅ Investigation folder ready!**

Here's how this works:

📁 **Your project folder** (`<path>`) is where you put evidence — paste in logs, traces, conversation exports, screenshots, anything relevant to the investigation.

📝 **The `.ai/` folder** is where I keep organized notes as we investigate together. Here's what each file does:

| File | What it's for |
|------|--------------|
| `00-tracking.md` | **Start here.** Overview, open questions, links to everything else. I keep this updated. |
| `01-initial-findings.md` | What we know so far — symptoms, timeline, environment. |
| `02-hypotheses.md` | Our theories (POCs = possible causes). Includes the current leading hypothesis. |
| `03-root-cause-analysis.md` | Deep dive once we have a strong lead. |
| `04-trace-analysis.md` | Detailed log/trace walkthroughs with queries used. |
| `05-next-steps.md` | **What to do next.** Prioritized actions and open questions. |
| `06-assumptions.md` | Things we believe but haven't verified. Check here when something doesn't add up. |
| `07-known-facts.md` | **Read after 00.** Relevance-ranked facts, test summaries, context, confidence, and evidence limits. |

**How to work with me:**
- Drop evidence files into the project folder and ask me to review them
- Ask me to **update the .ai folder** after we discuss findings
- I'll keep `07-known-facts.md` current and add new detailed notes starting at 08
- Say **"what's next?"** and I'll check `05-next-steps.md`

**Ready to start?** Drop some evidence into the folder and tell me to review it, or describe what you're seeing.

---

## Important rules (from instructions.md)

- `poc` means **possible cause**, not proof of concept.
- Each note gets a date and model name.
- **Notes 00–07 are living documents.** `07-known-facts.md` is the primary reasoning input after `00-tracking.md`; keep it concise, relevance-ranked, and current. Detailed log-like notes start at 08.
- **Log assumptions in `06-assumptions.md`** whenever you notice you're making one. Don't exhaustively enumerate — just capture the ones you're aware of. The user reviews this doc to catch bad assumptions, and it's where we double-check when we run out of leads.
- Before accepting a test result, record its context and state both what it proves and what it does not prove.
- Prefer the nearest working control and change one context dimension at a time.
- Apply this schema only to new investigations. Do not retrofit or rewrite closed investigations.
- The `.ai` schema is an investigation workspace, not an archive. After closure, consolidate durable value into `00-tracking.md`, `01-initial-findings.md`, and `03-root-cause-analysis.md`. The other notes remain working history but are not required reading after the event.
- **Never delete useful info.** Keep busted hypotheses and assumptions (mark them wrong + why). Offload large unwanted chunks to another `.ai` doc instead of deleting.
- Sign edits with: `[Date] - [Model Name] - [Description]`
- The full conventions are in `.github/instructions/instructions.md` — always follow those for ongoing maintenance of the `.ai` folder.
