import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

function detectDataUrlMimeType(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() || "";
}

export default function PoliticaPrivacidad() {
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
        setErrorMessage(error.message || "No fue posible cargar la politica de privacidad.");
      } finally {
        setLoading(false);
      }
    };

    loadCompanyInfo();
  }, []);

  const documentUrl = companyInfo?.politicasDocumento || "";
  const documentName = companyInfo?.politicasDocumentoNombre || "politicas-empresa";
  const documentType = useMemo(
    () => (companyInfo?.politicasDocumentoTipo || detectDataUrlMimeType(documentUrl)).toLowerCase(),
    [companyInfo?.politicasDocumentoTipo, documentUrl]
  );
  const canPreviewPdf = Boolean(documentUrl) && documentType === "application/pdf";

  if (loading) {
    return <LoadingSpinner text="Cargando politica de privacidad..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Politica de privacidad</h1>

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {documentUrl ? (
        <div className="card mt-8 p-7 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="section-title">Documento oficial de politicas</h3>
            <a
              href={documentUrl}
              download={documentName}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200"
            >
              Descargar documento
            </a>
          </div>

          <p className="text-sm text-slate-500 break-all">{documentName}</p>

          {canPreviewPdf ? (
            <iframe
              title="Documento de politica de privacidad"
              src={documentUrl}
              className="w-full h-[32rem] rounded-xl border border-slate-200"
            />
          ) : (
            <p className="text-slate-600">
              La vista previa esta disponible solo para archivos PDF. Usa el boton de descarga para abrir el documento.
            </p>
          )}
        </div>
      ) : (
        <div className="card mt-8 p-7 space-y-4 text-slate-600">
          <p>Aun no hay un documento de politicas publicado.</p>
          <p>El administrador puede cargarlo desde el panel de informacion de la empresa.</p>
        </div>
      )}
    </div>
  );
}
