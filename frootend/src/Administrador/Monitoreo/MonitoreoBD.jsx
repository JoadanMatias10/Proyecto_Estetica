import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-MX").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "N/D";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/D";
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeLabel(value) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalizeLabel(value) {
  const text = String(value || "");
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatRelativeTime(value) {
  if (!value) return "Sin actividad";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin actividad";
  const diffSeconds = Math.round((Date.now() - parsed.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(diffSeconds) < 60) return capitalizeLabel(formatter.format(-diffSeconds, "second"));
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return capitalizeLabel(formatter.format(-diffMinutes, "minute"));
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return capitalizeLabel(formatter.format(-diffHours, "hour"));
  return capitalizeLabel(formatter.format(-Math.round(diffHours / 24), "day"));
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value) {
  return Math.min(Math.max(toSafeNumber(value), 0), 100);
}

function calculatePercentValue(part, total) {
  const safePart = toSafeNumber(part);
  const safeTotal = toSafeNumber(total);
  if (safeTotal <= 0) return 0;
  return clampPercent((safePart / safeTotal) * 100);
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/D";
  return `${Math.round(parsed)}%`;
}

function formatLatency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "N/D";
  return `${formatNumber(parsed)} ms`;
}

function formatMegabytes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "N/D";
  return `${parsed.toFixed(2)} MB`;
}

function formatKilobytes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "N/D";
  if (parsed >= 1024 * 1024) return `${(parsed / (1024 * 1024)).toFixed(2)} GB`;
  if (parsed >= 1024) return `${(parsed / 1024).toFixed(2)} MB`;
  return `${parsed.toFixed(0)} KB`;
}

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "N/D";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatConnectionValue(connections) {
  const current = Number(connections?.current || 0);
  const total = Number(connections?.totalCapacity || 0);
  if (total > 0) return `${formatNumber(current)} / ${formatNumber(total)}`;
  return formatNumber(current);
}

function formatConnectionHint(connections) {
  if (!connections) return "Sin datos";
  return `${formatPercent(connections.utilizationPct)} uso`;
}

function formatRecentActivityHint(operations, refreshIntervalMs = 0) {
  const intervalMs = Number(operations?.intervalMs || refreshIntervalMs || 0);
  const seconds = Math.max(Math.round(intervalMs / 1000), 1);
  return `Cambios en los ultimos ${seconds} s`;
}

function formatAccumulatedActivityHint(operations) {
  const since = operations?.desde ? formatDateTime(operations.desde) : "esta sesion";
  return `Acumulado desde ${since}`;
}

function formatCacheValue(cache) {
  if (!cache?.available || Number(cache?.maxMb || 0) <= 0) return "N/D";
  return formatPercent(cache.usedPct);
}

function formatCacheHint(cache) {
  if (!cache?.available || Number(cache?.maxMb || 0) <= 0) return "Sin datos";
  return `${Number(cache.usedMb || 0).toFixed(1)} / ${Number(cache.maxMb || 0).toFixed(1)} MB`;
}

function formatCacheDetail(cache) {
  if (!cache?.available || Number(cache?.maxMb || 0) <= 0) return "Sin datos";
  return `Sucio ${formatPercent(cache.dirtyPct)}`;
}

function formatCollectionName(value) {
  const labels = {
    productos: "Productos",
    products: "Productos",
    citas: "Citas",
    servicios: "Servicios",
    services: "Servicios",
    categorias_servicio: "Categorias de servicios",
    movimientos_inventario: "Inventario",
    ventas: "Ventas",
  };
  if (!value) return "N/D";
  return labels[value] || String(value).replace(/_/g, " ");
}

function formatActivityType(value) {
  const labels = {
    productos: "PRODUCTO",
    products: "PRODUCTO",
    citas: "CITA",
    servicios: "SERVICIO",
    services: "SERVICIO",
    categorias_servicio: "CAT. SERVICIO",
    movimientos_inventario: "INVENTARIO",
    ventas: "VENTA",
  };
  return labels[value] || "EVENTO";
}

function getCollectionVisuals(value) {
  const visuals = {
    productos: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500", solid: "#7c3aed", soft: "#ede9fe" },
    products: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500", solid: "#7c3aed", soft: "#ede9fe" },
    citas: { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500", solid: "#f43f5e", soft: "#ffe4e6" },
    servicios: { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500", solid: "#0ea5e9", soft: "#e0f2fe" },
    services: { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500", solid: "#0ea5e9", soft: "#e0f2fe" },
    categorias_servicio: { bg: "bg-fuchsia-100", text: "text-fuchsia-700", dot: "bg-fuchsia-500", solid: "#d946ef", soft: "#fae8ff" },
    movimientos_inventario: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", solid: "#f59e0b", soft: "#fef3c7" },
    ventas: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", solid: "#10b981", soft: "#d1fae5" },
  };
  return visuals[value] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
    solid: "#64748b",
    soft: "#e2e8f0",
  };
}

function formatActivityTitle(entry) {
  if (entry?.principal) return String(entry.principal);
  return String(entry?.titulo || "Sin registro");
}

function formatActivityDetail(entry) {
  if (entry?.datoClave) {
    if (entry?.coleccion === "ventas") {
      const amount = Number(String(entry.datoClave).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(amount) ? formatCurrency(amount) : String(entry.datoClave);
    }
    return String(entry.datoClave);
  }
  return String(entry?.descripcion || "N/D");
}

function buildSparklineGeometry(points, width = 320, height = 120, padding = 16) {
  const safePoints = Array.isArray(points)
    ? points
        .map((point, index) => ({
          label: point?.label || `P${index + 1}`,
          value: toSafeNumber(point?.value),
        }))
        .filter((point) => Number.isFinite(point.value))
    : [];

  if (!safePoints.length) return null;

  const plottedPoints = safePoints.length === 1 ? [safePoints[0], safePoints[0]] : safePoints;
  const values = plottedPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const isFlat = max === min;

  const coords = plottedPoints.map((point, index) => {
    const normalizedValue = isFlat ? 0.5 : (point.value - min) / (max - min);
    return {
      ...point,
      x: padding + (innerWidth * index) / Math.max(plottedPoints.length - 1, 1),
      y: padding + innerHeight - normalizedValue * innerHeight,
    };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

  return {
    width,
    height,
    min,
    max,
    firstLabel: safePoints[0].label,
    lastLabel: safePoints[safePoints.length - 1].label,
    coords,
    linePath,
    areaPath,
  };
}

function getStatusTone(status) {
  if (status === "Conectada") return "success";
  if (status === "Conectando") return "info";
  return "warning";
}

function Pill({ tone = "neutral", children }) {
  const tones = {
    success: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-100 text-amber-700 border border-amber-200",
    info: "bg-sky-100 text-sky-700 border border-sky-200",
    violet: "bg-violet-100 text-violet-700 border border-violet-200",
    neutral: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.neutral}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

function MetricCard({ title, value, hint, icon, gradient }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div
        className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-300 group-hover:opacity-20"
        style={{ background: gradient }}
      />
      <div
        className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: gradient }}
      >
        <SidebarIcon name={icon} className="h-5 w-5 text-white" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-slate-800">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DetailCard({ label, value, hint, icon }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
          <SidebarIcon name={icon} className="h-4 w-4 text-violet-500" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className="text-lg font-extrabold text-slate-800">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyChartState({ message, className = "h-36" }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center ${className}`}>
      <p className="px-6 text-sm text-slate-400">{message}</p>
    </div>
  );
}

function TrendChart({ points, color }) {
  const geometry = buildSparklineGeometry(points);

  if (!geometry) {
    return <EmptyChartState message="Esperando mas muestras para graficar." className="h-40" />;
  }

  const { width, height, coords, linePath, areaPath, min, max, firstLabel, lastLabel } = geometry;
  const lastPoint = coords[coords.length - 1];
  const gradientId = `trend-gradient-${color.replace('#', '')}`;

  return (
    <div className="group relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = 16 + (height - 32) * ratio;
          return <line key={ratio} x1="16" y1={y} x2={width - 16} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"/>;
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} className="transition-all duration-700" />
        <path 
          d={linePath} 
          fill="none" 
          stroke={color} 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="transition-all duration-300 group-hover:drop-shadow-lg" 
          style={{ filter: `url(#glow-${gradientId})` }} 
        />
        
        {coords.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2.5" className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        ))}

        <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="#ffffff" stroke={color} strokeWidth="3" className="drop-shadow-md" />
      </svg>

      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-400">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Min {formatNumber(min)}</span>
        <span>Max {formatNumber(max)}</span>
      </div>
    </div>
  );
}

function TrendMetricCard({ title, value, hint, points, color, footerStart, footerEnd }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative z-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}

        <div className="mt-6">
          <TrendChart points={points} color={color} />
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <span>{footerStart}</span>
          <span className="text-slate-700">{footerEnd}</span>
        </div>
      </div>
      <div 
        className="pointer-events-none absolute -right-10 -top-10 z-0 h-40 w-40 rounded-full opacity-5 blur-3xl transition-opacity group-hover:opacity-10"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function CollectionDistributionChart({ segments, total }) {
  if (!total || !segments.length) {
    return <EmptyChartState message="No hay suficiente actividad reciente para construir la grafica." className="h-full min-h-[280px]" />;
  }

  const radius = 80;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr] xl:grid-cols-1 2xl:grid-cols-[200px_1fr]">
      <div className="flex items-center justify-center">
        <div className="relative flex h-52 w-52 items-center justify-center drop-shadow-lg transition-transform hover:scale-105 duration-500">
          <svg className="absolute inset-0 h-full w-full -rotate-90 overflow-visible" viewBox="0 0 200 200">
            {segments.map((segment) => {
              const fraction = segment.value / total;
              const dashLength = Math.max((fraction * circumference) - 2, 0);
              const strokeDasharray = `${dashLength} ${circumference}`;
              const strokeDashoffset = -currentOffset;
              currentOffset += fraction * circumference;
              
              return (
                <circle
                  key={segment.key}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 ease-in-out hover:stroke-[34px] cursor-pointer"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center rounded-full bg-white/90 p-4 shadow-sm backdrop-blur-sm h-32 w-32 border border-slate-50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Eventos</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-800">{formatNumber(total)}</p>
            <p className="text-[10px] text-slate-500">visibles</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => {
          const percentage = calculatePercentValue(segment.value, total);
          return (
            <div key={segment.key} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
              <div className="flex min-w-0 items-center gap-4">
                <div 
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{ backgroundColor: segment.softColor }}
                >
                  <span className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: segment.color }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{segment.label}</p>
                  <p className="text-xs font-medium text-slate-500">{formatNumber(segment.value)} evt.</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-black text-slate-700">{formatPercent(percentage)}</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${percentage}%`, backgroundColor: segment.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OperationCompositionChart({ segments, total }) {
  if (!total || !segments.length) {
    return <EmptyChartState message="Todavia no hay operaciones acumuladas para mostrar en la grafica de hoy." className="h-40" />;
  }

  const maxValue = Math.max(...segments.map((segment) => Number(segment.value || 0)), 1);
  const chartWidth = 760;
  const chartHeight = 360;
  const chartMargin = {
    top: 24,
    right: 24,
    bottom: 22,
    left: 50,
  };
  const innerWidth = chartWidth - chartMargin.left - chartMargin.right;
  const innerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
  const gridTicks = [100, 75, 50, 25, 0];
  const normalizedSegments = segments.map((segment, index) => {
    const value = Number(segment.value || 0);
    const relativePercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const slotWidth = innerWidth / Math.max(segments.length, 1);
    const barWidth = Math.min(98, slotWidth * 0.48);
    const x = chartMargin.left + slotWidth * index + (slotWidth - barWidth) / 2;
    const visualHeight = value > 0
      ? Math.max((relativePercent / 100) * innerHeight, 18)
      : 10;
    const y = chartMargin.top + innerHeight - visualHeight;

    return {
      ...segment,
      value,
      relativePercent,
      sharePercent: calculatePercentValue(value, total),
      gradientId: `ops-bar-${segment.key}`,
      x,
      y,
      width: barWidth,
      height: visualHeight,
      labelX: x + barWidth / 2,
    };
  });

  return (
    <div className="space-y-6">
      <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Comparativa del dia</p>
              <p className="mt-2 text-sm text-slate-500">Cada barra muestra el volumen acumulado por tipo de operacion.</p>
            </div>
            <Pill tone="neutral">Pico: {formatNumber(maxValue)}</Pill>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50/80 p-5 shadow-inner">
            <div className="rounded-[1.7rem] border border-slate-200/80 bg-white p-4 sm:p-5">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[26rem] w-full">
                    <defs>
                      {normalizedSegments.map((segment) => (
                        <linearGradient key={segment.gradientId} id={segment.gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={segment.softColor} />
                          <stop offset="100%" stopColor={segment.color} />
                        </linearGradient>
                      ))}
                    </defs>

                    {gridTicks.map((tick) => {
                      const y = chartMargin.top + innerHeight - (tick / 100) * innerHeight;
                      return (
                        <g key={tick}>
                          <text
                            x={chartMargin.left - 6}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-400 text-[11px] font-semibold"
                          >
                            {tick}%
                          </text>
                          <line
                            x1={chartMargin.left}
                            y1={y}
                            x2={chartWidth - chartMargin.right}
                            y2={y}
                            stroke="#dbe7f5"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        </g>
                      );
                    })}

                    {normalizedSegments.map((segment) => (
                      <g key={segment.key}>
                        <text
                          x={segment.labelX}
                          y={Math.max(segment.y - 14, 14)}
                          textAnchor="middle"
                          className="fill-slate-600 text-[12px] font-extrabold"
                        >
                          {formatNumber(segment.value)}
                        </text>
                        <rect
                          x={segment.x}
                          y={segment.y}
                          width={segment.width}
                          height={segment.height}
                          rx="20"
                          fill={`url(#${segment.gradientId})`}
                        />
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {normalizedSegments.map((segment) => (
                <div key={`ops-summary-${segment.key}`} className="rounded-[1.45rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {segment.label}
                      </p>
                      <p className={`mt-2 text-3xl font-extrabold ${segment.accentClass}`}>{formatNumber(segment.value)}</p>
                    </div>
                    <span
                      className="inline-flex min-w-[56px] justify-center rounded-2xl px-3 py-2 text-sm font-extrabold text-white"
                      style={{ backgroundColor: segment.color }}
                      title={`Participacion del ${formatPercent(segment.sharePercent)} del total`}
                    >
                      {formatPercent(segment.relativePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 z-0 h-48 w-48 rounded-full opacity-5 blur-3xl transition-opacity group-hover:opacity-10"
          style={{ backgroundColor: "#8b5cf6" }}
        />
      </div>

    </div>
  );
}

function UsageBarsChart({ items }) {
  if (!items.length) {
    return <EmptyChartState message="No hay metricas suficientes para esta grafica." className="h-44" />;
  }

  return (
    <div className="space-y-5 mt-5">
      {items.map((item) => (
        <div key={item.label} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{item.label}</p>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{item.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black tracking-tight" style={{ color: item.color }}>{formatPercent(item.value)}</p>
            </div>
          </div>
          <div className="relative z-10 mt-4 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div 
              className="relative h-full rounded-full transition-all duration-1000 ease-out" 
              style={{ 
                width: `${clampPercent(item.value)}%`, 
                backgroundColor: item.color,
                background: `linear-gradient(90deg, ${item.color}bb, ${item.color})`
              }} 
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
          <div 
            className="pointer-events-none absolute -right-12 -top-12 z-0 h-32 w-32 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-10 blur-2xl"
            style={{ backgroundColor: item.color }}
          />
        </div>
      ))}
    </div>
  );
}

export default function MonitoreoBD() {
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chartHistory, setChartHistory] = useState([]);

  const requestControllerRef = useRef(null);
  const hasDataRef = useRef(false);
  const visibilityRef = useRef(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden"
  );

  const loadMonitor = useCallback(async ({ silent = false, showError = !silent } = {}) => {
    if (requestControllerRef.current) requestControllerRef.current.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const token = getAdminToken();
      const [summaryData, activityData, healthData] = await Promise.all([
        requestJson(endpoints.adminDatabaseMonitorSummary, { token, signal: controller.signal }),
        requestJson(endpoints.adminDatabaseMonitorActivity, { token, signal: controller.signal }),
        requestJson(endpoints.adminDatabaseMonitorHealth, { token, signal: controller.signal }),
      ]);

      if (requestControllerRef.current !== controller) return;

      hasDataRef.current = true;
      setSummary(summaryData);
      setActivity(activityData);
      setHealth(healthData);
      setChartHistory((current) => {
        const timestamp = String(healthData?.generadoEn || summaryData?.generadoEn || new Date().toISOString());
        const nextPoint = {
          timestamp,
          label: formatTimeLabel(timestamp),
          latencyMs: toSafeNumber(healthData?.latenciaMs ?? summaryData?.latenciaMs),
          recentOps: toSafeNumber(summaryData?.operacionesRecientes?.total ?? healthData?.ventana?.operations),
          requestsPerSec: toSafeNumber(healthData?.ventana?.requestsPerSec ?? summaryData?.ventana?.requestsPerSec),
        };

        const latest = current[current.length - 1];
        const nextHistory = latest && latest.timestamp === nextPoint.timestamp
          ? [...current.slice(0, -1), nextPoint]
          : [...current, nextPoint];

        return nextHistory.slice(-12);
      });
      setErrorMessage("");
    } catch (error) {
      if (isAbortError(error)) return;
      if (showError || !hasDataRef.current) {
        setErrorMessage(error.message || "No se pudo cargar el monitoreo.");
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadMonitor({ showError: true });
    return () => {
      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
        requestControllerRef.current = null;
      }
    };
  }, [loadMonitor]);

  useEffect(() => {
    const fn = () => {
      visibilityRef.current = document.visibilityState !== "hidden";
      if (visibilityRef.current) void loadMonitor({ silent: true });
    };
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, [loadMonitor]);

  useEffect(() => {
    const ms = Number(summary?.refreshIntervalMs || 15000);
    const id = window.setInterval(() => {
      if (visibilityRef.current) void loadMonitor({ silent: true });
    }, ms);
    return () => window.clearInterval(id);
  }, [summary?.refreshIntervalMs, loadMonitor]);

  const activityRows = useMemo(
    () => (Array.isArray(activity?.registros) ? activity.registros : []),
    [activity?.registros]
  );

  const metricCards = useMemo(() => ([
    {
      title: "Estado Mongo",
      value: summary?.estadoConexion || "N/D",
      hint: summary?.nombreBaseDatos || "Sin base activa",
      icon: "database",
      gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
    },
    {
      title: "Latencia",
      value: formatLatency(summary?.latenciaMs),
      hint: summary?.versionMongo ? `MongoDB ${summary.versionMongo}` : "Ping a MongoDB",
      icon: "stats",
      gradient: "linear-gradient(135deg,#0ea5e9,#0284c7)",
    },
    {
      title: "Conexiones",
      value: formatConnectionValue(summary?.conexiones),
      hint: formatConnectionHint(summary?.conexiones),
      icon: "staff",
      gradient: "linear-gradient(135deg,#10b981,#059669)",
    },
    {
      title: "Ops recientes",
      value: formatNumber(summary?.operacionesRecientes?.total ?? summary?.ventana?.operations ?? 0),
      hint: formatRecentActivityHint(summary?.operacionesRecientes, summary?.refreshIntervalMs),
      icon: "reports",
      gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
    },
    {
      title: "Cache WT",
      value: formatCacheValue(summary?.cache),
      hint: formatCacheHint(summary?.cache),
      icon: "inventory",
      gradient: "linear-gradient(135deg,#f43f5e,#e11d48)",
    },
  ]), [summary]);

  const operationCards = useMemo(() => {
    const operations = health?.operacionesAcumuladas || {};
    const cards = [
      {
        label: "Inserciones",
        key: "insert",
        accentClass: "text-emerald-600",
        barClass: "bg-emerald-500",
        color: "#10b981",
        softColor: "#d1fae5",
      },
      {
        label: "Consultas",
        key: "query",
        accentClass: "text-sky-600",
        barClass: "bg-sky-500",
        color: "#0ea5e9",
        softColor: "#e0f2fe",
      },
      {
        label: "Actualizaciones",
        key: "update",
        accentClass: "text-amber-600",
        barClass: "bg-amber-500",
        color: "#f59e0b",
        softColor: "#fef3c7",
      },
      {
        label: "Eliminaciones",
        key: "delete",
        accentClass: "text-rose-600",
        barClass: "bg-rose-500",
        color: "#f43f5e",
        softColor: "#ffe4e6",
      },
    ];

    const normalizedCards = cards.map((card) => ({
      ...card,
      value: Number(operations?.[card.key] ?? 0),
    }));

    const maxValue = Math.max(...normalizedCards.map((card) => card.value), 1);
    const totalValue = normalizedCards.reduce((sum, card) => sum + card.value, 0);

    return normalizedCards.map((card) => ({
      ...card,
      width: (card.value / maxValue) * 100,
      percentage: calculatePercentValue(card.value, totalValue),
    }));
  }, [health?.operacionesAcumuladas]);

  const activityDistribution = useMemo(() => {
    const counts = new Map();

    activityRows.forEach((entry) => {
      const key = String(entry?.coleccion || "otros");
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, value]) => {
        const visuals = getCollectionVisuals(key);
        return {
          key,
          label: formatCollectionName(key),
          value,
          color: visuals.solid,
          softColor: visuals.soft,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [activityRows]);

  const technicalUsage = useMemo(() => {
    const dataSizeMb = toSafeNumber(health?.baseDatos?.tamanoDatosMb);
    const storageMb = toSafeNumber(health?.baseDatos?.tamanoAlmacenamientoMb);

    return [
      {
        label: "Conexiones activas",
        value: toSafeNumber(health?.conexiones?.utilizationPct),
        detail: formatConnectionValue(health?.conexiones),
        color: "#7c3aed",
      },
      {
        label: "Cache utilizada",
        value: toSafeNumber(health?.cache?.usedPct),
        detail: formatCacheHint(health?.cache),
        color: "#0ea5e9",
      },
      {
        label: "Cache sucia",
        value: toSafeNumber(health?.cache?.dirtyPct),
        detail: formatCacheDetail(health?.cache),
        color: "#f59e0b",
      },
      {
        label: "Datos vs almacenamiento",
        value: calculatePercentValue(dataSizeMb, storageMb),
        detail: `${formatMegabytes(dataSizeMb)} / ${formatMegabytes(storageMb)}`,
        color: "#10b981",
      },
    ];
  }, [health]);

  const latencyTrend = useMemo(
    () => chartHistory.map((point) => ({ label: point.label, value: point.latencyMs })),
    [chartHistory]
  );

  const operationsTrend = useMemo(
    () => chartHistory.map((point) => ({ label: point.label, value: point.recentOps })),
    [chartHistory]
  );

  const totalActivityEvents = activityDistribution.reduce((sum, item) => sum + item.value, 0);
  const totalOperationCount = operationCards.reduce((sum, item) => sum + item.value, 0);
  const peakLatency = latencyTrend.length ? Math.max(...latencyTrend.map((point) => point.value)) : 0;
  const peakOperations = operationsTrend.length ? Math.max(...operationsTrend.map((point) => point.value)) : 0;
  const latestRequestsPerSecond = chartHistory.length ? chartHistory[chartHistory.length - 1].requestsPerSec : 0;

  if (loading && !summary) {
    return <LoadingSpinner fullScreen={false} text="Cargando monitoreo..." className="py-20" />;
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="pointer-events-none absolute -left-10 -top-10 h-56 w-56 rounded-full bg-violet-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-emerald-100/50 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-700">
              <SidebarIcon name="database" className="h-3.5 w-3.5" />
              MongoDB
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Monitoreo</h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-500">
              Conexion, latencia, operaciones y actividad de la base de datos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill tone={getStatusTone(summary?.estadoConexion)}>{summary?.estadoConexion || "Sin estado"}</Pill>
              {summary?.motorAlmacenamiento ? <Pill tone="neutral">Motor: {summary.motorAlmacenamiento}</Pill> : null}
            </div>
          </div>

          <div className="flex-shrink-0 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 lg:min-w-[320px]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumen</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ultima actualizacion</p>
                <p className="mt-0.5 font-semibold text-slate-700">{formatDateTime(summary?.generadoEn)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Version</p>
                <p className="mt-0.5 font-semibold text-slate-700">{summary?.versionMongo || "N/D"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ultima actividad</p>
                <p className="mt-0.5 font-semibold text-slate-700">
                  {activityRows[0]?.fecha ? formatRelativeTime(activityRows[0].fecha) : "Sin actividad"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Actualizacion auto</p>
                <p className="mt-0.5 font-semibold text-slate-700">{Math.round(Number(summary?.refreshIntervalMs || 0) / 1000)} s</p>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <Button
                type="button"
                variant="indigo"
                className="w-full justify-center px-4 py-2.5 text-sm"
                onClick={() => loadMonitor({ silent: true, showError: true })}
              >
                {refreshing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Actualizando...
                  </span>
                ) : (
                  "Actualizar"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <span className="mt-0.5 text-base">!</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {metricCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Salud de MongoDB</h2>
              <p className="mt-0.5 text-xs text-slate-500">Estado tecnico de la instancia y la base</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
              <SidebarIcon name="stats" className="h-4.5 w-4.5 text-violet-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailCard
              label="Base de datos"
              value={health?.nombreBaseDatos || "N/D"}
              hint={health?.motorAlmacenamiento ? `Motor: ${health.motorAlmacenamiento}` : "Sin motor"}
              icon="database"
            />
            <DetailCard
              label="Conexiones"
              value={formatConnectionValue(health?.conexiones)}
              hint={`Creadas: ${formatNumber(health?.conexiones?.totalCreated || 0)}`}
              icon="staff"
            />
            <DetailCard
              label="Tiempo activo"
              value={formatDuration(health?.uptimeSegundos)}
              hint={health?.versionMongo ? `MongoDB ${health.versionMongo}` : "Sin version"}
              icon="reports"
            />
            <DetailCard
              label="Latencia"
              value={formatLatency(health?.latenciaMs)}
              hint={formatConnectionHint(health?.conexiones)}
              icon="stats"
            />
            <DetailCard
              label="Almacenamiento"
              value={formatMegabytes(health?.baseDatos?.tamanoDatosMb)}
              hint={`Total: ${formatMegabytes(health?.baseDatos?.tamanoAlmacenamientoMb)}`}
              icon="inventory"
            />
            <DetailCard
              label="Indices"
              value={formatNumber(health?.baseDatos?.totalIndices || 0)}
              hint={`Tamano: ${formatMegabytes(health?.baseDatos?.tamanoIndicesMb)}`}
              icon="reports"
            />
            <DetailCard
              label="Red"
              value={`${formatNumber(health?.red?.requests || 0)} solicitudes`}
              hint={`Entrada ${formatKilobytes(health?.red?.bytesInKb)} | Salida ${formatKilobytes(health?.red?.bytesOutKb)}`}
              icon="backup"
            />
            <DetailCard
              label="Cache WT"
              value={formatCacheHint(health?.cache)}
              hint={formatCacheDetail(health?.cache)}
              icon="inventory"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <DetailCard label="Documentos" value={formatNumber(health?.baseDatos?.totalDocumentosAprox || 0)} hint="Aprox." icon="database" />
            <DetailCard label="Colecciones" value={formatNumber(health?.baseDatos?.totalColecciones || 0)} hint="Visibles" icon="productsCat" />
            <DetailCard
              label="Ventana ops"
              value={formatNumber(health?.ventana?.operations || 0)}
              hint={`${Math.round(Number(health?.ventana?.intervalMs || 0) / 1000) || 0} s`}
              icon="stats"
            />
            <DetailCard
              label="Solic./s"
              value={formatNumber(health?.ventana?.requestsPerSec || 0)}
              hint={`${formatNumber(health?.ventana?.requests || 0)} solicitudes`}
              icon="reports"
            />
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Actividad reciente</h2>
              <p className="mt-0.5 text-xs text-slate-500">Eventos de colecciones monitoreadas</p>
            </div>
            <Pill tone="violet">{formatNumber(activityRows.length)}</Pill>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activityRows.length === 0 ? (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <p className="text-sm text-slate-400">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activityRows.map((entry) => {
                  const col = getCollectionVisuals(entry.coleccion);

                  return (
                    <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${col.bg} ${col.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                            {formatActivityType(entry.coleccion)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{formatActivityTitle(entry)}</p>
                            <p className="truncate text-xs text-slate-500">{formatActivityDetail(entry)}</p>
                          </div>
                        </div>
                        <p className="flex-shrink-0 text-xs font-semibold text-slate-500">{formatRelativeTime(entry.fecha)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Desglose de operaciones</h2>
            <p className="mt-0.5 text-xs text-slate-500">{formatAccumulatedActivityHint(health?.operacionesAcumuladas)}</p>
          </div>
          <Pill tone="neutral">Total: {formatNumber(health?.operacionesAcumuladas?.total ?? 0)}</Pill>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Grafica diaria de composicion</h3>
              <p className="mt-1 text-xs text-slate-500">Comparativa visual por tipo de operacion acumulada durante el dia.</p>
            </div>
            <Pill tone="violet">{formatNumber(totalOperationCount)} movimientos</Pill>
          </div>

          <div className="mt-5">
            <OperationCompositionChart segments={operationCards} total={totalOperationCount} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Graficas de monitoreo</h2>
            <p className="mt-0.5 text-xs text-slate-500">Visualizaciones ligeras con los datos que ya genera el monitor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral">Sesion: {formatNumber(chartHistory.length)} muestras</Pill>
            <Pill tone="violet">Eventos visibles: {formatNumber(totalActivityEvents)}</Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TrendMetricCard
                title="Latencia durante la sesion"
                value={formatLatency(health?.latenciaMs)}
                hint="Se actualiza junto con el monitoreo automatico."
                points={latencyTrend}
                color="#0ea5e9"
                footerStart={`${formatNumber(latencyTrend.length)} muestras`}
                footerEnd={`Pico ${formatLatency(peakLatency)}`}
              />

              <TrendMetricCard
                title="Operaciones recientes"
                value={formatNumber(summary?.operacionesRecientes?.total ?? 0)}
                hint={`Solicitudes actuales por segundo: ${formatNumber(latestRequestsPerSecond)}`}
                points={operationsTrend}
                color="#8b5cf6"
                footerStart={`${formatNumber(operationsTrend.length)} muestras`}
                footerEnd={`Pico ${formatNumber(peakOperations)}`}
              />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Uso tecnico actual</h3>
                  <p className="mt-1 text-xs text-slate-500">Barras de ocupacion para las metricas mas visibles.</p>
                </div>
                <Pill tone="neutral">Instantaneo</Pill>
              </div>
              <UsageBarsChart items={technicalUsage} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Actividad por coleccion</h3>
                <p className="mt-1 text-xs text-slate-500">Distribucion basada en los eventos visibles dentro del panel.</p>
              </div>
              <Pill tone="neutral">{formatNumber(totalActivityEvents)} registros</Pill>
            </div>
            <CollectionDistributionChart segments={activityDistribution} total={totalActivityEvents} />
          </div>
        </div>
      </section>
    </div>
  );
}
