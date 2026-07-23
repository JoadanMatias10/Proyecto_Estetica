import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SidebarIcon from "../components/ui/SidebarIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../api";

function getEstilistaToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function getEstilistaUser() {
  try {
    const raw = localStorage.getItem("adminUser") || localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ estado }) {
  const map = {
    pendiente:  { cls: "badge badge-amber",   label: "Pendiente" },
    confirmada: { cls: "badge badge-violet",  label: "Confirmada" },
    completada: { cls: "badge badge-emerald", label: "Completada" },
    cancelada:  { cls: "badge badge-rose",    label: "Cancelada" },
  };
  const { cls, label } = map[estado?.toLowerCase()] ?? { cls: "badge", label: estado };
  return <span className={cls}>{label}</span>;
}

export default function DashboardEstilista() {
  const user = getEstilistaUser();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [citasHoy, setCitasHoy] = useState([]);
  const [serviciosRealizados, setServiciosRealizados] = useState([]);
  const latestRef = useRef(0);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    const reqId = ++latestRef.current;
    if (!silent) { setLoading(true); setErrorMessage(""); }

    const token = getEstilistaToken();
    const today = toLocalDateString(new Date());

    try {
      const appointmentsData = await requestJson(
        endpoints.stylistAppointments({ desde: today, hasta: today }),
        { token }
      );
      if (latestRef.current !== reqId) return;

      const registros = Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : [];

      // Citas de hoy (pendientes/confirmadas) y servicios realizados (completadas)
      setCitasHoy(registros.filter((r) => ["pendiente", "confirmada"].includes(r.estado?.toLowerCase())));
      setServiciosRealizados(registros.filter((r) => r.estado?.toLowerCase() === "completada"));
      setErrorMessage("");
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar la información del dashboard.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Refresco automático cada 30 s
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") void loadData({ silent: true }); };
    const id = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [loadData]);

  const stats = useMemo(() => [
    {
      title: "Citas asignadas hoy",
      value: String(citasHoy.length),
      icon: "appointments",
      container: "border-rose-100",
      iconWrap: "bg-rose-50 text-rose-600",
    },
    {
      title: "Servicios realizados hoy",
      value: String(serviciosRealizados.length),
      icon: "services",
      container: "border-violet-100",
      iconWrap: "bg-violet-50 text-violet-600",
    },
  ], [citasHoy, serviciosRealizados]);

  const quickActions = [
    { to: "/estilista/citas",         label: "Ver Citas",         icon: "appointments", card: "hover:bg-rose-50 hover:border-rose-200",   iconWrap: "bg-rose-100 text-rose-600",   text: "group-hover:text-rose-700" },
    { to: "/estilista/servicios",     label: "Servicios",         icon: "services",     card: "hover:bg-violet-50 hover:border-violet-200", iconWrap: "bg-violet-100 text-violet-600", text: "group-hover:text-violet-700" },
    { to: "/estilista/agenda",        label: "Mi Agenda",         icon: "calendar",     card: "hover:bg-cyan-50 hover:border-cyan-200",    iconWrap: "bg-cyan-100 text-cyan-600",   text: "group-hover:text-cyan-700" },
    { to: "/estilista/horario",       label: "Horario",           icon: "stats",        card: "hover:bg-emerald-50 hover:border-emerald-200", iconWrap: "bg-emerald-100 text-emerald-600", text: "group-hover:text-emerald-700" },
    { to: "/estilista/notificaciones",label: "Notificaciones",    icon: "notifications",card: "hover:bg-amber-50 hover:border-amber-200",  iconWrap: "bg-amber-100 text-amber-600", text: "group-hover:text-amber-700" },
  ];

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="page-title">
          Bienvenido{user?.nombre ? `, ${user.nombre}` : ""}
        </h1>
        <p className="text-slate-500 mt-2">
          Aqui tienes un resumen de tu actividad de hoy y accesos directos a tus herramientas.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* Tarjetas resumen */}
      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando resumen..." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.map((stat) => (
            <div key={stat.title} className={`bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4 ${stat.container}`}>
              <div className={`p-3 rounded-xl ${stat.iconWrap}`}>
                <SidebarIcon name={stat.icon} className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm text-slate-500 font-medium">{stat.title}</div>
                <div className="text-3xl font-bold text-slate-800">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`p-4 bg-white border border-slate-100 rounded-xl transition-all shadow-sm group text-center flex flex-col items-center justify-center gap-2 ${action.card}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${action.iconWrap}`}>
                <SidebarIcon name={action.icon} className="h-5 w-5" />
              </div>
              <span className={`text-sm font-semibold text-slate-700 ${action.text}`}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Citas asignadas hoy */}
      {!loading && citasHoy.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Citas Asignadas Hoy</h2>
            <Link to="/estilista/citas" className="text-sm text-violet-600 font-semibold hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="table-container">
            <table className="min-w-[640px] w-full divide-y divide-slate-100">
              <thead className="table-header">
                <tr>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Servicio</th>
                  <th className="table-cell">Hora</th>
                  <th className="table-cell">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {citasHoy.slice(0, 5).map((cita, idx) => (
                  <tr key={cita.id || cita._id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell text-sm font-medium text-slate-800">{cita.cliente || "—"}</td>
                    <td className="table-cell text-sm text-slate-600">{cita.servicio || "—"}</td>
                    <td className="table-cell text-sm text-slate-600">{formatDateTime(cita.fechaHora)}</td>
                    <td className="table-cell"><StatusBadge estado={cita.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Servicios realizados hoy */}
      {!loading && serviciosRealizados.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Servicios Realizados Hoy</h2>
            <Link to="/estilista/servicios" className="text-sm text-violet-600 font-semibold hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="table-container">
            <table className="min-w-[640px] w-full divide-y divide-slate-100">
              <thead className="table-header">
                <tr>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Servicio</th>
                  <th className="table-cell">Hora</th>
                  <th className="table-cell">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {serviciosRealizados.slice(0, 5).map((srv, idx) => (
                  <tr key={srv.id || srv._id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell text-sm font-medium text-slate-800">{srv.cliente || "—"}</td>
                    <td className="table-cell text-sm text-slate-600">{srv.servicio || "—"}</td>
                    <td className="table-cell text-sm text-slate-600">{formatDateTime(srv.fechaHora)}</td>
                    <td className="table-cell"><StatusBadge estado={srv.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && citasHoy.length === 0 && serviciosRealizados.length === 0 && (
        <div className="card p-10 text-center">
          <SidebarIcon name="appointments" className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No hay citas ni servicios registrados para hoy.</p>
        </div>
      )}
    </div>
  );
}
