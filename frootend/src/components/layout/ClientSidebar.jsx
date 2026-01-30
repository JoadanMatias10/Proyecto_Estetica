import React from "react";
import { NavLink } from "react-router-dom";

const base =
  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group";
const inactive = "text-rose-700/70 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm";
const active = "bg-gradient-to-r from-rose-100 to-rose-50 text-rose-700 shadow-sm border border-rose-200/50";

export default function ClientSidebar() {
  const links = [
    { to: "/cliente", label: "Dashboard", icon: "🏠" },

    { to: "/cliente/productos", label: "Productos AVYNA", icon: "🧴" },
    { to: "/cliente/carrito", label: "Carrito", icon: "🛒" },
    { to: "/cliente/pagos", label: "Historial de pago", icon: "💳" },

    { to: "/cliente/citas", label: "Gestión de citas", icon: "📅" },
    { to: "/cliente/citas/calendario", label: "Calendario disponibilidad", icon: "🗓️" },

    { to: "/cliente/servicios", label: "Servicios", icon: "💇‍♀️" },
    { to: "/cliente/notificaciones", label: "Recordatorios", icon: "🔔" },

    { to: "/cliente/perfil", label: "Perfil", icon: "👤" },
  ];

  return (
    <aside className="w-full bg-white/60 backdrop-blur-md border border-rose-200/50 rounded-2xl p-4 shadow-sm h-fit sticky top-20">
      <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-4 px-2">MENÚ CLIENTE</div>
      <nav className="space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/cliente"}
            className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
          >
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-white border border-rose-100 shadow-sm">
        <div className="text-sm font-bold text-rose-700 flex items-center gap-2">
          <span>💡</span> Tip
        </div>
        <p className="text-xs text-rose-600/80 mt-2 leading-relaxed">
          Desde “Gestión de citas” puedes agendar, cancelar o reprogramar tus visitas.
        </p>
      </div>
    </aside>
  );
}
