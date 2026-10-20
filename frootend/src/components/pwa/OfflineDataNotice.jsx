import React from "react";

function formatCachedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function OfflineDataNotice({ cachedAt = "", className = "" }) {
  const formattedDate = formatCachedAt(cachedAt);

  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      Estás sin conexión a internet. Mostrando información guardada.
      {formattedDate ? ` Última actualización local: ${formattedDate}.` : ""}
    </div>
  );
}
