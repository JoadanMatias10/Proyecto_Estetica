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

const DISTRIBUTION_COLORS = {
  servicios: { solid: "#8b5cf6", soft: "#ede9fe", label: "Servicios" },
  productos: { solid: "#fb7185", soft: "#ffe4e6", label: "Productos" },
  otros: { solid: "#f59e0b", soft: "#fef3c7", label: "Otros" },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "$0";
  if (Math.abs(parsed) < 1000) return formatCurrency(parsed);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(parsed);
}

function formatCompactNumber(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return new Intl.NumberFormat("es-MX", {
    notation: Math.abs(parsed) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(parsed) >= 1000 ? 1 : 0,
  }).format(parsed);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function clampPercent(value) {
  return Math.min(Math.max(Number(value || 0), 0), 100);
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

  const comparisonSeries = useMemo(
    () =>
      stats.comparison.map((item) => ({
        label: item.label,
        servicios: Number(item.servicios || 0),
        productos: Number(item.productos || 0),
      })),
    [stats.comparison]
  );

  const comparisonMax = useMemo(() => {
    const maxValue = comparisonSeries.reduce((acc, item) => {
      const localMax = Math.max(item.servicios, item.productos);
      return Math.max(acc, localMax);
    }, 0);
    return maxValue > 0 ? maxValue : 1;
  }, [comparisonSeries]);

  const comparisonTicks = useMemo(
    () => [1, 0.75, 0.5, 0.25, 0].map((ratio) => comparisonMax * ratio),
    [comparisonMax]
  );

  const distributionItems = useMemo(
    () =>
      [
        { key: "servicios", value: clampPercent(stats.distribution.servicios) },
        { key: "productos", value: clampPercent(stats.distribution.productos) },
        { key: "otros", value: clampPercent(stats.distribution.otros) },
      ].map((item) => ({
        ...item,
        ...DISTRIBUTION_COLORS[item.key],
      })),
    [stats.distribution]
  );

  const distributionTotal = useMemo(() => {
    const servicios = Number(stats.distribution.servicios || 0);
    const productos = Number(stats.distribution.productos || 0);
    const otros = Number(stats.distribution.otros || 0);
    return servicios + productos + otros;
  }, [stats.distribution]);

  const topDistribution = useMemo(
    () => distributionItems.reduce((best, item) => (item.value > best.value ? item : best), distributionItems[0] || { value: 0, label: "Sin datos" }),
    [distributionItems]
  );

  const donutStyle = useMemo(() => {
    const servicios = clampPercent(stats.distribution.servicios);
    const productos = clampPercent(stats.distribution.productos);
    const otros = clampPercent(stats.distribution.otros);
    const p1 = servicios;
    const p2 = Math.min(servicios + productos, 100);
    const p3 = Math.min(servicios + productos + otros, 100);

    if (p3 <= 0) {
      return {
        background: "conic-gradient(#e2e8f0 0% 100%)",
      };
    }

    return {
      background: `conic-gradient(#8b5cf6 0% ${p1}%, #fb7185 ${p1}% ${p2}%, #f59e0b ${p2}% ${p3}%)`,
    };
  }, [stats.distribution]);

  const chartMinWidth = Math.max(comparisonSeries.length * 74, 520);

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
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-slate-800">Comparativa (Servicios vs Productos)</h3>
                  <p className="text-xs text-slate-400 mt-1">Misma informacion, con mejor lectura visual.</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-violet-500" />
                    Servicios
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    Productos
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                {comparisonSeries.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                    Sin datos para graficar.
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div className="grid gap-3" style={{ gridTemplateColumns: `44px minmax(${chartMinWidth}px, 1fr)` }}>
                      <div className="flex h-64 flex-col justify-between pb-7 text-[11px] font-medium text-slate-400">
                        {comparisonTicks.map((tick, index) => (
                          <span key={`${tick}-${index}`}>{formatCompactNumber(tick)}</span>
                        ))}
                      </div>

                      <div className="relative h-64 min-w-[520px]">
                        <div className="absolute inset-0 flex flex-col justify-between">
                          {comparisonTicks.map((tick, index) => (
                            <div key={`${tick}-line-${index}`} className="border-t border-dashed border-slate-200" />
                          ))}
                        </div>

                        <div className="relative z-10 h-full flex items-end gap-3">
                          {comparisonSeries.map((item) => {
                            const serviceHeight = item.servicios > 0 ? Math.max((item.servicios / comparisonMax) * 100, 12) : 0;
                            const productHeight = item.productos > 0 ? Math.max((item.productos / comparisonMax) * 100, 12) : 0;

                            return (
                              <div key={item.label} className="w-full min-w-0 flex flex-col items-center gap-2">
                                <div className="w-full h-full flex items-end justify-center">
                                  <div className="w-full max-w-[58px] h-full flex items-end gap-1.5 rounded-t-xl px-1 pt-6 hover:bg-white/70 transition-colors">
                                    <div className="w-1/2 h-full flex flex-col justify-end gap-2">
                                      <span className="text-[10px] text-center font-semibold text-violet-700">
                                        {item.servicios > 0 ? formatCompactCurrency(item.servicios) : ""}
                                      </span>
                                      <div
                                        className="w-full rounded-t-xl bg-gradient-to-t from-violet-600 via-violet-500 to-violet-300 shadow-[0_12px_24px_rgba(139,92,246,0.24)] transition-all duration-700"
                                        style={{ height: `${serviceHeight}%`, minHeight: item.servicios > 0 ? 22 : 0 }}
                                        title={`Servicios ${item.label}: ${formatCurrency(item.servicios)}`}
                                      />
                                    </div>
                                    <div className="w-1/2 h-full flex flex-col justify-end gap-2">
                                      <span className="text-[10px] text-center font-semibold text-rose-600">
                                        {item.productos > 0 ? formatCompactCurrency(item.productos) : ""}
                                      </span>
                                      <div
                                        className="w-full rounded-t-xl bg-gradient-to-t from-rose-500 via-rose-400 to-rose-200 shadow-[0_12px_24px_rgba(251,113,133,0.24)] transition-all duration-700"
                                        style={{ height: `${productHeight}%`, minHeight: item.productos > 0 ? 22 : 0 }}
                                        title={`Productos ${item.label}: ${formatCurrency(item.productos)}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[11px] text-slate-500 font-semibold text-center">{item.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-slate-800">Distribucion de Valor</h3>
                  <p className="text-xs text-slate-400 mt-1">Distribucion porcentual con mejor contraste visual.</p>
                </div>
                <div
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: topDistribution?.soft || "#f8fafc",
                    color: topDistribution?.solid || "#475569",
                  }}
                >
                  Lider: {topDistribution?.label || "Sin datos"}
                </div>
              </div>

              <div className="flex items-center justify-center h-64 rounded-2xl border border-slate-100 bg-slate-50/70 relative overflow-hidden">
                <div className="absolute h-40 w-40 rounded-full bg-violet-100/80 blur-3xl" />
                <div className="absolute h-36 w-36 translate-x-10 translate-y-8 rounded-full bg-rose-100/80 blur-3xl" />
                <div className="relative w-52 h-52 rounded-full p-4 shadow-[0_18px_44px_rgba(148,163,184,0.24)] ring-8 ring-white/90" style={donutStyle}>
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-inner">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-800">{distributionTotal.toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Total</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {distributionItems.map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: item.solid }} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="font-semibold">{formatPercent(item.value)}</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.value}%`,
                          background: `linear-gradient(90deg, ${item.solid} 0%, ${item.soft} 100%)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
