import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function getDefaultUsuario() {
  try {
    const raw = localStorage.getItem("adminUser");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.nombre || parsed?.username || "Admin";
  } catch (_error) {
    return "Admin";
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCsv(rows) {
  const header = ["Fecha", "Producto", "Accion", "Cantidad", "Usuario", "Stock Anterior", "Stock Actual"];
  const lines = rows.map((row) => [
    formatDateTime(row.createdAt),
    row.producto,
    row.accion,
    Number(row.cantidad || 0),
    row.usuario,
    Number(row.stockAnterior || 0),
    Number(row.stockActual || 0),
  ]);
  return [header, ...lines]
    .map((line) => line.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function ControlStock() {
  const [filter, setFilter] = useState("Todos");
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    producto: "",
    cantidad: "",
    accion: "Entrada",
    usuario: getDefaultUsuario(),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const [movementsData, alertsData] = await Promise.all([
        requestJson(endpoints.adminInventoryMovements({ action: filter }), { token }),
        requestJson(endpoints.adminInventoryAlerts(10), { token }),
      ]);
      setLogs(Array.isArray(movementsData.movements) ? movementsData.movements : []);
      setAlerts(Array.isArray(alertsData.alerts) ? alertsData.alerts : []);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setEntryForm({
      producto: "",
      cantidad: "",
      accion: "Entrada",
      usuario: getDefaultUsuario(),
    });
  };

  const handleEntryChange = (event) => {
    const { name, value } = event.target;
    setEntryForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterEntry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      await requestJson(endpoints.adminInventoryMovements({ action: "Todos" }), {
        method: "POST",
        token: getAdminToken(),
        body: {
          producto: entryForm.producto.trim(),
          cantidad: Number(entryForm.cantidad),
          accion: entryForm.accion,
          usuario: entryForm.usuario.trim(),
        },
      });
      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible registrar movimiento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!logs.length) return;
    const now = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventario-${now}.csv`, buildCsv(logs));
  };

  const alertMessage = useMemo(() => {
    if (alerts.length === 0) return "Sin alertas de stock bajo.";
    return `${alerts.length} producto(s) con stock bajo.`;
  }, [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Control de Inventario</h1>
          <p className="text-slate-500 text-sm">Monitorea el stock y revisa el historial de movimientos.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={!logs.length}
            className="inline-flex items-center gap-2 px-2 py-2 text-violet-600 font-semibold hover:text-violet-700 transition-colors disabled:opacity-50"
          >
            <SidebarIcon name="reports" className="h-4 w-4" />
            <span>Descargar Reporte</span>
          </button>
          <Button
            variant="outline"
            onClick={openModal}
            aria-label="Registrar movimiento"
            title="Registrar movimiento"
            className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
          >
            +
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">!</span>
        <div>
          <h3 className="font-bold text-amber-800">Alertas de Stock Bajo</h3>
          <p className="text-sm text-amber-700 mb-2">{alertMessage}</p>
          {alerts.length > 0 && (
            <ul className="list-disc list-inside text-sm text-amber-800">
              {alerts.map((item) => (
                <li key={item.id}>{item.nombre} ({item.stock} unidades)</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Historial de Movimientos</h3>
          <select className="text-sm border-slate-300 rounded-lg" onChange={(e) => setFilter(e.target.value)} value={filter}>
            <option>Todos</option>
            <option>Entrada</option>
            <option>Salida</option>
          </select>
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando movimientos..." className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Accion</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Stock Antes</th>
                  <th className="px-6 py-4">Stock Despues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{log.producto}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.accion === "Entrada" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{log.cantidad}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{log.usuario}</td>
                    <td className="px-6 py-4">{Number(log.stockAnterior || 0)}</td>
                    <td className="px-6 py-4">{Number(log.stockActual || 0)}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                      No hay movimientos para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Registrar movimiento">
        <form onSubmit={handleRegisterEntry} className="space-y-4">
          <div>
            <label className="form-label">Producto</label>
            <input
              name="producto"
              value={entryForm.producto}
              onChange={handleEntryChange}
              required
              className="form-input"
              placeholder="Nombre del producto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Cantidad</label>
              <input
                name="cantidad"
                type="number"
                min="1"
                value={entryForm.cantidad}
                onChange={handleEntryChange}
                required
                className="form-input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label">Accion</label>
              <select name="accion" value={entryForm.accion} onChange={handleEntryChange} className="form-input">
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Usuario</label>
            <input
              name="usuario"
              value={entryForm.usuario}
              onChange={handleEntryChange}
              className="form-input"
              placeholder="Admin"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
