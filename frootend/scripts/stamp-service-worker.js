const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const buildDirectory = path.resolve(__dirname, "..", "build");
const manifestPath = path.join(buildDirectory, "asset-manifest.json");
const serviceWorkerPath = path.join(buildDirectory, "service-worker.js");
const versionMarker = 'const CACHE_VERSION = "BUILD_VERSION";';
const versionedPublicFiles = [
  "index.html",
  "manifest.json",
  "offline.html",
  "favicon.ico",
  "logo-panamericana-white-favicon.png",
  "logo-panamericana-white-192.png",
  "logo-panamericana-white-512.png",
];

if (!fs.existsSync(manifestPath) || !fs.existsSync(serviceWorkerPath)) {
  console.error("No se encontraron los archivos de producción necesarios para versionar la PWA.");
  process.exit(1);
}

const manifestContent = fs.readFileSync(manifestPath, "utf8");
const serviceWorkerContent = fs.readFileSync(serviceWorkerPath, "utf8");

if (!serviceWorkerContent.includes(versionMarker)) {
  console.error("No se encontró el marcador BUILD_VERSION en el Service Worker.");
  process.exit(1);
}

const fingerprintBuilder = crypto
  .createHash("sha256")
  .update(manifestContent)
  .update("\n")
  .update(serviceWorkerContent);

for (const relativePath of versionedPublicFiles) {
  const filePath = path.join(buildDirectory, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`No se encontró el recurso PWA requerido: ${relativePath}`);
    process.exit(1);
  }
  fingerprintBuilder.update("\n").update(relativePath).update("\n").update(fs.readFileSync(filePath));
}

const fingerprint = fingerprintBuilder.digest("hex").slice(0, 16);

const stampedServiceWorker = serviceWorkerContent.replace(
  versionMarker,
  `const CACHE_VERSION = "${fingerprint}";`
);

fs.writeFileSync(serviceWorkerPath, stampedServiceWorker, "utf8");
console.log(`Service Worker versionado: ${fingerprint}`);
