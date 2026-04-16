import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function RegistrarVenta() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cliente, setCliente] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [pagoCon, setPagoCon] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadProducts = async () => {
    setLoadingProducts(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminProducts, {
        token: getAdminToken(),
      });
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar productos.");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      String(product.nombre || "").toLowerCase().includes(term)
    );
  }, [products, searchTerm]);
  const suggestionProducts = useMemo(
    () => filteredProducts.slice(0, 8),
    [filteredProducts]
  );

  const addProductToCart = (product, quantityToAdd = 1) => {
    if (!product) return;

    const safeQuantity = Number(quantityToAdd);
    if (!Number.isInteger(safeQuantity) || safeQuantity < 1) {
      window.alert("La cantidad minima es 1.");
      return;
    }

    const stockDisponible = Number(product.stock || 0);
    if (stockDisponible <= 0) {
      window.alert("Este producto no tiene stock disponible.");
      return;
    }
    if (safeQuantity > stockDisponible) {
      window.alert("La cantidad no puede ser mayor al stock disponible.");
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.cantidad + safeQuantity > stockDisponible) {
        window.alert("No puedes agregar mas unidades que el stock disponible.");
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, cantidad: item.cantidad + safeQuantity }
            : item
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: product.id,
          nombre: product.nombre,
          precio: Number(product.precio || 0),
          stock: stockDisponible,
          cantidad: safeQuantity,
        },
      ]);
    }
  };

  const handleSuggestionClick = (product) => {
    addProductToCart(product, 1);
    setSearchTerm("");
    setShowSuggestions(false);
  };

  const handleAddFromSearch = () => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      window.alert("Escribe el nombre de un producto.");
      return;
    }

    const exact = products.find(
      (product) => String(product.nombre || "").toLowerCase() === term
    );
    const candidate = exact || filteredProducts[0] || null;
    if (!candidate) {
      window.alert("No se encontro un producto para agregar.");
      return;
    }

    addProductToCart(candidate, 1);
    setSearchTerm("");
    setShowSuggestions(false);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = item.cantidad + delta;
        if (next <= 0) return item;
        if (next > Number(item.stock || 0)) {
          window.alert("Cantidad mayor al stock disponible.");
          return item;
        }
        return { ...item, cantidad: next };
      })
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0),
    [cart]
  );
  const total = subtotal;
  const pagoConNumber = Number(pagoCon);
  const requiereEfectivo = metodoPago === "Efectivo";
  const cambio = requiereEfectivo && Number.isFinite(pagoConNumber)
    ? Math.max(pagoConNumber - total, 0)
    : 0;
  const pagoInsuficiente = requiereEfectivo
    ? (!Number.isFinite(pagoConNumber) || pagoConNumber < total)
    : false;
  const isConfirmDisabled = submitting || cart.length === 0 || pagoInsuficiente;

  const handleConfirmSale = async () => {
    if (cart.length === 0) {
      window.alert("Agrega al menos un producto al carrito.");
      return;
    }
    if (requiereEfectivo && pagoInsuficiente) {
      window.alert("El pago en efectivo debe cubrir el total de la venta.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminSales(), {
        method: "POST",
        token: getAdminToken(),
        body: {
          cliente: cliente.trim(),
          metodoPago,
          pagoCon: requiereEfectivo && Number.isFinite(pagoConNumber) ? pagoConNumber : null,
          cambio,
          items: cart.map((item) => ({
            productId: item.id,
            cantidad: Number(item.cantidad),
          })),
        },
      });

      window.alert(`Venta registrada correctamente (ID: ${data.sale?.id || "N/A"}).`);
      window.dispatchEvent(new CustomEvent("adminSalesUpdated"));
      setCart([]);
      setCliente("");
      setMetodoPago("Efectivo");
      setPagoCon("");
      await loadProducts();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible registrar la venta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/ventas" className="text-violet-600 hover:text-violet-700 font-medium transition-colors">
          {"<-"} Volver al historial
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Registrar Nueva Venta</h1>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Agregar Productos</h2>
            {loadingProducts ? (
              <LoadingSpinner fullScreen={false} text="Cargando productos..." className="py-8" />
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="relative flex-1">
                      <SidebarIcon
                        name="search"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        className="h-12 w-full rounded-xl border border-transparent bg-slate-50 pl-10 pr-3 text-slate-800 outline-none transition-colors focus:border-violet-200 focus:bg-white"
                        placeholder="Buscar producto por nombre..."
                        value={searchTerm}
                        onChange={(event) => {
                          setSearchTerm(event.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddFromSearch();
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setShowSuggestions(false), 120);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddFromSearch}
                      disabled={!searchTerm.trim()}
                      className="h-12 px-6 text-base whitespace-nowrap"
                    >
                      Agregar
                    </Button>
                  </div>

                  {showSuggestions && searchTerm.trim() && (
                    <div className="absolute z-20 mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {suggestionProducts.length > 0 ? (
                        suggestionProducts.map((product) => {
                          const hasStock = Number(product.stock || 0) > 0;
                          return (
                            <button
                              key={`suggestion-${product.id}`}
                              type="button"
                              onMouseDown={() => hasStock && handleSuggestionClick(product)}
                              className={`w-full px-3 py-2 text-left border-b border-slate-100 last:border-b-0 ${
                                hasStock ? "hover:bg-slate-50" : "opacity-60 cursor-not-allowed"
                              }`}
                              disabled={!hasStock}
                            >
                              <span className="font-medium text-slate-800">{product.nombre}</span>
                              <span className="ml-2 text-sm text-slate-500">{formatCurrency(product.precio)}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-right">Subtotal</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 font-medium text-slate-900">{item.nombre}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
                        >
                          -
                        </button>
                        <span className="font-semibold min-w-6 text-center">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {formatCurrency(Number(item.precio || 0) * Number(item.cantidad || 0))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400">
                      El carrito esta vacio
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Resumen de Venta</h2>
            <div className="space-y-3 text-sm text-slate-600 border-b border-slate-100 pb-4 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-2xl font-bold text-slate-900 mb-6">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Cliente (Opcional)</label>
                <input
                  className="form-input"
                  placeholder="Nombre del cliente"
                  value={cliente}
                  onChange={(event) => setCliente(event.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Metodo de pago</label>
                <select
                  className="form-input"
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value)}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
              {requiereEfectivo && (
                <div className="space-y-2">
                  <div>
                    <label className="form-label">Pago con</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={pagoCon}
                      onChange={(event) => setPagoCon(event.target.value)}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Cambio</span>
                    <span className={`font-semibold ${pagoInsuficiente ? "text-red-600" : "text-emerald-600"}`}>
                      {formatCurrency(cambio)}
                    </span>
                  </div>
                  {pagoInsuficiente && (
                    <p className="text-xs text-red-600">El pago en efectivo debe ser igual o mayor al total.</p>
                  )}
                </div>
              )}
              <Button
                type="button"
                className="w-full justify-center text-lg"
                onClick={handleConfirmSale}
                disabled={isConfirmDisabled}
              >
                {submitting ? "Confirmando..." : "Confirmar Venta"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
