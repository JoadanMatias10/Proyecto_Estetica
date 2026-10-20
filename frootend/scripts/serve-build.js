const fs = require("fs");
const http = require("http");
const path = require("path");

const BUILD_DIRECTORY = path.resolve(__dirname, "..", "build");
const HOST = process.env.PWA_HOST || "127.0.0.1";
const PORT = Number(process.env.PWA_PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isInsideBuild(filePath) {
  return filePath === BUILD_DIRECTORY || filePath.startsWith(`${BUILD_DIRECTORY}${path.sep}`);
}

function resolveRequestFile(request) {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const relativePath = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "");
  const requestedPath = path.resolve(BUILD_DIRECTORY, relativePath);
  if (!isInsideBuild(requestedPath)) return null;

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isDirectory()) {
    const directoryIndex = path.join(requestedPath, "index.html");
    if (fs.existsSync(directoryIndex)) return directoryIndex;
  }

  const acceptsHtml = String(request.headers.accept || "").includes("text/html");
  if (acceptsHtml && !path.extname(requestedPath)) {
    return path.join(BUILD_DIRECTORY, "index.html");
  }

  return null;
}

if (!fs.existsSync(path.join(BUILD_DIRECTORY, "index.html"))) {
  console.error("No existe frootend/build. Ejecuta npm run build antes de servir la PWA.");
  process.exit(1);
}

const server = http.createServer((request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let filePath;
  try {
    filePath = resolveRequestFile(request);
  } catch (_error) {
    response.writeHead(400);
    response.end("Solicitud inválida.");
    return;
  }

  if (!filePath) {
    response.writeHead(404);
    response.end("Recurso no encontrado.");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const headers = {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  };

  if (fileName === "service-worker.js" || fileName === "index.html") {
    headers["Cache-Control"] = "no-cache";
  } else if (filePath.includes(`${path.sep}static${path.sep}`)) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }

  if (fileName === "service-worker.js") {
    headers["Service-Worker-Allowed"] = "/";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(`PWA disponible en http://${HOST}:${PORT}`);
});
