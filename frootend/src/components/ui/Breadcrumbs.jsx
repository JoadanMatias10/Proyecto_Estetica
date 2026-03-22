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
  respaldos: "Respaldos BD",
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);
  const firstSegment = pathnames[0];
  const homePath = firstSegment === "admin"
    ? "/admin"
    : firstSegment === "cliente"
      ? "/cliente"
      : "/";

  if (pathnames.length === 0) return null;

  return (
    <nav className="text-sm font-medium text-rose-500 mb-4" aria-label="Breadcrumb">
      <ol className="list-none p-0 inline-flex">
        <li className="flex items-center">
          <Link to={homePath} className="hover:text-rose-700 transition-colors">
            Inicio
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          const name = routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

          return (
            <li key={to} className="flex items-center">
              <span className="mx-2 text-rose-300">/</span>
              {isLast ? (
                <span className="text-rose-700 font-bold" aria-current="page">
                  {name}
                </span>
              ) : (
                <Link to={to} className="hover:text-rose-700 transition-colors">
                  {name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
