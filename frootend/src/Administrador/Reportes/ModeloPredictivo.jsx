import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ─────────────── helpers de formato ─────────────── */
function fmtNum(v) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(
    Number(v || 0)
  );
}

function fmtPercent(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "N/D";
  return `${Number(v).toFixed(1)}%`;
}

function fmtDateTime(value) {
  if (!value) return "Sin registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const stringValue = String(value);
  const normalizedValue = stringValue.includes("T") ? stringValue : `${stringValue}T12:00:00`;
  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffCalendarDays(startValue, endValue) {
  const startDate = parseLocalDate(startValue);
  const endDate = parseLocalDate(endValue);
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.ceil((endDate - startDate) / MS_PER_DAY));
}

function formatDaySpan(days) {
  const normalizedDays = Math.max(0, Number(days || 0));
  return `${normalizedDays} ${normalizedDays === 1 ? "dia" : "dias"}`;
}

function getWeekKey(value) {
  const date = parseLocalDate(value);
  if (!date) return "";
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

function getControlPointKey(value, granularity) {
  const rawValue = String(value || "");
  if (granularity === "monthly") return rawValue.slice(0, 7);
  if (granularity === "weekly") return getWeekKey(rawValue);
  return rawValue.slice(0, 10);
}

function getSalePointKey(sale, granularity) {
  const rawValue = String(sale?.fecha || sale?.date || "");
  if (granularity === "monthly") return rawValue.slice(0, 7);
  if (granularity === "weekly") return getWeekKey(rawValue);
  return rawValue.slice(0, 10);
}

function sumUnitsForControlPoint(sales, granularity, dateValue) {
  const pointKey = getControlPointKey(dateValue, granularity);
  if (!pointKey) return 0;

  return sales
    .filter((sale) => getSalePointKey(sale, granularity) === pointKey)
    .reduce((total, sale) => total + Number(sale.cantidad || sale.quantity || 1), 0);
}

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

/* ─────────────── motor predictivo: P(t) = P₀·e^(k·t) ─────────────── */
// Basado en la ecuación diferencial dP/dt = kP (MEMORIA DE CALCULO BINA 9)
function exponentialParams(ys) {
  const series = ys.map((v) => Number(v || 0));
  const p0Idx = series.findIndex((v) => v > 0);
  if (p0Idx === -1) return { p0: 0, k: 0, p0Idx: 0, valid: false };
  const p0 = series[p0Idx];
  let refIdx = -1;
  for (let i = series.length - 1; i > p0Idx; i--) {
    if (series[i] > 0) { refIdx = i; break; }
  }
  if (refIdx === -1) return { p0, k: 0, p0Idx, valid: true };
  const pt = series[refIdx];
  const t = refIdx - p0Idx;
  if (t === 0 || p0 <= 0 || pt <= 0) return { p0, k: 0, p0Idx, valid: true };
  // k redondeado a 4 decimales (igual que cálculo a mano de la maestra)
  const k = Math.round((Math.log(pt / p0) / t) * 10000) / 10000;
  return { p0, k, p0Idx, valid: true };
}

function predict(ys, stepsAhead) {
  const series = ys.map((v) => Number(v || 0));
  const { p0, k, p0Idx, valid } = exponentialParams(series);
  if (!valid || p0 === 0) return 0;
  const tFuture = (series.length - 1 - p0Idx) + stepsAhead;
  return Math.max(0, Math.round(p0 * Math.exp(k * tFuture)));
}

const EMPTY_PREDICTION = { p1: 0, p3: 0, p6: 0, prev1: 0, prev3: 0, prev6: 0 };

function sumProjectedDemand(ys, months) {
  return Array.from({ length: months }, (_, i) => predict(ys, i + 1)).reduce(
    (sum, value) => sum + value,
    0
  );
}

function buildPredictionSnapshot(values) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  return {
    p1: predict(series, 1),
    p3: predict(series, 3),
    p6: predict(series, 6),
    prev1: series[series.length - 1] || 0,
    prev3: Math.round(series.slice(-3).reduce((sum, value) => sum + value, 0) / 3),
    prev6: Math.round(series.slice(-6).reduce((sum, value) => sum + value, 0) / 6),
  };
}

/* ─────────────── datos simulados (fallback) ─────────────── */
const CATEGORY_COLORS = {
  Cabello: { solid: "#6366f1", soft: "#eef2ff", dark: "#4338ca" },
  Coloración: { solid: "#ec4899", soft: "#fdf2f8", dark: "#be185d" },
  Tratamientos: { solid: "#f59e0b", soft: "#fffbeb", dark: "#b45309" },
  "Naturales": { solid: "#10b981", soft: "#ecfdf5", dark: "#065f46" },
  Accesorios: { solid: "#0ea5e9", soft: "#f0f9ff", dark: "#0369a1" },
  Otro: { solid: "#8b5cf6", soft: "#f5f3ff", dark: "#6d28d9" },
};

function colorForCategory(name) {
  return (
    CATEGORY_COLORS[name] || {
      solid: "#64748b",
      soft: "#f8fafc",
      dark: "#334155",
    }
  );
}

/* ─────────────── datos simulados (fallback) removidos ─────────────── */

/* ─────────────── construcción de labels de meses ─────────────── */
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatCoverage(value) {
  if (value === null || value === undefined) return "Sin demanda estimada";
  return `${Number(value).toFixed(1)} meses`;
}

function getConfidencePalette(level) {
  if (level === "Alta") {
    return {
      bg: "#ecfdf5",
      border: "#10b98133",
      text: "#065f46",
    };
  }

  if (level === "Media") {
    return {
      bg: "#fffbeb",
      border: "#f59e0b33",
      text: "#92400e",
    };
  }

  return {
    bg: "#fef2f2",
    border: "#ef444433",
    text: "#991b1b",
  };
}

function buildActionMessage(summary) {
  if (!summary) return "";
  if (summary.riskBreakage) {
    if (summary.suggestedRestock > 0) {
      return `El stock actual no cubre la demanda estimada. Conviene reponer al menos ${fmtNum(summary.suggestedRestock)} uds. para sostener los proximos 3 meses.`;
    }
    return "La cobertura estimada es baja para la demanda proyectada. Conviene monitorear ventas y reabastecer pronto.";
  }

  if (summary.riskOverstock) {
    return "El inventario disponible esta por encima de la demanda esperada. Conviene frenar compras de esta categoria o reforzar promociones.";
  }

  return "El inventario y la demanda proyectada se ven balanceados. Mantener monitoreo mensual deberia ser suficiente.";
}

function getAlertPalette(severity) {
  if (severity === "Alta") {
    return { bg: "#fef2f2", border: "#ef444433", text: "#991b1b" };
  }

  if (severity === "Media") {
    return { bg: "#fff7ed", border: "#f9731633", text: "#9a3412" };
  }

  return { bg: "#eff6ff", border: "#3b82f633", text: "#1d4ed8" };
}

function getProductStatus(product) {
  if (product?.riskBreakage) {
    return {
      label: "Reabasto",
      palette: { bg: "#fef2f2", text: "#991b1b" },
    };
  }

  if (product?.riskOverstock) {
    return {
      label: "Sobrestock",
      palette: { bg: "#fff7ed", text: "#9a3412" },
    };
  }

  if (product?.lowRotation) {
    return {
      label: "Baja rotacion",
      palette: { bg: "#eff6ff", text: "#1d4ed8" },
    };
  }

  return {
    label: "Estable",
    palette: { bg: "#ecfdf5", text: "#065f46" },
  };
}

function DashboardCard({ children, className = "", style }) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function PanelIntro({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {eyebrow}
          </span>
        ) : null}
        <h3 className="mt-1 text-lg font-bold text-slate-800">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function buildMonthLabels(count, fromDate = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth() - count + 1 + i, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  });
}

function buildFutureLabels(currentDate, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1 + i, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  });
}

function buildDayLabels(count, fromDate) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() - count + 1 + i);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  });
}

function buildFutureDayLabels(currentDate, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1 + i);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  });
}

function buildWeekLabels(count, fromDate) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() - (count - 1 - i) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `S ${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]}`;
  });
}

function buildFutureWeekLabels(currentDate, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (i + 1) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `S ${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]}`;
  });
}

function ProductIntelligencePanel({ product, rawSales, rawProductSales, today, color }) {
  const [gran, setGran] = useState("monthly");

  const { labels, values, isPrediction } = useMemo(() => {
    const isProduct = !!product;
    const targetSales = isProduct
      ? rawProductSales.filter(s => String(s.productId || s.nombre) === String(product.productId || product.nombre))
      : rawSales.filter(s => s.categoria === product?.categoria);

    let hLabels = [];
    let hValues = [];
    let pLabels = [];
    let pValues = [];

    if (gran === "monthly") {
      // 12 meses de historia (para coincidir con el resto del dashboard)
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        hLabels.push(`${MONTH_NAMES[d.getMonth()].slice(0, 3)}`);
        hValues.push(targetSales.filter(s => s.fecha.startsWith(key)).reduce((acc, s) => acc + s.cantidad, 0));
      }
      // 3 meses de prediccion
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        pLabels.push(`${MONTH_NAMES[d.getMonth()].slice(0, 3)}`);
        pValues.push(predict(hValues, i));
      }
    } else if (gran === "weekly") {
      // 12 semanas de historia
      for (let i = 0; i < 12; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (11 - i) * 7);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        hLabels.push(`S${monday.getDate()}`);
        const key = monday.toISOString().slice(0, 10);
        hValues.push(targetSales.filter(s => {
          const sd = new Date(s.fecha + "T12:00:00");
          const sday = sd.getDay();
          const sdiff = sd.getDate() - sday + (sday === 0 ? -6 : 1);
          const smondayStr = new Date(sd.setDate(sdiff)).toISOString().slice(0, 10);
          return smondayStr === key;
        }).reduce((acc, s) => acc + s.cantidad, 0));
      }
      // 3 semanas de prediccion
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i * 7);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        pLabels.push(`S${monday.getDate()}`);
        pValues.push(predict(hValues, i));
      }
    } else {
      // 30 dias de historia (para que no se pierdan ventas recientes)
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - 29 + i);
        hLabels.push(`${d.getDate()}`);
        const key = d.toISOString().slice(0, 10);
        hValues.push(targetSales.filter(s => s.fecha === key).reduce((acc, s) => acc + s.cantidad, 0));
      }
      // 3 dias de prediccion
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        pLabels.push(`${d.getDate()}`);
        pValues.push(predict(hValues, i));
      }
    }

    return {
      labels: [...hLabels, ...pLabels],
      values: [...hValues, ...pValues],
      isPrediction: [...hLabels.map(() => false), ...pLabels.map(() => true)]
    };
  }, [product, rawSales, rawProductSales, today, gran]);

  if (!product) return null;

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Ventas",
        data: values,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return color.solid;

          const index = context.dataIndex;
          const isPred = isPrediction[index];

          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          if (isPred) {
            // Estilo para prediccion: Violeta/Indigo
            gradient.addColorStop(0, "#8b5cf6");
            gradient.addColorStop(1, "#6366f1");
          } else {
            // Estilo para historia: Color de categoria
            gradient.addColorStop(0, color.solid);
            gradient.addColorStop(1, color.dark + "CC");
          }
          return gradient;
        },
        hoverBackgroundColor: (context) => {
          const index = context.dataIndex;
          return isPrediction[index] ? "#4f46e5" : color.dark;
        },
        borderRadius: 12,
        borderSkipped: false,
        barThickness: 40,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2000,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        backdropFilter: "blur(4px)",
        padding: 14,
        titleFont: { size: 14, weight: "900", family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            return isPrediction[index] ? `🔮 Predicción: ${labels[index]}` : `📊 Real: ${labels[index]}`;
          },
          label: (context) => `Demanda: ${Math.round(context.raw)} unidades`,
        },
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11, weight: "700", family: "'Inter', sans-serif" },
          color: "#94a3b8",
          padding: 10
        }
      },
      y: {
        grid: {
          color: "#f1f5f9",
          drawBorder: false,
          borderDash: [5, 5]
        },
        ticks: {
          font: { size: 11, weight: "600" },
          color: "#cbd5e1",
          stepSize: 1,
          padding: 10
        }
      }
    }
  };

  return (
    <DashboardCard className="p-6 overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
        {/* Lado Izquierdo: Imagen y Info */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="relative group aspect-square rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center p-6 overflow-hidden">
            {product.imagen ? (
              <img
                src={product.imagen}
                alt={product.nombre}
                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="text-4xl">📦</div>
            )}
            <div className="absolute top-4 left-4">
              <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 border border-slate-100 shadow-sm uppercase tracking-wider">
                Preview
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{product.nombre}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{product.marca || "Marca no especificada"}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Primera Venta</span>
                <span className="text-xs font-bold text-slate-600">{fmtDateTime(product.firstSaleAt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Última Venta</span>
                <span className="text-xs font-bold text-slate-600">{fmtDateTime(product.lastSaleAt)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Grafica de Barras */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Distribución de Demanda</h3>
              <p className="text-xs text-slate-400 mt-1">Análisis por periodos para el producto seleccionado</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              {["daily", "weekly", "monthly"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGran(g)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${gran === g ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-500"
                    }`}
                >
                  {g === "daily" ? "DÍA" : g === "weekly" ? "SEM" : "MES"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[200px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

/* ─────────────── sub-componentes UI ─────────────── */
// eslint-disable-next-line no-unused-vars
function KpiCard({ label, value, prev, color }) {
  const up = value >= prev;
  const arrow = up ? "▲" : "▼";
  const arrowColor = up ? "#10b981" : "#ef4444";
  const diff = Math.abs(value - prev);
  return (
    <div
      className="flex-1 min-w-0 rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: color.soft, border: `1.5px solid ${color.solid}22` }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: color.dark }}>
        {label}
      </span>
      <span className="text-3xl font-extrabold" style={{ color: color.dark }}>
        {fmtNum(value)}
        <span className="text-sm font-medium text-slate-500 ml-1">uds.</span>
      </span>
      <span className="text-xs font-medium flex items-center gap-1" style={{ color: arrowColor }}>
        <span>{arrow}</span>
        <span>{fmtNum(diff)} vs período ant.</span>
      </span>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function ForecastCard({ label, value, prev, color }) {
  const up = value >= prev;
  const diff = Math.abs(value - prev);

  return (
    <DashboardCard
      className="flex-1 min-w-[220px] p-5 md:p-6"
      style={{
        background: `linear-gradient(180deg, ${color.soft} 0%, rgba(255,255,255,0.98) 100%)`,
        borderColor: `${color.solid}22`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${color.dark} 0%, ${color.solid} 100%)` }}
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: color.dark }}>
            {label}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: up ? "#ecfdf5" : "#fef2f2",
              color: up ? "#047857" : "#b91c1c",
            }}
          >
            {up ? "▲" : "▼"} {fmtNum(diff)}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-black tracking-tight" style={{ color: color.dark }}>
            {fmtNum(value)}
          </span>
          <span className="pb-1 text-sm font-medium text-slate-400">uds.</span>
        </div>
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-white/80 ring-1 ring-black/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(12, prev > 0 ? (value / prev) * 100 : 100))}%`,
                background: `linear-gradient(90deg, ${color.dark} 0%, ${color.solid} 100%)`,
              }}
            />
          </div>
          <span className="text-xs font-medium" style={{ color: up ? "#047857" : "#b91c1c" }}>
            {up ? "Por encima" : "Por debajo"} del periodo anterior
          </span>
        </div>
      </div>
    </DashboardCard>
  );
}

function SalesChart({ histValues, futureValues, histLabels, futureLabels, color }) {
  const allLabels = [...histLabels, ...futureLabels];
  const histData = [...histValues, ...Array(futureValues.length).fill(null)];

  // Para unir la línea, el último punto histórico también es el primer punto proyectado
  const lastHistVal = histValues.length > 0 ? histValues[histValues.length - 1] : null;
  const projData = [...Array(histValues.length > 0 ? histValues.length - 1 : 0).fill(null), lastHistVal, ...futureValues];

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: "Ventas reales",
        data: histData,
        borderColor: color.solid,
        backgroundColor: `${color.solid}33`,
        borderWidth: 3,
        pointBackgroundColor: color.solid,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0,
      },
      {
        label: "Proyección",
        data: projData,
        borderColor: "#f97316",
        backgroundColor: "#f9731622",
        borderWidth: 3,
        borderDash: [7, 5],
        pointBackgroundColor: "#f97316",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 11, family: "inherit", weight: "bold" },
          color: "#64748b",
        },
      },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.95)",
        titleColor: "#334155",
        bodyColor: "#475569",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 13, family: "inherit" },
        bodyFont: { size: 12, family: "inherit", weight: "bold" },
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${fmtNum(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: { size: 10, family: "inherit" },
          color: "#94a3b8",
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: "#f1f5f9", drawTicks: false },
        ticks: { font: { size: 11, family: "inherit" }, color: "#94a3b8", padding: 8 },
      },
    },
  };

  return (
    <div className="w-full h-[280px]">
      <Line data={data} options={options} />
    </div>
  );
}

/* ─────────────── VERTICAL BAR CHART ─────────────── */
function VerticalBarChart({ categories, selected, onSelect }) {
  const data = {
    labels: categories.map((c) => c.name),
    datasets: [
      {
        label: "Ventas Históricas",
        data: categories.map((c) => c.histTotal),
        backgroundColor: categories.map((c) =>
          c.name === selected ? colorForCategory(c.name).solid : colorForCategory(c.name).soft
        ),
        borderRadius: 4,
        barPercentage: 0.6,
      },
      {
        label: "Proyección (3m)",
        data: categories.map((c) => c.proj3Total),
        backgroundColor: categories.map((c) =>
          c.name === selected ? "#f97316" : "#fed7aa"
        ),
        borderRadius: 4,
        barPercentage: 0.6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (e, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        onSelect(categories[index].name);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          font: { size: 11, family: "inherit", weight: "bold" },
          color: "#64748b",
        },
      },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.95)",
        titleColor: "#334155",
        bodyColor: "#475569",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${fmtNum(context.parsed.y)} uds`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          font: { size: 10, family: "inherit", weight: "600" },
          color: (ctx) => (categories[ctx.index]?.name === selected ? "#1e293b" : "#94a3b8"),
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        border: { display: false },
        grid: { color: "#f1f5f9" },
        ticks: { font: { size: 11, family: "inherit" }, color: "#94a3b8" },
      },
    },
  };

  return (
    <div className="w-full h-[320px]">
      <Bar data={data} options={options} />
    </div>
  );
}

/* ─────────────── HEATMAP (simulado con Bar) ─────────────── */
function HeatmapChart({ data, labels }) {
  const chartData = {
    labels: labels || Array.from({ length: 30 }, (_, i) => `Día ${i + 1}`),
    datasets: [
      {
        label: "Ventas",
        data,
        backgroundColor: data.map((value) => {
          if (value === 0) return "#f1f5f9";
          if (value < 3) return "#bae6fd";
          if (value < 6) return "#7dd3fc";
          if (value < 10) return "#38bdf8";
          return "#0ea5e9";
        }),
        borderColor: "#fff",
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.95)",
        titleColor: "#334155",
        bodyColor: "#475569",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => `Ventas: ${fmtNum(context.parsed.y)} uds`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: { size: 9 },
          color: "#94a3b8",
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        display: false,
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="w-full h-[180px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}

/* ─────────────── DOUGHNUT CHART ─────────────── */
function DoughnutChart({ categories, values }) {
  const chartData = {
    labels: categories,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#6366f1", // Indigo
          "#ec4899", // Pink
          "#f59e0b", // Amber
          "#10b981", // Emerald
          "#0ea5e9", // Sky
          "#8b5cf6", // Violet
        ],
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          font: { size: 11, weight: "600" },
          color: "#475569",
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.95)",
        titleColor: "#334155",
        bodyColor: "#475569",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${fmtNum(context.parsed)} uds (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-[280px]">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

/* ─────────────── PROGRESS RING (con Doughnut) ─────────────── */
function ProgressRing({ label, value, max = 100, color = "#6366f1" }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const chartData = {
    labels: ["Completado", "Restante"],
    datasets: [
      {
        data: [percentage, 100 - percentage],
        backgroundColor: [color, "#e2e8f0"],
        borderWidth: 0,
        hoverOffset: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-[140px] h-[140px]">
        <Doughnut data={chartData} options={options} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color }}>
              {fmtNum(value)}
            </div>
            <div className="text-xs font-bold text-slate-400">
              {percentage.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="text-sm font-bold text-slate-700">{label}</div>
      </div>
    </div>
  );
}

/* ─────────────── SPARKLINE (con Line) ─────────────── */
function Sparkline({ data, color = "#6366f1" }) {
  const chartData = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: `${color}22`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false, beginAtZero: true },
    },
  };

  return (
    <div className="w-full h-[45px]">
      <Line data={chartData} options={options} />
    </div>
  );
}

/* ─────────────── KPI CARD CON SPARKLINE ─────────────── */
function KpiCardWithSparkline({ label, value, prev, color, sparklineData }) {
  const up = value >= prev;
  const diff = prev ? Math.abs(value - prev) : 0;
  const percentage = prev ? ((value - prev) / prev * 100).toFixed(1) : 0;

  return (
    <DashboardCard className="flex-1 min-w-[240px] p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
          {prev && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
            >
              {up ? '↑' : '↓'} {percentage}%
            </span>
          )}
        </div>

        <div className="text-3xl font-black" style={{ color: color.dark }}>
          {fmtNum(value)}
          <span className="text-sm font-medium text-slate-400 ml-1">uds.</span>
        </div>
        {prev ? (
          <span className="text-[11px] font-semibold text-slate-400">
            Diferencia: {fmtNum(diff)} uds.
          </span>
        ) : null}
        {Array.isArray(sparklineData) && sparklineData.length > 1 ? (
          <Sparkline data={sparklineData} color={color.solid} />
        ) : null}
      </div>
    </DashboardCard>
  );
}


function MetricRow({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-bold text-slate-800 text-right">{value}</span>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}


/* ─────────────── COMPONENTE: DATOS DE ENTRADA DEL MODELO ─────────────── */
function ModelInputData({
  stockInitial = 0,
  salesInRange = 0,
  p0 = 0,
  k = 0,
  alertLevel = 0,
  category = "",
  product = "",
  granularity = "monthly",
  horizon = 1,
  histValues = [],
  histLabels = [],
  filteredSales = [],
  rangeStart = null,
  rangeEnd = null,
  predictionHorizon = { label: "1 Mes", d: 0, m: 1 }
}) {
  const formatDate = () => {
    const today = new Date();
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(today);
  };

  const getGranularityLabel = () => {
    switch (granularity) {
      case 'daily': return 'días';
      case 'weekly': return 'semanas';
      case 'monthly': return 'meses';
      default: return 'meses';
    }
  };

  const getHistoricalLabel = () => {
    switch (granularity) {
      case 'daily': return 'Histórico de 30 días';
      case 'weekly': return 'Histórico de 12 semanas';
      case 'monthly': return 'Histórico de 12 meses';
      default: return 'Histórico de 12 meses';
    }
  };

  const getKInterpretation = () => {
    const percentage = (k * 100).toFixed(2);
    const period = getGranularityLabel();

    if (k > 0.05) return `Crecimiento acelerado del ${percentage}% por ${period}. La demanda aumenta rápidamente.`;
    if (k > 0) return `Crecimiento moderado del ${percentage}% por ${period}. Tendencia positiva estable.`;
    if (k < -0.05) return `Descenso acelerado del ${Math.abs(percentage)}% por ${period}. La demanda disminuye considerablemente.`;
    if (k < 0) return `Ligero descenso del ${Math.abs(percentage)}% por ${period}. Tendencia a la baja.`;
    return `Sin crecimiento (0%). Demanda estable sin variación.`;
  };

  const displayName = product || category || "Sin seleccionar";
  const displayType = product ? "Producto" : "Categoría";

  // ── Lógica para la Tabla de 2 Puntos (ING) ──
  const twoPointTable = useMemo(() => {
    if (!filteredSales || !rangeStart || !rangeEnd) return null;

    const dStart = parseLocalDate(rangeStart);
    const dEnd = parseLocalDate(rangeEnd);
    if (!dStart || !dEnd) return null;

    // Diferencia en días real del periodo histórico elegido (CI -> K)
    const elapsedDays = diffCalendarDays(dStart, dEnd);
    const safeElapsedDays = Math.max(1, elapsedDays);

    // La proyeccion P1 es "Fin de Periodo + Horizonte Seleccionado"
    const dTarget = new Date(dEnd);
    if (predictionHorizon.m > 0) dTarget.setMonth(dTarget.getMonth() + predictionHorizon.m);
    else dTarget.setDate(dTarget.getDate() + predictionHorizon.d);

    const forecastDays = diffCalendarDays(dEnd, dTarget);
    const totalDays = elapsedDays + forecastDays;

    // Agregación de unidades (P) según la granularidad
    const p_start = sumUnitsForControlPoint(filteredSales, granularity, rangeStart);
    const p_end = sumUnitsForControlPoint(filteredSales, granularity, rangeEnd);

    // k = ln(p2/p1) / Δt (donde Δt es el tiempo CI -> K)
    const safePStart = Math.max(0.1, p_start);
    const safePEnd = Math.max(0.1, p_end);
    const k_calc = Math.round((Math.log(safePEnd / safePStart) / safeElapsedDays) * 10000) / 10000;

    // P1 proyectado al total de días (CI -> P1)
    const p1_val = safePEnd * Math.exp(k_calc * forecastDays);

    return {
      ci: { p: p_start, t: "0 dias", fecha: dStart.toLocaleDateString("es-MX") },
      k_point: { p: p_end, t: formatDaySpan(elapsedDays), fecha: dEnd.toLocaleDateString("es-MX") },
      p1: {
        p: Math.max(0, Math.round(p1_val)),
        t: formatDaySpan(totalDays),
        breakdown: `${formatDaySpan(elapsedDays)} + ${formatDaySpan(forecastDays)}`,
        horizonLabel: predictionHorizon.label,
        fecha: dTarget.toLocaleDateString("es-MX"),
      },
      k_raw: k_calc
    };
  }, [filteredSales, predictionHorizon, granularity, rangeStart, rangeEnd]);

  return (
    <DashboardCard className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          Datos de Entrada del Modelo
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Información base utilizada para el cálculo predictivo exponencial
        </p>
      </div>

      {/* Memoria de Cálculo (Tabla de 2 Puntos) - NUEVO */}
      {twoPointTable && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
          <div className="bg-slate-900 px-5 py-3 border-b border-slate-800">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Memoria de Cálculo: Calibración Exponencial
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-4">Punto de Control</th>
                  <th className="px-6 py-4 text-center">p (Cantidad)</th>
                  <th className="px-6 py-4 text-center">t (Tiempo)</th>
                  <th className="px-6 py-4">Fecha de Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-700">CI</span>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-tighter">Condición Inicial</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-lg border border-indigo-100">
                      {twoPointTable.ci.p}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500 font-medium">{twoPointTable.ci.t}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium italic">fecha 1: {twoPointTable.ci.fecha}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-700">K</span>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-tighter">Punto de Calibración</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-mono font-bold text-lg border border-violet-100">
                      {twoPointTable.k_point.p}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500 font-medium">{twoPointTable.k_point.t}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium italic">fecha 2: {twoPointTable.k_point.fecha}</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-6 py-4">
                    <span className="font-black text-indigo-900">P1</span>
                    <span className="text-[10px] text-indigo-400 block uppercase font-black tracking-tighter">Proyección Final</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg bg-emerald-500 text-white font-mono font-black text-lg shadow-sm">
                      {twoPointTable.p1.p}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-slate-600 font-black">{twoPointTable.p1.t}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{twoPointTable.p1.breakdown}</div>
                  </td>
                  <td className="px-6 py-4 text-emerald-600 font-black italic">Pronóstico: {twoPointTable.p1.fecha}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50/30 p-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed m-0">
                Cálculo basado en la tasa de crecimiento instantánea: <code className="mx-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-600 font-black">k = ln(P₂/P₁) / Δt</code>. Este método permite validar la memoria de cálculo técnica.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selección actual */}
      <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            {product ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.707 2.121a2 2 0 01-1.897 1.36h-1.092a2 2 0 01-1.897-1.36l-.707-2.121a2 2 0 00-1.96-1.414l-2.387.477a2 2 0 00-1.022.547l-1.38 1.38a2 2 0 01-2.828 0l-.707-.707a2 2 0 010-2.828l1.38-1.38a2 2 0 00.547-1.022l.477-2.387a2 2 0 00-1.414-1.96l-2.121-.707a2 2 0 01-1.36-1.897V10.15a2 2 0 011.36-1.897l2.121-.707a2 2 0 001.414-1.96l-.477-2.387a2 2 0 00-.547-1.022l-1.38-1.38a2 2 0 010-2.828l.707-.707a2 2 0 012.828 0l1.38 1.38a2 2 0 001.022.547l2.387.477a2 2 0 001.96-1.414l.707-2.121a2 2 0 011.897-1.36h1.092a2 2 0 011.897 1.36l.707 2.121a2 2 0 001.96 1.414l2.387-.477a2 2 0 001.022-.547l1.38-1.38a2 2 0 012.828 0l.707.707a2 2 0 010 2.828l-1.38 1.38a2 2 0 00-.547-1.022l-.477 2.387a2 2 0 001.414-1.96l2.121.707a2 2 0 011.36 1.897v1.092a2 2 0 01-1.36 1.897l-2.121.707a2 2 0 00-1.414-1.96l.477 2.387z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            )}
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              {displayType} seleccionada
            </div>
            <div className="font-bold text-slate-800 text-lg">
              {displayName}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Inicial</div>
          <div className="text-2xl font-black text-slate-800">{fmtNum(stockInitial)} <span className="text-xs font-medium text-slate-400">uds</span></div>
          <div className="text-[10px] text-slate-400 mt-1 italic">Día {formatDate()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas Rango</div>
          <div className="text-2xl font-black text-emerald-600">{fmtNum(salesInRange)} <span className="text-xs font-medium text-slate-400">uds</span></div>
          <div className="text-[10px] text-emerald-500 mt-1 italic">{getHistoricalLabel()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Condición P₀</div>
          <div className="text-2xl font-black text-amber-600">{fmtNum(twoPointTable?.ci?.p || p0)} <span className="text-xs font-medium text-slate-400">uds</span></div>
          <div className="text-[10px] text-amber-500 mt-1 italic">Punto de partida</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ritmo k (diario)</div>
          <div className="text-2xl font-black text-violet-600">{(twoPointTable?.k_raw || k).toFixed(4)}</div>
          <div className="text-[10px] text-violet-500 mt-1 italic">{(twoPointTable?.k_raw || k) > 0 ? 'Crecimiento' : 'Descenso'}</div>
        </div>
      </div>

      {/* Ecuación y Alerta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Ecuación Predictiva</div>
          <div className="font-mono text-xl md:text-2xl text-center bg-slate-800 py-4 rounded-xl border border-slate-700">
            P(t) = <span className="text-indigo-400 font-bold">{fmtNum(twoPointTable?.ci?.p || p0)}</span> · e<sup className="text-violet-400 font-bold">{(twoPointTable?.k_raw || k).toFixed(4)}</sup> · t
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <span className="px-2 py-1 rounded-md bg-slate-800 text-[9px] font-bold text-slate-400 border border-slate-700">P(t): Demanda</span>
            <span className="px-2 py-1 rounded-md bg-slate-800 text-[9px] font-bold text-slate-400 border border-slate-700">t: días</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-indigo-600 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Interpretación</div>
            <p className="text-sm font-medium leading-relaxed italic">"{getKInterpretation()}"</p>
          </div>
          <div className="mt-4 pt-4 border-t border-indigo-500/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Stock Crítico</div>
              <div className="text-2xl font-black">{fmtNum(alertLevel)} <span className="text-xs">uds</span></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center border border-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}


function ActionsPanel({ summary, color, horizon }) {
  const statusLabel = summary?.riskBreakage
    ? "Riesgo de quiebre"
    : summary?.riskOverstock
      ? "Riesgo de sobrestock"
      : "Cobertura balanceada";
  const statusPalette = summary?.riskBreakage
    ? { bg: "#fef2f2", border: "#ef444433", text: "#991b1b" }
    : summary?.riskOverstock
      ? { bg: "#fff7ed", border: "#f9731633", text: "#9a3412" }
      : { bg: color.soft, border: `${color.solid}33`, text: color.dark };

  return (
    <DashboardCard className="p-6 md:p-7">
      <PanelIntro
        eyebrow="Operacion"
        title="Acciones recomendadas"
        description="Cruce entre demanda estimada e inventario disponible para esta categoria."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricRow
          label="Stock actual"
          value={`${fmtNum(summary?.stockActual || 0)} uds.`}
          hint={`${fmtNum(summary?.totalProducts || 0)} productos dentro de la categoria`}
        />
        <MetricRow
          label="Cobertura estimada"
          value={formatCoverage(summary?.stockCoverageMonths)}
          hint={`Meses que cubriría el stock actual con la proyeccion de ${horizon} meses`}
        />
        <MetricRow
          label="Reposicion sugerida"
          value={`${fmtNum(summary?.suggestedRestock || 0)} uds.`}
          hint={`Demanda estimada próximos ${horizon} meses: ${fmtNum(summary?.projectedInHorizon || 0)} uds.`}
        />
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: statusPalette.bg, border: `1px solid ${statusPalette.border}` }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">Estado operativo</span>
            <span className="text-sm font-bold" style={{ color: statusPalette.text }}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: statusPalette.text }}>
            Pronostico siguiente mes: {fmtNum(summary?.projectedNextMonth || 0)} uds.
          </p>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl px-4 py-3"
        style={{ background: color.soft, border: `1px solid ${color.solid}22` }}
      >
        <p className="text-sm leading-relaxed" style={{ color: color.dark }}>
          {buildActionMessage(summary)}
        </p>
      </div>
    </DashboardCard>
  );
}


function ProductBreakdownPanel({ categoryName, products }) {
  const visibleProducts = Array.isArray(products) ? products.slice(0, 8) : [];

  return (
    <DashboardCard className="flex flex-col p-0 overflow-hidden border-0 shadow-lg ring-1 ring-slate-100 h-full">
      <div className="p-6 md:p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
        <PanelIntro
          eyebrow="Drill-down"
          title="Detalle por producto"
          description={`Productos con mayor impacto proyectado dentro de ${categoryName || "la categoría"}.`}
        />
      </div>

      <div className="flex-1 overflow-x-auto bg-white">
        {visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">No hay productos suficientes para desglosar.</p>
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Próx. 3 Meses</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Actual</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Reposición</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleProducts.map((product) => {
                const status = getProductStatus(product);
                return (
                  <tr key={product.productId || product.nombre} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[13px] shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm ring-1 ring-slate-200">
                          {(product.nombre || "P").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-[13px]">{product.nombre}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{product.marca}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-700">{fmtNum(product.totalUnits)}</span> <span className="text-xs text-slate-400">uds</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        <span className="font-bold text-indigo-700">{fmtNum(product.projected3Months)}</span> <span className="text-xs text-indigo-400/80 font-medium">uds</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-700">{fmtNum(product.stockActual)}</span> <span className="text-xs text-slate-400">uds</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${product.suggestedRestock > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {fmtNum(product.suggestedRestock)}
                      </span> <span className="text-xs opacity-70">uds</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all"
                        style={{ background: status.palette.bg, color: status.palette.text, border: `1px solid ${status.palette.text}22` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.palette.text }}></span>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardCard>
  );
}

/* ─────────────── INSIGHTS PANEL ─────────────── */
function buildInsightData(selectionName, histValues, pred1, pred3, pred6) {
  const last = histValues[histValues.length - 1] || 0;
  const { k } = exponentialParams(histValues.map((v) => Number(v || 0)));
  const trend = k > 0.02 ? "crecimiento" : k < -0.02 ? "descenso" : "estabilidad";
  const isUp = k > 0.02;
  const isStable = Math.abs(k) <= 0.02;
  const seasonHigh = histValues.indexOf(Math.max(...histValues));
  const seasonLabel = MONTH_NAMES[seasonHigh % 12];

  return {
    trend,
    isUp,
    isStable,
    lastVal: last,
    pred1,
    pred3,
    pred6,
    seasonLabel,
    selectionName
  };
}

function InsightsPanel({ catName, histValues, pred1, pred3, pred6, color }) {
  const data = buildInsightData(catName, histValues, pred1, pred3, pred6);

  return (
    <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 transition-all hover:shadow-md"
      style={{
        background: `linear-gradient(145deg, #ffffff 0%, ${color.soft} 100%)`,
        border: `1.5px solid ${color.solid}22`,
        boxShadow: `0 8px 30px ${color.solid}15`
      }}
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none" style={{ color: color.solid }}>
        <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      <div className="relative flex flex-col md:flex-row items-start gap-5">
        <div
          className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color.solid} 0%, ${color.dark} 100%)` }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: color.dark }}>
            Inteligencia Predictiva
          </h4>

          <div className="text-slate-700 leading-relaxed text-[15px] space-y-4">
            <p>
              La selección <strong style={{ color: color.dark, fontWeight: 800 }}>{data.selectionName}</strong> presenta una tendencia de{" "}
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold mx-1 uppercase tracking-wide"
                style={{
                  background: data.isStable ? '#f1f5f9' : (data.isUp ? '#ecfdf5' : '#fef2f2'),
                  color: data.isStable ? '#475569' : (data.isUp ? '#047857' : '#be123c'),
                  border: `1px solid ${data.isStable ? '#cbd5e1' : (data.isUp ? '#10b98133' : '#e11d4833')}`
                }}
              >
                {data.isStable ? '➡️' : (data.isUp ? '📈' : '📉')} {data.trend}
              </span>
              . Las ventas registradas el último mes alcanzaron las <strong className="text-slate-900 font-bold">{fmtNum(data.lastVal)} uds.</strong>
            </p>

            <div className="flex flex-wrap gap-3 mt-5">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-slate-900/5 shadow-sm min-w-[110px]">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Próx. mes</span>
                <span className="block font-black text-xl mt-0.5" style={{ color: color.dark }}>{fmtNum(data.pred1)} <span className="text-xs font-semibold text-slate-400">uds</span></span>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-slate-900/5 shadow-sm min-w-[110px]">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">En 3 meses</span>
                <span className="block font-black text-xl mt-0.5" style={{ color: color.dark }}>{fmtNum(data.pred3)} <span className="text-xs font-semibold text-slate-400">uds</span></span>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-slate-900/5 shadow-sm min-w-[110px]">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">En 6 meses</span>
                <span className="block font-black text-xl mt-0.5" style={{ color: color.dark }}>{fmtNum(data.pred6)} <span className="text-xs font-semibold text-slate-400">uds</span></span>
              </div>
            </div>

            <div className="bg-white/60 rounded-xl p-3.5 flex items-center gap-3 mt-4 border border-white">
              <div className="bg-amber-100 rounded-lg p-2 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 leading-snug m-0">
                El mes con mayor volumen histórico fue <strong className="text-slate-800 font-bold">{data.seasonLabel}</strong>, ideal para planear reposiciones o lanzar promociones.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── COMPONENTE PRINCIPAL ─────────────── */
export default function ModeloPredictivo() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predictiveMeta, setPredictiveMeta] = useState(null);
  const [categorySummaries, setCategorySummaries] = useState({});
  const [productBreakdown, setProductBreakdown] = useState({});
  const [predictiveAlerts, setPredictiveAlerts] = useState([]);
  // categoryData: { [name]: number[] } — 12 meses de ventas (unidades)
  const [categoryData, setCategoryData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null); // filtro por producto
  const [granularity, setGranularity] = useState("monthly");
  const [rawSales, setRawSales] = useState([]);
  const [rawProductSales, setRawProductSales] = useState([]);
  const [targetDateStr, setTargetDateStr] = useState(() => "2026-02-01");
  const [endDateStr, setEndDateStr] = useState(() => "2026-04-01");
  const [predictionHorizon, setPredictionHorizon] = useState({ label: "1 Mes", d: 0, m: 1 });

  const today = useMemo(() => new Date(`${targetDateStr}T12:00:00`), [targetDateStr]);
  const endD = useMemo(() => new Date(`${endDateStr}T12:00:00`), [endDateStr]);

  const horizon = useMemo(() => {
    if (granularity === "monthly") {
      const m = (endD.getFullYear() - today.getFullYear()) * 12 + (endD.getMonth() - today.getMonth());
      return Math.max(1, m);
    } else if (granularity === "weekly") {
      return Math.max(1, Math.ceil(Math.abs(endD - today) / (1000 * 60 * 60 * 24 * 7)));
    } else {
      return Math.max(1, Math.ceil(Math.abs(endD - today) / (1000 * 60 * 60 * 24)));
    }
  }, [today, endD, granularity]);

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAdminToken();
        const data = await requestJson(endpoints.adminSalesPredictive(targetDateStr), { token });

        const sales = Array.isArray(data.sales) ? data.sales : [];
        const summaries = data.categorySummaries || {};
        const products = data.productBreakdown || {};
        const alerts = Array.isArray(data.alerts) ? data.alerts : [];

        setRawSales(sales);
        setRawProductSales(Array.isArray(data.productSales) ? data.productSales : []);
        setPredictiveMeta(data.meta || null);
        setCategorySummaries(summaries);
        setProductBreakdown(products);
        setPredictiveAlerts(alerts);

        const built = granularity === "monthly" ? buildCategoryData(sales, endD)
          : granularity === "weekly" ? buildCategoryDataWeekly(sales, endD)
            : buildCategoryDataDaily(sales, endD);

        const categoryKeys = Object.keys(built);
        setCategoryData(built);
        if (categoryKeys.length > 0) {
          setSelected((currentSelected) => (
            currentSelected && built[currentSelected] ? currentSelected : categoryKeys[0]
          ));
        } else {
          setSelected(null);
          setSelectedProduct(null);
        }
      } catch (err) {
        setError(err.message || "Error al cargar los datos.");
      } finally {
        setLoading(false);
      }
    };
    loadSales();
  }, [targetDateStr, granularity, endD]);

  function buildCategoryData(sales, refDate) {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - 11 + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const map = {};
    sales.forEach((s) => {
      const cat = s.categoria || s.category || "Otro";
      const fecha = String(s.fecha || s.date || "").slice(0, 7);
      if (!map[cat]) map[cat] = {};
      map[cat][fecha] = (map[cat][fecha] || 0) + Number(s.cantidad || s.quantity || 1);
    });
    const result = {};
    Object.keys(map).forEach((cat) => { result[cat] = months.map((m) => map[cat][m] || 0); });
    return result;
  }

  function buildCategoryDataDaily(sales, refDate) {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(refDate);
      d.setDate(d.getDate() - 29 + i);
      return d.toISOString().slice(0, 10);
    });
    const map = {};
    sales.forEach((s) => {
      const cat = s.categoria || s.category || "Otro";
      const fecha = String(s.fecha || s.date || "").slice(0, 10);
      if (!map[cat]) map[cat] = {};
      map[cat][fecha] = (map[cat][fecha] || 0) + Number(s.cantidad || s.quantity || 1);
    });
    const result = {};
    Object.keys(map).forEach((cat) => { result[cat] = days.map((d) => map[cat][d] || 0); });
    return result;
  }

  function buildCategoryDataWeekly(sales, refDate) {
    const getMonday = (d) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff)).toISOString().slice(0, 10);
    };
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(refDate);
      d.setDate(d.getDate() - (11 - i) * 7);
      return getMonday(d);
    });
    const map = {};
    sales.forEach((s) => {
      const cat = s.categoria || s.category || "Otro";
      const fechaRaw = s.fecha || s.date || "";
      const d = new Date(fechaRaw.includes("T") ? fechaRaw : fechaRaw + "T12:00:00");
      const mondayStr = getMonday(d);
      if (!map[cat]) map[cat] = {};
      map[cat][mondayStr] = (map[cat][mondayStr] || 0) + Number(s.cantidad || s.quantity || 1);
    });
    const result = {};
    Object.keys(map).forEach((cat) => { result[cat] = weeks.map((w) => map[cat][w] || 0); });
    return result;
  }

  const handleCategoryChange = (cat) => { setSelected(cat); setSelectedProduct(null); };

  const productsInCategory = useMemo(() => selected ? (productBreakdown[selected] || []) : [], [productBreakdown, selected]);
  const selectedProductSummary = useMemo(() => {
    if (!selectedProduct) return null;
    return productsInCategory.find((p) => String(p.productId || p.nombre) === String(selectedProduct)) || null;
  }, [productsInCategory, selectedProduct]);

  const selHist = useMemo(() => {
    if (!selected) return [];
    if (granularity === "monthly") {
      const targetSales = selectedProduct
        ? rawProductSales.filter((s) => String(s.productId || s.nombre).trim() === String(selectedProduct).trim())
        : null;
      if (targetSales) {
        const months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(endD.getFullYear(), endD.getMonth() - 11 + i, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        });
        const map = {};
        targetSales.forEach(s => {
          const f = String(s.fecha || s.date).slice(0, 7);
          map[f] = (map[f] || 0) + Number(s.cantidad || 1);
        });
        return months.map(m => map[m] || 0);
      }
      return (categoryData && selected) ? categoryData[selected] : [];
    }
    const targetSales = selectedProduct
      ? rawProductSales.filter((s) => String(s.productId || s.nombre).trim() === String(selectedProduct).trim())
      : rawSales.filter((s) => String(s.categoria || s.category).trim() === String(selected).trim());
    if (granularity === "weekly") {
      const weeks = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(endD);
        d.setDate(d.getDate() - (11 - i) * 7);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff)).toISOString().slice(0, 10);
      });
      const map = {};
      targetSales.forEach((s) => {
        const d = new Date((s.fecha || s.date).includes("T") ? (s.fecha || s.date) : (s.fecha || s.date) + "T12:00:00");
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const m = new Date(d.setDate(diff)).toISOString().slice(0, 10);
        map[m] = (map[m] || 0) + Number(s.cantidad || 1);
      });
      return weeks.map((w) => map[w] || 0);
    } else {
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(endD);
        d.setDate(d.getDate() - 29 + i);
        return d.toISOString().slice(0, 10);
      });
      const map = {};
      targetSales.forEach((s) => {
        const f = String(s.fecha || s.date).slice(0, 10);
        map[f] = (map[f] || 0) + Number(s.cantidad || 1);
      });
      return days.map((d) => map[d] || 0);
    }
  }, [categoryData, selected, granularity, rawSales, rawProductSales, endD, selectedProduct]);

  const filteredSales = useMemo(() => {
    if (!selected) return [];
    const base = selectedProduct
      ? rawProductSales.filter((s) => String(s.productId || s.nombre).trim() === String(selectedProduct).trim())
      : rawSales.filter((s) => String(s.categoria || s.category).trim() === String(selected).trim());

    // Aplicar el filtro por el rango de fechas seleccionado en la UI
    return base.filter(s => {
      const d = parseLocalDate(s.fecha || s.date);
      return d && d >= today && d <= endD;
    });
  }, [rawSales, rawProductSales, selected, selectedProduct, today, endD]);

  const selPred = useMemo(() => selHist.length ? buildPredictionSnapshot(selHist) : EMPTY_PREDICTION, [selHist]);
  const selColor = useMemo(() => colorForCategory(selected || ""), [selected]);

  // ── Etiquetas y Valores para la Gráfica (Referenciados al fin del periodo histórico K) ──
  const histLabels = useMemo(() => {
    if (granularity === "monthly") return buildMonthLabels(12, endD);
    if (granularity === "weekly") return buildWeekLabels(12, endD);
    return buildDayLabels(30, endD);
  }, [endD, granularity]);

  // ── Sincronización del Horizonte para la Gráfica ──
  const chartHorizon = useMemo(() => {
    if (granularity === "monthly") {
      return predictionHorizon.m > 0 ? predictionHorizon.m : Math.ceil(predictionHorizon.d / 30) || 1;
    }
    if (granularity === "weekly") {
      return predictionHorizon.m > 0 ? predictionHorizon.m * 4 : Math.ceil(predictionHorizon.d / 7) || 1;
    }
    // Diario
    return predictionHorizon.m > 0 ? predictionHorizon.m * 30 : predictionHorizon.d || 7;
  }, [predictionHorizon, granularity]);

  const futureLabels = useMemo(() => {
    if (granularity === "monthly") return buildFutureLabels(endD, chartHorizon);
    if (granularity === "weekly") return buildFutureWeekLabels(endD, chartHorizon);
    return buildFutureDayLabels(endD, chartHorizon);
  }, [endD, chartHorizon, granularity]);

  const futureValues = useMemo(() => {
    if (!selHist.length) return [];
    return Array.from({ length: chartHorizon }, (_, i) => predict(selHist, i + 1));
  }, [selHist, chartHorizon]);

  // ── Resumen de la Selección (KPIs) ──
  const selectedSummary = useMemo(() => {
    if (!selected) return { stockActual: 0, confidence: { level: "Baja", score: 0 } };
    if (selectedProductSummary) return selectedProductSummary;
    return categorySummaries[selected] || { stockActual: 0, confidence: { level: "Baja", score: 0 } };
  }, [selected, selectedProductSummary, categorySummaries]);
  const confidencePalette = getConfidencePalette(selectedSummary.confidence?.level || "Baja");

  if (loading) return <LoadingSpinner text="Cargando modelo..." />;
  if (error) {
    return (
      <DashboardCard className="p-6 border border-rose-100 bg-rose-50">
        <PanelIntro
          eyebrow="Error"
          title="No se pudieron cargar los datos predictivos"
          description={error}
        />
      </DashboardCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header Principal con Selector de Fechas y Granularidad ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 p-6 rounded-2xl border border-white shadow-sm backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Modelo Predictivo de Demanda</h1>
          <p className="text-sm text-slate-500 font-medium">Análisis de crecimiento exponencial para inventario inteligente</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="badge badge-violet text-[10px]">Modelo: {predictiveMeta?.model || "Exponencial P(t)=P₀·eᵏᵗ"}</span>
            <span className="badge badge-emerald text-[10px]">Actualizado: {fmtDateTime(predictiveMeta?.generatedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Horizonte de Predicción (Independiente del Periodo) */}
          <div className="flex bg-slate-100 px-3 py-1.5 rounded-xl items-center gap-3 border border-slate-200">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Predecir a:</div>
            <div className="relative">
              <select
                value={predictionHorizon.label}
                onChange={(e) => {
                  const options = [
                    { label: "7 Días", d: 7, m: 0 },
                    { label: "15 Días", d: 15, m: 0 },
                    { label: "1 Mes", d: 0, m: 1 },
                    { label: "2 Meses", d: 0, m: 2 },
                    { label: "3 Meses", d: 0, m: 3 }
                  ];
                  const selectedOpt = options.find(o => o.label === e.target.value);
                  if (selectedOpt) setPredictionHorizon(selectedOpt);
                }}
                className="appearance-none pl-3 pr-8 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-black text-indigo-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all hover:border-indigo-300"
              >
                <option value="7 Días">7 Días</option>
                <option value="15 Días">15 Días</option>
                <option value="1 Mes">1 Mes</option>
                <option value="2 Meses">2 Meses</option>
                <option value="3 Meses">3 Meses</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-[10px]">▼</span>
            </div>
          </div>

          {/* Rango de Fechas (K → P1) */}
          <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-2 border border-slate-200">
            <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periodo</div>
            <input
              type="date"
              value={targetDateStr}
              onChange={(e) => setTargetDateStr(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 p-1 shadow-sm focus:ring-1 focus:ring-indigo-300 outline-none"
            />
            <span className="text-slate-300">→</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 p-1 shadow-sm focus:ring-1 focus:ring-indigo-300 outline-none"
            />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-1 border border-slate-200">
            {[
              { value: "daily", label: "DIA" },
              { value: "weekly", label: "SEM" },
              { value: "monthly", label: "MES" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGranularity(option.value)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${granularity === option.value
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Filtros de Categoría y Producto ── */}
      <div className="flex flex-wrap items-center gap-4 bg-white/50 p-4 rounded-2xl border border-white/60">
        <div className="flex items-center gap-3">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Categoría:</label>
          <div className="relative">
            <select
              value={selected || ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 cursor-pointer transition-all hover:border-slate-300"
              style={{ "--tw-ring-color": selColor.solid }}
            >
              {Object.keys(categoryData || {}).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
          </div>
        </div>

        {productsInCategory.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Producto:</label>
            <div className="relative">
              <select
                value={selectedProduct || ""}
                onChange={(e) => setSelectedProduct(e.target.value || null)}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 cursor-pointer transition-all hover:border-slate-300"
                style={{ "--tw-ring-color": selColor.solid }}
              >
                <option value="">— Seleccionar Producto —</option>
                {productsInCategory.map((p) => (
                  <option key={p.productId || p.nombre} value={p.productId || p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
            </div>
          </div>
        )}

        <span
          className="ml-auto px-4 py-2 rounded-full text-[11px] font-black tracking-wider shadow-sm border border-white/50"
          style={{ background: selColor.soft, color: selColor.dark }}
        >
          {selHist.reduce((a, v) => a + v, 0)} UDS. HISTÓRICAS
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCardWithSparkline
          label={granularity === "monthly" ? "PRÓXIMO MES" : granularity === "weekly" ? "PRÓXIMA SEMANA" : "PRÓXIMO DÍA"}
          value={selPred.p1}
          prev={selPred.prev1}
          color={selColor}
          sparklineData={selHist.slice(-7)}
        />
        <KpiCardWithSparkline
          label={`DEMANDA EN EL RANGO (${horizon} ${granularity === 'monthly' ? (horizon === 1 ? 'MES' : 'MESES') : granularity === 'weekly' ? (horizon === 1 ? 'SEM' : 'SEM') : (horizon === 1 ? 'DÍA' : 'DÍAS')})`}
          value={sumProjectedDemand(selHist, horizon)}
          prev={granularity === "monthly" ? selPred.prev3 * (horizon / 3) : null}
          color={selColor}
          sparklineData={selHist.slice(-7)}
        />
        <KpiCardWithSparkline
          label="VENTA TOTAL ESTIMADA"
          value={selHist.reduce((a, v) => a + v, 0) + sumProjectedDemand(selHist, horizon)}
          prev={null}
          color={selColor}
          sparklineData={selHist.slice(-7)}
        />
      </div>

      <DashboardCard className="p-6">
        <PanelIntro
          eyebrow="ANÁLISIS TEMPORAL"
          title="Tendencia y Predicción"
          description="Evolución histórica y proyección exponencial futura"
        />
        <SalesChart
          key={`${predictionHorizon.label}-${granularity}`}
          histLabels={histLabels}
          histValues={selHist}
          futureLabels={futureLabels}
          futureValues={futureValues}
          color={selColor}
        />
      </DashboardCard>

      {selectedProductSummary ? (
        <ProductIntelligencePanel
          product={selectedProductSummary}
          rawSales={rawSales}
          rawProductSales={rawProductSales}
          today={today}
          color={selColor}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard className="p-6">
          <PanelIntro
            eyebrow="ANÁLISIS TEMPORAL"
            title="Mapa de Calor"
            description="Intensidad de ventas en los últimos 30 días"
          />
          <HeatmapChart
            data={selHist.slice(-30)}
            labels={histLabels.slice(-30)}
          />
        </DashboardCard>

        <DashboardCard className="p-6">
          <PanelIntro
            eyebrow="DISTRIBUCIÓN"
            title="Share por Categoría"
            description="Participación en el volumen total de ventas"
          />
          <DoughnutChart
            categories={Object.keys(categoryData || {}).map(name => name)}
            values={Object.keys(categoryData || {}).map(name => categoryData[name].reduce((a, v) => a + v, 0))}
          />
        </DashboardCard>
      </div>

      {/* Indicadores de Stock y Confianza */}
      <DashboardCard className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ProgressRing
            label="COBERTURA DE STOCK"
            value={selectedSummary.stockCoverageMonths || 0}
            max={6}
            color="#10b981"
          />
          <ProgressRing
            label="PRECISIÓN DEL MODELO"
            value={selectedSummary.confidence?.score || 0}
            max={100}
            color="#6366f1"
          />
          <ProgressRing
            label="ROTACIÓN ESTIMADA"
            value={((selectedSummary.projectedNextMonth || 0) / Math.max(selectedSummary.stockActual || 1, 1)) * 100}
            max={100}
            color="#f59e0b"
          />
        </div>
        <div
          className="mt-6 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ background: confidencePalette.bg, border: `1px solid ${confidencePalette.border}` }}
        >
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: confidencePalette.text }}>
            Confianza del modelo: {selectedSummary.confidence?.level || "Baja"}
          </span>
          <span className="text-sm font-bold" style={{ color: confidencePalette.text }}>
            {fmtPercent(selectedSummary.confidence?.score || 0)}
          </span>
        </div>
      </DashboardCard>

      {/* ── Datos de Entrada del Modelo (Memoria de Cálculo) ── */}
      {predictiveAlerts.length > 0 ? (
        <DashboardCard className="p-6">
          <PanelIntro
            eyebrow="Alertas"
            title="Alertas predictivas"
            description="Riesgos calculados a partir de demanda, stock y confianza del modelo."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {predictiveAlerts.slice(0, 4).map((alert) => {
              const palette = getAlertPalette(alert.severity);
              return (
                <button
                  key={alert.id || alert.title}
                  type="button"
                  onClick={() => alert.category && handleCategoryChange(alert.category)}
                  className="text-left rounded-xl px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: palette.text }}>
                      {alert.severity || "Media"}
                    </span>
                    <span className="text-xs font-bold" style={{ color: palette.text }}>
                      {alert.metric || ""}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-black text-slate-800">{alert.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{alert.description}</p>
                </button>
              );
            })}
          </div>
        </DashboardCard>
      ) : null}

      <ActionsPanel summary={selectedSummary} color={selColor} horizon={horizon} />

      <ModelInputData
        stockInitial={selectedSummary.stockActual || 0}
        salesInRange={selHist.reduce((a, v) => a + v, 0)}
        p0={exponentialParams(selHist).p0}
        k={exponentialParams(selHist).k}
        alertLevel={Math.round((selectedSummary.projectedNextMonth || 0) * 0.5) || 5}
        category={selected || ""}
        product={selectedProductSummary?.nombre || ""}
        granularity={granularity}
        horizon={horizon}
        histValues={selHist}
        histLabels={histLabels}
        filteredSales={filteredSales}
        rangeStart={targetDateStr}
        rangeEnd={endDateStr}
        predictionHorizon={predictionHorizon}
      />

      {/* ── Distribución de Productos de la Categoría ── */}
      <ProductBreakdownPanel
        categoryName={selected}
        products={productsInCategory}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard className="p-6 md:p-8">
          <PanelIntro
            eyebrow="BENCHMARK"
            title="Comparativa de Categorías"
            description="Haz clic en una barra para profundizar en esa categoría"
          />
          <VerticalBarChart
            categories={Object.keys(categoryData || {}).map(name => ({
              name,
              histTotal: categoryData[name].reduce((a, v) => a + v, 0),
              proj3Total: sumProjectedDemand(categoryData[name], 3)
            }))}
            selected={selected}
            onSelect={handleCategoryChange}
          />
        </DashboardCard>

        <InsightsPanel
          catName={selectedProductSummary ? selectedProductSummary.nombre : selected}
          histValues={selHist}
          pred1={selPred.p1}
          pred3={selPred.p3}
          pred6={selPred.p6}
          color={selColor}
        />
      </div>
    </div>
  );
}
