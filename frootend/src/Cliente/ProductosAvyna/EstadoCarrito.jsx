import React from "react";

export default function EstadoCarrito() {
  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Estado del carrito</h1>
      <p className="page-subtitle mt-2">Seguimiento del proceso de compra.</p>

      <div className="card mt-8 p-8 space-y-4">
        {[
          { step: "1) Productos seleccionados", status: "Pendiente" },
          { step: "2) Dirección/entrega", status: "Pendiente" },
          { step: "3) Pago", status: "Pendiente" },
          { step: "4) Confirmación", status: "Pendiente" },
        ].map((s) => (
          <div key={s.step} className="flex items-center justify-between p-4 rounded-xl bg-violet-50/50 border border-violet-100 hover:bg-violet-50 transition-colors">
            <div className="font-semibold text-slate-800">{s.step}</div>
            <div className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">{s.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
