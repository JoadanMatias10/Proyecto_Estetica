import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { cacheClientPayment, getClientToken } from "../../utils/clientStore";
import { fetchPublicServicesBundle } from "../../utils/publicCatalogApi";
import TransferenciaFields, {
  buildClientPaymentBody,
  validateTransferPayment,
} from "../Pagos/TransferenciaFields";
import OnlinePaymentButtons from "../Pagos/OnlinePaymentButtons";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

function formatDateTime(value) {
  if (!value) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function canPayAppointment(appointment) {
  const appointmentStatus = String(appointment?.estado || "").toLowerCase();
  const paymentStatus = appointment?.estatusPago || "Sin pago";
  return (
    ["pendiente", "programada", "confirmada"].includes(appointmentStatus) &&
    ["Sin pago", "Rechazado"].includes(paymentStatus)
  );
}

export default function PagoServicios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceIdFromUrl = searchParams.get("serviceId") || "";
  const appointmentIdFromUrl = searchParams.get("appointmentId") || "";
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointmentIdFromUrl);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [transferReference, setTransferReference] = useState("");
  const [transferProof, setTransferProof] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [servicesData, appointmentsData] = await Promise.all([
          fetchPublicServicesBundle(),
          requestJson(endpoints.clientAppointments, { token: getClientToken() }),
        ]);
        const loadedServices = servicesData.services || [];
        const payableAppointments = (
          Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []
        ).filter(canPayAppointment);

        setServices(loadedServices);
        setAppointments(payableAppointments);

        const appointmentFromUrl = payableAppointments.find(
          (appointment) => String(appointment.id) === String(appointmentIdFromUrl)
        );
        const appointmentForService = payableAppointments.find(
          (appointment) => String(appointment.serviceId) === String(serviceIdFromUrl)
        );
        setSelectedAppointmentId(
          appointmentFromUrl?.id || appointmentForService?.id || payableAppointments[0]?.id || ""
        );
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar las citas disponibles para pago.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [appointmentIdFromUrl, serviceIdFromUrl]);

  const selectedAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) => String(appointment.id) === String(selectedAppointmentId)
      ) || null,
    [appointments, selectedAppointmentId]
  );

  const selectedService = useMemo(
    () =>
      services.find(
        (service) =>
          String(service.id) === String(selectedAppointment?.serviceId) ||
          service.nombre === selectedAppointment?.servicio
      ) || null,
    [selectedAppointment, services]
  );

  const handleConfirmPayment = async () => {
    if (!selectedAppointment || !selectedService) {
      setPaymentError("Selecciona una cita disponible para pagar.");
      return;
    }
    if (paymentMethod === "Transferencia") {
      const validationError = validateTransferPayment(transferReference, transferProof);
      if (validationError) {
        setPaymentError(validationError);
        return;
      }
    }

    setIsSaving(true);
    setPaymentError("");
    try {
      const data = await requestJson(endpoints.clientPayments, {
        method: "POST",
        token: getClientToken(),
        body: buildClientPaymentBody({
          tipo: "Servicio",
          metodo: paymentMethod,
          detalle: [
            {
              id: selectedService.id,
              cantidad: 1,
            },
          ],
          referencia: transferReference,
          comprobante: transferProof,
          appointmentId: selectedAppointment.id,
        }),
      });

      if (data.payment) {
        cacheClientPayment(data.payment);
      }
      navigate("/cliente/pagos");
    } catch (error) {
      setPaymentError(error.message || "No fue posible registrar el pago.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOnlinePayment = (provider) => {
    setPaymentError(
      `${provider} necesita las credenciales de una cuenta comercial para procesar el pago.`
    );
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando servicios..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="page-title">Pago de servicios</h1>
        <p className="page-subtitle mt-2">Selecciona una cita reservada y confirma el pago.</p>
      </div>

      <div className="card mt-8 space-y-6 p-4 sm:p-8">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        {paymentError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {paymentError}
          </div>
        )}

        <div>
          <label className="form-label">Cita reservada</label>
          <select
            className="form-input"
            value={selectedAppointmentId}
            onChange={(event) => setSelectedAppointmentId(event.target.value)}
            disabled={appointments.length === 0}
          >
            {appointments.length === 0 ? (
              <option>No tienes citas disponibles para pago</option>
            ) : (
              appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.servicio} - {formatDateTime(appointment.fechaHora)}
                </option>
              ))
            )}
          </select>
        </div>

        {appointments.length === 0 && (
          <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Primero agenda una cita para poder registrar el pago del servicio.
            <Link to="/cliente/citas" className="ml-1 font-bold underline">Agendar cita</Link>
          </div>
        )}

        <div>
          <label className="form-label">Metodo de pago</label>
          <select
            className="form-input"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <option>Tarjeta</option>
            <option>Transferencia</option>
            <option>Pago en sucursal</option>
          </select>
        </div>

        <OnlinePaymentButtons onSelect={handleOnlinePayment} />

        {paymentMethod === "Transferencia" && (
          <TransferenciaFields
            reference={transferReference}
            onReferenceChange={setTransferReference}
            proofFile={transferProof}
            onProofFileChange={setTransferProof}
          />
        )}

        <div className="border-y border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-bold text-violet-600 uppercase tracking-wider">Total</div>
          <div className="text-4xl font-bold text-rose-600 mt-2">
            {formatCurrency(selectedAppointment?.servicioPrecio || selectedService?.precio || 0)}
          </div>
          {selectedService?.tiempo && (
            <div className="mt-2 text-sm font-medium text-slate-500">Duracion: {selectedService.tiempo}</div>
          )}
        </div>

        <Button
          type="button"
          onClick={handleConfirmPayment}
          disabled={!selectedAppointment || !selectedService || isSaving}
          className="w-full py-4 rounded-xl"
        >
          {isSaving
            ? "Registrando..."
            : paymentMethod === "Transferencia"
              ? "Registrar transferencia"
              : "Confirmar pago"}
        </Button>

        <Link to="/cliente/citas" className="block text-center text-sm font-semibold text-violet-600 hover:text-violet-700">
          Volver a mis citas
        </Link>
      </div>
    </div>
  );
}
