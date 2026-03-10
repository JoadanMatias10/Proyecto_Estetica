import React, { useMemo, useState } from "react";
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
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildCsv(rows) {
  const header = ["Fecha", "Tipo", "Detalle", "Usuario", "Monto"];
  const lines = rows.map((row) => [
    row.fecha,
    row.tipo,
    row.detalle,
    row.usuario,
    Number(row.monto || 0).toFixed(2),
  ]);
  const all = [header, ...lines];
  return all
    .map((line) =>
      line
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function GenerarReportes() {
  const [filters, setFilters] = useState({ desde: "", hasta: "", tipo: "Todos" });
  const [generated, setGenerated] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    totalVentas: 0,
    totalServicios: 0,
    totalRegistros: 0,
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasRows = useMemo(() => rows.length > 0, [rows]);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await requestJson(endpoints.adminReports(filters), {
        token: getAdminToken(),
      });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || {
        total: 0,
        totalVentas: 0,
        totalServicios: 0,
        totalRegistros: 0,
      });
      setGenerated(true);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible generar el reporte.");
      setGenerated(false);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!hasRows) return;
    const csv = buildCsv(rows);
    const now = new Date().toISOString().slice(0, 10);
    downloadTextFile(`reporte-${now}.csv`, csv, "text/csv;charset=utf-8;");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Generar Reportes</h1>
        <p className="text-slate-500 text-sm">Consulta detallada de ventas y servicios por periodo.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="form-label">Fecha Inicio</label>
            <input
              type="date"
              className="form-input"
              value={filters.desde}
              onChange={(e) => setFilters((prev) => ({ ...prev, desde: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Fecha Fin</label>
            <input
              type="date"
              className="form-input"
              value={filters.hasta}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasta: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Tipo de Reporte</label>
            <select
              className="form-input"
              value={filters.tipo}
              onChange={(e) => setFilters((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="Todos">General (Ventas y Servicios)</option>
              <option value="Venta">Solo Ventas de Productos</option>
              <option value="Servicio">Solo Servicios</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 text-violet-600 font-semibold hover:text-violet-700 transition-colors py-2 disabled:opacity-60"
          >
            <SidebarIcon name="reports" className="h-4 w-4" />
            <span>{loading ? "Generando..." : "Generar Reporte"}</span>
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {loading && (
        <LoadingSpinner fullScreen={false} text="Generando reporte..." className="py-12" />
      )}

      {generated && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Resultados del Reporte</h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCsv}
                disabled={!hasRows}
                className="text-xs px-3 py-1 h-8"
              >
                Descargar CSV
              </Button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 bg-white text-xs sm:text-sm text-slate-600 flex flex-wrap gap-4">
            <span>Total: <strong className="text-slate-800">{formatCurrency(summary.total)}</strong></span>
            <span>Ventas: <strong className="text-violet-700">{formatCurrency(summary.totalVentas)}</strong></span>
            <span>Servicios: <strong className="text-rose-700">{formatCurrency(summary.totalServicios)}</strong></span>
            <span>Registros: <strong className="text-slate-800">{summary.totalRegistros}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Detalle</th>
                  <th className="px-6 py-4">Vendedor/Estilista</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">{item.fecha}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.tipo === "Venta" ? "bg-violet-50 text-violet-600" : "bg-rose-50 text-rose-600"}`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{item.detalle}</td>
                    <td className="px-6 py-4">{item.usuario}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(item.monto)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-8 text-slate-400">No se encontraron datos con los filtros seleccionados.</td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 font-bold text-slate-800">
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-right">Total Generado:</td>
                    <td className="px-6 py-4 text-right text-rose-600">
                      {formatCurrency(summary.total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
