import React, { useCallback, useEffect, useRef, useState } from "react";
import SidebarIcon from "../components/ui/SidebarIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../api";

function getToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function toLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ServiciosRealizados() {
  const today = toLocalDateString(new Date());

  // Por defecto: último mes
  const firstOfMonth = toLocalDateString(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [desde, setDesde] = useState(firstOfMonth);
  const [hasta, setHasta] = useState(today);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [servicios, setServicios]   = useState([]);
  const latestRef = useRef(0);

  const loadServicios = useCallback(async () => {
    const reqId = ++latestRef.current;
    setLoading(true);
    setErrorMessage("");

    try {
      const token = getToken();
      const data  = await requestJson(
        endpoints.stylistAppointments({ desde, hasta, estado: "Completada" }),
        { token }
      );
      if (latestRef.current !== reqId) return;

      const registros = Array.isArray(data.appointments) ? data.appointments : [];
      // Solo mostrar servicios completados
      setServicios(registros.filter((r) => r.estado?.toLowerCase() === "completada"));
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar los servicios realizados.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void loadServicios(); }, [loadServicios]);

  const filtered = servicios.filter((s) =>
    !search ||
    s.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    s.servicio?.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupado por tipo de servicio para el resumen
  const resumenServicios = servicios.reduce((acc, s) => {
    const key = s.servicio || "Sin nombre";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topServicios = Object.entries(resumenServicios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="page-title">Servicios Realizados</h1>
        <p className="text-slate-500 mt-1">Historial de todos los servicios que has completado.</p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="form-label">Buscar</label>
          <div className="relative">
            <SidebarIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-buscar-servicios"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente o servicio..."
              className="search-input"
            />
          </div>
        </div>
        <div>
          <label className="form-label">Desde</label>
          <input
            id="input-desde-servicios"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Hasta</label>
          <input
            id="input-hasta-servicios"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="form-input"
          />
        </div>
        <button
          id="btn-buscar-servicios"
          onClick={loadServicios}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          Buscar
        </button>
      </div>

      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando servicios..." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tabla principal */}
          <div className="lg:col-span-2 space-y-4">
            {/* Badge total */}
            <div className="flex items-center gap-3">
              <span className="badge badge-emerald">Total completados: {servicios.length}</span>
              {search && <span className="badge badge-violet">Filtrados: {filtered.length}</span>}
            </div>

            {filtered.length === 0 ? (
              <div className="card p-10 text-center">
                <SidebarIcon name="services" className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No se encontraron servicios realizados en este período.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="table-header">
                    <tr>
                      <th className="table-cell text-left">#</th>
                      <th className="table-cell text-left">Cliente</th>
                      <th className="table-cell text-left">Servicio</th>
                      <th className="table-cell text-left">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((srv, idx) => (
                      <tr key={srv.id || srv._id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="table-cell text-xs text-slate-400">{idx + 1}</td>
                        <td className="table-cell text-sm font-medium text-slate-800">{srv.cliente || "—"}</td>
                        <td className="table-cell text-sm text-slate-600">{srv.servicio || "—"}</td>
                        <td className="table-cell text-sm text-slate-600">{formatDateTime(srv.fechaHora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Panel de resumen */}
          <div className="space-y-4">
            {/* Tarjeta total */}
            <div className="bg-gradient-to-br from-rose-50 to-violet-50 border border-violet-100 rounded-2xl p-5 text-center shadow-sm">
              <div className="text-4xl font-bold bg-gradient-to-r from-rose-500 to-violet-600 bg-clip-text text-transparent">
                {servicios.length}
              </div>
              <div className="text-sm font-medium text-slate-500 mt-1">Servicios completados</div>
              <div className="text-xs text-slate-400 mt-0.5">en el período seleccionado</div>
            </div>

            {/* Top servicios */}
            {topServicios.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <SidebarIcon name="stats" className="h-4 w-4 text-violet-500" />
                  Servicios más realizados
                </h3>
                <div className="space-y-2">
                  {topServicios.map(([nombre, count], i) => (
                    <div key={nombre} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-700 font-medium flex-1 truncate">{nombre}</span>
                      <span className="badge badge-emerald">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
