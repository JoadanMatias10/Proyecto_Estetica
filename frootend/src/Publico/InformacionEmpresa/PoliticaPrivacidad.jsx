import React from "react";
import { API_BASE_URL } from "../../api";

export default function PoliticaPrivacidad() {
  const policyUrl = `${API_BASE_URL}/public/privacy-policy`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="page-title">Politica de privacidad</h1>

      <div className="card mt-8 p-7 space-y-4">
        <h3 className="section-title">Aviso de privacidad</h3>
        <p className="text-slate-600">
          Consulta el aviso completo de privacidad en la pagina oficial.
        </p>
        <a
          href={policyUrl}
          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200"
        >
          Abrir politica de privacidad
        </a>
      </div>
    </div>
  );
}
