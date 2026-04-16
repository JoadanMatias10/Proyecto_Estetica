import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SidebarIcon from "../components/ui/SidebarIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function DashboardAdmin() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState({
    ventasHoy: 0,
    citasHoy: 0,
    stockBajo: 0,
  });
  const latestRequestRef = useRef(0);

  const stats = useMemo(
    () => [
      {
        title: "Ventas de hoy",
        value: formatCurrency(summary.ventasHoy),
        icon: "sales",
        container: "border-rose-50",
        iconWrap: "bg-rose-50 text-rose-600",
      },
      {
        title: "Citas de hoy",
        value: String(summary.citasHoy),
        icon: "appointments",
        container: "border-violet-50",
        iconWrap: "bg-violet-50 text-violet-600",
      },
      {
        title: "Stock bajo",
        value: String(summary.stockBajo),
        icon: "inventory",
        container: "border-emerald-50",
        iconWrap: "bg-emerald-50 text-emerald-600",
      },
    ],
    [summary]
  );

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    if (!silent) {
      setLoading(true);
      setErrorMessage("");
    }

    const token = getAdminToken();
    const today = toLocalDateString(new Date());

    try {
      const [salesData, servicesData, productsData] = await Promise.all([
        requestJson(endpoints.adminSales({ desde: today, hasta: today }), { token }),
        requestJson(endpoints.adminReports({ tipo: "Servicio", desde: today, hasta: today }), { token }),
        requestJson(endpoints.adminProducts, { token }),
      ]);

      if (latestRequestRef.current !== requestId) return;

      const products = Array.isArray(productsData.products) ? productsData.products : [];
      const stockBajo = products.filter((product) => Number(product.stock || 0) <= 5).length;

      setSummary({
        ventasHoy: Number(salesData.summary?.total || 0),
        citasHoy: Number(servicesData.summary?.totalRegistros || 0),
        stockBajo,
      });
      setErrorMessage("");
    } catch (error) {
      if (latestRequestRef.current !== requestId) return;
      setErrorMessage(error.message || "No fue posible cargar el resumen del dashboard.");
    } finally {
      if (latestRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const refreshDashboard = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void loadDashboard({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        void loadDashboard({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshDashboard, 30000);
    window.addEventListener("focus", refreshDashboard);
    window.addEventListener("adminSalesUpdated", refreshDashboard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshDashboard);
      window.removeEventListener("adminSalesUpdated", refreshDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard]);

  const quickActions = [
    {
      to: "/admin/ventas/nueva",
      label: "Nueva Venta",
      icon: "sales",
      card: "hover:bg-emerald-50 hover:border-emerald-200",
      iconWrap: "bg-emerald-100 text-emerald-600",
      text: "group-hover:text-emerald-700",
    },
    {
      to: "/admin/productos",
      label: "Productos",
      icon: "products",
      card: "hover:bg-violet-50 hover:border-violet-200",
      iconWrap: "bg-violet-100 text-violet-600",
      text: "group-hover:text-violet-700",
    },
    {
      to: "/admin/servicios",
      label: "Servicios",
      icon: "services",
      card: "hover:bg-cyan-50 hover:border-cyan-200",
      iconWrap: "bg-cyan-100 text-cyan-600",
      text: "group-hover:text-cyan-700",
    },
    {
      to: "/admin/personal",
      label: "Personal",
      icon: "staff",
      card: "hover:bg-indigo-50 hover:border-indigo-200",
      iconWrap: "bg-indigo-100 text-indigo-600",
      text: "group-hover:text-indigo-700",
    },
    {
      to: "/admin/carrusel",
      label: "Carrusel",
      icon: "carousel",
      card: "hover:bg-rose-50 hover:border-rose-200",
      iconWrap: "bg-rose-100 text-rose-600",
      text: "group-hover:text-rose-700",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Bienvenido, Administrador</h1>
        <p className="text-slate-500 mt-2">
          Aqui tienes un resumen de la actividad reciente y accesos directos a tus herramientas.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando resumen..." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.title} className={`bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4 ${stat.container}`}>
              <div className={`p-3 rounded-xl ${stat.iconWrap}`}>
                <SidebarIcon name={stat.icon} className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm text-slate-500 font-medium">{stat.title}</div>
                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`p-4 bg-white border border-slate-100 rounded-xl transition-all shadow-sm group text-center flex flex-col items-center justify-center gap-2 ${action.card}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${action.iconWrap}`}>
                <SidebarIcon name={action.icon} className="h-5 w-5" />
              </div>
              <span className={`text-sm font-semibold text-slate-700 ${action.text}`}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
