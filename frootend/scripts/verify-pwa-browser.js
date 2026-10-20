const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const APP_ORIGIN = process.env.PWA_VERIFY_ORIGIN || "http://127.0.0.1:4173";
const EXPECTED_VERSION = process.env.PWA_VERIFY_VERSION || "faa6bde670e8d00d";
const CHROME_PATH = process.env.CHROME_PATH
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROUTES = [
  "/",
  "/productos",
  "/servicios",
  "/promociones",
  "/contactos",
  "/quienes-somos",
  "/mision-vision-valores",
  "/redes-sociales",
  "/politica-privacidad",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function pollJson(url, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await wait(125);
  }
  throw lastError || new Error(`No respondió ${url}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(JSON.parse(event.data)));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  handleMessage(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }

    for (const listener of this.listeners.get(message.method) || []) {
      listener(message.params || {});
    }
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        dispose();
        reject(new Error(`Tiempo agotado esperando ${method}`));
      }, timeoutMs);
      const dispose = this.on(method, (params) => {
        clearTimeout(timer);
        dispose();
        resolve(params);
      });
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || "Falló Runtime.evaluate");
  }
  return result.result.value;
}

async function waitForValue(client, expression, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  do {
    value = await evaluate(client, expression);
    if (value) return value;
    await wait(100);
  } while (Date.now() < deadline);
  return value;
}

async function navigate(client, url) {
  const loaded = client.once("Page.loadEventFired");
  const result = await client.send("Page.navigate", { url });
  assert(!result.errorText, `No se pudo navegar a ${url}: ${result.errorText}`);
  await loaded;
  await wait(150);
}

async function setOffline(client, offline) {
  await client.send("Network.emulateNetworkConditions", {
    offline,
    latency: 0,
    downloadThroughput: offline ? 0 : -1,
    uploadThroughput: offline ? 0 : -1,
    connectionType: offline ? "none" : "wifi",
  });
  await wait(300);
}

async function main() {
  assert(fs.existsSync(CHROME_PATH), `No se encontró Chrome en ${CHROME_PATH}`);
  const serverResponse = await fetch(APP_ORIGIN);
  assert(serverResponse.ok, `La PWA no está disponible en ${APP_ORIGIN}`);

  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "estetica-pwa-verify-"));
  const debuggingPort = await getFreePort();
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--disable-breakpad",
    "--disable-crash-reporter",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let client;
  try {
    const targets = await pollJson(`http://127.0.0.1:${debuggingPort}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page");
    assert(pageTarget?.webSocketDebuggerUrl, "Chrome no publicó una página CDP.");
    client = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);

    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
    ]);

    await navigate(client, `${APP_ORIGIN}/`);
    await evaluate(client, "navigator.serviceWorker.ready.then(() => true)");
    await wait(700);
    await navigate(client, `${APP_ORIGIN}/`);
    assert(await evaluate(client, "Boolean(navigator.serviceWorker.controller)"), "La página no quedó controlada por el Service Worker.");

    const cacheSnapshot = await evaluate(client, `(async () => {
      const result = {};
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        result[name] = (await cache.keys()).map((request) => new URL(request.url).pathname);
      }
      return result;
    })()`);

    const expectedNames = {
      documentos: `estetica-pwa-documentos-${EXPECTED_VERSION}`,
      pantallas: `estetica-pwa-pantallas-${EXPECTED_VERSION}`,
      recursos: `estetica-pwa-recursos-${EXPECTED_VERSION}`,
      imagenes: `estetica-pwa-imagenes-${EXPECTED_VERSION}`,
      api: `estetica-pwa-api-publica-${EXPECTED_VERSION}`,
    };
    for (const cacheName of Object.values(expectedNames)) {
      assert(cacheSnapshot[cacheName], `No existe el caché ${cacheName}`);
    }
    assert(cacheSnapshot[expectedNames.documentos].includes("/manifest.json"), "manifest.json no está en documentos.");
    assert(cacheSnapshot[expectedNames.documentos].includes("/service-worker.js"), "service-worker.js no está en documentos.");
    for (const route of ROUTES) {
      assert(cacheSnapshot[expectedNames.pantallas].includes(route), `Falta ${route} en pantallas.`);
    }

    const requests = new Map();
    const documentResponses = new Map();
    const coreFailures = [];
    client.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
      requests.set(requestId, { url: request.url, type });
    });
    client.on("Network.responseReceived", ({ response, type }) => {
      if (type === "Document") {
        documentResponses.set(new URL(response.url).pathname, {
          status: response.status,
          fromServiceWorker: response.fromServiceWorker,
        });
      }
    });
    client.on("Network.loadingFailed", ({ requestId, errorText }) => {
      const request = requests.get(requestId);
      if (request?.url?.startsWith(APP_ORIGIN)) coreFailures.push({ ...request, errorText });
    });

    await setOffline(client, true);
    const routeResults = {};
    for (const route of ROUTES) {
      await navigate(client, `${APP_ORIGIN}${route}`);
      routeResults[route] = documentResponses.get(route);
      assert(routeResults[route]?.status === 200, `${route} no respondió 200 offline.`);
      assert(routeResults[route]?.fromServiceWorker === true, `${route} no vino del Service Worker.`);
      assert(await evaluate(client, "document.body.innerText.includes('Sin conexión a Internet.')"), `Falta el aviso offline en ${route}.`);
    }

    const offlineDocuments = await evaluate(client, `(async () => Promise.all(
      ["/manifest.json", "/service-worker.js"].map(async (url) => {
        const response = await fetch(url);
        return { url, status: response.status };
      })
    ))()`);
    offlineDocuments.forEach(({ url, status }) => assert(status === 200, `${url} no respondió 200 offline.`));

    await navigate(client, `${APP_ORIGIN}/contactos`);
    await waitForValue(
      client,
      "document.body.innerText.includes('Mapa no disponible sin conexión')"
    );
    const contactOffline = await evaluate(client, `({
      hasMapFrame: Boolean(document.querySelector('iframe[src*="google.com/maps"]')),
      hasPlaceholder: document.body.innerText.includes("Mapa no disponible sin conexión")
    })`);
    assert(!contactOffline.hasMapFrame, "Contactos montó Google Maps offline.");
    assert(contactOffline.hasPlaceholder, "Contactos no mostró el respaldo offline del mapa.");

    await setOffline(client, false);
    const reconnectedNotice = await waitForValue(
      client,
      "document.body.innerText.includes('Conexión a Internet restablecida.')"
    );
    assert(reconnectedNotice, "No apareció el aviso de conexión restablecida.");
    assert(coreFailures.length === 0, `Hubo fallos propios offline: ${JSON.stringify(coreFailures)}`);

    const manifest = await client.send("Page.getAppManifest");
    assert((manifest.errors || []).length === 0, `El manifiesto tiene errores: ${JSON.stringify(manifest.errors)}`);

    console.log(JSON.stringify({
      ok: true,
      version: EXPECTED_VERSION,
      caches: Object.fromEntries(Object.entries(cacheSnapshot).map(([name, entries]) => [name, entries.length])),
      routes: routeResults,
      offlineDocuments,
      offlineNotice: true,
      reconnectedNotice,
      contactOffline,
      coreFailures,
      manifestErrors: manifest.errors || [],
    }, null, 2));
  } finally {
    client?.close();
    chrome.kill();
    await wait(500);
    fs.rmSync(profileDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
