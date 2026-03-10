/*import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;*/

import React from "react";
import { Routes, Route } from "react-router-dom";

import PublicLayout from "./components/layout/PublicLayout";

// Páginas públicas
import Home from "./Publico/Home";

// Productos AVYNA
import Catalogo from "./Publico/ProductosAvyna/Catalogo";
import DetalleProducto from "./Publico/ProductosAvyna/DetalleProducto";
import Promociones from "./Publico/ProductosAvyna/Promociones";

// Login
import InicioSesion from "./Publico/Login/InicioSesion";
import Registro from "./Publico/Login/Registro";
import Recuperacion from "./Publico/Login/Recuperacion";

// Servicios
import ConsultaServicio from "./Publico/Servicios/ConsultaServicio";

// Información de la empresa
import Contactos from "./Publico/InformacionEmpresa/Contactos";
import QuienesSomos from "./Publico/InformacionEmpresa/QuienesSomos";
import MisionVisionValores from "./Publico/InformacionEmpresa/MisionVisionValores";
import RedesSociales from "./Publico/InformacionEmpresa/RedesSociales";
import PoliticaPrivacidad from "./Publico/InformacionEmpresa/PoliticaPrivacidad";

import ErrorPage from "./Publico/Error/ErrorPage";

//RUTAS DEL CLIENTE 
import ClientLayout from "./components/layout/ClientLayout";

import DashboardCliente from "./Cliente/DashboardCliente";

import CatalogoProductos from "./Cliente/ProductosAvyna/CatalogoProductos";
import DetalleProductoCliente from "./Cliente/ProductosAvyna/DetalleProductoCliente";
import PagoProducto from "./Cliente/ProductosAvyna/PagoProducto";
import CarritoCompra from "./Cliente/ProductosAvyna/CarritoCompra";
import EstadoCarrito from "./Cliente/ProductosAvyna/EstadoCarrito";

import AgendarCancelarCitas from "./Cliente/Citas/AgendarCancelarCitas";
import ReprogramarCita from "./Cliente/Citas/ReprogramarCita";
import CalendarioDisponibilidad from "./Cliente/Citas/CalendarioDisponibilidad";

import ConsultaServicioCliente from "./Cliente/Servicios/ConsultaServicioCliente";
import PagoServicios from "./Cliente/Servicios/PagoServicios";

import RecordarCita from "./Cliente/Notificaciones/RecordarCita";
import NotificarCitas from "./Cliente/Notificaciones/NotificarCitas";

import HistorialPago from "./Cliente/Pagos/HistorialPago";

import PerfilCliente from "./Cliente/Perfil/PerfilCliente";
import InformacionCliente from "./Cliente/Perfil/InformacionCliente";
import NotificacionesCliente from "./Cliente/Perfil/NotificacionesCliente";




// Admin
import AdminLayout from "./components/layout/AdminLayout";
import DashboardAdmin from "./Administrador/DashboardAdmin";
import GestionServicios from "./Administrador/Servicios/GestionServicios";
import PromocionesAdmin from "./Administrador/Servicios/Promociones";
import CatalogoProductosAdmin from "./Administrador/Productos/CatalogoProductosAdmin";
import CategoriasProductos from "./Administrador/Productos/CategoriasProductos";
import MarcasProductos from "./Administrador/Productos/MarcasProductos";
import RegistrarVenta from "./Administrador/Ventas/RegistrarVenta";
import HistorialVentas from "./Administrador/Ventas/HistorialVentas";
import GestionPersonal from "./Administrador/Personal/GestionPersonal";
import GenerarReportes from "./Administrador/Reportes/GenerarReportes";
import InformesEstadisticos from "./Administrador/Reportes/InformesEstadisticos";
import InformacionEmpresa from "./Administrador/Empresa/InformacionEmpresa";
import ControlStock from "./Administrador/Inventario/ControlStock";
import CategoriasServicios from "./Administrador/Servicios/CategoriasServicios";
import GestionCarrusel from "./Administrador/Marketing/GestionCarrusel";
import InicioSesionAdmin from "./Administrador/Login/InicioSesionAdmin";
import GestionRespaldos from "./Administrador/Respaldos/GestionRespaldos";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />

        <Route path="/productos" element={<Catalogo />} />
        <Route path="/productos/:id" element={<DetalleProducto />} />
        <Route path="/promociones" element={<Promociones />} />

        <Route path="/login" element={<InicioSesion />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperacion />} />

        <Route path="/servicios" element={<ConsultaServicio />} />

        <Route path="/contactos" element={<Contactos />} />
        <Route path="/quienes-somos" element={<QuienesSomos />} />
        <Route path="/mision-vision-valores" element={<MisionVisionValores />} />
        <Route path="/redes-sociales" element={<RedesSociales />} />
        <Route path="/politica-privacidad" element={<PoliticaPrivacidad />} />

        {/* Páginas de Error para pruebas */}
        <Route path="/400" element={<ErrorPage code="400" title="Solicitud Incorrecta" message="Hubo un problema con la solicitud. Por favor verifica los datos." />} />
        <Route path="/404" element={<ErrorPage code="404" title="Página no encontrada" message="Lo sentimos, la ruta que buscas no existe." />} />
        <Route path="/500" element={<ErrorPage code="500" title="Error Interno" message="Algo salió mal en nuestro servidor. Intenta de nuevo más tarde." />} />

        <Route path="*" element={<ErrorPage code="404" />} />
      </Route>

      <Route path="/cliente" element={<ClientLayout />}>
        <Route index element={<DashboardCliente />} />

        <Route path="productos" element={<CatalogoProductos />} />
        <Route path="productos/:id" element={<DetalleProductoCliente />} />
        <Route path="productos/pago/:id" element={<PagoProducto />} />

        <Route path="carrito" element={<CarritoCompra />} />
        <Route path="carrito/estado" element={<EstadoCarrito />} />

        <Route path="citas" element={<AgendarCancelarCitas />} />
        <Route path="citas/reprogramar" element={<ReprogramarCita />} />
        <Route path="citas/calendario" element={<CalendarioDisponibilidad />} />

        <Route path="servicios" element={<ConsultaServicioCliente />} />
        <Route path="servicios/pago" element={<PagoServicios />} />

        <Route path="notificaciones" element={<RecordarCita />} />
        <Route path="notificaciones/enviar" element={<NotificarCitas />} />

        <Route path="pagos" element={<HistorialPago />} />

        <Route path="perfil" element={<PerfilCliente />} />
        <Route path="perfil/info" element={<InformacionCliente />} />
        <Route path="perfil/notificaciones" element={<NotificacionesCliente />} />
      </Route>

      <Route path="/admin/login" element={<InicioSesionAdmin />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardAdmin />} />
        <Route path="servicios" element={<GestionServicios />} />
        <Route path="servicios/categorias" element={<CategoriasServicios />} />
        <Route path="promociones" element={<PromocionesAdmin />} />
        <Route path="productos" element={<CatalogoProductosAdmin />} />
        <Route path="productos/categorias" element={<CategoriasProductos />} />
        <Route path="productos/marcas" element={<MarcasProductos />} />
        <Route path="ventas" element={<HistorialVentas />} />
        <Route path="ventas/nueva" element={<RegistrarVenta />} />
        <Route path="personal" element={<GestionPersonal />} />
        <Route path="reportes/generar" element={<GenerarReportes />} />
        <Route path="reportes/estadisticas" element={<InformesEstadisticos />} />
        <Route path="empresa" element={<InformacionEmpresa />} />
        <Route path="carrusel" element={<GestionCarrusel />} />
        <Route path="marketing/carrusel" element={<GestionCarrusel />} />
        <Route path="inventario" element={<ControlStock />} />
        <Route path="respaldos" element={<GestionRespaldos />} />
      </Route>
    </Routes>

  );




}
