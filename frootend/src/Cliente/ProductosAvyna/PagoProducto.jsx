import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import {
  cacheClientPayment,
  clearClientCart,
  getCartSummary,
  getClientCart,
  getClientToken,
} from "../../utils/clientStore";
import { formatProductPresentation } from "../../utils/productPresentation";
import TransferenciaFields, {
  buildClientPaymentBody,
  validateTransferPayment,
} from "../Pagos/TransferenciaFields";
import OnlinePaymentButtons from "../Pagos/OnlinePaymentButtons";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

export default function PagoProducto({ mode = "product" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCartPayment = mode === "cart";
  const [product, setProduct] = useState(null);
  const [cart, setCart] = useState(() => getClientCart());
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [transferReference, setTransferReference] = useState("");
  const [transferProof, setTransferProof] = useState(null);
  const [isLoading, setIsLoading] = useState(!isCartPayment);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (isCartPayment) {
      setIsLoading(false);
      return;
    }

    const loadProduct = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await requestJson(endpoints.publicProductById(id));
        setProduct(data.product || null);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar el producto.");
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id, isCartPayment]);

  const summary = useMemo(() => {
    if (isCartPayment) return getCartSummary(cart);
    return {
      totalItems: quantity,
      subtotal: Number(product?.precio || 0) * quantity,
    };
  }, [cart, isCartPayment, product, quantity]);

  const detail = useMemo(() => {
    if (isCartPayment) {
      return cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
      }));
    }
    if (!product) return [];
    return [
      {
        id: product.id,
        nombre: product.nombre,
        cantidad: quantity,
        precio: Number(product.precio || 0),
      },
    ];
  }, [cart, isCartPayment, product, quantity]);

  const handleConfirmPayment = async () => {
    if (summary.subtotal <= 0 || detail.length === 0) return;

    if (paymentMethod === "Transferencia") {
      const validationError = validateTransferPayment(transferReference, transferProof);
      if (validationError) {
        setPaymentError(validationError);
        return;
      }
    }

    setIsSaving(true);
    setPaymentError("");
    try {
      const data = await requestJson(endpoints.clientPayments, {
        method: "POST",
        token: getClientToken(),
        body: buildClientPaymentBody({
          tipo: "Producto",
          metodo: paymentMethod,
          detalle: detail,
          referencia: transferReference,
          comprobante: transferProof,
        }),
      });

      if (data.payment) {
        cacheClientPayment(data.payment);
      }

      if (isCartPayment) {
        clearClientCart();
        setCart([]);
      }

      navigate("/cliente/pagos");
    } catch (error) {
      setPaymentError(error.message || "No fue posible registrar el pago.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOnlinePayment = (provider) => {
    setPaymentError(
      `${provider} necesita las credenciales de una cuenta comercial para procesar el pago.`
    );
  };

  if (isLoading) {
    return <LoadingSpinner text="Preparando pago..." fullScreen={false} className="py-24" />;
  }

  if (errorMessage || (!isCartPayment && !product)) {
    return (
      <div className="card max-w-2xl p-4 text-center sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800">No se pudo preparar el pago</h1>
        <p className="mt-3 text-slate-500">{errorMessage || "Producto no encontrado."}</p>
        <Link to="/cliente/productos" className="mt-6 inline-block">
          <Button className="px-6 py-3 rounded-xl">Volver al catalogo</Button>
        </Link>
      </div>
    );
  }

  if (isCartPayment && cart.length === 0) {
    return (
      <div className="card max-w-2xl p-4 text-center sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800">Tu carrito esta vacio</h1>
        <p className="mt-3 text-slate-500">Agrega productos antes de continuar con el pago.</p>
        <Link to="/cliente/productos" className="mt-6 inline-block">
          <Button className="px-6 py-3 rounded-xl">Ver productos</Button>
        </Link>
      </div>
    );
  }

  const productPresentation = product ? formatProductPresentation(product) : "";

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">{isCartPayment ? "Pago del carrito" : "Pago de producto"}</h1>
      <p className="page-subtitle mt-2">
        Confirma el metodo de pago y revisa el resumen antes de finalizar.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card p-6 space-y-5">
          <h2 className="section-title">Detalle</h2>

          {paymentError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {paymentError}
            </div>
          )}

          {isCartPayment ? (
            <div className="divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="font-bold text-slate-800">{item.nombre}</div>
                    <div className="text-sm text-slate-500">Cantidad: {item.cantidad}</div>
                  </div>
                  <div className="font-bold text-rose-600">{formatCurrency(item.precio * item.cantidad)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-28 w-full overflow-hidden rounded-2xl bg-violet-50 sm:w-32">
                <img
                  src={product.imagen || "https://placehold.co/400x400/F5F3FF/7C3AED?text=AVYNA"}
                  alt={product.nombre}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800">{product.nombre}</h2>
                {productPresentation && <p className="mt-1 text-sm text-slate-500">{productPresentation}</p>}
                <div className="mt-4 flex h-11 w-36 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="px-2 text-xl font-bold text-violet-500 hover:text-violet-700"
                  >
                    -
                  </button>
                  <span className="font-bold text-slate-800">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => value + 1)}
                    className="px-2 text-xl font-bold text-violet-500 hover:text-violet-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Metodo de pago</label>
            <select
              className="form-input"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option>Tarjeta</option>
              <option>Transferencia</option>
              <option>Pago en sucursal</option>
            </select>
          </div>

          <OnlinePaymentButtons onSelect={handleOnlinePayment} />

          {paymentMethod === "Transferencia" && (
            <TransferenciaFields
              reference={transferReference}
              onReferenceChange={setTransferReference}
              proofFile={transferProof}
              onProofFileChange={setTransferProof}
            />
          )}
        </div>

        <aside className="card h-fit p-6">
          <div className="text-sm text-violet-600 font-bold uppercase tracking-wider">Resumen</div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Articulos</span>
              <span className="font-semibold">{summary.totalItems}</span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-bold text-rose-600">{formatCurrency(summary.subtotal)}</span>
            </div>
          </div>

          <Button type="button" onClick={handleConfirmPayment} disabled={isSaving} className="mt-6 w-full py-4 rounded-xl">
            {isSaving
              ? "Registrando..."
              : paymentMethod === "Transferencia"
                ? "Registrar transferencia"
                : "Confirmar pago"}
          </Button>

          <div className="mt-4 text-sm text-center">
            <Link to={isCartPayment ? "/cliente/carrito" : "/cliente/productos"} className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
              Volver
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
