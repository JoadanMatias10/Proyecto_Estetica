import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

function parseEsenciaItems(rawText) {
  if (!rawText) return [];
  const unique = new Set(
    rawText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

export default function QuienesSomos() {
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

  const esenciaItems = useMemo(
    () => parseEsenciaItems(companyInfo?.quienesSomosEsencia || ""),
    [companyInfo?.quienesSomosEsencia]
  );

  if (loading) {
    return <LoadingSpinner text="Cargando informacion..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Quienes somos</h1>

      {errorMessage ? (
        <p className="mt-3 text-red-600 text-sm">{errorMessage}</p>
      ) : (
        <div className="card mt-6 p-7">
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">
            {companyInfo?.quienesSomosTexto || "Informacion no disponible."}
          </p>
        </div>
      )}

      <div className="card mt-8 p-7">
        <h3 className="section-title">Nuestra esencia</h3>
        <ul className="mt-3 space-y-2 text-slate-600">
          {esenciaItems.map((item) => (
            <li key={item}>- {item}</li>
          ))}
          {esenciaItems.length === 0 && <li>- Informacion no disponible</li>}
        </ul>
      </div>
    </div>
  );
}
