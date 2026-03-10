import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const PERIODS = ["Semana", "Mes", "Ano"];

const EMPTY_STATS = {
  kpis: {
    ingresosTotales: 0,
    citasAtendidas: 0,
    ticketPromedio: 0,
    nuevosClientes: 0,
  },
  comparison: [],
  distribution: {
    servicios: 0,
    productos: 0,
    otros: 0,
  },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

export default function InformesEstadisticos() {
  const [period, setPeriod] = useState("Mes");
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const data = await requestJson(endpoints.adminStats(period), {
          token: getAdminToken(),
        });
        setStats({
          kpis: data.kpis || EMPTY_STATS.kpis,
          comparison: Array.isArray(data.comparison) ? data.comparison : [],
          distribution: data.distribution || EMPTY_STATS.distribution,
        });
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar estadisticas.");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [period]);

  const comparisonMax = useMemo(() => {
    const maxValue = stats.comparison.reduce((acc, item) => {
      const localMax = Math.max(Number(item.servicios || 0), Number(item.productos || 0));
      return Math.max(acc, localMax);
    }, 0);
    return maxValue > 0 ? maxValue : 1;
  }, [stats.comparison]);

  const donutStyle = useMemo(() => {
    const servicios = Number(stats.distribution.servicios || 0);
    const productos = Number(stats.distribution.productos || 0);
    const otros = Number(stats.distribution.otros || 0);
    const p1 = servicios;
    const p2 = servicios + productos;
    const p3 = servicios + productos + otros;
    return {
      background: `conic-gradient(#8b5cf6 0% ${p1}%, #fb7185 ${p1}% ${p2}%, #f59e0b ${p2}% ${p3}%)`,
    };
  }, [stats.distribution]);

  const distributionTotal = useMemo(() => {
    const servicios = Number(stats.distribution.servicios || 0);
    const productos = Number(stats.distribution.productos || 0);
    const otros = Number(stats.distribution.otros || 0);
    return servicios + productos + otros;
  }, [stats.distribution]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Informes Estadisticos</h1>
          <p className="text-slate-500 text-sm">Visualizacion grafica del desempeno.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${period === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <LoadingSpinner text="Cargando estadisticas..." fullScreen={false} className="py-20" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-violet-500 to-rose-500 rounded-2xl p-6 text-white shadow-lg">
              <div className="text-violet-100 text-sm font-medium mb-1">Ingresos Estimados</div>
              <div className="text-3xl font-bold mb-4">{formatCurrency(stats.kpis.ingresosTotales)}</div>
              <div className="text-xs bg-white/20 inline-block px-2 py-1 rounded w-fit">
                Con datos registrados
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm font-medium mb-1">Citas Registradas</div>
              <div className="text-3xl font-bold text-slate-800 mb-4">{stats.kpis.citasAtendidas}</div>
              <div className="text-xs text-slate-400">Durante {period.toLowerCase()}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm font-medium mb-1">Ticket Promedio</div>
              <div className="text-3xl font-bold text-slate-800 mb-4">{formatCurrency(stats.kpis.ticketPromedio)}</div>
              <div className="text-xs text-slate-400">Promedio por item</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm font-medium mb-1">Nuevos Clientes</div>
              <div className="text-3xl font-bold text-slate-800 mb-4">{stats.kpis.nuevosClientes}</div>
              <div className="text-xs text-slate-400">Altas en {period.toLowerCase()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-6">Comparativa (Servicios vs Productos)</h3>
              <div className="h-64 flex items-end justify-between px-2 gap-3">
                {stats.comparison.map((item) => {
                  const serviceHeight = (Number(item.servicios || 0) / comparisonMax) * 100;
                  const productHeight = (Number(item.productos || 0) / comparisonMax) * 100;

                  return (
                    <div key={item.label} className="w-full flex flex-col items-center gap-2">
                      <div className="w-full max-w-[54px] h-full flex items-end gap-1">
                        <div className="w-1/2 bg-violet-500 rounded-t-md transition-all duration-700" style={{ height: `${serviceHeight}%` }} />
                        <div className="w-1/2 bg-rose-400 rounded-t-md transition-all duration-700" style={{ height: `${productHeight}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{item.label}</span>
                    </div>
                  );
                })}
                {stats.comparison.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    Sin datos para graficar.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-6">Distribucion de Valor</h3>
              <div className="flex items-center justify-center h-64">
                <div className="w-52 h-52 rounded-full p-4" style={donutStyle}>
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-800">{distributionTotal.toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Total</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-4 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-violet-500" /> Servicios {stats.distribution.servicios.toFixed(1)}%
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-rose-400" /> Productos {stats.distribution.productos.toFixed(1)}%
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-amber-400" /> Otros {stats.distribution.otros.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
