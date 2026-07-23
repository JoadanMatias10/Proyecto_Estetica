import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { getClientToken } from "../../utils/clientStore";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function canClientModifyAppointment(appointment) {
  return ["pendiente", "programada", "confirmada"].includes(String(appointment?.estado || "").toLowerCase());
}

export default function ReprogramarCita() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentIdFromUrl = searchParams.get("appointmentId") || "";
  const [appointments, setAppointments] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointmentIdFromUrl);
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadAppointments = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const [appointmentsData, stylistsData] = await Promise.all([
          requestJson(endpoints.clientAppointments, { token }),
          requestJson(endpoints.clientStylists, { token }),
        ]);
        const activeAppointments = (Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : [])
          .filter(canClientModifyAppointment);
        const loadedStylists = Array.isArray(stylistsData.stylists) ? stylistsData.stylists : [];
        setAppointments(activeAppointments);
        setStylists(loadedStylists);

        const existsFromUrl = activeAppointments.some((appointment) => String(appointment.id) === String(appointmentIdFromUrl));
        const nextAppointmentId = existsFromUrl ? appointmentIdFromUrl : activeAppointments[0]?.id || "";
        const nextAppointment = activeAppointments.find((appointment) => String(appointment.id) === String(nextAppointmentId));
        setSelectedAppointmentId(nextAppointmentId);
        setSelectedStylistId(nextAppointment?.stylistId || loadedStylists[0]?.id || "");
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar tus citas.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointments();
  }, [appointmentIdFromUrl]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => String(appointment.id) === String(selectedAppointmentId)) || null,
    [appointments, selectedAppointmentId]
  );

  useEffect(() => {
    if (!selectedAppointment) return;
    setSelectedStylistId(selectedAppointment.stylistId || stylists[0]?.id || "");
  }, [selectedAppointment, stylists]);

  useEffect(() => {
    const loadAvailability = async () => {
      setAvailableSlots([]);
      setHora("");
      if (!selectedStylistId || !fecha) return;

      setAvailabilityLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const data = await requestJson(
          endpoints.clientStylistAvailability(selectedStylistId, { desde: fecha, hasta: fecha, serviceId: selectedAppointment?.serviceId || "" }),
          { token }
        );
        const day = Array.isArray(data.days) ? data.days[0] : null;
        setAvailableSlots(Array.isArray(day?.slots) ? day.slots : []);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar horarios disponibles.");
      } finally {
        setAvailabilityLoading(false);
      }
    };

    loadAvailability();
  }, [selectedStylistId, fecha, selectedAppointment]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!selectedAppointment) {
      setErrorMessage("Selecciona una cita.");
      return;
    }
    if (!selectedStylistId) {
      setErrorMessage("Selecciona un estilista.");
      return;
    }
    if (!hora) {
      setErrorMessage("Selecciona un horario disponible.");
      return;
    }

    setIsSaving(true);
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientAppointmentReprogram(selectedAppointment.id), {
        method: "POST",
        token,
        body: { fecha, hora, stylistId: selectedStylistId },
      });
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === selectedAppointment.id ? data.appointment : appointment
        )
      );
      setMessage(data.message || "Cita reprogramada.");
      setFecha("");
      setHora("");
    } catch (error) {
      setErrorMessage(error.message || "No fue posible reprogramar la cita.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando citas..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="page-title">Reprogramar cita</h1>
        <p className="page-subtitle mt-2">Selecciona una cita y define nueva fecha y hora.</p>
      </div>

      <form onSubmit={handleSubmit} className="card mt-8 space-y-6 p-4 sm:p-8">
        {(message || errorMessage) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {message || errorMessage}
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

        <div>
          <label className="form-label">Estilista</label>
          <select
            className="form-input"
            value={selectedStylistId}
            onChange={(event) => setSelectedStylistId(event.target.value)}
            disabled={stylists.length === 0}
          >
            {stylists.length === 0 ? (
              <option>No hay estilistas disponibles</option>
            ) : (
              stylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {stylist.nombre}
                </option>
              ))
            )}
          </select>
        </div>

        {selectedAppointment && (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-700">
            Cita actual: {formatDateTime(selectedAppointment.fechaHora)}
          </div>
        )}

        <div>
          <label className="form-label">Nueva fecha</label>
          <input type="date" className="form-input" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </div>
        <div>
          <label className="form-label">Nueva hora</label>
          <select
            className="form-input"
            value={hora}
            onChange={(event) => setHora(event.target.value)}
            disabled={!fecha || availabilityLoading || availableSlots.length === 0}
          >
            {!fecha ? (
              <option>Selecciona fecha</option>
            ) : availabilityLoading ? (
              <option>Cargando horarios...</option>
            ) : availableSlots.length === 0 ? (
              <option>Sin horarios libres</option>
            ) : (
              <>
                <option value="">Selecciona hora</option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <Button type="submit" disabled={isSaving || !selectedAppointment || !selectedStylistId || !hora} className="w-full py-4 rounded-xl">
          {isSaving ? "Guardando..." : "Confirmar reprogramacion"}
        </Button>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link to="/cliente/citas">
            <Button type="button" variant="outline" className="w-full py-3 rounded-xl border-2">Volver a citas</Button>
          </Link>
          <Button type="button" variant="outline" onClick={() => navigate("/cliente/citas/calendario")} className="w-full py-3 rounded-xl border-2">
            Ver calendario
          </Button>
        </div>
      </form>
    </div>
  );
}
