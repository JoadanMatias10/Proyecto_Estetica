import React from "react";
import { useParams, Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function PagoProducto() {
  const { id } = useParams();

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Pago de producto</h1>
      <p className="page-subtitle mt-2">Producto seleccionado ID: <b className="text-violet-600">{id}</b></p>

      <div className="card mt-8 p-8 space-y-6">
        <div className="p-6 rounded-xl bg-gradient-to-br from-violet-50 to-rose-50 border border-violet-100">
          <div className="text-sm text-violet-600 font-bold uppercase tracking-wider">Resumen</div>
          <div className="text-slate-700 mt-2 font-medium">1 producto • Envío estándar</div>
          <div className="text-3xl font-bold text-rose-600 mt-3">$299 <span className="text-sm font-normal text-slate-400">MXN</span></div>
        </div>

        <div>
          <label className="form-label">Método de pago</label>
          <select className="form-input">
            <option>Tarjeta</option>
            <option>Transferencia</option>
            <option>Pago en sucursal</option>
          </select>
        </div>

        <Button className="w-full py-4 rounded-xl">Confirmar pago</Button>

        <div className="text-sm text-center">
          <Link to="/cliente/pagos" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
            Ver historial de pago →
          </Link>
        </div>
      </div>
    </div>
  );
}
