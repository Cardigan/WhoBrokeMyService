---
name: WhoBrokeMyService
description: >
  Build and start the Who Broke My Service interactive mind-map visualization
  for a troubleshooting project's .ai investigation.
user-invocable: true
disable-model-invocation: true
argument-hint: "[project-or-.ai-path] [--port <port>]"
---

## Overview

This skill builds and starts the local Who Broke My Service (WBMS) viewer for a
troubleshooting project's Markdown-backed `.ai` investigation.

The viewer:

- Reads the selected project's `.ai/*.md` files.
- Builds an in-memory investigation model and mind-map projection.
- Serves the interactive visualization on `127.0.0.1`.
- Watches the source Markdown and refreshes the visualization when it changes.
- Never copies investigation data into the TroubleshooterAgent repository.

## Invocation

```text
/WhoBrokeMyService
/WhoBrokeMyService C:\path\to\project
/WhoBrokeMyService C:\path\to\project\.ai --port 4174
```

Use the supplied project or `.ai` path. If no path was supplied, use the current
working directory when it contains `.ai` or is itself an `.ai` directory.
Otherwise, ask the user for the investigation path.

## Steps

1. Resolve the project or `.ai` path without copying or modifying its contents.
2. Locate `start-wbms.ps1` beside this `SKILL.md`.
3. Run the script as an attached background process so the server remains
   available during the current Copilot CLI session.
4. Pass the investigation path with `-ProjectPath`.
5. Pass `-Port` only when the user supplied a port; otherwise use `4173`.
6. Allow the script to install dependencies when needed and build WBMS.
7. Verify `http://127.0.0.1:<port>/api/health` after startup.
8. Report the viewer URL and the exact watched `.ai` path.

Do not detach the server, copy `.ai` data, add investigation files to Git, or
silently stop another process already using the requested port.
