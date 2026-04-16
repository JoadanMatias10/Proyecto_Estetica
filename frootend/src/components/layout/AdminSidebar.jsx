import React from "react";
import { NavLink } from "react-router-dom";
import SidebarIcon from "../ui/SidebarIcon";

export default function AdminSidebar() {
  const links = [
    { to: "/admin",                         label: "Dashboard",              icon: "home",        end: true },
    { to: "/admin/servicios",               label: "Gestion de Servicios",   icon: "services" },
    { to: "/admin/servicios/categorias",    label: "Categorias Servicios",   icon: "servicesCat" },
    { to: "/admin/promociones",             label: "Promociones",            icon: "promotions" },
    { to: "/admin/productos",               label: "Catalogo de Productos",  icon: "products" },
    { to: "/admin/productos/categorias",    label: "Categorias Productos",   icon: "productsCat" },
    { to: "/admin/productos/marcas",        label: "Marcas Productos",       icon: "brands" },
    { to: "/admin/destacados-inicio",       label: "Destacados Inicio",      icon: "highlights" },
    { to: "/admin/ventas",                  label: "Ventas de Productos",    icon: "sales" },
    { to: "/admin/personal",               label: "Gestion Personal",       icon: "staff" },
    { to: "/admin/reportes/generar",        label: "Generar Reportes",       icon: "reports" },
    { to: "/admin/reportes/estadisticas",   label: "Estadisticas",           icon: "stats" },
    { to: "/admin/reportes/predictivo",     label: "Modelo Predictivo",      icon: "predictive" },
    { to: "/admin/empresa",                 label: "Informacion Empresa",    icon: "company" },
    { to: "/admin/carrusel",                label: "Gestion Carrusel",       icon: "carousel" },
    { to: "/admin/inventario",              label: "Gestion Inventarios",    icon: "inventory" },
    { to: "/admin/respaldos",               label: "Respaldos BD",           icon: "backup" },
    { to: "/admin/monitoreo",               label: "Monitoreo BD",           icon: "database" },
  ];

  return (
    <aside className="sidebar group fixed left-0 top-[80px] z-40 h-[calc(100vh-80px)] w-full overflow-hidden transition-all duration-300 md:w-16 md:hover:w-72">
      <div className="flex h-full flex-col px-2 py-3">
        <div className="sidebar-label mb-2 whitespace-nowrap px-2 text-center md:text-left md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          MENU ADMINISTRADOR
        </div>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
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
            <SidebarIcon name="idea" className="h-4 w-4" /> Admin
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Acceso total a la gestion del sistema.
          </p>
        </div>

        <div className="tip-box mt-4 hidden md:group-hover:block">
          <div className="text-sm font-bold text-violet-700 flex items-center gap-2">
            <SidebarIcon name="idea" className="h-4 w-4" /> Admin
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Acceso total a la gestion del sistema.
          </p>
        </div>
      </div>
    </aside>
  );
}
