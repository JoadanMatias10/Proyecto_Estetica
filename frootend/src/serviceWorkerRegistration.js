const isLocalhost = Boolean(
  window.location.hostname === "localhost"
  || window.location.hostname === "[::1]"
  || window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

function notifyUpdate(registration, config) {
  if (config?.onUpdate) config.onUpdate(registration);
  window.dispatchEvent(new CustomEvent("pwa:update-available", { detail: { registration } }));
}

function registerValidServiceWorker(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdate(registration, config);
      }

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== "installed") return;

          if (navigator.serviceWorker.controller) {
            notifyUpdate(registration, config);
          } else if (config?.onSuccess) {
            config.onSuccess(registration);
          }
        };
      };
    })
    .catch((error) => {
      console.error("No fue posible registrar la PWA:", error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { "Service-Worker": "script" } })
    .then((response) => {
      const contentType = response.headers.get("content-type");
      if (response.status === 404 || (contentType && !contentType.includes("javascript"))) {
        navigator.serviceWorker.ready.then((registration) => registration.unregister());
        window.location.reload();
        return;
      }

      registerValidServiceWorker(swUrl, config);
    })
    .catch(() => {
      // La copia instalada continuará atendiendo recursos compatibles sin conexión.
    });
}

export function register(config) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const publicUrl = new URL(process.env.PUBLIC_URL || "/", window.location.href);
    if (publicUrl.origin !== window.location.origin) return;

    const swUrl = `${process.env.PUBLIC_URL || ""}/service-worker.js`;
    if (navigator.onLine) {
      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidServiceWorker(swUrl, config);
      }
    } else {
      // La PWA instalada continúa bajo el worker activo. Esperar a que vuelva la
      // conexión evita una comprobación fallida tanto local como desplegada.
      window.addEventListener(
        "online",
        () => {
          if (isLocalhost) checkValidServiceWorker(swUrl, config);
          else registerValidServiceWorker(swUrl, config);
        },
        { once: true }
      );
    }
  });
}

export function unregister() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch(() => undefined);
}
