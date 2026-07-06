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

export default function RecordarCita() {
  const [settings, setSettings] = useState(() => getReminderSettings());
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = getClientToken();
        const [appointmentsData, settingsData] = await Promise.all([
          requestJson(endpoints.clientAppointments, { token }),
          requestJson(endpoints.clientNotificationSettings, { token }),
        ]);
        setAppointments(Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []);
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
    </div>
  );
}
