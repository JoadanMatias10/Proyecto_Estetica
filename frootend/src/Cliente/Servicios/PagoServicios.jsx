import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { cacheClientPayment, getClientToken } from "../../utils/clientStore";
import { fetchPublicServicesBundle } from "../../utils/publicCatalogApi";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

export default function PagoServicios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceIdFromUrl = searchParams.get("serviceId") || "";
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceIdFromUrl);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const loadServices = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await fetchPublicServicesBundle();
        const loadedServices = data.services || [];
        setServices(loadedServices);
        const existsFromUrl = loadedServices.some((service) => String(service.id) === String(serviceIdFromUrl));
        setSelectedServiceId(existsFromUrl ? serviceIdFromUrl : loadedServices[0]?.id || "");
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar servicios.");
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, [serviceIdFromUrl]);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(selectedServiceId)) || null,
    [selectedServiceId, services]
  );

  const handleConfirmPayment = async () => {
    if (!selectedService) return;
    setIsSaving(true);
    setPaymentError("");
    try {
      const data = await requestJson(endpoints.clientPayments, {
        method: "POST",
        token: getClientToken(),
        body: {
          tipo: "Servicio",
          metodo: paymentMethod,
          detalle: [
            {
              id: selectedService.id,
              cantidad: 1,
            },
          ],
        },
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

  if (isLoading) {
    return <LoadingSpinner text="Cargando servicios..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="page-title">Pago de servicios</h1>
        <p className="page-subtitle mt-2">Selecciona el servicio y confirma el pago.</p>
      </div>

      <div className="card mt-8 p-8 space-y-6">
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

        <div className="p-6 rounded-xl bg-gradient-to-br from-violet-50 to-rose-50 border border-violet-100">
          <div className="text-sm font-bold text-violet-600 uppercase tracking-wider">Total</div>
          <div className="text-4xl font-bold text-rose-600 mt-2">
            {formatCurrency(selectedService?.precio || 0)}
          </div>
          {selectedService?.tiempo && (
            <div className="mt-2 text-sm font-medium text-slate-500">Duracion: {selectedService.tiempo}</div>
          )}
        </div>

        <Button
          type="button"
          onClick={handleConfirmPayment}
          disabled={!selectedService || isSaving}
          className="w-full py-4 rounded-xl"
        >
          {isSaving ? "Registrando..." : "Confirmar pago"}
        </Button>

        <Link to="/cliente/servicios" className="block text-center text-sm font-semibold text-violet-600 hover:text-violet-700">
          Volver a servicios
        </Link>
      </div>
    </div>
  );
}
