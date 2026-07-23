import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { getClientToken } from "../../utils/clientStore";
import { fetchPublicServicesBundle } from "../../utils/publicCatalogApi";

function formatDateTime(value) {
  if (!value) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status) {
  return status === "cancelada"
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function canClientModifyAppointment(appointment) {
  return ["pendiente", "programada", "confirmada"].includes(String(appointment?.estado || "").toLowerCase());
}

function paymentStatusClass(status) {
  if (status === "Pagado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Pendiente") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Rechazado") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function hasActivePayment(appointment) {
  return ["Pendiente", "Pagado"].includes(appointment?.estatusPago || "Sin pago");
}

export default function AgendarCancelarCitas() {
  const [searchParams] = useSearchParams();
  const serviceIdFromUrl = searchParams.get("serviceId") || "";
  const stylistIdFromUrl = searchParams.get("stylistId") || "";
  const dateFromUrl = searchParams.get("date") || "";
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceIdFromUrl);
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [notas, setNotas] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const [servicesData, appointmentsData, stylistsData] = await Promise.all([
          fetchPublicServicesBundle(),
          requestJson(endpoints.clientAppointments, { token }),
          requestJson(endpoints.clientStylists, { token }),
        ]);

        const loadedServices = servicesData.services || [];
        const loadedStylists = Array.isArray(stylistsData.stylists) ? stylistsData.stylists : [];
        setServices(loadedServices);
        setStylists(loadedStylists);
        setAppointments(Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []);

        const existsFromUrl = loadedServices.some((service) => String(service.id) === String(serviceIdFromUrl));
        setSelectedServiceId(existsFromUrl ? serviceIdFromUrl : loadedServices[0]?.id || "");
        const existsStylistFromUrl = loadedStylists.some((stylist) => String(stylist.id) === String(stylistIdFromUrl));
        setSelectedStylistId(existsStylistFromUrl ? stylistIdFromUrl : loadedStylists[0]?.id || "");
        setFecha(/^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : "");
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar el modulo de citas.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [serviceIdFromUrl, stylistIdFromUrl, dateFromUrl]);

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
          endpoints.clientStylistAvailability(selectedStylistId, { desde: fecha, hasta: fecha, serviceId: selectedServiceId }),
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
  }, [selectedStylistId, selectedServiceId, fecha]);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(selectedServiceId)) || null,
    [selectedServiceId, services]
  );

  const activeAppointments = useMemo(
    () =>
      appointments
        .filter(canClientModifyAppointment)
        .sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora)),
    [appointments]
  );

  const handleSchedule = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!selectedService) {
      setErrorMessage("Selecciona un servicio.");
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
      const data = await requestJson(endpoints.clientAppointments, {
        method: "POST",
        token,
        body: {
          servicio: selectedService.nombre,
          serviceId: selectedService.id,
          stylistId: selectedStylistId,
          fecha,
          hora,
          notas,
        },
      });

      setAppointments((current) => [...current, data.appointment]);
      setFecha("");
      setHora("");
      setNotas("");
      setMessage(data.message || "Cita agendada correctamente.");
    } catch (error) {
      setErrorMessage(error.message || "No fue posible guardar la cita.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (appointmentId) => {
    setMessage("");
    setErrorMessage("");
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientAppointmentCancel(appointmentId), {
        method: "POST",
        token,
      });
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId ? data.appointment : appointment
        )
      );
      setMessage(data.message || "Cita cancelada.");
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cancelar la cita.");
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando citas..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h1 className="page-title">Gestion de citas</h1>
          <p className="page-subtitle mt-1">Agenda, cancela o reprograma tus citas.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/cliente/citas/calendario">
            <Button variant="outline" className="px-4 py-2 border-2 text-sm">Ver disponibilidad</Button>
          </Link>
          <Link to="/cliente/citas/reprogramar">
            <Button className="px-4 py-2 text-sm">Reprogramar</Button>
          </Link>
        </div>
      </div>

      {(message || errorMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message || errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <form onSubmit={handleSchedule} className="card p-4 sm:p-8">
          <h3 className="section-title border-b border-slate-100 pb-2 mb-4">Agendar nueva cita</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="form-label">Servicio</label>
              <select
                className="form-input"
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                disabled={services.length === 0}
              >
                {services.length === 0 ? (
                  <option>No hay servicios disponibles</option>
                ) : (
                  services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.nombre}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="md:col-span-2">
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
            <div>
              <label className="form-label">Fecha</label>
              <input type="date" className="form-input" value={fecha} onChange={(event) => setFecha(event.target.value)} />
            </div>
            <div>
              <label className="form-label">Hora</label>
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
            <div className="md:col-span-2">
              <label className="form-label">Notas</label>
              <input
                placeholder="Ej. tengo alergia a algun producto"
                className="form-input"
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button type="submit" disabled={isSaving || !selectedService || !selectedStylistId || !hora} className="px-8 py-3 rounded-xl">
              {isSaving ? "Guardando..." : "Guardar cita"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFecha("");
                setHora("");
                setNotas("");
                setAvailableSlots([]);
              }}
              className="px-8 py-3 rounded-xl border-2"
            >
              Limpiar
            </Button>
          </div>
        </form>

        <div className="card p-6">
          <h3 className="section-title">Mis citas activas</h3>
          <div className="mt-5 space-y-3">
            {activeAppointments.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No tienes citas activas.</p>
            ) : (
              activeAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800">{appointment.servicio}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatDateTime(appointment.fechaHora)}</div>
                      {appointment.notas && <div className="mt-1 text-xs text-slate-400">{appointment.notas}</div>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(appointment.estado)}`}>
                        {appointment.estado}
                      </span>
                      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${paymentStatusClass(appointment.estatusPago)}`}>
                        Pago: {appointment.estatusPago || "Sin pago"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link to={`/cliente/citas/reprogramar?appointmentId=${encodeURIComponent(appointment.id)}`} className="w-full">
                      <Button variant="outline" className="w-full py-2 rounded-xl border-2 text-sm">Reprogramar</Button>
                    </Link>
                    {!hasActivePayment(appointment) && (
                      <Link
                        to={`/cliente/servicios/pago?appointmentId=${encodeURIComponent(appointment.id)}&serviceId=${encodeURIComponent(appointment.serviceId || "")}`}
                        className="w-full"
                      >
                        <Button variant="emerald" className="w-full py-2 rounded-xl text-sm">Pagar servicio</Button>
                      </Link>
                    )}
                    {!hasActivePayment(appointment) && (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleCancel(appointment.id)}
                        className="w-full py-2 rounded-xl text-sm"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                  {hasActivePayment(appointment) && (
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {appointment.estatusPago === "Pagado"
                        ? "Servicio pagado. La cita permanece ligada a su pago."
                        : "Pago en revision. La cita no puede cancelarse mientras se valida."}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
