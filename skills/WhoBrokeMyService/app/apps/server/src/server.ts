import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { realpath, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import chokidar, { type FSWatcher } from "chokidar";
import type { EntityDetail, InvestigationModel, MindMapProjection } from "@ai-mind-map/contracts";
import { getEntityDetail, loadInvestigationModel } from "@ai-mind-map/markdown-model";
import { projectMindMap } from "@ai-mind-map/mind-map-projection";

const LOOPBACK_HOST = "127.0.0.1";
const MAX_REQUEST_BODY_BYTES = 32 * 1024;

export interface InvestigationLocation {
  projectRoot: string;
  aiDirectory: string;
}

export interface MindMapServerOptions {
  path: string;
  port?: number;
  webDistPath?: string;
  editorUrlTemplate?: string;
}

export interface RunningMindMapServer {
  url: string;
  readonly location: InvestigationLocation;
  close(): Promise<void>;
  rebuild(): Promise<boolean>;
}

interface Snapshot {
  investigation: InvestigationModel;
  mindMap: MindMapProjection;
}

export async function resolveInvestigationLocation(inputPath: string): Promise<InvestigationLocation> {
  const selectedPath = await realpath(resolve(inputPath));
  const selectedStat = await stat(selectedPath);
  if (!selectedStat.isDirectory()) {
    throw new Error(`Investigation path must be a directory: ${inputPath}`);
  }

  const aiDirectory = basename(selectedPath).toLowerCase() === ".ai"
    ? selectedPath
    : await realpath(resolve(selectedPath, ".ai"));
  const aiStat = await stat(aiDirectory);
  if (!aiStat.isDirectory()) {
    throw new Error(`Expected a .ai directory below: ${selectedPath}`);
  }

  return {
    projectRoot: basename(selectedPath).toLowerCase() === ".ai" ? resolve(selectedPath, "..") : selectedPath,
    aiDirectory
  };
}

export async function startMindMapServer(options: MindMapServerOptions): Promise<RunningMindMapServer> {
  let location = await resolveInvestigationLocation(options.path);
  let snapshot = await createSnapshot(location.aiDirectory);
  const clients = new Set<ServerResponse>();
  const webDistPath = options.webDistPath ?? resolve(process.cwd(), "apps", "web", "dist");
  let rebuildTimer: NodeJS.Timeout | undefined;
  let watcher: FSWatcher;

  const publish = (event: "revision" | "diagnostics") => {
    const payload = JSON.stringify({
      revision: snapshot.investigation.revision,
      diagnostics: snapshot.investigation.diagnostics
    });
    for (const client of clients) {
      client.write(`event: ${event}\ndata: ${payload}\n\n`);
    }
  };

  const rebuild = async (): Promise<boolean> => {
    try {
      const nextSnapshot = await createSnapshot(location.aiDirectory);
      const parseErrors = nextSnapshot.investigation.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error"
      );
      if (parseErrors.length > 0) {
        snapshot = {
          ...snapshot,
          investigation: {
            ...snapshot.investigation,
            diagnostics: nextSnapshot.investigation.diagnostics
          }
        };
        publish("diagnostics");
        return false;
      }
      snapshot = nextSnapshot;
      publish("revision");
      return true;
    } catch (error) {
      snapshot = {
        ...snapshot,
        investigation: {
          ...snapshot.investigation,
          diagnostics: [
            ...snapshot.investigation.diagnostics,
            {
              severity: "error",
              code: "snapshot-rebuild-failed",
              message: `Could not rebuild the investigation snapshot: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        }
      };
      publish("diagnostics");
      return false;
    }
  };

  const attachWatcher = (aiDirectory: string): FSWatcher => {
    const nextWatcher = chokidar.watch(aiDirectory, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 25
      }
    });
    nextWatcher.on("all", (_event, changedPath) => {
      if (!/\.md$/i.test(changedPath)) return;
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        rebuildTimer = undefined;
        void rebuild();
      }, 200);
    });
    return nextWatcher;
  };

  watcher = attachWatcher(location.aiDirectory);

  const switchSource = async (inputPath: string): Promise<InvestigationLocation> => {
    const nextLocation = await resolveInvestigationLocation(inputPath);
    const nextSnapshot = await createSnapshot(nextLocation.aiDirectory);
    const previousWatcher = watcher;
    location = nextLocation;
    snapshot = nextSnapshot;
    watcher = attachWatcher(location.aiDirectory);
    await previousWatcher.close();
    publish("revision");
    return location;
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response, {
      getSnapshot: () => snapshot,
      getLocation: () => location,
      switchSource,
      clients,
      webDistPath,
      editorUrlTemplate: options.editorUrlTemplate
    });
  });

  await listen(server, options.port ?? 4173);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 4173;

  return {
    url: `http://${LOOPBACK_HOST}:${port}`,
    get location() {
      return location;
    },
    rebuild,
    close: async () => {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      for (const client of clients) client.end();
      await watcher.close();
      await closeServer(server);
    }
  };
}

async function createSnapshot(aiDirectory: string): Promise<Snapshot> {
  const investigation = await loadInvestigationModel(aiDirectory);
  return {
    investigation,
    mindMap: projectMindMap(investigation)
  };
}

interface RequestContext {
  getSnapshot(): Snapshot;
  getLocation(): InvestigationLocation;
  switchSource(inputPath: string): Promise<InvestigationLocation>;
  clients: Set<ServerResponse>;
  webDistPath: string;
  editorUrlTemplate?: string;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, context: RequestContext): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);
  const pathname = requestUrl.pathname;
  const snapshot = context.getSnapshot();
  const location = context.getLocation();

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      host: LOOPBACK_HOST,
      watchedPath: location.aiDirectory,
      projectRoot: location.projectRoot,
      revision: snapshot.investigation.revision,
      diagnostics: snapshot.investigation.diagnostics
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/investigation") {
    sendJson(response, 200, snapshot.investigation);
    return;
  }

  if (request.method === "GET" && pathname === "/api/mind-map") {
    sendJson(response, 200, snapshot.mindMap);
    return;
  }

  if (request.method === "GET" && pathname === "/api/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    response.write("retry: 1000\n");
    response.write(`event: revision\ndata: ${JSON.stringify({
      revision: snapshot.investigation.revision,
      diagnostics: snapshot.investigation.diagnostics
    })}\n\n`);
    context.clients.add(response);
    request.on("close", () => context.clients.delete(response));
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/entities/")) {
    let entityId: string;
    try {
      entityId = decodeURIComponent(pathname.slice("/api/entities/".length));
    } catch {
      sendJson(response, 400, { error: "Invalid entity ID encoding." });
      return;
    }
    const detail = getEntityDetail(snapshot.investigation, entityId);
    if (!detail) {
      sendJson(response, 404, { error: "Unknown entity ID." });
      return;
    }
    sendJson(response, 200, detail);
    return;
  }

  if (request.method === "POST" && pathname === "/api/open-editor") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request body."
      });
      return;
    }
    const entityId = typeof body.entityId === "string" ? body.entityId : "";
    const detail = getEntityDetail(snapshot.investigation, entityId);
    if (!detail?.source) {
      sendJson(response, 404, { error: "Entity has no source range." });
      return;
    }
    sendJson(response, 200, editorTarget(detail, location.aiDirectory, context.editorUrlTemplate));
    return;
  }

  if (request.method === "POST" && pathname === "/api/select-folder") {
    let initialPath: string | undefined;
    try {
      const body = await readJsonBody(request);
      initialPath = typeof body.initialPath === "string" && body.initialPath.trim().length > 0
        ? body.initialPath.trim()
        : undefined;
    } catch {
      initialPath = undefined;
    }
    try {
      const selectedPath = await pickFolderDialog(initialPath);
      sendJson(response, 200, { path: selectedPath ?? null, cancelled: !selectedPath });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Could not open the folder picker."
      });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/load-source") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request body."
      });
      return;
    }
    const inputPath = typeof body.path === "string" ? body.path.trim() : "";
    if (!inputPath) {
      sendJson(response, 400, { error: "A folder path is required." });
      return;
    }
    try {
      const nextLocation = await context.switchSource(inputPath);
      sendJson(response, 200, { location: nextLocation });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Could not load the selected folder."
      });
    }
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Unknown API endpoint." });
    return;
  }

  await serveFrontend(response, pathname, context.webDistPath);
}

function editorTarget(detail: EntityDetail, aiDirectory: string, editorUrlTemplate?: string): object {
  if (!detail.source) throw new Error("An editor target requires a source range.");
  const sourcePath = resolve(aiDirectory, detail.source.relativePath);
  if (!isWithinDirectory(aiDirectory, sourcePath)) {
    throw new Error("Entity source escaped the selected investigation directory.");
  }
  const response: {
    path: string;
    line: number;
    url?: string;
  } = {
    path: detail.source.relativePath,
    line: detail.source.startLine
  };

  if (editorUrlTemplate?.includes("{path}") && editorUrlTemplate.includes("{line}")) {
    response.url = editorUrlTemplate
      .replaceAll("{path}", encodeURIComponent(sourcePath.replace(/\\/g, "/")))
      .replaceAll("{line}", String(detail.source.startLine));
  }
  return response;
}

function isWithinDirectory(directory: string, candidate: string): boolean {
  const relation = relative(directory, candidate);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}

async function serveFrontend(response: ServerResponse, pathname: string, webDistPath: string): Promise<void> {
  if (!existsSync(webDistPath)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>.ai Mind Map Server</title><p>Server is running. Build apps/web to serve the viewer.</p>");
    return;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL encoding." });
    return;
  }
  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\//, "");
  const candidate = resolve(webDistPath, requestedPath);
  const assetPath = isWithinDirectory(webDistPath, candidate) && existsSync(candidate)
    ? candidate
    : resolve(webDistPath, "index.html");
  if (!existsSync(assetPath)) {
    sendJson(response, 404, { error: "Frontend bundle has no index.html." });
    return;
  }
  response.writeHead(200, { "content-type": contentType(assetPath) });
  createReadStream(assetPath).pipe(response);
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_REQUEST_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Request body must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid JSON request body: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

export function openBrowser(url: string): void {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function runCapture(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      windowsHide: false,
      env: env ? { ...process.env, ...env } : undefined,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function pickFolderDialogWindows(initialPath?: string): Promise<string | undefined> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.ShowInTaskbar = $false",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.Size = New-Object System.Drawing.Size(0, 0)",
    "$owner.Show()",
    "$owner.Activate()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select a project folder containing a .ai directory'",
    "$dialog.ShowNewFolderButton = $false",
    "if ($env:INITIAL_FOLDER -and (Test-Path -LiteralPath $env:INITIAL_FOLDER)) { $dialog.SelectedPath = $env:INITIAL_FOLDER }",
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Close()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ].join("; ");

  const env = initialPath ? { INITIAL_FOLDER: initialPath } : undefined;
  const { code, stdout, stderr } = await runCapture(
    "powershell.exe",
    ["-NoProfile", "-STA", "-Command", script],
    env,
  );
  if (code !== 0 && stderr.trim()) {
    throw new Error(stderr.trim());
  }
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function pickFolderDialogMac(initialPath?: string): Promise<string | undefined> {
  const script = initialPath
    ? `POSIX path of (choose folder with prompt "Select a project folder containing a .ai directory" default location (POSIX file "${initialPath}"))`
    : 'POSIX path of (choose folder with prompt "Select a project folder containing a .ai directory")';
  const { code, stdout, stderr } = await runCapture("osascript", ["-e", script]);
  if (code !== 0) {
    if (stderr.includes("User canceled")) return undefined;
    throw new Error(stderr.trim() || "Could not open the folder picker.");
  }
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function pickFolderDialogLinux(initialPath?: string): Promise<string | undefined> {
  try {
    const args = [
      "--file-selection",
      "--directory",
      "--title=Select a project folder containing a .ai directory"
    ];
    if (initialPath) {
      args.push(`--filename=${initialPath.endsWith("/") ? initialPath : `${initialPath}/`}`);
    }
    const { code, stdout } = await runCapture("zenity", args);
    if (code === 1) return undefined;
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    throw new Error("Could not find a native folder picker (zenity). Type the path manually instead.");
  }
}

async function pickFolderDialog(initialPath?: string): Promise<string | undefined> {
  if (process.platform === "win32") return pickFolderDialogWindows(initialPath);
  if (process.platform === "darwin") return pickFolderDialogMac(initialPath);
  return pickFolderDialogLinux(initialPath);
}