import React, { useEffect, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

export default function RedesSociales() {
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
        setErrorMessage(error.message || "No fue posible cargar redes sociales.");
      } finally {
        setLoading(false);
      }
    };

    loadCompanyInfo();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Cargando redes sociales..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Redes sociales</h1>
      <p className="page-subtitle mt-2">Sigue a la estetica en nuestras redes oficiales.</p>

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <a
          href={companyInfo?.facebook || "#"}
          target="_blank"
          rel="noreferrer"
          className="card p-7 hover:shadow-lg transition-shadow"
        >
          <h3 className="section-title">Facebook</h3>
          <p className="text-slate-600 mt-2 break-all">{companyInfo?.facebook || "No configurado"}</p>
        </a>
        <a
          href={companyInfo?.instagram || "#"}
          target="_blank"
          rel="noreferrer"
          className="card p-7 hover:shadow-lg transition-shadow"
        >
          <h3 className="section-title">Instagram</h3>
          <p className="text-slate-600 mt-2 break-all">{companyInfo?.instagram || "No configurado"}</p>
        </a>
      </div>
    </div>
  );
}
