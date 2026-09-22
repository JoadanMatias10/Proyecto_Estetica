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

import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import PublicLayout from "./components/layout/PublicLayout";

// Páginas públicas
const importHome = () => import("./Publico/Home");
const initialHomeImport =
  typeof window !== "undefined" && window.location.pathname === "/"
    ? importHome()
    : null;
const Home = React.lazy(() => initialHomeImport || importHome());

// Productos AVYNA
const Catalogo = React.lazy(() => import("./Publico/ProductosAvyna/Catalogo"));
const DetalleProducto = React.lazy(() => import("./Publico/ProductosAvyna/DetalleProducto"));
const Promociones = React.lazy(() => import("./Publico/ProductosAvyna/Promociones"));

// Login
const InicioSesion = React.lazy(() => import("./Publico/Login/InicioSesion"));
const Registro = React.lazy(() => import("./Publico/Login/Registro"));
const Recuperacion = React.lazy(() => import("./Publico/Login/Recuperacion"));
const ConfigurarAccesoCuenta = React.lazy(() => import("./Publico/Login/ConfigurarAccesoCuenta"));

// Servicios
const ConsultaServicio = React.lazy(() => import("./Publico/Servicios/ConsultaServicio"));
const DetalleServicio = React.lazy(() => import("./Publico/Servicios/DetalleServicio"));

// Información de la empresa
const Contactos = React.lazy(() => import("./Publico/InformacionEmpresa/Contactos"));
const QuienesSomos = React.lazy(() => import("./Publico/InformacionEmpresa/QuienesSomos"));
const MisionVisionValores = React.lazy(() => import("./Publico/InformacionEmpresa/MisionVisionValores"));
const RedesSociales = React.lazy(() => import("./Publico/InformacionEmpresa/RedesSociales"));
const PoliticaPrivacidad = React.lazy(() => import("./Publico/InformacionEmpresa/PoliticaPrivacidad"));

const ErrorPage = React.lazy(() => import("./Publico/Error/ErrorPage"));

//RUTAS DEL CLIENTE 
const ClientLayout = React.lazy(() => import("./components/layout/ClientLayout"));

const DashboardCliente = React.lazy(() => import("./Cliente/DashboardCliente"));

const CatalogoProductos = React.lazy(() => import("./Cliente/ProductosAvyna/CatalogoProductos"));
const DetalleProductoCliente = React.lazy(() => import("./Cliente/ProductosAvyna/DetalleProductoCliente"));
const PagoProducto = React.lazy(() => import("./Cliente/ProductosAvyna/PagoProducto"));
const CarritoCompra = React.lazy(() => import("./Cliente/ProductosAvyna/CarritoCompra"));
const EstadoCarrito = React.lazy(() => import("./Cliente/ProductosAvyna/EstadoCarrito"));

const AgendarCancelarCitas = React.lazy(() => import("./Cliente/Citas/AgendarCancelarCitas"));
const ReprogramarCita = React.lazy(() => import("./Cliente/Citas/ReprogramarCita"));
const CalendarioDisponibilidad = React.lazy(() => import("./Cliente/Citas/CalendarioDisponibilidad"));

const ConsultaServicioCliente = React.lazy(() => import("./Cliente/Servicios/ConsultaServicioCliente"));
const DetalleServicioCliente = React.lazy(() => import("./Cliente/Servicios/DetalleServicioCliente"));
const PagoServicios = React.lazy(() => import("./Cliente/Servicios/PagoServicios"));

const RecordarCita = React.lazy(() => import("./Cliente/Notificaciones/RecordarCita"));
const NotificarCitas = React.lazy(() => import("./Cliente/Notificaciones/NotificarCitas"));

const HistorialPago = React.lazy(() => import("./Cliente/Pagos/HistorialPago"));

const PerfilCliente = React.lazy(() => import("./Cliente/Perfil/PerfilCliente"));
const InformacionCliente = React.lazy(() => import("./Cliente/Perfil/InformacionCliente"));
const NotificacionesCliente = React.lazy(() => import("./Cliente/Perfil/NotificacionesCliente"));




// Estilista
const EstilistaLayout = React.lazy(() => import("./components/layout/EstilistaLayout"));
const DashboardEstilista = React.lazy(() => import("./Estilista/DashboardEstilista"));
const CitasAsignadas = React.lazy(() => import("./Estilista/CitasAsignadas"));
const ServiciosRealizados = React.lazy(() => import("./Estilista/ServiciosRealizados"));
const AgendaCalendario = React.lazy(() => import("./Estilista/AgendaCalendario"));
const HorarioTrabajo = React.lazy(() => import("./Estilista/HorarioTrabajo"));
const NotificacionesEstilista = React.lazy(() => import("./Estilista/NotificacionesEstilista"));

// Admin
const AdminLayout = React.lazy(() => import("./components/layout/AdminLayout"));
const DashboardAdmin = React.lazy(() => import("./Administrador/DashboardAdmin"));
const GestionServicios = React.lazy(() => import("./Administrador/Servicios/GestionServicios"));
const PromocionesAdmin = React.lazy(() => import("./Administrador/Servicios/Promociones"));
const CatalogoProductosAdmin = React.lazy(() => import("./Administrador/Productos/CatalogoProductosAdmin"));
const CategoriasProductos = React.lazy(() => import("./Administrador/Productos/CategoriasProductos"));
const MarcasProductos = React.lazy(() => import("./Administrador/Productos/MarcasProductos"));
const RegistrarVenta = React.lazy(() => import("./Administrador/Ventas/RegistrarVenta"));
const HistorialVentas = React.lazy(() => import("./Administrador/Ventas/HistorialVentas"));
const PagosTransferencia = React.lazy(() => import("./Administrador/Pagos/PagosTransferencia"));
const GestionPersonal = React.lazy(() => import("./Administrador/Personal/GestionPersonal"));
const GenerarReportes = React.lazy(() => import("./Administrador/Reportes/GenerarReportes"));
const InformesEstadisticos = React.lazy(() => import("./Administrador/Reportes/InformesEstadisticos"));
const ModeloPredictivo = React.lazy(() => import("./Administrador/Reportes/ModeloPredictivo"));
const ClasificacionCitas = React.lazy(() => import("./Administrador/Reportes/ClasificacionCitas"));
const RegresionDemanda = React.lazy(() => import("./Administrador/Reportes/RegresionDemanda"));
const RecomendacionServicios = React.lazy(() => import("./Administrador/Reportes/RecomendacionServicios"));
const InformacionEmpresa = React.lazy(() => import("./Administrador/Empresa/InformacionEmpresa"));
const ControlStock = React.lazy(() => import("./Administrador/Inventario/ControlStock"));
const CategoriasServicios = React.lazy(() => import("./Administrador/Servicios/CategoriasServicios"));
const GestionCarrusel = React.lazy(() => import("./Administrador/Marketing/GestionCarrusel"));
const GestionDestacadosInicio = React.lazy(() => import("./Administrador/Marketing/GestionDestacadosInicio"));
const GestionRespaldos = React.lazy(() => import("./Administrador/Respaldos/GestionRespaldos"));
const MonitoreoBD = React.lazy(() => import("./Administrador/Monitoreo/MonitoreoBD"));

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[40vh] items-center justify-center px-4 text-center text-sm font-medium text-slate-600"
    >
      Cargando página...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />

        <Route path="/productos" element={<Catalogo />} />
        <Route path="/productos/:id" element={<DetalleProducto />} />
        <Route path="/promociones" element={<Promociones />} />

        <Route path="/login" element={<InicioSesion />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperacion />} />
        <Route path="/activar-cuenta" element={<ConfigurarAccesoCuenta mode="invite" />} />
        <Route path="/restablecer-contrasena" element={<ConfigurarAccesoCuenta mode="reset" />} />

        <Route path="/servicios" element={<ConsultaServicio />} />
        <Route path="/servicios/:id" element={<DetalleServicio />} />

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
        <Route path="productos/pago/:id" element={<PagoProducto />} />
        <Route path="productos/:id" element={<DetalleProductoCliente />} />

        <Route path="carrito" element={<CarritoCompra />} />
        <Route path="carrito/pago" element={<PagoProducto mode="cart" />} />
        <Route path="carrito/estado" element={<EstadoCarrito />} />

        <Route path="citas" element={<AgendarCancelarCitas />} />
        <Route path="citas/reprogramar" element={<ReprogramarCita />} />
        <Route path="citas/calendario" element={<CalendarioDisponibilidad />} />

        <Route path="servicios" element={<ConsultaServicioCliente />} />
        <Route path="servicios/pago" element={<PagoServicios />} />
        <Route path="servicios/:id" element={<DetalleServicioCliente />} />

        <Route path="notificaciones" element={<RecordarCita />} />
        <Route path="notificaciones/enviar" element={<NotificarCitas />} />

        <Route path="pagos" element={<HistorialPago />} />

        <Route path="perfil" element={<PerfilCliente />} />
        <Route path="perfil/info" element={<InformacionCliente />} />
        <Route path="perfil/notificaciones" element={<NotificacionesCliente />} />
      </Route>

      <Route path="/estilista" element={<EstilistaLayout />}>
        <Route index element={<DashboardEstilista />} />
        <Route path="citas" element={<CitasAsignadas />} />
        <Route path="servicios" element={<ServiciosRealizados />} />
        <Route path="agenda" element={<AgendaCalendario />} />
        <Route path="horario" element={<HorarioTrabajo />} />
        <Route path="notificaciones" element={<NotificacionesEstilista />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardAdmin />} />
        <Route path="servicios" element={<GestionServicios />} />
        <Route path="servicios/categorias" element={<CategoriasServicios />} />
        <Route path="promociones" element={<PromocionesAdmin />} />
        <Route path="productos" element={<CatalogoProductosAdmin />} />
        <Route path="productos/categorias" element={<CategoriasProductos />} />
        <Route path="productos/marcas" element={<MarcasProductos />} />
        <Route path="destacados-inicio" element={<GestionDestacadosInicio />} />
        <Route path="ventas" element={<HistorialVentas />} />
        <Route path="ventas/nueva" element={<RegistrarVenta />} />
        <Route path="pagos-transferencia" element={<PagosTransferencia />} />
        <Route path="personal" element={<GestionPersonal />} />
        <Route path="reportes/generar" element={<GenerarReportes />} />
        <Route path="reportes/estadisticas" element={<InformesEstadisticos />} />
        <Route path="reportes/predictivo" element={<ModeloPredictivo />} />
        <Route path="reportes/clasificacion-citas" element={<ClasificacionCitas />} />
        <Route path="reportes/regresion-demanda" element={<RegresionDemanda />} />
        <Route path="reportes/recomendacion-servicios" element={<RecomendacionServicios />} />
        <Route path="empresa" element={<InformacionEmpresa />} />
        <Route path="carrusel" element={<GestionCarrusel />} />
        <Route path="marketing/carrusel" element={<GestionCarrusel />} />
        <Route path="inventario" element={<ControlStock />} />
        <Route path="respaldos" element={<GestionRespaldos />} />
        <Route path="monitoreo" element={<MonitoreoBD />} />
      </Route>
      </Routes>
    </Suspense>

  );




}
