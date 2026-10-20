import React, { useEffect, useRef, useState } from "react";

const RECONNECTED_NOTICE_DURATION_MS = 5000;

export default function PwaStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const wasOnlineRef = useRef(navigator.onLine);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const handleOnline = () => {
      const connectionWasOffline = !wasOnlineRef.current;
      wasOnlineRef.current = true;
      setIsOnline(true);

      if (!connectionWasOffline) return;

      clearReconnectTimer();
      setShowReconnected(true);
      reconnectTimerRef.current = window.setTimeout(() => {
        setShowReconnected(false);
        reconnectTimerRef.current = null;
      }, RECONNECTED_NOTICE_DURATION_MS);
    };

    const handleOffline = () => {
      wasOnlineRef.current = false;
      clearReconnectTimer();
      setShowReconnected(false);
      setIsOnline(false);
    };
    const handleUpdate = (event) => setUpdateRegistration(event.detail?.registration || null);
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallDismissed(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallDismissed(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pwa:update-available", handleUpdate);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pwa:update-available", handleUpdate);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      clearReconnectTimer();
    };
  }, []);

  const applyUpdate = () => {
    const waitingWorker = updateRegistration?.waiting;
    if (!waitingWorker) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  const requestInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    setInstallPrompt(null);
  };

  const connectionNotice = !isOnline ? "offline" : showReconnected ? "reconnected" : null;
  const showUpdate = isOnline && !connectionNotice && updateRegistration;
  const showInstall = isOnline && !connectionNotice && installPrompt && !installDismissed && !updateRegistration;

  if (!connectionNotice && !showUpdate && !showInstall) return null;

  const message =
    connectionNotice === "offline"
      ? "Sin conexión a Internet."
      : connectionNotice === "reconnected"
        ? "Conexión a Internet restablecida. Ya puedes consultar información actualizada."
        : showUpdate
          ? "Hay una nueva versión disponible. Puedes aplicarla cuando estés listo."
          : "Instala Estética Panamericana para abrirla como aplicación.";

  const noticeColors =
    connectionNotice === "offline"
      ? "border-amber-300 bg-amber-50/95 text-amber-900"
      : connectionNotice === "reconnected"
        ? "border-emerald-300 bg-emerald-50/95 text-emerald-900"
        : "border-violet-200 bg-white/95 text-slate-700";

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl"
      role={connectionNotice === "offline" ? "alert" : "status"}
      aria-live={connectionNotice === "offline" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div
        className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between ${noticeColors}`}
      >
        <p className="font-medium">{message}</p>

        <div className="flex shrink-0 gap-2">
          {showUpdate ? (
            <>
              <button
                type="button"
                onClick={() => setUpdateRegistration(null)}
                className="min-h-10 rounded-xl border border-slate-200 px-3 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Después
              </button>
              <button
                type="button"
                onClick={applyUpdate}
                className="min-h-10 rounded-xl bg-violet-600 px-4 font-semibold text-white hover:bg-violet-700"
              >
                Actualizar
              </button>
            </>
          ) : showInstall ? (
            <>
              <button
                type="button"
                onClick={() => setInstallDismissed(true)}
                className="min-h-10 rounded-xl border border-slate-200 px-3 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={requestInstall}
                className="min-h-10 rounded-xl bg-violet-600 px-4 font-semibold text-white hover:bg-violet-700"
              >
                Instalar
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
