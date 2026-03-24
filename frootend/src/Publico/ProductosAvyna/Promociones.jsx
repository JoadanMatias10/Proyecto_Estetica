import React, { useEffect, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function Promociones() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="page-title">Promociones AVYNA</h1>
          <p className="page-subtitle mt-2">Consulta promociones reales cuando esten disponibles.</p>
        </div>
      </div>

      <div className={`relative ${isLoading ? "min-h-[320px]" : ""}`}>
        {isLoading && (
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
        )}

        <div className={`rounded-3xl border border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm transition-opacity duration-200 ${isLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <h2 className="text-2xl font-bold text-slate-800">No hay promociones publicas disponibles</h2>
        </div>
      </div>
    </div>
  );
}
