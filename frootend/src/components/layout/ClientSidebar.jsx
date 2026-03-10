import React from "react";
import { NavLink } from "react-router-dom";
import SidebarIcon from "../ui/SidebarIcon";

export default function ClientSidebar() {
  const links = [
    { to: "/cliente", label: "Dashboard", icon: "home" },
    { to: "/cliente/productos", label: "Productos AVYNA", icon: "products" },
    { to: "/cliente/carrito", label: "Carrito", icon: "cart" },
    { to: "/cliente/pagos", label: "Historial de pago", icon: "payments" },
    { to: "/cliente/citas", label: "Gestion de citas", icon: "appointments" },
    { to: "/cliente/citas/calendario", label: "Calendario disponibilidad", icon: "calendar" },
    { to: "/cliente/servicios", label: "Servicios", icon: "services" },
    { to: "/cliente/notificaciones", label: "Recordatorios", icon: "notifications" },
    { to: "/cliente/perfil", label: "Perfil", icon: "profile" },
  ];

  return (
    <aside className="sidebar group fixed left-0 top-[80px] z-40 h-[calc(100vh-80px)] w-full overflow-hidden transition-all duration-300 md:w-16 md:hover:w-72">
      <div className="flex h-full flex-col px-2 py-3">
        <div className="sidebar-label mb-2 whitespace-nowrap px-2 text-center md:text-left md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          MENU CLIENTE
        </div>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/cliente"}
              title={link.label}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-active" : "nav-inactive"} gap-3 md:gap-0 md:group-hover:gap-3 md:justify-center md:group-hover:justify-start md:px-2 md:group-hover:px-4`
              }
            >
              <SidebarIcon name={link.icon} className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap transition-all duration-200 md:max-w-0 md:overflow-hidden md:opacity-0 md:group-hover:max-w-[180px] md:group-hover:opacity-100">
                {link.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="tip-box mt-4 md:hidden">
          <div className="text-sm font-bold text-violet-700 flex items-center gap-2">
            <SidebarIcon name="idea" className="h-4 w-4" /> Tip
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Desde Gestion de citas puedes agendar, cancelar o reprogramar tus visitas.
          </p>
        </div>

        <div className="tip-box mt-4 hidden md:group-hover:block">
          <div className="text-sm font-bold text-violet-700 flex items-center gap-2">
            <SidebarIcon name="idea" className="h-4 w-4" /> Tip
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Desde Gestion de citas puedes agendar, cancelar o reprogramar tus visitas.
          </p>
        </div>
      </div>
    </aside>
  );
}
