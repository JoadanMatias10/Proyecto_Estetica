import React from "react";
import { useParams, Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function PagoProducto() {
  const { id } = useParams();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Pago de producto</h1>
      <p className="text-rose-700/70 mt-2">Producto seleccionado ID: <b className="text-rose-500">{id}</b></p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div className="p-6 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-100">
          <div className="text-sm text-rose-600 font-bold uppercase tracking-wider">Resumen</div>
          <div className="text-rose-800 mt-2 font-medium">1 producto • Envío estándar</div>
          <div className="text-3xl font-bold text-rose-700 mt-3">$299 <span className="text-sm font-normal text-rose-500">MXN</span></div>
        </div>

        <div>
          <label className="text-sm font-bold text-rose-700 mb-2 block">Método de pago</label>
          <select className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all">
            <option>Tarjeta</option>
            <option>Transferencia</option>
            <option>Pago en sucursal</option>
          </select>
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold text-lg hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Confirmar pago</Button>

        <div className="text-sm text-center">
          <Link to="/cliente/pagos" className="text-rose-600 hover:text-rose-800 font-semibold transition-colors">
            Ver historial de pago →
          </Link>
        </div>
      </div>
    </div>
  );
}
