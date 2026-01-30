import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function CarritoCompra() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Carrito de compra</h1>
          <p className="text-rose-700/70 mt-1">Revisa tus productos antes de pagar.</p>
        </div>
        <Link to="/cliente/carrito/estado">
          <Button variant="outline" className="px-5 py-2.5 border-rose-300 text-rose-600 border-2">Estado del carrito</Button>
        </Link>
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md text-center py-16">
        <div className="text-6xl mb-4">🛒</div>
        <p className="text-rose-700/70 text-lg font-medium">Aún no hay productos en tu carrito (demo).</p>

        <div className="mt-8 flex justify-center gap-4">
          <Link to="/cliente/productos">
            <Button className="px-8 py-3 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold">Volver al catálogo</Button>
          </Link>
          <Link to="/cliente/pagos">
            <Button variant="outline" className="px-8 py-3 rounded-xl border-rose-300 text-rose-600 border-2 font-semibold">Ver pagos</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
