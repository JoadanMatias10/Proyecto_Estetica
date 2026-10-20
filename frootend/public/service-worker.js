/* global self, caches, fetch, Response, Request, Headers, AbortController */

// El build reemplaza este marcador por una huella de los assets publicados.
const CACHE_VERSION = "BUILD_VERSION";

// Los nombres describen lo que el profesor debe poder inspeccionar en
// DevTools > Application > Cache Storage.
const DOCUMENT_CACHE_NAME = `estetica-pwa-documentos-${CACHE_VERSION}`;
const PAGE_CACHE_NAME = `estetica-pwa-pantallas-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `estetica-pwa-recursos-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `estetica-pwa-imagenes-${CACHE_VERSION}`;
const PUBLIC_API_CACHE_NAME = `estetica-pwa-api-publica-${CACHE_VERSION}`;
const CACHE_PREFIX = "estetica-";

const API_TIMEOUT_MS = 4500;
const PUBLIC_API_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const IMAGE_MAX_ENTRIES = 60;

// Archivos propios de la PWA. Se guardan de forma explícita para que sigan
// disponibles sin conexión y sean visibles individualmente en Cache Storage.
const PWA_DOCUMENT_URLS = [
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/service-worker.js",
  "/asset-manifest.json",
];

// Cada ruta se registra como una entrada independiente aunque todas usen el
// mismo app shell de React. Así se pueden demostrar las pantallas precargadas.
const PUBLIC_PAGE_URLS = [
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

const ESSENTIAL_IMAGE_URLS = [
  "/favicon.ico",
  "/logo-panamericana-white-favicon.png",
  "/logo-panamericana-white-192.png",
  "/logo-panamericana-white-512.png",
];

const CURRENT_CACHES = new Set([
  DOCUMENT_CACHE_NAME,
  PAGE_CACHE_NAME,
  STATIC_CACHE_NAME,
  IMAGE_CACHE_NAME,
  PUBLIC_API_CACHE_NAME,
]);

const PWA_DOCUMENT_PATHS = new Set(PWA_DOCUMENT_URLS);
const PUBLIC_PAGE_PATHS = new Set(PUBLIC_PAGE_URLS);
const ESSENTIAL_IMAGE_PATHS = new Set(ESSENTIAL_IMAGE_URLS);
const PUBLIC_API_PATH = /^\/api\/public\/(?:bootstrap|company-info|product-categories|product-brands|products(?:\/[^/]+)?|service-categories|services(?:\/[^/]+)?|promotions|home-highlights|carousel)\/?$/;
const PUBLIC_OFFLINE_PATH = /^\/(?:$|productos(?:\/[^/]+)?\/?$|servicios(?:\/[^/]+)?\/?$|promociones\/?$|contactos\/?$|quienes-somos\/?$|mision-vision-valores\/?$|redes-sociales\/?$|politica-privacidad\/?$)/;
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

function uniqueSameOriginUrls(values) {
  const urls = new Set();

  for (const value of values) {
    if (!value || typeof value !== "string" || value.endsWith(".map")) continue;
    const url = new URL(value, self.location.origin);
    if (url.origin === self.location.origin) {
      urls.add(`${url.pathname}${url.search}`);
    }
  }

  return Array.from(urls);
}

async function readBuildAssets() {
  const response = await fetch("/asset-manifest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No fue posible leer asset-manifest.json (${response.status}).`);
  }

  const manifest = await response.json();
  return uniqueSameOriginUrls([
    ...Object.values(manifest.files || {}),
    ...(Array.isArray(manifest.entrypoints) ? manifest.entrypoints : []),
  ]).filter((url) => !PWA_DOCUMENT_PATHS.has(new URL(url, self.location.origin).pathname));
}

function copyResponseForPage(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Estetica-Precached-Page", pathname);
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function precachePublicPages(pageCache, documentCache) {
  const appShell = await documentCache.match("/index.html");
  if (!appShell) throw new Error("index.html no quedó disponible para precargar las pantallas.");

  await Promise.all(
    PUBLIC_PAGE_URLS.map((pathname) => pageCache.put(
      new Request(pathname),
      copyResponseForPage(appShell, pathname)
    ))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const buildAssets = await readBuildAssets();
    const buildImages = buildAssets.filter((url) => IMAGE_EXTENSION.test(new URL(url, self.location.origin).pathname));
    const buildResources = buildAssets.filter((url) => !IMAGE_EXTENSION.test(new URL(url, self.location.origin).pathname));

    const [documentCache, pageCache, staticCache, imageCache] = await Promise.all([
      caches.open(DOCUMENT_CACHE_NAME),
      caches.open(PAGE_CACHE_NAME),
      caches.open(STATIC_CACHE_NAME),
      caches.open(IMAGE_CACHE_NAME),
    ]);

    // Se crea desde la instalación para que también sea visible antes de la
    // primera consulta a la API. Sus respuestas siguen siendo network-first.
    await caches.open(PUBLIC_API_CACHE_NAME);

    await Promise.all([
      documentCache.addAll(PWA_DOCUMENT_URLS),
      staticCache.addAll(uniqueSameOriginUrls(buildResources)),
      imageCache.addAll(uniqueSameOriginUrls([...ESSENTIAL_IMAGE_URLS, ...buildImages])),
    ]);

    await precachePublicPages(pageCache, documentCache);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isPublicApiRequest(request, url) {
  if (request.method !== "GET") return false;
  if (request.headers.has("Authorization")) return false;
  return PUBLIC_API_PATH.test(url.pathname);
}

function isCacheablePublicResponse(response) {
  if (!response || response.status !== 200 || response.type === "opaque") return false;
  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/(?:no-store|private)/i.test(cacheControl) && !response.headers.has("Set-Cookie");
}

function isPublicImageRequest(request, url) {
  if (request.headers.has("Authorization")) return false;

  if (url.origin === self.location.origin) {
    return url.pathname.startsWith("/static/") || ESSENTIAL_IMAGE_PATHS.has(url.pathname);
  }

  return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
}

function isCacheableImageResponse(response) {
  // Una respuesta no-cors de Cloudinary es opaque; su dominio ya fue validado
  // antes de llegar aquí y no incluye credenciales de la aplicación.
  if (response?.type === "opaque") return true;
  if (!response?.ok) return false;

  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/(?:no-store|private)/i.test(cacheControl) && !response.headers.has("Set-Cookie");
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function withCachedTimestamp(response) {
  if (!response || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("X-Estetica-Cached-At", String(Date.now()));
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getFreshCachedResponse(cache, request, maxAgeMs) {
  const response = await cache.match(request, { ignoreSearch: true });
  if (!response) return null;

  const cachedAt = Number(response.headers.get("X-Estetica-Cached-At"));
  if (cachedAt && Date.now() - cachedAt > maxAgeMs) {
    await cache.delete(request, { ignoreSearch: true });
    return null;
  }

  return response;
}

function markAsOfflineFallback(response) {
  if (!response || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("X-Estetica-Offline-Fallback", "true");
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function markAsImageFallback(response) {
  if (!response || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("X-Estetica-Image-Fallback", "true");
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function networkFirstPublicApi(request) {
  const cache = await caches.open(PUBLIC_API_CACHE_NAME);

  // DevTools marca cada fetch interno como otra solicitud fallida cuando su
  // selector de red está en Offline. En ese estado conocido se omite ese fetch
  // redundante, pero con conexión la estrategia continúa siendo network-first.
  if (self.navigator?.onLine === false) {
    const cached = await getFreshCachedResponse(cache, request, PUBLIC_API_MAX_AGE_MS);
    if (cached) return markAsOfflineFallback(cached);
    throw new Error("Sin conexión y sin una respuesta pública guardada.");
  }

  try {
    const response = await fetchWithTimeout(request, API_TIMEOUT_MS);
    if (isCacheablePublicResponse(response)) {
      await cache.put(request, withCachedTimestamp(response.clone()));
    }
    return response;
  } catch (error) {
    const cached = await getFreshCachedResponse(cache, request, PUBLIC_API_MAX_AGE_MS);
    if (cached) return markAsOfflineFallback(cached);
    throw error;
  }
}

function normalizePublicPath(pathname) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function isSupportedPublicPath(pathname) {
  return PUBLIC_OFFLINE_PATH.test(pathname);
}

async function handleNavigation(request, url) {
  const pathname = normalizePublicPath(url.pathname);

  // El HTML de una SPA es el mismo para estas rutas. Servir primero la entrada
  // explícita de "pantallas" evita una solicitud roja innecesaria al navegar
  // con DevTools en modo Offline.
  if (isSupportedPublicPath(pathname)) {
    const pageCache = await caches.open(PAGE_CACHE_NAME);
    const exactPage = PUBLIC_PAGE_PATHS.has(pathname)
      ? await pageCache.match(pathname)
      : null;
    if (exactPage) return exactPage;

    const appShell = await caches.match("/index.html");
    if (appShell) return appShell;
  }

  try {
    return await fetch(request);
  } catch (_error) {
    return caches.match("/offline.html") || Response.error();
  }
}

async function cacheFirstDocument(request) {
  const cache = await caches.open(DOCUMENT_CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

function isPinnedImageRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin
    && (url.pathname.startsWith("/static/") || ESSENTIAL_IMAGE_PATHS.has(url.pathname));
}

async function trimImageCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;

  // Los iconos del manifiesto, el logotipo de respaldo y las imágenes del
  // build no se expulsan. Solo se rotan imágenes remotas vistas por el usuario.
  const removableKeys = keys.filter((key) => !isPinnedImageRequest(key));
  await Promise.all(removableKeys.slice(0, excess).map((key) => cache.delete(key)));
}

async function updateImageCache(cache, request) {
  const response = await fetch(request);
  if (isCacheableImageResponse(response)) {
    await cache.put(request, withCachedTimestamp(response.clone()));
    await trimImageCache(cache, IMAGE_MAX_ENTRIES);
  }
  return response;
}

async function staleWhileRevalidateImage(event) {
  const { request } = event;
  const cache = await caches.open(IMAGE_CACHE_NAME);

  // Sin conexión se usa exclusivamente Cache Storage: no se genera un segundo
  // fetch rojo para una imagen que ya está disponible localmente.
  if (self.navigator?.onLine === false) {
    const offlineImage = await cache.match(request, { ignoreSearch: true });
    if (offlineImage) return offlineImage;

    const fallbackImage = await cache.match("/logo-panamericana-white-512.png");
    return fallbackImage ? markAsImageFallback(fallbackImage) : Response.error();
  }

  const cached = await getFreshCachedResponse(cache, request, IMAGE_MAX_AGE_MS);
  const updatePromise = updateImageCache(cache, request);

  if (cached) {
    event.waitUntil(updatePromise.catch(() => undefined));
    return cached;
  }

  return updatePromise;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isPublicApiRequest(request, url)) {
    event.respondWith(networkFirstPublicApi(request));
    return;
  }

  if (url.origin === self.location.origin && PWA_DOCUMENT_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirstDocument(request));
    return;
  }

  // Se evalúan antes que /static/ para que las imágenes nuevas también se
  // escriban en el caché "imagenes" y no terminen mezcladas con JS/CSS.
  if (request.destination === "image" && isPublicImageRequest(request, url)) {
    event.respondWith(staleWhileRevalidateImage(event));
    return;
  }

  if (
    url.origin === self.location.origin
    && (url.pathname.startsWith("/static/") || ["script", "style", "font", "worker"].includes(request.destination))
  ) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
});
