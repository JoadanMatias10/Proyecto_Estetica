import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import { getClientToken, getReminderSettings, saveReminderSettings } from "../../utils/clientStore";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isUpcomingActiveAppointment(appointment) {
  return ["pendiente", "programada", "confirmada"].includes(String(appointment?.estado || "").toLowerCase());
}

function getNotificationStatusClass(status) {
  if (status === "enviada") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "lista_whatsapp") return "bg-sky-100 text-sky-700 border-sky-200";
  if (status === "fallida") return "bg-red-100 text-red-700 border-red-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function RecordarCita() {
  const [settings, setSettings] = useState(() => getReminderSettings());
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = getClientToken();
        const [appointmentsData, settingsData, notificationsData] = await Promise.all([
          requestJson(endpoints.clientAppointments, { token }),
          requestJson(endpoints.clientNotificationSettings, { token }),
          requestJson(endpoints.clientNotifications, { token }),
        ]);
        setAppointments(Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []);
        setNotifications(Array.isArray(notificationsData.notifications) ? notificationsData.notifications : []);
        if (settingsData.reminderSettings) {
          setSettings(settingsData.reminderSettings);
          saveReminderSettings(settingsData.reminderSettings);
        }
      } catch (_error) {
        try {
          const token = getClientToken();
          const data = await requestJson(endpoints.clientAppointments, { token });
          setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        } catch (_appointmentsError) {
          setAppointments([]);
        }
        setNotifications([]);
      }
    };

    loadData();
  }, []);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(isUpcomingActiveAppointment)
      .filter((appointment) => appointment.fechaHora && new Date(appointment.fechaHora) >= now)
      .sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora))[0];
  }, [appointments]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const handleSave = async () => {
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientReminderSettings, {
        method: "PUT",
        token,
        body: settings,
      });
      const nextSettings = data.reminderSettings || settings;
      setSettings(nextSettings);
      saveReminderSettings(nextSettings);
      setMessage(data.message || "Recordatorio guardado.");
    } catch (error) {
      saveReminderSettings(settings);
      setMessage(error.message || "Recordatorio guardado localmente.");
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h1 className="page-title">Recordar cita</h1>
          <p className="page-subtitle mt-1">Configura recordatorios para tus citas.</p>
        </div>
        <Link to="/cliente/notificaciones/enviar">
          <Button variant="outline" className="px-5 py-2.5 border-2 text-sm">Notificar citas</Button>
        </Link>
      </div>

      <div className="card p-6 md:p-8 space-y-5">
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {nextAppointment ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-700">
            Proxima cita: {nextAppointment.servicio} - {formatDateTime(nextAppointment.fechaHora)}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No tienes una cita proxima para recordar.
          </div>
        )}

        <div>
          <label className="form-label">Cuando recordar</label>
          <select name="anticipacion" className="form-input text-sm" value={settings.anticipacion} onChange={handleChange}>
            <option>24 horas antes</option>
            <option>12 horas antes</option>
            <option>2 horas antes</option>
          </select>
        </div>

        <div>
          <label className="form-label">Canal</label>
          <select name="canal" className="form-input text-sm" value={settings.canal} onChange={handleChange}>
            <option>Email</option>
            <option>WhatsApp</option>
            <option>Notificacion interna</option>
          </select>
        </div>

        <Button type="button" onClick={handleSave} className="w-full py-3 rounded-xl shadow-lg shadow-violet-200/50">
          Guardar configuracion
        </Button>
      </div>

      <div className="card p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Notificaciones recientes</h2>
            <p className="mt-1 text-sm text-slate-500">Envios por email, WhatsApp e internos.</p>
          </div>
          <Link to="/cliente/notificaciones/enviar">
            <Button variant="outline" className="px-4 py-2.5 border-2 text-sm">Enviar aviso</Button>
          </Link>
        </div>

        {notifications.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Aun no hay notificaciones registradas.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100">
            {notifications.map((notification) => (
              <div key={notification.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{notification.canal}</div>
                    <div className="mt-1 text-sm text-slate-500">{notification.mensaje}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-400">
                      {notification.fechaObjetivo ? formatDateTime(notification.fechaObjetivo) : "Sin fecha"} - {notification.origen}
                    </div>
                    {notification.errorEnvio && (
                      <div className="mt-2 text-xs font-semibold text-red-500">{notification.errorEnvio}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getNotificationStatusClass(notification.estado)}`}>
                      {notification.estado}
                    </span>
                    {notification.whatsappUrl && (
                      <a href={notification.whatsappUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                        Abrir WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
