import React from "react";
import { NavLink } from "react-router-dom";
import SidebarIcon from "../ui/SidebarIcon";

export default function ClientSidebar({ isOpen = false, onClose }) {
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
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 top-16 z-30 bg-slate-950/35 backdrop-blur-[1px] sm:top-20 md:hidden"
          onClick={onClose}
          aria-label="Cerrar menu"
        />
      )}
      <aside
        id="client-sidebar"
        className={`sidebar group fixed left-0 top-16 z-40 h-[calc(100dvh-4rem)] w-72 max-w-[88vw] overflow-hidden shadow-xl transition-transform duration-300 sm:top-20 sm:h-[calc(100dvh-5rem)] md:w-16 md:max-w-none md:translate-x-0 md:shadow-sm md:transition-all md:hover:w-72 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
              onClick={onClose}
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

        <div className="tip-box mt-4 hidden">
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
    </>
  );
}
