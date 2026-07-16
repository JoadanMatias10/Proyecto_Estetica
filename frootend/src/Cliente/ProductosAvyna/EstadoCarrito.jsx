import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import { getCartSummary, getClientCart, getClientPayments, getClientToken, saveClientPayments } from "../../utils/clientStore";

function getStatusClass(status) {
  if (status === "Completado") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "En proceso") return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function EstadoCarrito() {
  const cart = getClientCart();
  const [payments, setPayments] = useState(() => getClientPayments().filter((payment) => payment.tipo === "Producto"));
  const summary = getCartSummary(cart);
  const hasCart = cart.length > 0;
  const hasProductPayment = payments.length > 0;

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const data = await requestJson(endpoints.clientPayments, { token: getClientToken() });
        const nextPayments = saveClientPayments(Array.isArray(data.payments) ? data.payments : []);
        setPayments(nextPayments.filter((payment) => payment.tipo === "Producto"));
      } catch (_error) {
        setPayments(getClientPayments().filter((payment) => payment.tipo === "Producto"));
      }
    };

    loadPayments();
  }, []);

  const steps = [
    { step: "Productos seleccionados", status: hasCart || hasProductPayment ? "Completado" : "Pendiente" },
    { step: "Revision del carrito", status: hasCart ? "En proceso" : hasProductPayment ? "Completado" : "Pendiente" },
    { step: "Pago", status: hasProductPayment ? "Completado" : hasCart ? "Pendiente" : "Pendiente" },
    { step: "Confirmacion", status: hasProductPayment ? "Completado" : "Pendiente" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Estado del carrito</h1>
      <p className="page-subtitle mt-2">Seguimiento del proceso de compra.</p>

      <div className="card mt-8 p-8 space-y-4">
        {steps.map((item, index) => (
          <div key={item.step} className="flex items-center justify-between gap-4 rounded-xl bg-violet-50/50 p-4 border border-violet-100">
            <div>
              <div className="font-semibold text-slate-800">{index + 1}. {item.step}</div>
              {index === 0 && hasCart && (
                <div className="mt-1 text-sm text-slate-500">{summary.totalItems} productos en carrito</div>
              )}
            </div>
            <div className={`text-sm font-bold px-3 py-1 rounded-full border ${getStatusClass(item.status)}`}>
              {item.status}
            </div>
          </div>
        ))}

        {hasProductPayment && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Ultimo pago registrado: {payments[0].concepto} por ${Number(payments[0].total || 0).toFixed(2)} MXN.
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          <Link to="/cliente/carrito" className="w-full">
            <Button variant="outline" className="w-full py-3 rounded-xl border-2">Volver al carrito</Button>
          </Link>
          <Link to="/cliente/pagos" className="w-full">
            <Button className="w-full py-3 rounded-xl">Ver pagos</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
