import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";
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

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  if (status === "Anulada") {
    return "bg-red-50 text-red-600";
  }
  return "bg-emerald-50 text-emerald-600";
}

export default function HistorialVentas() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalVentas: 0,
    totalRegistros: 0,
    totalAnuladas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const data = await requestJson(endpoints.adminSales(), { token });
      const sales = Array.isArray(data.sales) ? data.sales : [];

      const parsedRows = sales.flatMap((sale) => {
        const items = Array.isArray(sale.items) && sale.items.length > 0
          ? sale.items
          : [{ producto: "-", cantidad: 0, subtotal: 0 }];

        return items.map((item, index) => ({
          id: `${sale.id}-${index}`,
          ventaId: sale.id,
          fecha: sale.createdAt,
          detalle: item.producto,
          usuario: sale.usuario || "Admin",
          cantidad: Number(item.cantidad || 0),
          monto: Number(item.subtotal || 0),
          estado: sale.estado || "Activa",
          cliente: sale.cliente || "",
          totalVenta: Number(sale.total || 0),
          anuladaAt: sale.anuladaAt || null,
          anuladaPor: sale.anuladaPor || "",
          motivoAnulacion: sale.motivoAnulacion || "",
          showSaleAction: index === 0,
        }));
      });

      setRows(parsedRows);
      setSummary({
        totalVentas: Number(data.summary?.total || 0),
        totalRegistros: Number(data.summary?.totalRegistros || 0),
        totalAnuladas: Number(data.summary?.totalAnuladas || 0),
      });
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar historial de ventas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const selectedSaleLabel = useMemo(() => {
    if (!selectedSale) return "";
    return selectedSale.cliente ? `${selectedSale.ventaId} | ${selectedSale.cliente}` : selectedSale.ventaId;
  }, [selectedSale]);

  const openCancelModal = (sale) => {
    if (!sale || sale.estado === "Anulada") return;
    setSelectedSale(sale);
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setIsCancelModalOpen(false);
    setSelectedSale(null);
    setCancelReason("");
  };

  const handleCancelSale = async (event) => {
    event.preventDefault();
    if (!selectedSale) return;

    const motivo = cancelReason.trim();
    if (!motivo) {
      setErrorMessage("Debes indicar el motivo de anulacion.");
      return;
    }

    setCancelSubmitting(true);
    setErrorMessage("");
    try {
      await requestJson(endpoints.adminSaleCancel(selectedSale.ventaId), {
        method: "POST",
        token: getAdminToken(),
        body: { motivo },
      });
      setIsCancelModalOpen(false);
      setSelectedSale(null);
      setCancelReason("");
      window.dispatchEvent(new CustomEvent("adminSalesUpdated"));
      await loadSales();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible anular la venta.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
          <p className="text-slate-500 text-sm">Consulta las ventas registradas en el sistema.</p>
        </div>
        <Link to="/admin/ventas/nueva">
          <Button
            variant="outline"
            aria-label="Nueva Venta"
            title="Nueva Venta"
            className="h-10 px-4 text-sm text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
          >
            Nueva Venta
          </Button>
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-white text-xs sm:text-sm text-slate-600 flex flex-wrap gap-4">
          <span>Total ventas activas: <strong className="text-slate-800">{formatCurrency(summary.totalVentas)}</strong></span>
          <span>Registros: <strong className="text-slate-800">{summary.totalRegistros}</strong></span>
          <span>Anuladas: <strong className="text-slate-800">{summary.totalAnuladas}</strong></span>
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando historial..." className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Venta</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acciones</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((sale) => (
                  <tr key={sale.id} className={`transition-colors ${sale.estado === "Anulada" ? "bg-slate-50/70" : "hover:bg-slate-50"}`}>
                    <td className="px-6 py-4 font-medium text-slate-900">{sale.ventaId}</td>
                    <td className="px-6 py-4">{formatDate(sale.fecha)}</td>
                    <td className="px-6 py-4">{sale.detalle}</td>
                    <td className="px-6 py-4">{sale.cantidad}</td>
                    <td className="px-6 py-4">{sale.usuario}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-md px-2 py-1 text-xs font-bold ${getStatusClasses(sale.estado)}`}>
                          {sale.estado}
                        </span>
                        {sale.estado === "Anulada" && sale.showSaleAction && sale.motivoAnulacion && (
                          <span className="max-w-[240px] text-xs text-slate-500">
                            {sale.motivoAnulacion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sale.showSaleAction ? (
                        sale.estado === "Anulada" ? (
                          <span className="text-xs text-slate-400">
                            {sale.anuladaAt ? `Anulada ${formatDate(sale.anuladaAt)}` : "Ya anulada"}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="danger"
                            className="h-9 px-3 text-xs"
                            onClick={() => openCancelModal(sale)}
                          >
                            Anular venta
                          </Button>
                        )
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(sale.monto)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                      No hay ventas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isCancelModalOpen} onClose={closeCancelModal} title="Anular venta" maxWidthClass="max-w-xl">
        <form onSubmit={handleCancelSale} className="space-y-5">
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Esta accion no elimina la venta. La marca como anulada y regresa el stock de sus productos.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Venta</div>
              <div className="mt-1 font-semibold text-slate-900">{selectedSaleLabel || "-"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
              <div className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedSale?.totalVenta || 0)}</div>
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="motivo-anulacion">Motivo de anulacion</label>
            <textarea
              id="motivo-anulacion"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="form-input min-h-[120px] resize-none"
              placeholder="Ej. cliente solicito cancelacion o se registro con productos incorrectos."
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="h-11 px-5" onClick={closeCancelModal}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" className="h-11 px-5" disabled={cancelSubmitting}>
              {cancelSubmitting ? "Anulando..." : "Confirmar anulacion"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
