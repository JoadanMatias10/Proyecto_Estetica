import React from "react";
import { Link, useLocation } from "react-router-dom";

const routeNameMap = {
  // Publico
  productos: "Productos AVYNA",
  promociones: "Promociones",
  login: "Iniciar Sesion",
  registro: "Registro",
  recuperar: "Recuperar Contrasena",
  "activar-cuenta": "Activar Cuenta",
  "restablecer-contrasena": "Restablecer Contrasena",
  servicios: "Nuestros Servicios",
  contactos: "Contactanos",
  "quienes-somos": "Quienes Somos",
  "mision-vision-valores": "Mision, Vision y Valores",
  "redes-sociales": "Redes Sociales",
  "politica-privacidad": "Politica de Privacidad",

  // Cliente
  cliente: "Panel",
  carrito: "Carrito",
  estado: "Estado del Carrito",
  citas: "Mis Citas",
  reprogramar: "Reprogramar",
  calendario: "Calendario",
  pago: "Pago",
  notificaciones: "Notificaciones",
  enviar: "Enviar Notificacion",
  pagos: "Historial de Pagos",
  perfil: "Mi Perfil",
  info: "Informacion Personal",

  // Admin
  admin: "Administrador",
  categorias: "Categorias",
  marcas: "Marcas",
  carrusel: "Carrusel",
  "destacados-inicio": "Destacados Inicio",
  respaldos: "Respaldos BD",
};

const customBreadcrumbs = {
  "/admin/reportes/estadisticas": [
    { to: "/admin", label: "Administrador" },
    { to: "/admin/reportes/estadisticas", label: "Estadisticas" },
  ],
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const firstSegment = pathnames[0];
  const homePath = firstSegment === "admin"
    ? "/admin"
    : firstSegment === "cliente"
      ? "/cliente"
      : "/";

  if (pathnames.length === 0) return null;

  const breadcrumbItems = customBreadcrumbs[normalizedPath]
    || pathnames.map((value, index) => ({
      to: `/${pathnames.slice(0, index + 1).join("/")}`,
      label: routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1),
    }));

  return (
    <nav className="text-sm font-medium text-rose-500 mb-4" aria-label="Breadcrumb">
      <ol className="list-none p-0 inline-flex">
        <li className="flex items-center">
          <Link to={homePath} className="hover:text-rose-700 transition-colors">
            Inicio
          </Link>
        </li>
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <li key={item.to} className="flex items-center">
              <span className="mx-2 text-rose-300">/</span>
              {isLast ? (
                <span className="text-rose-700 font-bold" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="hover:text-rose-700 transition-colors">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
