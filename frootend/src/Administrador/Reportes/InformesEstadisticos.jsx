import React, { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

function createVerticalGradient(context, topColor, bottomColor) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;
  if (!chartArea) return bottomColor;

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
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

  const hasComparisonData = useMemo(
    () => comparisonSeries.some((item) => item.servicios > 0 || item.productos > 0),
    [comparisonSeries]
  );

  const comparisonChartData = useMemo(
    () => ({
      labels: comparisonSeries.map((item) => item.label),
      datasets: [
        {
          label: "Servicios",
          data: comparisonSeries.map((item) => item.servicios),
          backgroundColor: (context) => createVerticalGradient(context, "#a78bfa", "#7c3aed"),
          borderColor: "#6d28d9",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 30,
          categoryPercentage: 0.72,
          barPercentage: 0.82,
        },
        {
          label: "Productos",
          data: comparisonSeries.map((item) => item.productos),
          backgroundColor: (context) => createVerticalGradient(context, "#fda4af", "#f43f5e"),
          borderColor: "#e11d48",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 30,
          categoryPercentage: 0.72,
          barPercentage: 0.82,
        },
      ],
    }),
    [comparisonSeries]
  );

  const comparisonChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: "#64748b",
            font: {
              size: 11,
              weight: 600,
            },
          },
        },
        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.22)",
            drawTicks: false,
          },
          ticks: {
            color: "#94a3b8",
            padding: 10,
            callback: (value) => formatCompactNumber(value),
            font: {
              size: 11,
              weight: 600,
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(255, 255, 255, 0.14)",
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
          },
        },
      },
    }),
    []
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

  const hasDistributionData = distributionTotal > 0;

  const topDistribution = useMemo(
    () => distributionItems.reduce((best, item) => (item.value > best.value ? item : best), distributionItems[0] || { value: 0, label: "Sin datos" }),
    [distributionItems]
  );

  const distributionChartData = useMemo(
    () => ({
      labels: distributionItems.map((item) => item.label),
      datasets: [
        {
          data: distributionItems.map((item) => item.value),
          backgroundColor: distributionItems.map((item) => item.solid),
          borderColor: "#ffffff",
          borderWidth: 6,
          hoverOffset: 12,
          spacing: 3,
        },
      ],
    }),
    [distributionItems]
  );

  const distributionChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(255, 255, 255, 0.14)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => `${context.label}: ${formatPercent(context.raw)}`,
          },
        },
      },
    }),
    []
  );

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
                {comparisonSeries.length === 0 || !hasComparisonData ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                    Sin datos para graficar.
                  </div>
                ) : (
                  <div className="h-72 min-w-0">
                    <Bar data={comparisonChartData} options={comparisonChartOptions} />
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

              <div className="flex items-center justify-center h-72 rounded-2xl border border-slate-100 bg-slate-50/70 relative overflow-hidden">
                {hasDistributionData ? (
                  <div className="relative h-56 w-56">
                    <Doughnut data={distributionChartData} options={distributionChartOptions} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-800">{distributionTotal.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">Total</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm">Sin datos para graficar.</div>
                )}
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
