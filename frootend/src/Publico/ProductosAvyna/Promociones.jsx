import React, { useEffect, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { fetchPublicPromotions } from "../../utils/publicCatalogApi";

function truncateText(value, maxLength = 160) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export default function Promociones() {
  const [promotions, setPromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPromotions = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchPublicPromotions();
        if (isMounted) setPromotions(data);
      } catch (error) {
        if (isMounted) {
          setPromotions([]);
          setErrorMessage(error.message || "No fue posible cargar promociones.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPromotions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="page-title">Promociones AVYNA</h1>
          <p className="page-subtitle mt-2">Aqui se muestran las promociones activas.</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <div className={`relative ${isLoading ? "min-h-[320px]" : ""}`}>
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-3xl bg-white/70 pt-20 backdrop-blur-sm sm:pt-24">
            <LoadingSpinner
              fullScreen={false}
              className="py-6"
              showText
              text="Cargando promociones"
              spinnerClassName="h-12 w-12 border-[3px] border-sky-200 border-t-blue-600"
              textClassName="mt-4 text-base font-semibold text-blue-600 sm:text-lg"
            />
          </div>
        ) : null}

        {promotions.length > 0 ? (
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 transition-opacity duration-200 ${isLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
            {promotions.map((promotion) => (
              <div
                key={promotion.id}
                className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-violet-50 p-7 shadow-sm"
              >
                <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
                  Activa
                </span>
                <h2 className="mt-4 text-2xl font-bold text-slate-800">{promotion.titulo}</h2>
                <p className="mt-4 min-h-[96px] text-slate-600 leading-7">
                  {truncateText(promotion.descripcion || "Promocion disponible por tiempo limitado.")}
                </p>
                <div className="mt-6 text-4xl font-extrabold text-rose-600">{promotion.descuento}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-3xl border border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm transition-opacity duration-200 ${isLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
            <h2 className="text-2xl font-bold text-slate-800">No hay promociones publicas disponibles</h2>
          </div>
        )}
      </div>
    </div>
  );
}
