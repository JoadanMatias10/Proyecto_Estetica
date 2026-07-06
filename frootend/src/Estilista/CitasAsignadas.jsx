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

function StatusBadge({ estado }) {
  const map = {
    pendiente:  { cls: "badge badge-amber",   label: "Pendiente" },
    confirmada: { cls: "badge badge-violet",  label: "Confirmada" },
    completada: { cls: "badge badge-emerald", label: "Completada" },
    cancelada:  { cls: "badge badge-rose",    label: "Cancelada" },
  };
  const { cls, label } = map[estado?.toLowerCase()] ?? { cls: "badge", label: estado ?? "—" };
  return <span className={cls}>{label}</span>;
}

export default function CitasAsignadas() {
  const today = toLocalDateString(new Date());
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [citas, setCitas]               = useState([]);
  const latestRef = useRef(0);

  const loadCitas = useCallback(async () => {
    const reqId = ++latestRef.current;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = getToken();
      const data  = await requestJson(
        endpoints.stylistAppointments({ desde, hasta }),
        { token }
      );
      if (latestRef.current !== reqId) return;
      setCitas(Array.isArray(data.appointments) ? data.appointments : []);
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar las citas.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void loadCitas(); }, [loadCitas]);

  const filtered = citas.filter((c) => {
    const matchEstado = filtroEstado === "Todos" || c.estado?.toLowerCase() === filtroEstado.toLowerCase();
    const matchSearch = !search ||
      c.cliente?.toLowerCase().includes(search.toLowerCase()) ||
      c.servicio?.toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchSearch;
  });

  const estadoOpts = ["Todos", "Pendiente", "Confirmada", "Completada", "Cancelada"];

  const handleStatusUpdate = async (appointmentId, estado) => {
    setUpdatingId(appointmentId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await requestJson(endpoints.stylistAppointmentStatus(appointmentId), {
        method: "PATCH",
        token: getToken(),
        body: { estado },
      });

      setCitas((current) =>
        current.map((cita) => (cita.id === appointmentId || cita._id === appointmentId ? data.appointment : cita))
      );
      setSuccessMessage(data.message || "Cita actualizada.");
    } catch (err) {
      setErrorMessage(err.message || "No fue posible actualizar la cita.");
    } finally {
      setUpdatingId("");
    }
  };

  const renderActions = (cita) => {
    const id = cita.id || cita._id;
    const estado = cita.estado?.toLowerCase();
    const isUpdating = updatingId === id;

    if (!id || estado === "cancelada" || estado === "completada") {
      return <span className="text-xs text-slate-400">Sin acciones</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {estado !== "confirmada" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusUpdate(id, "confirmada")}
            className="rounded-lg border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
          >
            Confirmar
          </button>
        )}
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusUpdate(id, "completada")}
          className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          Completar
        </button>
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusUpdate(id, "cancelada")}
          className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="page-title">Citas Asignadas</h1>
        <p className="text-slate-500 mt-1">Consulta todas las citas que tienes programadas.</p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        {/* Buscar */}
        <div className="flex-1 min-w-[160px]">
          <label className="form-label">Buscar</label>
          <div className="relative">
            <SidebarIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-buscar-citas"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente o servicio..."
              className="search-input"
            />
          </div>
        </div>

        {/* Desde */}
        <div>
          <label className="form-label">Desde</label>
          <input
            id="input-desde-citas"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Hasta */}
        <div>
          <label className="form-label">Hasta</label>
          <input
            id="input-hasta-citas"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Estado */}
        <div>
          <label className="form-label">Estado</label>
          <select
            id="select-estado-citas"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="form-input"
          >
            {estadoOpts.map((op) => <option key={op}>{op}</option>)}
          </select>
        </div>

        <button
          id="btn-buscar-citas"
          onClick={loadCitas}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          Buscar
        </button>
      </div>

      {/* Resumen badges */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          <span className="badge badge-rose">Total: {citas.length}</span>
          <span className="badge badge-amber">Pendientes: {citas.filter((c) => c.estado?.toLowerCase() === "pendiente").length}</span>
          <span className="badge badge-violet">Confirmadas: {citas.filter((c) => c.estado?.toLowerCase() === "confirmada").length}</span>
          <span className="badge badge-emerald">Completadas: {citas.filter((c) => c.estado?.toLowerCase() === "completada").length}</span>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando citas..." className="py-16" />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <SidebarIcon name="appointments" className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No se encontraron citas con los filtros seleccionados.</p>
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
                <th className="table-cell text-left">Estado</th>
                <th className="table-cell text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((cita, idx) => (
                <tr key={cita.id || cita._id || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="table-cell text-xs text-slate-400">{idx + 1}</td>
                  <td className="table-cell text-sm font-medium text-slate-800">{cita.cliente || "—"}</td>
                  <td className="table-cell text-sm text-slate-600">{cita.servicio || "—"}</td>
                  <td className="table-cell text-sm text-slate-600">{formatDateTime(cita.fechaHora)}</td>
                  <td className="table-cell"><StatusBadge estado={cita.estado} /></td>
                  <td className="table-cell">{renderActions(cita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
