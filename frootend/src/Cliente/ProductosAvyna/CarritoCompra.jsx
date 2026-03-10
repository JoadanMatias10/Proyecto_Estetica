import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";

export default function CarritoCompra() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">Carrito de compra</h1>
          <p className="page-subtitle mt-1">Revisa tus productos antes de pagar.</p>
        </div>
        <Link to="/cliente/carrito/estado">
          <Button variant="outline" className="px-5 py-2.5 border-2">
            Estado del carrito
          </Button>
        </Link>
      </div>

      <div className="card p-8 text-center py-16">
        <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-violet-50 p-4 text-violet-600">
          <SidebarIcon name="cart" className="h-12 w-12" />
        </div>
        <p className="text-slate-500 text-lg font-medium">Aun no hay productos en tu carrito</p>

        <div className="mt-8 flex justify-center gap-4">
          <Link to="/cliente/productos">
            <Button className="px-8 py-3 rounded-xl">Volver al catalogo</Button>
          </Link>
          <Link to="/cliente/pagos">
            <Button variant="outline" className="px-8 py-3 rounded-xl border-2">
              Ver pagos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
