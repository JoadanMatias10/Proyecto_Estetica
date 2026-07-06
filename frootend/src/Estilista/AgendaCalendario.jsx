import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SidebarIcon from "../components/ui/SidebarIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../api";

function getToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function toLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(value));
}

// eslint-disable-next-line no-unused-vars
function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
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

/* ─── Calendario mini ─────────────────────────────────────────────────────── */
function MiniCalendar({ selectedDate, onSelectDate, markedDates }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const monthName    = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(viewDate);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const toStr = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      {/* Controles mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-violet-50 text-slate-500 hover:text-violet-600 flex items-center justify-center transition-colors"
          aria-label="Mes anterior"
        >‹</button>
        <span className="font-bold text-slate-800 capitalize text-sm">{monthName}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-violet-50 text-slate-500 hover:text-violet-600 flex items-center justify-center transition-colors"
          aria-label="Mes siguiente"
        >›</button>
      </div>

      {/* Días de semana */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-slate-400 py-1">{w}</div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const str     = toStr(day);
          const isToday = str === toLocalDateString(new Date());
          const isSel   = str === selectedDate;
          const hasApp  = markedDates?.includes(str);

          return (
            <button
              key={str}
              onClick={() => onSelectDate(str)}
              className={[
                "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all",
                isSel   ? "bg-gradient-to-br from-rose-500 to-violet-600 text-white shadow-md"
                        : isToday ? "border-2 border-violet-400 text-violet-700 font-bold"
                        : "hover:bg-violet-50 text-slate-700 hover:text-violet-700",
              ].join(" ")}
            >
              {day}
              {hasApp && !isSel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-rose-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────── */
export default function AgendaCalendario() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [loading, setLoading]           = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [citas, setCitas]               = useState([]);
  const [allDates, setAllDates]         = useState([]);
  const latestRef = useRef(0);

  const loadCitas = useCallback(async (date) => {
    const reqId = ++latestRef.current;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = getToken();
      const data  = await requestJson(
        endpoints.stylistAppointments({ desde: date, hasta: date }),
        { token }
      );
      if (latestRef.current !== reqId) return;

      const registros = Array.isArray(data.appointments) ? data.appointments : [];
      setCitas(registros);
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar las citas.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, []);

  // Carga del mes completo para marcar días con citas
  const loadMonthDates = useCallback(async () => {
    try {
      const token = getToken();
      const now   = new Date();
      const desde = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
      const hasta = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const data  = await requestJson(
        endpoints.stylistAppointments({ desde, hasta }),
        { token }
      );
      const registros = Array.isArray(data.appointments) ? data.appointments : [];
      const dates = [...new Set(registros
        .filter((r) => r.fechaHora)
        .map((r) => toLocalDateString(new Date(r.fechaHora))))];
      setAllDates(dates);
    } catch {
      // no crítico
    }
  }, []);

  useEffect(() => {
    void loadCitas(selectedDate);
  }, [loadCitas, selectedDate]);

  useEffect(() => {
    void loadMonthDates();
  }, [loadMonthDates]);

  const handleSelectDate = (date) => setSelectedDate(date);

  const pendientes  = citas.filter((c) => ["pendiente", "confirmada"].includes(c.estado?.toLowerCase()));
  const completadas = citas.filter((c) => c.estado?.toLowerCase() === "completada");

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
      void loadMonthDates();
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
    if (!id || estado === "cancelada" || estado === "completada") return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
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
        <h1 className="page-title">Agenda / Calendario</h1>
        <p className="text-slate-500 mt-1">
          Consulta y gestiona tus citas por fecha.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: calendario + enlace horario */}
        <div className="space-y-4">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            markedDates={allDates}
          />

          {/* Acceso rápido al horario */}
          <Link
            to="/estilista/horario"
            className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SidebarIcon name="stats" className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-violet-700">Horario de Trabajo</div>
              <div className="text-xs text-slate-500">Ver mi horario asignado</div>
            </div>
          </Link>
        </div>

        {/* Columna derecha: citas del día seleccionado */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center gap-3">
            <SidebarIcon name="calendar" className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-800">
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "full" }).format(
                new Date(selectedDate + "T00:00:00")
              )}
            </h2>
            <span className="badge badge-rose ml-auto">{citas.length} cita{citas.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <LoadingSpinner fullScreen={false} text="Cargando citas..." className="py-12" />
          ) : citas.length === 0 ? (
            <div className="card p-10 text-center">
              <SidebarIcon name="calendar" className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No hay citas para esta fecha.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {citas.map((cita, idx) => (
                <div key={cita.id || cita._id || idx} className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-violet-100 flex items-center justify-center shrink-0 font-bold text-rose-600">
                    {formatTime(cita.fechaHora)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{cita.cliente || "Cliente"}</span>
                      <StatusBadge estado={cita.estado} />
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{cita.servicio || "Servicio"}</p>
                    {cita.notas && <p className="text-xs text-slate-400 mt-1 italic">"{cita.notas}"</p>}
                    {renderActions(cita)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumen del día */}
          {!loading && citas.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{pendientes.length}</div>
                <div className="text-xs font-medium text-amber-600 mt-1">Por atender</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">{completadas.length}</div>
                <div className="text-xs font-medium text-emerald-600 mt-1">Completadas</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
