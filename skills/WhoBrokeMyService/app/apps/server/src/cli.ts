import { openBrowser, startMindMapServer } from "./server.js";

function usage(): string {
  return "Usage: ai-mind-map <project-or-.ai-path> [--port <port>] [--no-open]";
}

function parseArguments(args: string[]): { path: string; port: number; open: boolean } {
  let path: string | undefined;
  let port = 4173;
  let open = true;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--no-open") {
      open = false;
    } else if (argument === "--port") {
      const candidate = Number(args[index + 1]);
      if (!Number.isInteger(candidate) || candidate < 0 || candidate > 65535) {
        throw new Error("--port must be an integer from 0 through 65535.");
      }
      port = candidate;
      index += 1;
    } else if (!path && !argument.startsWith("-")) {
      path = argument;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!path) throw new Error(usage());
  return { path, port, open };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const server = await startMindMapServer({
    path: options.path,
    port: options.port,
    editorUrlTemplate: process.env.MIND_MAP_EDITOR_URL_TEMPLATE
  });
  console.log(`.ai mind map server listening at ${server.url}`);
  if (options.open) openBrowser(server.url);
  process.once("SIGINT", () => void server.close().then(() => process.exit(0)));
  process.once("SIGTERM", () => void server.close().then(() => process.exit(0)));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
