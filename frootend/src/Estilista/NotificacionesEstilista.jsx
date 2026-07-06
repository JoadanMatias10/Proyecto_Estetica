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

function formatRelativeTime(value) {
  if (!value) return "";
  const diff = new Date(value) - new Date();
  const mins = Math.round(diff / 60000);
  if (mins < 0)   return "Ya pasó";
  if (mins < 60)  return `En ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)   return `En ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `En ${days} día${days !== 1 ? "s" : ""}`;
}

function urgencyColor(value) {
  if (!value) return "border-slate-100";
  const mins = Math.round((new Date(value) - new Date()) / 60000);
  if (mins < 0)    return "border-slate-200 opacity-60";
  if (mins < 60)   return "border-rose-300";
  if (mins < 240)  return "border-amber-300";
  return "border-violet-200";
}

export default function NotificacionesEstilista() {
  const [loading, setLoading]         = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [proximas, setProximas]       = useState([]);
  const [pasadas, setPasadas]         = useState([]);
  const latestRef = useRef(0);

  const loadNotificaciones = useCallback(async ({ silent = false } = {}) => {
    const reqId = ++latestRef.current;
    if (!silent) { setLoading(true); setErrorMessage(""); }

    try {
      const token = getToken();
      const today = toLocalDateString(new Date());

      // Citas de hoy y mañana para notificaciones
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const hasta   = toLocalDateString(tomorrow);

      const data = await requestJson(
        endpoints.stylistAppointments({ desde: today, hasta }),
        { token }
      );
      if (latestRef.current !== reqId) return;

      const registros = Array.isArray(data.appointments) ? data.appointments : [];
      const now = new Date();

      const futuras = registros
        .filter((r) => r.fechaHora && new Date(r.fechaHora) >= now && r.estado?.toLowerCase() !== "cancelada")
        .sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

      const anteriores = registros
        .filter((r) => r.fechaHora && new Date(r.fechaHora) < now)
        .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

      setProximas(futuras);
      setPasadas(anteriores);
      setErrorMessage("");
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar las notificaciones.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotificaciones(); }, [loadNotificaciones]);

  // Auto-refresco cada 60 s para mantener los avisos actualizados
  useEffect(() => {
    const id = window.setInterval(() => void loadNotificaciones({ silent: true }), 60000);
    return () => window.clearInterval(id);
  }, [loadNotificaciones]);

  const CitaCard = ({ cita, showRelative = false }) => {
    const rel = showRelative ? formatRelativeTime(cita.fechaHora) : null;
    const isUrgent = showRelative && rel && rel.includes("min");

    return (
      <div className={`card p-4 border-l-4 ${urgencyColor(cita.fechaHora)} flex gap-4 items-start hover:shadow-md transition-shadow`}>
        {/* Icono urgencia */}
        <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isUrgent ? "bg-rose-100 text-rose-600" : "bg-violet-50 text-violet-600"
        }`}>
          <SidebarIcon name={isUrgent ? "notifications" : "appointments"} className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{cita.cliente || "Cliente"}</span>
            {rel && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isUrgent ? "bg-rose-100 text-rose-600" : "bg-violet-50 text-violet-600"
              }`}>
                {rel}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{cita.servicio || "Servicio"}</p>
          <p className="text-xs text-slate-400 mt-1">{formatDateTime(cita.fechaHora)}</p>
          {cita.notas && (
            <p className="text-xs text-slate-400 mt-1 italic">"{cita.notas}"</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="text-slate-500 mt-1">Avisos de tus próximas citas y actividad reciente.</p>
        </div>
        <button
          id="btn-refrescar-notificaciones"
          onClick={() => void loadNotificaciones()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all"
        >
          <SidebarIcon name="stats" className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando notificaciones..." className="py-16" />
      ) : (
        <>
          {/* Aviso de próximas citas */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <SidebarIcon name="notifications" className="h-4 w-4 text-rose-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Próximas Citas</h2>
              <span className="badge badge-rose">{proximas.length}</span>
            </div>

            {proximas.length === 0 ? (
              <div className="card p-8 text-center">
                <SidebarIcon name="appointments" className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No tienes citas próximas para hoy ni mañana.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proximas.map((cita, idx) => (
                  <CitaCard key={cita.id || cita._id || idx} cita={cita} showRelative />
                ))}
              </div>
            )}
          </section>

          {/* Actividad reciente */}
          {pasadas.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <SidebarIcon name="reports" className="h-4 w-4 text-slate-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Actividad Reciente</h2>
                <span className="badge">{pasadas.length}</span>
              </div>
              <div className="space-y-3">
                {pasadas.slice(0, 5).map((cita, idx) => (
                  <CitaCard key={cita.id || cita._id || idx} cita={cita} showRelative={false} />
                ))}
              </div>
            </section>
          )}

          {/* Panel sin actividad */}
          {proximas.length === 0 && pasadas.length === 0 && (
            <div className="card p-12 text-center">
              <SidebarIcon name="notifications" className="h-14 w-14 mx-auto text-slate-200 mb-4" />
              <h3 className="section-title text-slate-400">Sin actividad</h3>
              <p className="text-slate-400 mt-2 text-sm">
                No hay citas registradas para hoy ni mañana.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
