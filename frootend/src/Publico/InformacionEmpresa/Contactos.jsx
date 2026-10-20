import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import OfflineDataNotice from "../../components/pwa/OfflineDataNotice";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

function buildEmbedUrl(lat, lng, zoom) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const parsedZoom = Number(zoom || 15);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return "";
  const safeZoom = Number.isFinite(parsedZoom) ? Math.min(Math.max(Math.round(parsedZoom), 1), 20) : 15;
  return `https://www.google.com/maps?q=${parsedLat},${parsedLng}&z=${safeZoom}&output=embed`;
}

function buildGoogleUrl(lat, lng) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return "";
  return `https://www.google.com/maps?q=${parsedLat},${parsedLng}`;
}

export default function Contactos() {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const loadCompanyInfo = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const info = await fetchPublicCompanyInfo();
        setCompanyInfo(info);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar informacion de contacto.");
      } finally {
        setLoading(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      loadCompanyInfo();
    };
    const handleOffline = () => setIsOnline(false);

    loadCompanyInfo();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const mapEmbedUrl = useMemo(
    () => buildEmbedUrl(companyInfo?.mapLat, companyInfo?.mapLng, companyInfo?.mapZoom),
    [companyInfo?.mapLat, companyInfo?.mapLng, companyInfo?.mapZoom]
  );
  const googleMapsUrl = useMemo(
    () => companyInfo?.mapGoogleUrl || buildGoogleUrl(companyInfo?.mapLat, companyInfo?.mapLng),
    [companyInfo?.mapGoogleUrl, companyInfo?.mapLat, companyInfo?.mapLng]
  );

  if (loading) {
    return <LoadingSpinner text="Cargando contactos..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Contactos</h1>
      <p className="page-subtitle mt-2">Puedes comunicarte con nosotros por estos medios.</p>

      {companyInfo?.__offline && <OfflineDataNotice cachedAt={companyInfo.__cachedAt} className="mt-6" />}

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-7">
          <h3 className="section-title">Sucursal</h3>
          <p className="text-slate-600 mt-2">- {companyInfo?.direccion || "No disponible"}</p>
          <p className="text-slate-600 mt-1">- {companyInfo?.telefono || "No disponible"}</p>
          <p className="text-slate-600 mt-1">- {companyInfo?.email || "No disponible"}</p>
        </div>
        <div className="card p-7">
          <h3 className="section-title">Horario</h3>
          <p className="text-slate-600 mt-2">{companyInfo?.horarioLunesSabado || "No disponible"}</p>
          <p className="text-slate-600 mt-1">{companyInfo?.horarioDomingo || "No disponible"}</p>
        </div>
      </div>

      <div className="card p-7 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="section-title">Ubicacion en Google Maps</h3>
          {isOnline && googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-violet-600 hover:text-violet-700"
            >
              Abrir en Google Maps
            </a>
          )}
        </div>

        {!isOnline ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-64 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-6 text-center"
          >
            <div>
              <p className="font-semibold text-amber-900">Mapa no disponible sin conexión</p>
              <p className="mt-2 text-sm text-amber-800">
                Este mapa requiere conexión a Internet. Se mostrará nuevamente cuando recuperes la conexión.
              </p>
            </div>
          </div>
        ) : mapEmbedUrl ? (
          <iframe
            title="Mapa de Estetica Panamericana"
            src={mapEmbedUrl}
            className="w-full h-80 rounded-xl border border-slate-200"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <p className="text-slate-400 text-sm">Mapa no configurado por el administrador.</p>
        )}
      </div>
    </div>
  );
}
