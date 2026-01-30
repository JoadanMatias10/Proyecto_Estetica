import React from "react";

export default function EstadoCarrito() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Estado del carrito</h1>
      <p className="text-rose-700/70 mt-2">Seguimiento del proceso de compra.</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-4">
        {[
          { step: "1) Productos seleccionados", status: "Pendiente" },
          { step: "2) Dirección/entrega", status: "Pendiente" },
          { step: "3) Pago", status: "Pendiente" },
          { step: "4) Confirmación", status: "Pendiente" },
        ].map((s) => (
          <div key={s.step} className="flex items-center justify-between p-4 rounded-xl bg-rose-50/50 border border-rose-100 hover:bg-rose-50 transition-colors">
            <div className="font-semibold text-rose-800">{s.step}</div>
            <div className="text-sm font-bold text-rose-500 bg-rose-100 px-3 py-1 rounded-full">{s.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
