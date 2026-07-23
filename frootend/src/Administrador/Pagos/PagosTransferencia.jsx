import React, { useCallback, useEffect, useState } from "react";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";

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

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  if (status === "Confirmado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Rechazado") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getPaymentDetail(payment) {
  const items = Array.isArray(payment?.detalle) ? payment.detalle : [];
  if (!items.length) return payment?.concepto || "-";
  return items.map((item) => `${item.cantidad}x ${item.nombre}`).join(", ");
}

export default function PagosTransferencia() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pendientes: 0,
    confirmados: 0,
    rechazados: 0,
  });
  const [filters, setFilters] = useState({
    estatus: "Todos",
    tipo: "Todos",
    metodo: "Todos",
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [decision, setDecision] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminClientPayments(filters), {
        token: getAdminToken(),
      });
      setPayments(Array.isArray(data.payments) ? data.payments : []);
      setSummary({
        total: Number(data.summary?.total || 0),
        pendientes: Number(data.summary?.pendientes || 0),
        confirmados: Number(data.summary?.confirmados || 0),
        rechazados: Number(data.summary?.rechazados || 0),
      });
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar los pagos.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openReview = (payment, nextDecision) => {
    setSelectedPayment(payment);
    setDecision(nextDecision);
    setAdminNotes("");
    setErrorMessage("");
  };

  const closeReview = () => {
    if (submitting) return;
    setSelectedPayment(null);
    setDecision("");
    setAdminNotes("");
  };

  const handleReview = async (event) => {
    event.preventDefault();
    if (!selectedPayment || !decision) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const data = await requestJson(endpoints.adminClientPaymentStatus(selectedPayment.id), {
        method: "PATCH",
        token: getAdminToken(),
        body: {
          estatus: decision,
          notasAdmin: adminNotes.trim(),
        },
      });
      setSuccessMessage(data.message || "Pago actualizado.");
      if (data.sale) {
        window.dispatchEvent(new CustomEvent("adminSalesUpdated"));
      }
      setSelectedPayment(null);
      setDecision("");
      setAdminNotes("");
      await loadPayments();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible revisar la transferencia.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pagos de clientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirma transferencias y pagos en efectivo realizados en la sucursal.
        </p>
      </div>

      {errorMessage && (
        <div className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="border-l-4 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total", summary.total, "text-slate-800"],
          ["Pendientes", summary.pendientes, "text-amber-700"],
          ["Confirmados", summary.confirmados, "text-emerald-700"],
          ["Rechazados", summary.rechazados, "text-red-700"],
        ].map(([label, value, className]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${className}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 border-y border-slate-200 bg-white py-4 sm:grid-cols-3">
        <div className="min-w-0 flex-1">
          <label className="form-label" htmlFor="payment-status-filter">Estado</label>
          <select
            id="payment-status-filter"
            className="form-input"
            value={filters.estatus}
            onChange={(event) => setFilters((current) => ({ ...current, estatus: event.target.value }))}
          >
            <option>Todos</option>
            <option>Pendiente</option>
            <option>Procesando</option>
            <option>Confirmado</option>
            <option>Rechazado</option>
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="form-label" htmlFor="payment-type-filter">Tipo</label>
          <select
            id="payment-type-filter"
            className="form-input"
            value={filters.tipo}
            onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}
          >
            <option>Todos</option>
            <option>Producto</option>
            <option>Servicio</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="form-label" htmlFor="payment-method-filter">Metodo</label>
          <select
            id="payment-method-filter"
            className="form-input"
            value={filters.metodo}
            onChange={(event) => setFilters((current) => ({ ...current, metodo: event.target.value }))}
          >
            <option>Todos</option>
            <option>Transferencia</option>
            <option>Pago en sucursal</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando pagos..." className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1290px] table-fixed text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="w-[200px] px-4 py-3">Cliente</th>
                  <th className="w-[155px] px-4 py-3">Fecha</th>
                  <th className="w-[180px] px-4 py-3">Detalle</th>
                  <th className="w-[125px] px-4 py-3">Metodo</th>
                  <th className="w-[110px] px-4 py-3">Referencia</th>
                  <th className="w-[115px] px-4 py-3">Comprobante</th>
                  <th className="w-[90px] px-4 py-3 text-right">Total</th>
                  <th className="w-[145px] px-4 py-3">Estado</th>
                  <th className="w-[170px] px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{payment.cliente?.nombre || "Cliente"}</div>
                      <div className="mt-1 text-xs text-slate-500">{payment.cliente?.correo || "-"}</div>
                      <div className="text-xs text-slate-500">{payment.cliente?.telefono || "-"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800">{payment.tipo}</div>
                      <div className="mt-1 text-xs leading-5">{getPaymentDetail(payment)}</div>
                      {payment.saleId && (
                        <div className="mt-2 text-xs font-semibold text-emerald-700">
                          Venta: <span className="font-mono">{payment.saleId}</span>
                        </div>
                      )}
                      {payment.appointmentId && (
                        <div className="mt-2 text-xs font-semibold text-violet-700">
                          Cita: <span className="font-mono">{payment.appointmentId}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      {payment.metodo}
                    </td>
                    <td className="px-4 py-4 font-mono font-semibold text-slate-800">
                      {payment.referencia || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {payment.metodo === "Pago en sucursal" ? (
                        <span className="text-xs font-semibold text-slate-500">No requerido</span>
                      ) : payment.comprobanteUrl ? (
                        <a
                          href={payment.comprobanteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-violet-600 hover:text-violet-800"
                        >
                          Abrir imagen
                        </a>
                      ) : (
                        <span className="text-red-600">Sin comprobante</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-slate-900">
                      {formatCurrency(payment.total)}
                    </td>
                    <td className="w-[170px] px-4 py-4">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${getStatusClasses(payment.estatus)}`}>
                        {payment.estatus}
                      </span>
                      {payment.revisadoAt && (
                        <div className="mt-2 max-w-[180px] text-xs text-slate-500">
                          {payment.revisadoPor || "Admin"} - {formatDate(payment.revisadoAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {payment.estatus === "Pendiente" ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="emerald"
                            className="h-9 px-3 text-xs"
                            onClick={() => openReview(payment, "Confirmado")}
                          >
                            Confirmar
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="h-9 px-3 text-xs"
                            onClick={() => openReview(payment, "Rechazado")}
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : payment.estatus === "Confirmado" ? (
                        payment.whatsappTicketUrl ? (
                          <a
                            href={payment.whatsappTicketUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#25D366] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1fb857] focus:outline-none focus:ring-4 focus:ring-emerald-200"
                            title={`Enviar al +${payment.whatsappRecipient}`}
                          >
                            <img
                              src="/whatsapp.svg"
                              alt=""
                              aria-hidden="true"
                              className="h-5 w-5 shrink-0"
                            />
                            <span>Enviar ticket</span>
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-red-600">
                            Telefono de cliente no valido
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">Revisado</span>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-6 py-10 text-center text-slate-400">
                      No hay pagos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedPayment)}
        onClose={closeReview}
        title={decision === "Confirmado" ? "Confirmar pago" : "Rechazar pago"}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleReview} className="space-y-5">
          {errorMessage && (
            <div className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {decision === "Confirmado" && selectedPayment?.tipo === "Producto" && (
            <div className="border-l-4 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Al confirmar se creara la venta y se descontara el inventario de los productos.
            </div>
          )}
          {decision === "Confirmado" && selectedPayment?.tipo === "Servicio" && (
            <div className="border-l-4 border-violet-400 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              Al confirmar, la cita ligada quedara marcada como servicio pagado.
            </div>
          )}
          {decision === "Confirmado" && selectedPayment?.metodo === "Pago en sucursal" && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Confirma este pago solamente despues de recibir el efectivo en la sucursal.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 border-y border-slate-200 py-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Cliente</div>
              <div className="mt-1 font-bold text-slate-900">{selectedPayment?.cliente?.nombre || "Cliente"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Total</div>
              <div className="mt-1 font-bold text-slate-900">{formatCurrency(selectedPayment?.total)}</div>
            </div>
            {selectedPayment?.metodo === "Transferencia" ? (
              <>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Referencia</div>
                  <div className="mt-1 font-mono font-bold text-slate-900">{selectedPayment?.referencia || "-"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Comprobante</div>
                  {selectedPayment?.comprobanteUrl ? (
                    <a
                      href={selectedPayment.comprobanteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-semibold text-violet-600 hover:text-violet-800"
                    >
                      Abrir imagen
                    </a>
                  ) : (
                    <div className="mt-1 font-semibold text-red-600">No disponible</div>
                  )}
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold uppercase text-slate-500">Metodo</div>
                <div className="mt-1 font-bold text-slate-900">Efectivo en sucursal</div>
              </div>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="admin-payment-notes">Notas de revision</label>
            <textarea
              id="admin-payment-notes"
              className="form-input min-h-[100px] resize-none"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              maxLength={300}
              placeholder={decision === "Rechazado" ? "Indica el motivo del rechazo." : "Nota opcional."}
              required={decision === "Rechazado"}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="h-11 px-5" onClick={closeReview}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={decision === "Confirmado" ? "emerald" : "danger"}
              className="h-11 px-5"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : decision === "Confirmado" ? "Confirmar pago" : "Rechazar pago"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
