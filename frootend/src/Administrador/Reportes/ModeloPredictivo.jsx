import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

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

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

/* ─────────────── motor predictivo ─────────────── */
// Regresión lineal simple → devuelve pendiente m e intercepto b
function linearRegression(ys) {
  const n = ys.length;
  if (n === 0) return { m: 0, b: 0 };
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, v) => a + v, 0);
  const sumY = ys.reduce((a, v) => a + v, 0);
  const sumXY = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const sumX2 = xs.reduce((a, v) => a + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

function predict(ys, stepsAhead) {
  const { m, b } = linearRegression(ys);
  const nextX = ys.length - 1 + stepsAhead;
  return Math.max(0, Math.round(m * nextX + b));
}

const EMPTY_PREDICTION = { p1: 0, p3: 0, p6: 0, prev1: 0, prev3: 0, prev6: 0 };

function sumProjectedDemand(ys, months) {
  return Array.from({ length: months }, (_, i) => predict(ys, i + 1)).reduce(
    (sum, value) => sum + value,
    0
  );
}

/* ─────────────── datos simulados (fallback) ─────────────── */
const CATEGORY_COLORS = {
  Cabello:      { solid: "#6366f1", soft: "#eef2ff", dark: "#4338ca" },
  Coloración:   { solid: "#ec4899", soft: "#fdf2f8", dark: "#be185d" },
  Tratamientos: { solid: "#f59e0b", soft: "#fffbeb", dark: "#b45309" },
  "Naturales":  { solid: "#10b981", soft: "#ecfdf5", dark: "#065f46" },
  Accesorios:   { solid: "#0ea5e9", soft: "#f0f9ff", dark: "#0369a1" },
  Otro:         { solid: "#8b5cf6", soft: "#f5f3ff", dark: "#6d28d9" },
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
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

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

/* ─────────────── LINE CHART ─────────────── */
function LineChart({ histLabels, histValues, futureLabels, futureValues, color }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const W = 700, H = 260, PAD = { top: 24, right: 20, bottom: 44, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allValues = [...histValues, ...futureValues];
  const maxV = Math.max(...allValues, 1);
  const minV = 0;

  const allLabels = [...histLabels, ...futureLabels];
  const totalPoints = allLabels.length;

  function xPos(i) {
    return PAD.left + (i / (totalPoints - 1)) * plotW;
  }
  function yPos(v) {
    return PAD.top + plotH - ((v - minV) / (maxV - minV)) * plotH;
  }

  // ticks Y
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxV / 4) * i));

  // polyline points
  const histPoints = histValues.map((v, i) => ({ x: xPos(i), y: yPos(v), v, label: histLabels[i] }));
  const futurePoints = futureValues.map((v, i) => ({
    x: xPos(histValues.length - 1 + i + 1),
    y: yPos(v),
    v,
    label: futureLabels[i],
  }));

  const histPolyline = histPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const joinPoint = histPoints[histPoints.length - 1];
  const projPolyline = [joinPoint, ...futurePoints].map((p) => `${p.x},${p.y}`).join(" ");

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const allPts = [...histPoints, ...futurePoints];
    let closest = null;
    let minDist = Infinity;
    allPts.forEach((p) => {
      const d = Math.abs(p.x - mx);
      if (d < minDist) { minDist = d; closest = p; }
    });
    if (closest && minDist < (plotW / totalPoints) * 1.2) {
      setTooltip(closest);
    } else {
      setTooltip(null);
    }
  }, [histPoints, futurePoints, plotW, totalPoints]);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ minWidth: 340, cursor: "crosshair" }}
      >
        {/* grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={yPos(t)} y2={yPos(t)}
              stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4"
            />
            <text x={PAD.left - 6} y={yPos(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
              {t}
            </text>
          </g>
        ))}

        {/* shade projection area */}
        {futurePoints.length > 0 && (() => {
          const areaPath = [
            `M ${joinPoint.x} ${PAD.top + plotH}`,
            `L ${joinPoint.x} ${joinPoint.y}`,
            ...futurePoints.map((p) => `L ${p.x} ${p.y}`),
            `L ${futurePoints[futurePoints.length - 1].x} ${PAD.top + plotH}`,
            "Z",
          ].join(" ");
          return (
            <path d={areaPath} fill={`${color.solid}18`} />
          );
        })()}

        {/* historical line */}
        <polyline
          points={histPolyline}
          fill="none"
          stroke={color.solid}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* projected line (dashed) */}
        {futurePoints.length > 0 && (
          <polyline
            points={projPolyline}
            fill="none"
            stroke="#f97316"
            strokeWidth="2.5"
            strokeDasharray="7 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* historical dots */}
        {histPoints.map((p, i) => (
          <circle
            key={`h${i}`}
            cx={p.x} cy={p.y} r={tooltip?.label === p.label ? 6 : 3.5}
            fill={color.solid}
            stroke="white" strokeWidth="2"
            style={{ transition: "r 0.15s" }}
          />
        ))}

        {/* projected dots */}
        {futurePoints.map((p, i) => (
          <circle
            key={`f${i}`}
            cx={p.x} cy={p.y} r={tooltip?.label === p.label ? 6 : 3.5}
            fill="#f97316"
            stroke="white" strokeWidth="2"
            style={{ transition: "r 0.15s" }}
          />
        ))}

        {/* X labels */}
        {allLabels.map((lbl, i) => {
          // show every label if few, else every 2nd or 3rd
          const step = allLabels.length > 14 ? 3 : allLabels.length > 9 ? 2 : 1;
          if (i % step !== 0) return null;
          const isFuture = i >= histValues.length;
          return (
            <text
              key={lbl}
              x={xPos(i)} y={H - PAD.bottom + 16}
              textAnchor="middle" fontSize={10}
              fill={isFuture ? "#f97316" : "#94a3b8"}
              fontWeight={isFuture ? "600" : "400"}
            >
              {lbl}
            </text>
          );
        })}

        {/* tooltip */}
        {tooltip && (() => {
          const tx = Math.min(Math.max(tooltip.x, 60), W - 60);
          const ty = Math.max(tooltip.y - 14, PAD.top + 4);
          return (
            <g>
              <rect x={tx - 40} y={ty - 18} width={80} height={22} rx={6}
                fill={tooltip.label && futureLabels.includes(tooltip.label) ? "#f97316" : color.solid}
                opacity={0.92}
              />
              <text x={tx} y={ty - 3} textAnchor="middle" fontSize={11} fill="white" fontWeight="700">
                {tooltip.label}: {fmtNum(tooltip.v)}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* legend */}
      <div className="flex items-center gap-5 mt-3 px-2 flex-wrap">
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke={color.solid} strokeWidth="2.5" strokeLinecap="round" /></svg>
          Ventas reales
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#f97316" strokeWidth="2.5" strokeDasharray="6 3" strokeLinecap="round" /></svg>
          Proyección
        </span>
      </div>
    </div>
  );
}

/* ─────────────── HORIZONTAL BAR CHART ─────────────── */
function HorizontalBarChart({ categories, selected, onSelect }) {
  const maxVal = Math.max(...categories.map((c) => c.histTotal + c.proj3Total), 1);
  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => {
        const histWidth = ((cat.histTotal / (maxVal * 1.1)) * 100).toFixed(1);
        const projWidth = (((cat.histTotal + cat.proj3Total) / (maxVal * 1.1)) * 100).toFixed(1);
        const isSelected = cat.name === selected;
        const col = colorForCategory(cat.name);
        return (
          <button
            key={cat.name}
            onClick={() => onSelect(cat.name)}
            className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
            style={{
              background: isSelected ? col.soft : "transparent",
              border: `1.5px solid ${isSelected ? col.solid + "55" : "#e2e8f0"}`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: col.dark }}>{cat.name}</span>
              <span className="text-xs text-slate-400">{fmtNum(cat.histTotal)} hist. + {fmtNum(cat.proj3Total)} próx. 3 m.</span>
            </div>
            <div className="h-4 rounded-full bg-slate-100 overflow-hidden relative">
              {/* projected bar (lighter) */}
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                style={{ width: `${projWidth}%`, background: `${col.solid}44` }}
              />
              {/* historical bar */}
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${histWidth}%`,
                  background: `linear-gradient(90deg, ${col.dark} 0%, ${col.solid} 100%)`,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
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

function QualityPanel({ summary, meta }) {
  const confidencePalette = getConfidencePalette(summary?.confidence?.level);

  return (
    <DashboardCard className="p-6 md:p-7">
      <PanelIntro
        eyebrow="Calidad"
        title="Calidad del pronostico"
        description="Datos usados para evaluar la confiabilidad de la proyeccion seleccionada."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricRow
          label="Modelo"
          value={meta?.model || "Regresion lineal simple"}
          hint={`${summary?.monthsAnalyzed || 0} meses analizados`}
        />
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: confidencePalette.bg, border: `1px solid ${confidencePalette.border}` }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">Confianza</span>
            <span className="text-sm font-bold" style={{ color: confidencePalette.text }}>
              {summary?.confidence?.level || "Baja"}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: confidencePalette.text }}>
            Puntaje {fmtNum(summary?.confidence?.score || 0)} / 100
          </p>
        </div>
        <MetricRow
          label="Error historico"
          value={fmtPercent(summary?.errorRate)}
          hint={summary?.evaluatedMonths ? `${summary.evaluatedMonths} meses evaluados` : "Aun no hay suficientes meses para evaluar error"}
        />
        <MetricRow
          label="Meses con ventas"
          value={`${fmtNum(summary?.monthsWithData || 0)} / ${fmtNum(summary?.monthsAnalyzed || 0)}`}
          hint="Meses no vacios dentro de la ventana analizada"
        />
        <MetricRow
          label="Ultima venta detectada"
          value={fmtDateTime(summary?.lastSaleAt)}
          hint={`Actualizado: ${fmtDateTime(meta?.generatedAt || summary?.generatedAt)}`}
        />
        <MetricRow
          label="Unidades usadas"
          value={`${fmtNum(summary?.totalUnits || 0)} uds.`}
          hint="Volumen historico considerado para el calculo"
        />
      </div>
    </DashboardCard>
  );
}

function ActionsPanel({ summary, color }) {
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
          hint="Meses que cubriria el stock actual con la proyeccion de 3 meses"
        />
        <MetricRow
          label="Reposicion sugerida"
          value={`${fmtNum(summary?.suggestedRestock || 0)} uds.`}
          hint={`Demanda estimada proximos 3 meses: ${fmtNum(summary?.projected3Months || 0)} uds.`}
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

function AlertsPanel({ alerts, selected, onSelect }) {
  const visibleAlerts = Array.isArray(alerts) ? alerts.slice(0, 6) : [];

  return (
    <DashboardCard className="p-6 md:p-7">
      <PanelIntro
        eyebrow="Prioridades"
        title="Alertas prioritarias"
        description={
          selected
            ? `Alertas relevantes para ${selected}. Si no hay suficientes, se muestran alertas globales.`
            : "Alertas construidas con demanda proyectada, inventario y rotacion."
        }
      />

      {visibleAlerts.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No hay alertas activas para esta proyeccion.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const palette = getAlertPalette(alert.severity);
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => alert.category && onSelect(alert.category)}
                className="w-full text-left rounded-2xl border px-4 py-4 transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                style={{ borderColor: palette.border, background: `linear-gradient(180deg, #ffffff 0%, ${palette.bg} 100%)` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: palette.bg, color: palette.text }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{alert.title}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{alert.description}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      {alert.category ? <span>{alert.category}</span> : null}
                      {alert.productName ? <span>{alert.productName}</span> : null}
                    </div>
                  </div>
                  {alert.metric ? (
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{alert.metric}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}

function ProductBreakdownPanel({ categoryName, products }) {
  const visibleProducts = Array.isArray(products) ? products.slice(0, 8) : [];

  return (
    <DashboardCard className="p-6 md:p-7">
      <PanelIntro
        eyebrow="Drill-down"
        title="Detalle por producto"
        description={`Productos con mayor salida o mayor impacto proyectado dentro de ${categoryName || "la categoria seleccionada"}.`}
      />

      {visibleProducts.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No hay productos suficientes para desglosar esta categoria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[780px] text-left text-sm text-slate-600">
            <thead className="bg-slate-50/90 text-slate-800 font-semibold uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Historico</th>
                <th className="px-4 py-3">Prox. 3 meses</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Reposicion</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleProducts.map((product) => {
                const status = getProductStatus(product);
                return (
                  <tr key={product.productId || product.nombre} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{product.nombre}</div>
                      <div className="text-xs text-slate-400 mt-1">{product.marca}</div>
                    </td>
                    <td className="px-4 py-3">{fmtNum(product.totalUnits)} uds.</td>
                    <td className="px-4 py-3">{fmtNum(product.projected3Months)} uds.</td>
                    <td className="px-4 py-3">{fmtNum(product.stockActual)} uds.</td>
                    <td className="px-4 py-3">{fmtNum(product.suggestedRestock)} uds.</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ background: status.palette.bg, color: status.palette.text }}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

/* ─────────────── INSIGHTS PANEL ─────────────── */
function buildInsight(catName, histValues, pred1, pred3, pred6) {
  const last = histValues[histValues.length - 1] || 0;
  const { m } = linearRegression(histValues);
  const trend = m > 0.5 ? "crecimiento" : m < -0.5 ? "descenso" : "estabilidad";
  const dirEmoji = m > 0.5 ? "📈" : m < -0.5 ? "📉" : "➡️";
  const seasonHigh = histValues.indexOf(Math.max(...histValues));
  const seasonLabel = MONTH_NAMES[seasonHigh % 12];
  return (
    `${dirEmoji} La categoría **${catName}** presenta una tendencia de **${trend}**.` +
    ` Las ventas del último mes registrado fueron de **${fmtNum(last)} uds.**` +
    ` Se proyecta alcanzar **${fmtNum(pred1)}** el próximo mes,` +
    ` **${fmtNum(pred3)}** en 3 meses y **${fmtNum(pred6)}** en 6 meses.` +
    ` El mes históricamente más alto fue **${seasonLabel}**, útil para planear reposición y promociones.`
  );
}

function InsightsPanel({ catName, histValues, pred1, pred3, pred6, color }) {
  const text = buildInsight(catName, histValues, pred1, pred3, pred6);
  // Parse **bold** markers for rendering
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <div
      className="rounded-2xl p-5 flex gap-4 items-start"
      style={{ background: color.soft, border: `1.5px solid ${color.solid}33` }}
    >
      <span className="text-2xl mt-0.5">💡</span>
      <p className="text-sm text-slate-700 leading-relaxed">
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <strong key={i} style={{ color: color.dark }}>
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
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
  const [horizon, setHorizon] = useState(6); // meses a proyectar en chart

  const today = useMemo(() => new Date(), []);

  // ── fetch de ventas reales ──────────────────────────────────────────
  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAdminToken();
        const data = await requestJson(endpoints.adminSalesPredictive, { token });

        const sales = Array.isArray(data.sales) ? data.sales : [];
        const summaries = data.categorySummaries && typeof data.categorySummaries === "object"
          ? data.categorySummaries
          : {};
        const products = data.productBreakdown && typeof data.productBreakdown === "object"
          ? data.productBreakdown
          : {};
        const alerts = Array.isArray(data.alerts) ? data.alerts : [];
        const built = buildCategoryData(sales, today);
        setPredictiveMeta(data.meta || null);
        setCategorySummaries(summaries);
        setProductBreakdown(products);
        setPredictiveAlerts(alerts);
        if (Object.keys(built).length > 0) {
          setCategoryData(built);
          setSelected(Object.keys(built)[0]);
        } else {
          setCategoryData({});
          setSelected(null);
        }
      } catch (err) {
        setError(err.message || "No se pudieron cargar las ventas para generar la proyecciÃ³n.");
        setPredictiveMeta(null);
        setCategorySummaries({});
        setProductBreakdown({});
        setPredictiveAlerts([]);
        setCategoryData({});
        setSelected(null);
      } finally {
        setLoading(false);
      }
    };
    loadSales();
  }, [today]);

  // Agrupa ventas reales por categoría y mes (array de 12 posiciones)
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
      if (!map[cat][fecha]) map[cat][fecha] = 0;
      map[cat][fecha] += Number(s.cantidad || s.quantity || 1);
    });
    const result = {};
    Object.keys(map).forEach((cat) => {
      result[cat] = months.map((m) => map[cat][m] || 0);
    });
    return result;
  }

  // ── predicciones ────────────────────────────────────────────────────
  const predictions = useMemo(() => {
    if (!categoryData) return {};
    const res = {};
    Object.entries(categoryData).forEach(([name, hist]) => {
      res[name] = {
        p1: predict(hist, 1),
        p3: predict(hist, 3),
        p6: predict(hist, 6),
        prev1: hist[hist.length - 1] || 0,
        prev3: Math.round((hist.slice(-3).reduce((a, v) => a + v, 0)) / 3),
        prev6: Math.round((hist.slice(-6).reduce((a, v) => a + v, 0)) / 6),
      };
    });
    return res;
  }, [categoryData]);

  // ── datos de la categoría seleccionada ──────────────────────────────
  const selHist = useMemo(
    () => (categoryData && selected ? categoryData[selected] : []),
    [categoryData, selected]
  );
  const selPred = predictions[selected] || EMPTY_PREDICTION;

  // Labels de meses
  const histLabels = useMemo(() => buildMonthLabels(12, today), [today]);
  const futureLabels = useMemo(() => buildFutureLabels(today, horizon), [today, horizon]);

  // Valores futuros: interpolamos mensualmente
  const futureValues = useMemo(() => {
    if (!selHist.length) return [];
    return Array.from({ length: horizon }, (_, i) => predict(selHist, i + 1));
  }, [selHist, horizon]);

  // Lista de categorías para el bar chart
  const categoryList = useMemo(() => {
    if (!categoryData) return [];
    return Object.keys(categoryData).map((name) => ({
      name,
      histTotal: categoryData[name].reduce((a, v) => a + v, 0),
      proj3Total: sumProjectedDemand(categoryData[name], 3),
    }));
  }, [categoryData]);

  const topProjectedCategory = useMemo(() => {
    if (!categoryList.length) return "-";
    return [...categoryList].sort((a, b) => b.proj3Total - a.proj3Total)[0]?.name || "-";
  }, [categoryList]);

  const selectedSummary = useMemo(() => {
    if (!selected) {
      return {
        monthsAnalyzed: 0,
        monthsWithData: 0,
        totalUnits: 0,
        lastSaleAt: null,
        generatedAt: predictiveMeta?.generatedAt || null,
        totalProducts: 0,
        stockActual: 0,
        projectedNextMonth: 0,
        projected3Months: 0,
        projected6Months: 0,
        errorRate: null,
        evaluatedMonths: 0,
        confidence: { level: "Baja", score: 0 },
        stockCoverageMonths: null,
        suggestedRestock: 0,
        riskBreakage: false,
        riskOverstock: false,
      };
    }

    return categorySummaries[selected] || {
      monthsAnalyzed: selHist.length,
      monthsWithData: selHist.filter((value) => value > 0).length,
      totalUnits: selHist.reduce((sum, value) => sum + value, 0),
      lastSaleAt: null,
      generatedAt: predictiveMeta?.generatedAt || null,
      totalProducts: 0,
      stockActual: 0,
      projectedNextMonth: selPred.p1,
      projected3Months: sumProjectedDemand(selHist, 3),
      projected6Months: sumProjectedDemand(selHist, 6),
      errorRate: null,
      evaluatedMonths: 0,
      confidence: { level: "Baja", score: 0 },
      stockCoverageMonths: null,
      suggestedRestock: 0,
      riskBreakage: false,
      riskOverstock: false,
    };
  }, [categorySummaries, predictiveMeta, selHist, selPred, selected]);

  const selectedProducts = useMemo(() => {
    if (!selected) return [];
    return Array.isArray(productBreakdown[selected]) ? productBreakdown[selected] : [];
  }, [productBreakdown, selected]);

  const selectedAlerts = useMemo(() => {
    const allAlerts = Array.isArray(predictiveAlerts) ? predictiveAlerts : [];
    if (!selected) return allAlerts.slice(0, 6);
    const filtered = allAlerts.filter((alert) => alert.category === selected);
    return (filtered.length ? filtered : allAlerts).slice(0, 6);
  }, [predictiveAlerts, selected]);

  const selColor = useMemo(() => colorForCategory(selected || ""), [selected]);

  const categories = Object.keys(categoryData || {});

  if (loading) {
    return <LoadingSpinner text="Cargando modelo predictivo..." fullScreen={false} className="py-24" />;
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modelo Predictivo de Demanda</h1>
          <p className="text-slate-500 text-sm mt-1">
            Estimación lineal de ventas activas por categoría en los últimos 12 meses
          </p>
        </div>
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="text-4xl mb-4">{error ? "⚠️" : "📊"}</div>
          <h3 className="text-lg font-bold text-slate-800">{error ? "No se pudo cargar la proyección" : "Sin ventas registradas"}</h3>
          <p className="text-slate-500 text-sm mt-2 max-w-sm">
            {error
              ? `${error} Verifica la conexión con el servidor o la sesión de administrador e inténtalo de nuevo.`
              : "Aún no hay ventas activas de productos en los últimos 12 meses para estimar la demanda por categoría."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="hidden pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] overflow-hidden">
        <div className="absolute -left-12 top-6 h-44 w-44 rounded-full bg-rose-200/35 blur-3xl" />
        <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-violet-200/35 blur-3xl" />
        <div className="absolute left-1/3 top-20 h-36 w-36 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <DashboardCard
        className="hidden p-6 md:p-8"
        style={{ background: "linear-gradient(135deg, rgba(255,245,250,0.98) 0%, rgba(245,243,255,0.98) 52%, rgba(240,249,255,0.98) 100%)" }}
      >
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_60%)] lg:block" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm ring-1 ring-white/70">
                Analitica predictiva
              </span>
              <h1 className="mt-4 page-title text-3xl md:text-4xl">Modelo Predictivo de Demanda</h1>
              <p className="page-subtitle mt-3 max-w-2xl text-sm md:text-base">
                Estimacion lineal de ventas activas por categoria en los ultimos 12 meses, con alertas y acciones para inventario.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge badge-violet">Modelo: {predictiveMeta?.model || "Regresion lineal simple"}</span>
                <span className="badge badge-amber">Ventana: {predictiveMeta?.monthsWindow || 12} meses</span>
                <span className="badge badge-emerald">Actualizado: {fmtDateTime(predictiveMeta?.generatedAt)}</span>
              </div>
            </div>

            <div className="rounded-[24px] bg-white/70 p-2 shadow-sm ring-1 ring-white/80 backdrop-blur-sm">
              <div className="mb-2 px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Horizonte
              </div>
              <div className="flex bg-slate-100/80 p-1 rounded-2xl">
                {[1, 3, 6].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                      horizon === h
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {h} {h === 1 ? "mes" : "meses"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div className="rounded-[24px] bg-white/70 p-5 shadow-sm ring-1 ring-white/80 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categoria activa</label>
                <div className="relative min-w-[240px] flex-1">
                  <select
                    value={selected || ""}
                    onChange={(e) => setSelected(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-white/90 pl-4 pr-10 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 cursor-pointer"
                    style={{ "--tw-ring-color": selColor.solid }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold shadow-sm"
                  style={{ background: selColor.soft, color: selColor.dark }}
                >
                  {selHist.reduce((a, v) => a + v, 0)} uds. historicas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[22px] bg-white/75 p-4 shadow-sm ring-1 ring-white/80">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Confianza</div>
                <div className="mt-3 text-lg font-bold text-slate-800">{selectedSummary.confidence?.level || "Baja"}</div>
                <div className="mt-1 text-xs text-slate-500">{fmtNum(selectedSummary.confidence?.score || 0)}/100</div>
              </div>
              <div className="rounded-[22px] bg-white/75 p-4 shadow-sm ring-1 ring-white/80">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Stock</div>
                <div className="mt-3 text-lg font-bold text-slate-800">{fmtNum(selectedSummary.stockActual || 0)}</div>
                <div className="mt-1 text-xs text-slate-500">unidades</div>
              </div>
              <div className="rounded-[22px] bg-white/75 p-4 shadow-sm ring-1 ring-white/80">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Alertas</div>
                <div className="mt-3 text-lg font-bold text-slate-800">{fmtNum(selectedAlerts.length)}</div>
                <div className="mt-1 text-xs text-slate-500">prioritarias</div>
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modelo Predictivo de Demanda</h1>
          <p className="text-slate-500 text-sm mt-1">
            Estimación lineal de ventas activas por categoría en los últimos 12 meses
          </p>
        </div>

        {/* Horizon selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[1, 3, 6].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                horizon === h
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {h} {h === 1 ? "mes" : "meses"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dropdown de categoría ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-slate-600">Categoría:</label>
        <div className="relative">
          <select
            id="categoria-select"
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 cursor-pointer"
            style={{ "--tw-ring-color": selColor.solid }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: selColor.soft, color: selColor.dark }}
        >
          {selHist.reduce((a, v) => a + v, 0)} uds. históricas
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Próximo mes"
          value={selPred.p1}
          prev={selPred.prev1}
          color={selColor}
        />
        <KpiCard
          label="En 3 meses"
          value={selPred.p3}
          prev={selPred.prev3}
          color={selColor}
        />
        <KpiCard
          label="En 6 meses"
          value={selPred.p6}
          prev={selPred.prev6}
          color={selColor}
        />
      </div>

      <div className="hidden grid-cols-1 xl:grid-cols-2 gap-6">
        <QualityPanel
          summary={selectedSummary}
          meta={predictiveMeta}
        />
        <ActionsPanel
          summary={selectedSummary}
          color={selColor}
        />
      </div>

      {/* ── Line Chart ── */}
      <DashboardCard className="p-6 md:p-7">
        <div className="mb-4">
          <h3 className="font-bold text-slate-800">Ventas históricas y proyección — {selected}</h3>
          <p className="text-xs text-slate-400 mt-1">
            Línea sólida = datos reales · Línea punteada = proyección a {horizon} {horizon === 1 ? "mes" : "meses"}
          </p>
        </div>
        <LineChart
          histLabels={histLabels}
          histValues={selHist}
          futureLabels={futureLabels}
          futureValues={futureValues}
          color={selColor}
        />
      </DashboardCard>

      {/* ── Bar Chart + Insights ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AlertsPanel
          alerts={selectedAlerts}
          selected={selected}
          onSelect={setSelected}
        />
        <ProductBreakdownPanel
          categoryName={selected}
          products={selectedProducts}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard className="p-6 md:p-7">
          <PanelIntro
            eyebrow="Benchmark"
            title="Comparativa de categorias"
            description="Volumen historico de 12 meses + demanda estimada para los proximos 3 meses. Haz clic para seleccionar."
          />
          <HorizontalBarChart
            categories={categoryList}
            selected={selected}
            onSelect={setSelected}
          />
        </DashboardCard>

        <div className="flex flex-col gap-4">
          <DashboardCard className="flex-1 p-6 md:p-7">
            <PanelIntro
              eyebrow="Sintesis"
              title="Resumen del modelo"
              description="Lectura rapida del comportamiento general del pronostico."
            />
            <div className="space-y-3">
              {[
                { label: "Categorías analizadas", value: categories.length },
                {
                  label: "Mayor volumen proyectado a 3 meses",
                  value: topProjectedCategory,
                },
                {
                  label: "Tendencia general",
                  value: (() => {
                    // promedio de pendientes de todas las categorías
                    const avgM = Object.values(categoryData || {}).reduce((sum, hist) => {
                      return sum + linearRegression(hist).m;
                    }, 0) / Math.max(categories.length, 1);
                    if (avgM > 0.3) return "📈 Crecimiento";
                    if (avgM < -0.3) return "📉 Descenso";
                    return "➡️ Estable";
                  })(),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className="text-sm font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

          <InsightsPanel
            catName={selected || ""}
            histValues={selHist}
            pred1={selPred.p1}
            pred3={selPred.p3}
            pred6={selPred.p6}
            color={selColor}
          />
        </div>
      </div>
    </div>
  );
}
