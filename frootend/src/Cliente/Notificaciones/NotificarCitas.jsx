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

function isActiveAppointment(appointment) {
  return ["pendiente", "programada", "confirmada"].includes(String(appointment?.estado || "").toLowerCase());
}

export default function NotificarCitas() {
  const [reminderSettings, setReminderSettings] = useState(() => getReminderSettings());
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [messageText, setMessageText] = useState("Hola, te recordamos tu cita en Estetica Panamericana. Te esperamos.");
  const [sentMessage, setSentMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const token = getClientToken();
        const [appointmentsData, settingsData] = await Promise.all([
          requestJson(endpoints.clientAppointments, { token }),
          requestJson(endpoints.clientNotificationSettings, { token }),
        ]);
        const activeAppointments = (Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : [])
          .filter(isActiveAppointment);
        setAppointments(activeAppointments);
        setSelectedAppointmentId(activeAppointments[0]?.id || "");
        if (settingsData.reminderSettings) {
          setReminderSettings(settingsData.reminderSettings);
          saveReminderSettings(settingsData.reminderSettings);
        }
      } catch (_error) {
        setAppointments([]);
      }
    };

    loadAppointments();
  }, []);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => String(appointment.id) === String(selectedAppointmentId)) || null,
    [appointments, selectedAppointmentId]
  );

  const handleSend = async () => {
    if (!selectedAppointment) {
      setSentMessage("Selecciona una cita activa.");
      return;
    }
    setIsSaving(true);
    setSentMessage("");
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientNotificationPrepare, {
        method: "POST",
        token,
        body: {
          appointmentId: selectedAppointment.id,
          messageText,
        },
      });
      setSentMessage(data.message || `Notificacion preparada por ${reminderSettings.canal} para ${formatDateTime(selectedAppointment.fechaHora)}.`);
    } catch (error) {
      setSentMessage(error.message || "No fue posible preparar la notificacion.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Notificar citas</h1>
      <p className="page-subtitle mt-2">Prepara el aviso de tu proxima cita.</p>

      <div className="card mt-8 p-8 space-y-6">
        {sentMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {sentMessage}
          </div>
        )}

        <div>
          <label className="form-label">Cita</label>
          <select
            className="form-input"
            value={selectedAppointmentId}
            onChange={(event) => setSelectedAppointmentId(event.target.value)}
            disabled={appointments.length === 0}
          >
            {appointments.length === 0 ? (
              <option>No tienes citas activas</option>
            ) : (
              appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.servicio} - {formatDateTime(appointment.fechaHora)}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-700">
          Canal configurado: {reminderSettings.canal}. Anticipacion: {reminderSettings.anticipacion}.
        </div>

        <div>
          <label className="form-label">Mensaje</label>
          <textarea
            rows="4"
            className="form-input resize-none"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
          />
        </div>

        <Button type="button" onClick={handleSend} disabled={isSaving} className="w-full py-4 rounded-xl">
          {isSaving ? "Preparando..." : "Preparar notificacion"}
        </Button>

        <Link to="/cliente/notificaciones" className="block text-center text-sm font-semibold text-violet-600 hover:text-violet-700">
          Volver a recordatorios
        </Link>
      </div>
    </div>
  );
}
