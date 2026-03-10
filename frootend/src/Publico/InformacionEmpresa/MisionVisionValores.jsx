import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

function parseValores(rawValue) {
  if (!rawValue) return [];
  const items = rawValue.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(items));
}

export default function MisionVisionValores() {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadCompanyInfo = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const info = await fetchPublicCompanyInfo();
        setCompanyInfo(info);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar informacion de la empresa.");
      } finally {
        setLoading(false);
      }
    };

    loadCompanyInfo();
  }, []);

  const valores = useMemo(
    () => parseValores(companyInfo?.valores || ""),
    [companyInfo?.valores]
  );

  if (loading) {
    return <LoadingSpinner text="Cargando informacion..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Mision, vision y valores</h1>

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div className="card p-7">
          <h3 className="section-title">Mision</h3>
          <p className="text-slate-600 mt-2 leading-relaxed">
            {companyInfo?.mision || "Informacion no disponible."}
          </p>
        </div>

        <div className="card p-7">
          <h3 className="section-title">Vision</h3>
          <p className="text-slate-600 mt-2 leading-relaxed">
            {companyInfo?.vision || "Informacion no disponible."}
          </p>
        </div>

        <div className="card p-7">
          <h3 className="section-title">Valores</h3>
          <ul className="mt-3 space-y-2 text-slate-600">
            {valores.map((valor) => (
              <li key={valor}>- {valor}</li>
            ))}
            {valores.length === 0 && <li>- Informacion no disponible.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
