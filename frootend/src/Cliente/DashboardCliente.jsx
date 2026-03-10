import React from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import SidebarIcon from "../components/ui/SidebarIcon";

export default function DashboardCliente() {
  const summaryCards = [
    { title: "Proxima cita", value: "Sin cita programada", icon: "appointments" },
    { title: "Carrito", value: "0 productos", icon: "cart" },
    { title: "Pagos", value: "Sin pagos pendientes", icon: "payments" },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-8">
        <h1 className="page-title flex items-center gap-2">
          Bienvenido
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
