import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SidebarIcon from "../components/ui/SidebarIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../api";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

const DEFAULT_WEEKLY = [
  { day: 0, enabled: false, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 1, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 2, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 3, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 4, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 5, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 6, enabled: true, startTime: "10:00", endTime: "15:00", breakStart: "", breakEnd: "" },
];

const EMPTY_BLOCK = {
  startDate: "",
  endDate: "",
  allDay: true,
  startTime: "",
  endTime: "",
  reason: "",
};

function getToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function toLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekRange(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function getDayLabel(dateStr) {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric" }).format(
    new Date(`${dateStr}T00:00:00`)
  );
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(value));
}

function StatusBadge({ estado }) {
  const map = {
    pendiente: { cls: "badge badge-amber", label: "Pendiente" },
    confirmada: { cls: "badge badge-violet", label: "Confirmada" },
    completada: { cls: "badge badge-emerald", label: "Completada" },
    cancelada: { cls: "badge badge-rose", label: "Cancelada" },
  };
  const { cls, label } = map[estado?.toLowerCase()] ?? { cls: "badge", label: estado ?? "-" };
  return <span className={cls}>{label}</span>;
}

export default function HorarioTrabajo() {
  const today = toLocalDateString(new Date());
  const [weekBase, setWeekBase] = useState(today);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [citasSemana, setCitasSemana] = useState([]);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [weeklySchedule, setWeeklySchedule] = useState(DEFAULT_WEEKLY);
  const [blockedPeriods, setBlockedPeriods] = useState([]);
  const [newBlock, setNewBlock] = useState({ ...EMPTY_BLOCK });
  const latestRef = useRef(0);

  const { monday, sunday } = getWeekRange(new Date(`${weekBase}T00:00:00`));
  const desde = toLocalDateString(monday);
  const hasta = toLocalDateString(sunday);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + index);
        return toLocalDateString(d);
      }),
    [monday]
  );

  const loadSemana = useCallback(async () => {
    const reqId = ++latestRef.current;
    setLoading(true);
    setErrorMessage("");

    try {
      const token = getToken();
      const [appointmentsData, availabilityData] = await Promise.all([
        requestJson(endpoints.stylistAppointments({ desde, hasta }), { token }),
        requestJson(endpoints.stylistAvailability, { token }),
      ]);

      if (latestRef.current !== reqId) return;

      setCitasSemana(Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []);
      const availability = availabilityData.availability || {};
      setSlotMinutes(Number(availability.slotMinutes || 30));
      setWeeklySchedule(Array.isArray(availability.weeklySchedule) && availability.weeklySchedule.length ? availability.weeklySchedule : DEFAULT_WEEKLY);
      setBlockedPeriods(Array.isArray(availability.blockedPeriods) ? availability.blockedPeriods : []);
    } catch (err) {
      if (latestRef.current !== reqId) return;
      setErrorMessage(err.message || "No fue posible cargar el horario.");
    } finally {
      if (latestRef.current === reqId) setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void loadSemana();
  }, [loadSemana]);

  const updateDay = (day, patch) => {
    setWeeklySchedule((current) =>
      current.map((item) => (Number(item.day) === Number(day) ? { ...item, ...patch } : item))
    );
  };

  const addBlockedPeriod = () => {
    if (!newBlock.startDate) {
      setErrorMessage("Selecciona fecha de inicio para la ausencia.");
      return;
    }
    setBlockedPeriods((current) => [
      ...current,
      {
        ...newBlock,
        endDate: newBlock.endDate || newBlock.startDate,
      },
    ]);
    setNewBlock({ ...EMPTY_BLOCK });
    setErrorMessage("");
  };

  const removeBlockedPeriod = (index) => {
    setBlockedPeriods((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveAvailability = async () => {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await requestJson(endpoints.stylistAvailability, {
        method: "PUT",
        token: getToken(),
        body: {
          slotMinutes,
          weeklySchedule,
          blockedPeriods,
        },
      });
      const availability = data.availability || {};
      setSlotMinutes(Number(availability.slotMinutes || 30));
      setWeeklySchedule(Array.isArray(availability.weeklySchedule) ? availability.weeklySchedule : DEFAULT_WEEKLY);
      setBlockedPeriods(Array.isArray(availability.blockedPeriods) ? availability.blockedPeriods : []);
      setSuccessMessage(data.message || "Disponibilidad actualizada.");
    } catch (err) {
      setErrorMessage(err.message || "No fue posible guardar la disponibilidad.");
    } finally {
      setSaving(false);
    }
  };

  const semanaLabel = `${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(monday)} - ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(sunday)}`;

  const citasByDay = weekDays.reduce((acc, day) => {
    acc[day] = citasSemana.filter((cita) => {
      if (!cita.fechaHora) return false;
      return toLocalDateString(new Date(cita.fechaHora)) === day;
    });
    return acc;
  }, {});

  const totalSemana = citasSemana.length;
  const completadas = citasSemana.filter((cita) => cita.estado?.toLowerCase() === "completada").length;
  const pendientes = citasSemana.filter((cita) => ["pendiente", "confirmada"].includes(cita.estado?.toLowerCase())).length;

  if (loading) {
    return <LoadingSpinner fullScreen={false} text="Cargando horario..." className="py-16" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Horario de Trabajo</h1>
        <p className="text-slate-500 mt-1">Configura tus dias, horas disponibles y ausencias.</p>
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

      <section className="card p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Disponibilidad semanal</h2>
            <p className="text-sm text-slate-500">Estos horarios alimentan el calendario del cliente.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            Intervalo
            <select className="form-input w-28" value={slotMinutes} onChange={(event) => setSlotMinutes(event.target.value)}>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3">
          {weeklySchedule.map((day) => (
            <div key={day.day} className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 md:grid-cols-[150px_repeat(4,minmax(0,1fr))] md:items-end">
              <label className="flex items-center gap-3 font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(day.enabled)}
                  onChange={(event) => updateDay(day.day, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-violet-600"
                />
                {DAY_LABELS[day.day]}
              </label>
              <div>
                <label className="form-label">Entrada</label>
                <input type="time" className="form-input" value={day.startTime || ""} onChange={(event) => updateDay(day.day, { startTime: event.target.value })} disabled={!day.enabled} />
              </div>
              <div>
                <label className="form-label">Salida</label>
                <input type="time" className="form-input" value={day.endTime || ""} onChange={(event) => updateDay(day.day, { endTime: event.target.value })} disabled={!day.enabled} />
              </div>
              <div>
                <label className="form-label">Descanso inicio</label>
                <input type="time" className="form-input" value={day.breakStart || ""} onChange={(event) => updateDay(day.day, { breakStart: event.target.value })} disabled={!day.enabled} />
              </div>
              <div>
                <label className="form-label">Descanso fin</label>
                <input type="time" className="form-input" value={day.breakEnd || ""} onChange={(event) => updateDay(day.day, { breakEnd: event.target.value })} disabled={!day.enabled} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">Ausencias y bloqueos</h2>
          <p className="text-sm text-slate-500">Usalo para permisos, salidas o dias que no vas a atender.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-6 md:items-end">
          <div>
            <label className="form-label">Desde</label>
            <input type="date" className="form-input" value={newBlock.startDate} onChange={(event) => setNewBlock((current) => ({ ...current, startDate: event.target.value }))} />
          </div>
          <div>
            <label className="form-label">Hasta</label>
            <input type="date" className="form-input" value={newBlock.endDate} onChange={(event) => setNewBlock((current) => ({ ...current, endDate: event.target.value }))} />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={newBlock.allDay} onChange={(event) => setNewBlock((current) => ({ ...current, allDay: event.target.checked }))} className="h-4 w-4 accent-violet-600" />
            Todo el dia
          </label>
          <div>
            <label className="form-label">Inicio</label>
            <input type="time" className="form-input" value={newBlock.startTime} disabled={newBlock.allDay} onChange={(event) => setNewBlock((current) => ({ ...current, startTime: event.target.value }))} />
          </div>
          <div>
            <label className="form-label">Fin</label>
            <input type="time" className="form-input" value={newBlock.endTime} disabled={newBlock.allDay} onChange={(event) => setNewBlock((current) => ({ ...current, endTime: event.target.value }))} />
          </div>
          <button type="button" onClick={addBlockedPeriod} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">
            Agregar
          </button>
          <div className="md:col-span-6">
            <label className="form-label">Motivo</label>
            <input className="form-input" value={newBlock.reason} onChange={(event) => setNewBlock((current) => ({ ...current, reason: event.target.value }))} placeholder="Permiso, vacaciones, salida..." />
          </div>
        </div>

        {blockedPeriods.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay ausencias registradas.</p>
        ) : (
          <div className="space-y-2">
            {blockedPeriods.map((period, index) => (
              <div key={period.id || `${period.startDate}-${index}`} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold">{period.startDate}</span>
                  <span> a </span>
                  <span className="font-semibold">{period.endDate}</span>
                  <span className="ml-2 text-slate-500">{period.allDay ? "Todo el dia" : `${period.startTime} - ${period.endTime}`}</span>
                  {period.reason && <span className="ml-2 text-slate-400">{period.reason}</span>}
                </div>
                <button type="button" onClick={() => removeBlockedPeriod(index)} className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={saveAvailability} disabled={saving} className="rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar disponibilidad"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const d = new Date(`${weekBase}T00:00:00`);
              d.setDate(d.getDate() - 7);
              setWeekBase(toLocalDateString(d));
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all"
          >
            Semana anterior
          </button>
          <span className="font-bold text-slate-700 flex-1 text-center text-sm">{semanaLabel}</span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(`${weekBase}T00:00:00`);
              d.setDate(d.getDate() + 7);
              setWeekBase(toLocalDateString(d));
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all"
          >
            Semana siguiente
          </button>
          {weekBase !== today && (
            <button type="button" onClick={() => setWeekBase(today)} className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-all">
              Hoy
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { label: "Total semana", value: totalSemana, icon: "appointments", iconCls: "bg-slate-50 text-slate-600" },
            { label: "Pendientes", value: pendientes, icon: "calendar", iconCls: "bg-amber-50 text-amber-600" },
            { label: "Completadas", value: completadas, icon: "services", iconCls: "bg-emerald-50 text-emerald-600" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className={`p-3 rounded-xl ${item.iconCls}`}>
                <SidebarIcon name={item.icon} className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">{item.label}</div>
                <div className="text-2xl font-bold text-slate-800">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDays.map((dayStr) => {
            const isToday = dayStr === today;
            const dayCitas = citasByDay[dayStr] || [];
            return (
              <div key={dayStr} className={["rounded-2xl p-3 flex flex-col gap-2 min-h-[120px] transition-all", isToday ? "bg-gradient-to-br from-rose-50 to-violet-50 border-2 border-violet-300 shadow-md" : "bg-white border border-slate-100 shadow-sm"].join(" ")}>
                <div className={`text-xs font-bold uppercase tracking-wide capitalize ${isToday ? "text-violet-700" : "text-slate-500"}`}>
                  {getDayLabel(dayStr)}
                </div>

                {dayCitas.length === 0 ? (
                  <p className="text-xs text-slate-300 italic mt-1">Sin citas</p>
                ) : (
                  dayCitas.map((cita, idx) => (
                    <div key={cita.id || cita._id || idx} className="rounded-xl bg-white/80 border border-slate-100 p-2 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-xs font-bold text-rose-500">{formatTime(cita.fechaHora)}</div>
                      <div className="text-xs font-semibold text-slate-700 truncate">{cita.cliente || "-"}</div>
                      <div className="text-xs text-slate-500 truncate">{cita.servicio || "-"}</div>
                      <div className="mt-1"><StatusBadge estado={cita.estado} /></div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
