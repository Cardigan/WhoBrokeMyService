# Product Requirements Document: WBMS

**Date:** 2026-09-20
**Status:** Working PRD
**Product name:** WBMS (Who Broke My Service)
**Signature visualization:** Hypothesis Flight Deck
**Primary audience:** Developers and Site Reliability Engineers (SREs)

## 1. Executive summary

WBMS is a local, AI-assisted investigation workspace for
developers and SREs. It turns the structured Markdown notes produced by the
Troubleshooter agent into a navigable visual model of an investigation.

Phase 0 is a working, read-only mind-map viewer for an existing `.ai`
investigation folder. It is built and undergoing UI testing:

- The left side presents the investigation as an interactive node map.
- The right side presents source-faithful, safely rendered Markdown for the
  selected node.
- Files become parent nodes; important items inside the files become children.
- A generated intermediate projection separates Markdown parsing from graph
  rendering.
- Changes written by the Troubleshooter agent appear automatically.
- Navigation helps users move between the visual map and source details without
  losing their place.

Phase 1 adds an ongoing conversation with the Troubleshooter agent. The browser
can submit messages to a local input queue, but it never edits investigation
Markdown directly. The agent consumes queued messages, updates the canonical
`.ai/*.md` files, and WBMS refreshes from those changes.

## 2. Problem statement

The Troubleshooter agent already provides a disciplined investigation process:

1. Collect context.
2. Form possible causes (POCs).
3. Design decisive tests.
4. Route work to a user, telemetry query, or code-review agent.
5. Record evidence and update the investigation.
6. Repeat until root cause is supported by positive and negative validation.

The process stores durable state in numbered Markdown files under a project's
`.ai` folder. This makes investigations resumable and auditable, but it is
difficult for a user to understand the investigation landscape quickly.

Today, users must read raw Markdown files or ask the CLI to summarize them.
This creates several problems:

- Competing hypotheses are difficult to compare.
- Relationships between files and findings are not visually obvious.
- Important assumptions and next steps can be buried in long documents.
- Joining or resuming an investigation requires reading significant context.
- Chat and CLI interfaces are effective for reasoning but weak at presenting
  continuously evolving state.
- Users can lose their location while moving between a high-level investigation
  view and detailed evidence.

## 3. Product vision

**See the investigation clearly; talk to the agent that moves it forward.**

WBMS should become an AI incident-investigation cockpit—not a generic mind map
and not a replacement for the Troubleshooter agent. Its value is structured
convergence:

- Preserve competing theories until evidence refutes them.
- Make uncertainty and assumptions visible.
- Connect hypotheses to decisive tests.
- Preserve negative evidence and busted theories.
- Keep investigation state available across sessions and models.
- Make every conclusion traceable to its source.
- Help the user communicate status and hand work between humans and agents.

## 4. Target users

### Primary user

A developer or SRE actively troubleshooting:

- A production incident.
- A service regression.
- A deployment failure.
- A customer or support escalation.
- A hard-to-reproduce bug.
- A cross-system problem involving logs, source code, infrastructure, and human
  discussion.

### Secondary users

- An on-call lead who needs to understand investigation state quickly.
- An engineer joining an active incident.
- A future investigator resuming prior work.
- A stakeholder who needs a concise status snapshot.

Secondary personas must not expand the initial milestone into a reporting or
incident-management product.

## 5. Job to be done

> When I am dropped into an investigation with noisy conversation, partial
> facts, competing theories, and scattered evidence, I want the product to show
> me the shape of the investigation and the source behind each conclusion so I
> can understand current thinking, identify the next decisive action, and
> converge on a verified root cause without repeating work.

## 6. Product principles

1. **Investigation state, not chat history.** The product represents
   hypotheses, evidence, assumptions, tests, and decisions—not merely messages.
2. **Source before summary.** Users must be able to inspect the exact source
   text behind a node.
3. **Visible uncertainty.** AI-inferred or unverified information must not look
   like confirmed fact.
4. **Action over decoration.** Visualizations must help the user understand or
   act; they must not become graph spaghetti.
5. **Progressive disclosure.** Show the landscape first, then reveal detail on
   demand.
6. **Durable and resumable.** Investigation state survives sessions, model
   changes, and CLI conversations.
7. **Safe local default.** The initial product operates on localhost and does
   not transmit investigation content elsewhere.
8. **Replaceable presentation.** Parsing, semantic modeling, layout, and graph
   rendering remain separate so libraries and views can change later.
9. **Do not overclaim.** The product must not call a root cause verified until
   both confirming and refuting behavior have been tested where possible.

## 7. Goals

### Phase 0: local investigation viewer

- Open an existing `.ai` investigation from the CLI.
- Visualize the investigation as a compact, navigable mind map.
- Parse and represent every Markdown file in the selected `.ai` folder and its
  important semantic contents.
- Let users inspect exact Markdown without leaving the visual context.
- Make large investigations navigable through collapse, breadcrumbs, back
  navigation, recentering, panning, and zooming.
- Reflect agent-written file changes without a page reload.
- Work with real, long-running troubleshooting investigations—not only a
  synthetic fixture.

### Phase 1: interactive investigation cockpit

- Surface facts, hypotheses, assumptions, evidence, tests, and open questions.
- Have the AI recommend the leading hypothesis and next decisive test.
- Keep the user in an ongoing conversation with the Troubleshooter agent.
- Send browser messages through a local input queue.
- Let the Troubleshooter agent update the canonical `.ai` Markdown.
- Display agent activity and hand work to code-review or analysis agents.
- Export concise investigation status back to Teams or another source channel.

## 8. Non-goals

### Current milestone

- Editing `.ai` investigation content from the UI.
- Creating or reconnecting semantic graph edges manually.
- Inferring cross-file relationships with AI.
- Supporting multiple users concurrently.
- Supporting multiple investigations in one browser session.
- Replacing the Troubleshooter agent.
- Replacing an incident-management or observability platform.
- Importing or interpreting chat in the UI layer.

### Phase 1

- Fully autonomous production remediation.
- Arbitrary rich-text editing of all Markdown.
- Direct browser mutation of `.ai` Markdown.
- Browser-owned chat extraction or Teams retrieval.
- Enterprise collaboration, permissions, and conflict resolution.
- Perfect parsing of every possible Markdown style.
- Building every proposed view before the core investigation loop is useful.

## 9. User journeys

### 9.1 Open an existing investigation

1. User runs the local viewer with a project or `.ai` folder path.
2. The server validates the path and restricts file access to the selected
   `.ai` folder.
3. The browser opens the investigation map.
4. The hypotheses branch is expanded; other file branches are collapsed.
5. The user pans, zooms, expands, or selects nodes.
6. The right pane displays the selected source item.
7. If the agent edits the `.ai` folder, the map refreshes automatically while
   preserving the user's layout where possible.

### 9.2 Navigate a large investigation

1. User selects a POC node.
2. The right pane shows the exact POC Markdown and source location.
3. A breadcrumb bar shows:
   `Investigation > 02 Hypotheses > POC`.
4. User clicks a breadcrumb or the Back button to move up.
5. User clicks a related entry or document in the right pane.
6. The corresponding graph node becomes selected and the canvas animates to
   center it.

### 9.3 Continue the investigation with the Troubleshooter agent

1. User types or pastes a message into the WBMS conversation input.
2. WBMS appends the message to a local input queue.
3. The Troubleshooter agent consumes the message and continues the
   investigation.
4. The agent may use its configured tools, including Teams MCP when available.
5. The agent updates the canonical Markdown files in `.ai`.
6. WBMS reparses the Markdown, updates its intermediate projection, and
   refreshes the graph.

### 9.4 Record a test result

1. User opens a hypothesis.
2. WBMS shows the AI-recommended next decisive test and expected
   confirming/refuting signals.
3. User tells the Troubleshooter agent the result in the ongoing conversation.
4. The message is appended to the input queue.
5. The agent updates the relevant Markdown investigation state.
6. WBMS refreshes from the changed Markdown.

## 10. Functional requirements

Priority definitions:

- **P0:** Required for the current usable viewer.
- **P1:** Required for the interactive agent-connected product.

Status definitions:

- **Implemented:** Present in the current initial build.
- **Planned:** Agreed requirement, not yet implemented.

### 10.1 Local launch and source loading

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-001 | P0 | Implemented | A CLI command accepts either a project folder containing `.ai` or the `.ai` folder itself. |
| FR-002 | P0 | Implemented | The server binds only to localhost and opens the viewer in the default browser. |
| FR-003 | P0 | Implemented | Existing `.ai/*.md` files are the canonical investigation source. |
| FR-004 | P0 | Implemented | The viewer supports standard files `00`–`06` and generic numbered notes `07+`. |
| FR-005 | P0 | Implemented | GFM headings, lists, task lists, and tables used by real investigations are parsed. |
| FR-006 | P0 | Implemented | Malformed or partially understood content produces diagnostics rather than crashing the viewer. |
| FR-007 | P0 | Implemented | The last valid map remains visible if a later parse fails. |
| FR-008 | P0 | Planned | Parsing produces a generated intermediate projection file used by the renderer. |
| FR-009 | P0 | Planned | The generated projection is derived, replaceable, and never becomes the investigation source of truth. |

### 10.2 Investigation hierarchy

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-010 | P0 | Implemented | The map has one investigation root node. |
| FR-011 | P0 | Implemented | Every `.ai` Markdown file becomes a child file node. |
| FR-012 | P0 | Implemented | `02-hypotheses.md` produces one child node per POC/hypothesis. |
| FR-013 | P0 | Implemented | `05-next-steps.md` produces child nodes for major actions/tests, including table rows. |
| FR-014 | P0 | Implemented | `06-assumptions.md` produces child nodes for assumptions, including table rows. |
| FR-015 | P0 | Implemented | Tracking, initial findings, RCA, and trace files produce major semantic child nodes. |
| FR-016 | P0 | Implemented | Unknown notes fall back to major heading-based child nodes. |
| FR-017 | P0 | Implemented | The current viewer creates containment edges only. |
| FR-018 | P1 | Planned | Navigation can expose parent, child, and explicitly linked file relationships without changing Markdown ownership. |

### 10.3 Mind-map presentation

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-020 | P0 | Implemented | The left pane displays a left-to-right hierarchical mind map. |
| FR-021 | P0 | Implemented | Hypotheses are expanded initially; other file branches are collapsed. |
| FR-022 | P0 | Implemented | Users can expand and collapse branches. |
| FR-023 | P0 | Implemented | Users can pan and zoom the canvas. |
| FR-024 | P0 | Implemented | Left-clicking and dragging empty canvas pans the map. |
| FR-025 | P0 | Implemented | Users can drag nodes to adjust visual placement. |
| FR-026 | P0 | Implemented | Dragging a node never reparents it or changes investigation content. |
| FR-027 | P0 | Implemented | Expanded/collapsed state persists in browser storage; manual node positions are session-only. |
| FR-028 | P0 | Implemented | Expanding or collapsing branches recalculates the visible layout and automatically fits it to the viewport. |
| FR-029 | P0 | Implemented | The map fills all browser height remaining below the header and banners. |
| FR-030 | P0 | Implemented | The graph and detail pane are resizable, initially approximately 65%/35%. |
| FR-031 | P0 | Implemented | Automatic compact layout considers all visible nodes; this behavior may be revised after UI testing. |
| FR-032 | P0 | Implemented | Node layout and recentering changes animate smoothly. |
| FR-033 | P0 | Implemented | Large investigations use collapsed branches and progressive disclosure rather than rendering every item expanded. |

### 10.4 Selection and navigation

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-040 | P0 | Implemented | Selecting a graph node highlights it and updates the right pane. |
| FR-041 | P0 | Implemented | Breadcrumbs show the complete path from the investigation root to the selected node. |
| FR-042 | P0 | Implemented | Every breadcrumb segment is clickable and selects its corresponding node. |
| FR-043 | P0 | Implemented | The right pane includes a Back button that selects the current node's parent. |
| FR-044 | P0 | Implemented | Selecting an item or document from the right pane selects, highlights, and recenters the corresponding graph node. |
| FR-045 | P0 | Implemented | Selecting the root node lists the `.ai` documents in the right pane. |
| FR-046 | P0 | Implemented | Document entries shown for the root node are clickable. |
| FR-047 | P0 | Implemented | If a selected node disappears after refresh, the viewer selects its closest available parent and informs the user. |
| FR-048 | P1 | Planned | Keyboard navigation supports moving through nodes and common investigation actions. |
| FR-049 | P1 | Planned | Right-pane navigation can expose parent, child, and explicitly linked Markdown files. |

### 10.5 Detail pane and source provenance

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-050 | P0 | Implemented | Selecting an item node renders its exact sanitized Markdown section. |
| FR-051 | P0 | Implemented | Selecting a file node renders a clickable outline/list of parsed items. |
| FR-052 | P0 | Implemented | The detail pane shows source file and line range. |
| FR-053 | P0 | Implemented | Links are safe and clickable; code blocks are copyable. |
| FR-054 | P0 | Implemented | The detail pane scrolls independently from the graph. |
| FR-055 | P0 | Implemented | Open-in-editor targets the selected source file and line, with copy-path fallback. |
| FR-056 | P1 | Planned | Every generated fact, hypothesis, assumption, test, and evidence item includes source provenance. |
| FR-057 | P1 | Planned | Provenance distinguishes AI inference, user confirmation, tool/code-review output, telemetry, and manual entry. |

### 10.6 Live refresh and state

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-060 | P0 | Implemented | The server watches the selected `.ai` folder for Markdown changes. |
| FR-061 | P0 | Implemented | The browser receives revisions through Server-Sent Events without page reload. |
| FR-062 | P0 | Implemented | Parse updates are published as complete snapshots, not partially updated file state. |
| FR-063 | P0 | Implemented | Browser presentation state is independent from investigation content. |
| FR-064 | P1 | Planned | The browser can append user messages to a local input queue. |
| FR-065 | P1 | Planned | The browser does not directly mutate canonical `.ai` Markdown. |
| FR-066 | P1 | Planned | The Troubleshooter agent consumes queued messages and updates `.ai` Markdown. |
| FR-067 | P1 | Planned | Agent-written Markdown changes flow through the normal parser, intermediate projection, and SSE refresh path. |

### 10.7 Troubleshooter conversation

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-070 | P1 | Planned | User has an ongoing conversation with the Troubleshooter agent from WBMS. |
| FR-071 | P1 | Planned | The conversation input accepts typed or pasted text. |
| FR-072 | P1 | Planned | WBMS places submitted messages in a local input queue for the agent. |
| FR-073 | P1 | Planned | Chat interpretation and investigation updates are owned by the Troubleshooter agent, not the UI layer. |
| FR-074 | P1 | Planned | The agent may use independently configured tools, including Teams MCP, without making Teams retrieval a WBMS UI responsibility. |
| FR-075 | P1 | Planned | Agent responses and resulting investigation changes remain visible to the user as an ongoing conversation and updated board. |

### 10.8 Investigation actions

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-080 | P1 | Planned | User can report a test result to the Troubleshooter agent as Supported, Refuted, Inconclusive, or Need help. |
| FR-081 | P1 | Planned | The agent updates related hypothesis and next-step Markdown after interpreting the user's message. |
| FR-082 | P1 | Planned | User can ask the agent to confirm, reject, or supersede an assumption. |
| FR-083 | P1 | Planned | The AI recommends the current leading hypothesis; the recommendation remains visibly an AI judgment. |
| FR-084 | P1 | Planned | Agent updates preserve prior reasoning and use the existing `.ai` note conventions. |
| FR-085 | P1 | Planned | The AI recommends one cheapest decisive next test for the current leading hypothesis. |

### 10.9 Agent integration and transparency

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-090 | P1 | Planned | User can send an eligible static-analysis task to code-review agents. |
| FR-091 | P1 | Planned | User can request a second opinion on the current reasoning. |
| FR-092 | P1 | Planned | Agent findings appear as sourced investigation items. |
| FR-093 | P1 | Planned | An Active Agents panel shows agent name, task, status, start time, and last output. |
| FR-094 | P1 | Planned | Users can stop active agent work from the UI. |

### 10.10 Communication and export

| ID | Priority | Status | Requirement |
| --- | --- | --- | --- |
| FR-100 | P1 | Planned | User can copy a Teams-ready status update containing the leading hypothesis, evidence, next test, owner, and blockers. |
| FR-101 | P1 | Planned | Activity timeline records queued user messages, agent activity, decisions, tests, and findings. |

## 11. Visual and interaction requirements

### 11.1 Layout

- Full browser-height application.
- Compact header containing product identity and connection state.
- Resizable map and detail panes.
- Map remains usable regardless of detail-pane content length.
- Right pane scrolls independently.
- Large maps begin collapsed except for the hypotheses branch.

### 11.2 Theme

- Dark-first design with bright, legible status accents.
- Light theme remains supported.
- Status meanings:
  - **Red:** user attention, major failure, or critical blocker.
  - **Yellow:** risky or unresolved.
  - **Green:** supported.
  - **Blue/link color:** active or untested.
  - **Accent color:** agent or code-review findings.
  - **Gray:** refuted or superseded; refuted theories remain gray until their
    status changes.
- Color must always be paired with text, icon, or shape.

### 11.3 Node behavior

- Nodes show a concise label, kind, and status where available.
- Selection is visually distinct.
- Nodes animate smoothly when layout or recentering changes.
- Node movement is direct and fluid.
- File and semantic nodes remain visually distinguishable.
- Busted or superseded theories remain visible rather than being deleted.

### 11.4 Navigation

- Breadcrumb path is always visible when a node is selected.
- Back moves exactly one level toward the investigation root.
- Clicking right-pane items synchronizes the map selection.
- Recenter animation must not unexpectedly change node positions during the current layout session.
- Root detail provides a document-level entry point for users who prefer lists
  over graph navigation.

## 12. Data model and architecture requirements

### 12.1 Phase 0

Markdown files in the selected `.ai` folder are the source of truth. The viewer
uses two generated layers:

1. **Investigation model**
   - Documents.
   - Semantic items.
   - Source ranges.
   - Status.
   - Diagnostics.
2. **Mind-map projection**
   - Visible nodes.
   - Containment edges.
   - Detail references.

The generated projection is written to an intermediate file and is the direct
input to graph rendering. It is disposable and can always be regenerated from
the Markdown source.

Browser view state stores:

- Expanded/collapsed branches.
- Selected node.

Phase 0 lays out all visible nodes automatically. Users can drag nodes during
the current layout session, but expanding or collapsing a branch recalculates
the visible layout, discards manual placement, and fits the result to the
viewport.

### 12.2 Phase 1 agent interaction

The Phase 1 data flow is:

1. User sends a conversational message from WBMS.
2. WBMS appends the message to a local input queue.
3. The Troubleshooter agent consumes the queued message.
4. The agent updates canonical `.ai/*.md` files.
5. WBMS regenerates the intermediate projection.
6. The browser receives and renders the updated investigation.

The input queue is the only investigation-related data the browser writes.
Neither the browser nor the intermediate projection directly edits canonical
Markdown.

### 12.3 Replaceability boundaries

- Parser registry isolates Markdown conventions.
- Semantic model isolates investigation meaning.
- Projection isolates view-specific shape.
- Layout engine is replaceable.
- React Flow integration is isolated from the rest of the frontend.
- Detail rendering consumes source entities, not graph-library objects.
- Phase 1 conversation commands use the input queue rather than direct renderer
  or Markdown mutation.

## 13. Non-functional requirements

### Performance

- Existing investigation should show its first useful map promptly after local
  launch.
- A map with approximately 300 nodes must remain navigable through branch
  collapse and progressive disclosure.
- File changes should appear without a full page reload.
- Recenter and layout changes should animate without blocking interaction.
- Large frontend bundle optimization is desirable but not required while
  current interaction remains responsive.

### Reliability

- One malformed note must not prevent other files from rendering.
- File writes are debounced and parsed as complete snapshots.
- Failed refresh retains the previous valid map.
- Stable semantic IDs preserve browser layout across revisions.

### Security and privacy

- Bind only to loopback.
- Restrict file access to the investigation selected at launch.
- Prevent path traversal.
- Sanitize rendered Markdown and embedded HTML.
- Never execute content from investigation notes.
- Do not transmit investigation contents to external services from the viewer.
- Agent tools and connectors are configured and governed outside the WBMS UI.

### Accessibility

- All controls are keyboard-focusable.
- Status is not communicated through color alone.
- Breadcrumbs, Back, outlines, and graph controls have accessible names.
- Pane resizing supports keyboard controls.
- Text and status colors meet readable contrast expectations.

## 14. Success metrics

### Phase 0

- A user can launch an existing `.ai` investigation with one command.
- Every Markdown file in the selected `.ai` folder is represented.
- Every POC is represented as an individual node.
- Real action and assumption tables are parsed into individual nodes.
- Users can reach any visible semantic node through graph, outline, root
  document list, breadcrumbs, or Back navigation.
- `.ai` changes appear without browser reload.
- No parser failure crashes the application.
- The sanitized fixture investigation loads with no diagnostics.
- UI testing validates navigation, layout, selection, recentering, and source
  detail behavior.

### Phase 1

- User can identify the leading hypothesis and next decisive test without
  reading all source notes.
- The AI-recommended leading hypothesis is visibly distinguishable from
  verified fact.
- A queued user message is consumed by the Troubleshooter agent and results in
  an observable `.ai` Markdown update.
- The updated Markdown regenerates the intermediate projection and refreshes
  the UI end to end.
- A new engineer can understand current investigation state faster than by
  reading the Markdown alone.

## 15. Current implementation baseline

The Phase 0 build exists and is undergoing UI testing. It includes:

- Local Node/TypeScript server.
- React/TypeScript frontend.
- React Flow mind map with Dagre layout.
- `.ai` watcher and SSE refresh.
- Specialized `00`–`06` parsers.
- Generic `07+` parser.
- GFM action and assumption table parsing.
- Browser-persisted branch and selection state.
- Full-height map and independently scrolling detail pane.
- Left-click drag panning.
- Back navigation.
- Breadcrumb navigation.
- Right-pane selection that highlights and recenters the graph.
- Compact graph spacing.
- Root-node document list.
- Smooth node layout/recenter transitions.
- Safe Markdown rendering.
- Source file/line display and editor navigation.
- Sanitized-fixture validation with no parser diagnostics.

The generated intermediate projection file remains a Phase 0 requirement to
complete or verify.

## 16. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Mind map becomes decorative graph spaghetti | Users cannot identify next action | Compact layout, progressive disclosure, ranked/next-test surface in Phase 1 |
| Markdown conventions evolve | Parsers miss or misclassify content | Parser registry, source diagnostics, generic fallback, regenerable intermediate projection |
| AI-generated confidence appears authoritative | Users over-trust weak reasoning | Prefer weak/moderate/strong labels, explain ranking, show provenance and evidence |
| User messages contain stale claims or contradictions | Incorrect facts enter investigation | Troubleshooter agent preserves fact/hypothesis/assumption separation and asks clarifying questions |
| Browser and agent both write state | Conflicts or lost reasoning | Browser writes only to the input queue; agent alone updates Markdown |
| Sub-agents take minutes | User thinks product is stuck | Active Agents panel, visible status, last output, kill switch |
| Graph library becomes limiting | Expensive rewrite | Library-neutral projection and isolated React Flow integration |
| Product expands into generic incident management | MVP loses focus | Anchor on hypothesis/evidence/assumption/test convergence |

## 17. Delivery phases

### Phase 0 — Visual foundation (built; UI testing)

- Local `.ai` viewer.
- Markdown-only source parsing.
- Generated intermediate projection used by the renderer.
- Semantic parsing.
- Mind map and exact source details.
- Navigation and recentering.
- Live refresh.
- Real-investigation compatibility.
- UI testing and refinement.

### Phase 1 — Investigation cockpit

- The graph remains the default working surface unless testing shows a better
  default.
- Ranked hypothesis surface.
- AI-recommended leading hypothesis and next decisive test.
- Assumption ledger.
- Activity timeline.
- Provenance on all structured items.
- Ongoing conversation with the Troubleshooter agent.
- Browser-to-agent local input queue.
- Agent-owned updates to canonical `.ai` Markdown.
- Active Agents and kill switch.
- Copy-to-Teams status.

## 18. Open decisions

- What should the generated intermediate projection file be named, and which
  fields must its schema contain?
- What local input-queue format and message lifecycle should connect WBMS to
  the Troubleshooter agent?
- How should explicit cross-file relationships be authored and preserved?
- How should confidence be calculated and explained?
- What is the supported editor-navigation contract outside VS Code?
- When should saved layout move from browser storage to a shareable
  `.ai/graph-layout.json`?
- After UI testing, does WBMS need an explicit Reset/Compact layout action?

## 19. MVP acceptance criteria

The current viewer milestone is accepted when:

1. The user can launch a project or `.ai` folder from the CLI.
2. The map fills the browser workspace and remains usable with long detail
   content.
3. All Markdown files in the selected `.ai` folder appear as file nodes.
4. Standard semantic items appear as child nodes.
5. The hypotheses branch opens by default.
6. Users can pan, zoom, drag, expand, collapse, and resize panes.
7. Breadcrumbs, Back, root document list, and right-pane links navigate the
   graph consistently.
8. Right-pane navigation highlights and recenters the selected graph node.
9. Node layout changes animate smoothly.
10. Exact sanitized Markdown and source lines appear for selected items.
11. File changes update the map through SSE.
12. Expanding or collapsing a branch recalculates and fits the visible layout.
13. Parse failures show diagnostics and preserve the last valid graph.
14. The sanitized fixture investigation loads without parser diagnostics.
15. A generated intermediate projection file is used as the renderer input and
    can be regenerated from canonical Markdown.
16. Build and tests pass, and dependency audit reports no known high or
    critical vulnerabilities.
17. UI testing covers the full navigation and selection workflow before Phase
    0 is considered accepted.
