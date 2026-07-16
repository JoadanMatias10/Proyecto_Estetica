import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../api";
import Button from "../components/ui/Button";
import SidebarIcon from "../components/ui/SidebarIcon";
import {
  getCartSummary,
  getClientCart,
  getClientPayments,
  getClientToken,
  getStoredClientUser,
  saveClientPayments,
} from "../utils/clientStore";

function formatAppointment(appointment) {
  if (!appointment?.fechaHora) return "Sin cita programada";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(appointment.fechaHora));
}

function isUpcomingActiveAppointment(appointment) {
  return ["pendiente", "programada", "confirmada"].includes(String(appointment?.estado || "").toLowerCase());
}

export default function DashboardCliente() {
  const [cart, setCart] = useState(() => getClientCart());
  const [payments, setPayments] = useState(() => getClientPayments());
  const [appointments, setAppointments] = useState([]);
  const user = getStoredClientUser();

  useEffect(() => {
    const refreshLocalState = () => {
      setCart(getClientCart());
      setPayments(getClientPayments());
    };

    window.addEventListener("client-state-change", refreshLocalState);
    window.addEventListener("storage", refreshLocalState);
    return () => {
      window.removeEventListener("client-state-change", refreshLocalState);
      window.removeEventListener("storage", refreshLocalState);
    };
  }, []);

  useEffect(() => {
    const loadClientData = async () => {
      const token = getClientToken();
      if (!token) return;
      const [appointmentsResult, paymentsResult] = await Promise.allSettled([
        requestJson(endpoints.clientAppointments, { token }),
        requestJson(endpoints.clientPayments, { token }),
      ]);

      if (appointmentsResult.status === "fulfilled") {
        setAppointments(Array.isArray(appointmentsResult.value.appointments) ? appointmentsResult.value.appointments : []);
      } else {
        setAppointments([]);
      }

      if (paymentsResult.status === "fulfilled") {
        setPayments(saveClientPayments(Array.isArray(paymentsResult.value.payments) ? paymentsResult.value.payments : []));
      }
    };

    loadClientData();
  }, []);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(isUpcomingActiveAppointment)
      .filter((appointment) => appointment.fechaHora && new Date(appointment.fechaHora) >= now)
      .sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora))[0];
  }, [appointments]);

  const cartSummary = getCartSummary(cart);
  const latestPayment = payments[0];

  const summaryCards = [
    {
      title: "Proxima cita",
      value: nextAppointment ? `${nextAppointment.servicio} - ${formatAppointment(nextAppointment)}` : "Sin cita programada",
      icon: "appointments",
    },
    {
      title: "Carrito",
      value: cartSummary.totalItems === 1 ? "1 producto" : `${cartSummary.totalItems} productos`,
      icon: "cart",
    },
    {
      title: "Pagos",
      value: latestPayment ? `${latestPayment.concepto} - ${latestPayment.estatus}` : "Sin pagos registrados",
      icon: "payments",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-8">
        <h1 className="page-title flex items-center gap-2">
          Bienvenido{user?.nombre ? `, ${user.nombre}` : ""}
          <SidebarIcon name="profile" className="h-6 w-6 text-violet-500" />
        </h1>
        <p className="page-subtitle mt-3 text-lg">
          Desde aqui gestionas tus citas, compras AVYNA, pagos y recordatorios.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <Link to="/cliente/citas">
            <Button className="px-6 py-3 rounded-xl">Agendar / gestionar citas</Button>
          </Link>
          <Link to="/cliente/productos">
            <Button variant="outline" className="px-6 py-3 rounded-xl border-2">
              Ver productos AVYNA
            </Button>
          </Link>
          {cartSummary.totalItems > 0 && (
            <Link to="/cliente/carrito">
              <Button variant="indigo" className="px-6 py-3 rounded-xl">
                Revisar carrito
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="card card-hover p-6">
            <div className="mb-3 p-2 bg-violet-50 rounded-xl w-fit text-violet-600">
              <SidebarIcon name={card.icon} className="h-7 w-7" />
            </div>
            <div className="mt-2 section-title">{card.title}</div>
            <div className="text-slate-500 mt-1 font-medium">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
