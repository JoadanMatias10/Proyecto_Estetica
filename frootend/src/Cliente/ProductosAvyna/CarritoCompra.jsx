import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import {
  clearClientCart,
  getCartSummary,
  getClientCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../utils/clientStore";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

export default function CarritoCompra() {
  const [cart, setCart] = useState(() => getClientCart());
  const summary = useMemo(() => getCartSummary(cart), [cart]);

  const handleQuantity = (productId, nextQuantity) => {
    setCart(updateCartItemQuantity(productId, nextQuantity));
  };

  const handleRemove = (productId) => {
    setCart(removeCartItem(productId));
  };

  const handleClear = () => {
    clearClientCart();
    setCart([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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

      {cart.length === 0 ? (
        <div className="card px-4 py-12 text-center sm:p-8 sm:py-16">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-violet-50 p-4 text-violet-600">
            <SidebarIcon name="cart" className="h-12 w-12" />
          </div>
          <p className="text-slate-500 text-lg font-medium">Aun no hay productos en tu carrito</p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
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
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="card p-4 md:p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="h-28 w-full overflow-hidden rounded-2xl bg-violet-50 sm:w-32">
                    <img
                      src={item.imagen || "https://placehold.co/400x400/F5F3FF/7C3AED?text=AVYNA"}
                      alt={item.nombre}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">{item.nombre}</h2>
                        <p className="text-sm text-slate-500">{item.categoria || item.marca || "Producto AVYNA"}</p>
                        {item.presentacion && (
                          <p className="mt-1 text-sm font-medium text-slate-500">{item.presentacion}</p>
                        )}
                      </div>
                      <div className="text-xl font-bold text-rose-600">{formatCurrency(item.precio * item.cantidad)}</div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex h-11 w-36 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.id, item.cantidad - 1)}
                          className="px-2 text-xl font-bold text-violet-500 hover:text-violet-700"
                        >
                          -
                        </button>
                        <span className="font-bold text-slate-800">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.id, item.cantidad + 1)}
                          className="px-2 text-xl font-bold text-violet-500 hover:text-violet-700"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="text-sm font-semibold text-rose-500 hover:text-rose-700"
                      >
                        Quitar producto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="card h-fit p-6">
            <h2 className="section-title">Resumen</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Productos</span>
                <span className="font-semibold">{summary.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envio</span>
                <span className="font-semibold text-emerald-600">En sucursal</span>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between text-lg font-bold text-slate-800">
                <span>Total</span>
                <span className="text-rose-600">{formatCurrency(summary.subtotal)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Link to="/cliente/carrito/pago" className="block">
                <Button className="w-full py-3 rounded-xl">Pagar carrito</Button>
              </Link>
              <Button type="button" variant="outline" onClick={handleClear} className="w-full py-3 rounded-xl border-2">
                Vaciar carrito
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
