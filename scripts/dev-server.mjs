import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const cliOptions = parseCliOptions(process.argv.slice(2));
const host = cliOptions.host || process.env.HOST || "0.0.0.0";
const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
const requestedPortValue = cliOptions.port || process.env.PORT;
const requestedPort = parsePort(requestedPortValue, 5500);
const allowPortFallback = !requestedPortValue;
const maxPort = allowPortFallback ? requestedPort + 99 : requestedPort;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"]
]);

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const filePath = resolveStaticPath(requestUrl.pathname);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      sendStatus(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": fileStat.size,
      "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      sendStatus(response, 404, "Not found");
      return;
    }

    console.error(`[dev-server] ${error.stack || error.message}`);
    sendStatus(response, 500, "Internal server error");
  }
});

server.on("clientError", (_, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

const port = await listenWithFallback(server, requestedPort, maxPort);
console.log(`[dev-server] Serving ${rootDir}`);
console.log(`[dev-server] Local: http://${displayHost}:${port}/`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

function parsePort(value, fallback) {
  const port = Number.parseInt(value ?? "", 10);
  if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  return fallback;
}

function parseCliOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--host" || arg === "-H") {
      options.host = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--host=")) {
      options.host = arg.slice("--host=".length);
      continue;
    }

    if (arg === "--port" || arg === "-p") {
      options.port = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      options.port = arg.slice("--port=".length);
    }
  }

  return options;
}

function resolveStaticPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relativePath);

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
    throw Object.assign(new Error("Path traversal is not allowed"), { code: "ENOENT" });
  }

  return filePath;
}

function sendStatus(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(`${message}\n`);
}

function listenWithFallback(serverInstance, startPort, endPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      serverInstance.once("error", (error) => {
        if (error.code === "EADDRINUSE" && port < endPort) {
          tryPort(port + 1);
          return;
        }

        reject(error);
      });

      serverInstance.listen(port, host, () => resolve(port));
    };

    tryPort(startPort);
  });
}
