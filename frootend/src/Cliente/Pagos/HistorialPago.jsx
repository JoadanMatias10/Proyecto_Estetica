import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { getClientPayments } from "../../utils/clientStore";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function HistorialPago() {
  const [payments, setPayments] = useState(() => getClientPayments());

  useEffect(() => {
    const refreshPayments = () => setPayments(getClientPayments());
    window.addEventListener("client-state-change", refreshPayments);
    window.addEventListener("storage", refreshPayments);
    return () => {
      window.removeEventListener("client-state-change", refreshPayments);
      window.removeEventListener("storage", refreshPayments);
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Historial de pago</h1>
      <p className="page-subtitle mt-2">Pagos de productos y servicios.</p>

      <div className="card mt-8 rounded-2xl overflow-hidden shadow-md">
        <div className="p-6 bg-violet-50/80 border-b border-violet-100 font-bold text-violet-700 uppercase text-sm tracking-wider">
          Movimientos recientes
        </div>

        {payments.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-violet-50 p-4 text-violet-600">
              <SidebarIcon name="payments" className="h-10 w-10" />
            </div>
            <p className="text-lg font-semibold text-slate-700">Aun no hay pagos registrados</p>
            <p className="mt-1 text-sm text-slate-500">Cuando compres productos o servicios apareceran aqui.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/cliente/productos">
                <Button className="px-6 py-3 rounded-xl">Comprar productos</Button>
              </Link>
              <Link to="/cliente/servicios">
                <Button variant="outline" className="px-6 py-3 rounded-xl border-2">Ver servicios</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <div key={payment.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="font-bold text-slate-800 text-lg">{payment.concepto}</div>
                  <div className="text-sm text-slate-500 mt-1 font-medium bg-slate-50 w-fit px-2 py-0.5 rounded-lg border border-slate-200">
                    {payment.tipo} - {payment.fecha} - {payment.metodo} - <span className="font-mono text-slate-400">{payment.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 justify-between md:justify-end">
                  <div className="font-bold text-2xl text-rose-600">{formatCurrency(payment.total)}</div>
                  <div className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-sm ${payment.estatus === "Pagado" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                    }`}>
                    {payment.estatus}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
