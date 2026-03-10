import React from "react";

const pagos = [
  { id: "P-001", tipo: "Servicio", concepto: "Coloración", total: 650, fecha: "2026-01-10", estatus: "Pagado" },
  { id: "P-002", tipo: "Producto", concepto: "Shampoo AVYNA", total: 299, fecha: "2026-01-18", estatus: "Pagado" },
  { id: "P-003", tipo: "Servicio", concepto: "Corte", total: 250, fecha: "2026-01-25", estatus: "Pendiente" },
];

export default function HistorialPago() {
  return (
    <div>
      <h1 className="page-title">Historial de pago</h1>
      <p className="page-subtitle mt-2">Pagos de productos y servicios.</p>

      <div className="card mt-8 rounded-2xl overflow-hidden shadow-md">
        <div className="p-6 bg-violet-50/80 border-b border-violet-100 font-bold text-violet-700 uppercase text-sm tracking-wider">
          Movimientos recientes
        </div>
        <div className="divide-y divide-slate-100">
          {pagos.map((p) => (
            <div key={p.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div>
                <div className="font-bold text-slate-800 text-lg">{p.concepto}</div>
                <div className="text-sm text-slate-500 mt-1 font-medium bg-slate-50 w-fit px-2 py-0.5 rounded-lg border border-slate-200">{p.tipo} • {p.fecha} • <span className="font-mono text-slate-400">{p.id}</span></div>
              </div>
              <div className="flex items-center gap-6 justify-between md:justify-end">
                <div className="font-bold text-2xl text-rose-600">${p.total}</div>
                <div className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-sm ${p.estatus === "Pagado" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                  }`}>
                  {p.estatus}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
