import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FIELD_LABELS = {
  frecuenciaVisitas: "Frecuencia",
  visitasUltimos90Dias: "Visitas 90 dias",
  mesesConActividad: "Meses activos",
  frecuenciaMensual: "Frecuencia mensual",
  gastoTotal: "Gasto total",
  gastoPromedio: "Gasto promedio",
  serviciosPromedioVisita: "Servicios por visita",
  diversidadServicios: "Diversidad",
  diasDesdeUltimaVisita: "Recencia (dias)",
  antiguedadClienteDias: "Antiguedad (dias)",
  proporcionCortes: "% Cortes",
  proporcionColor: "% Color",
  proporcionEstetica: "% Estetica",
  proporcionTratamientos: "% Tratamientos",
  proporcionUnas: "% Unas",
};
const TABLE_COLUMNS = [
  "frecuenciaVisitas",
  "visitasUltimos90Dias",
  "mesesConActividad",
  "frecuenciaMensual",
  "gastoTotal",
  "gastoPromedio",
  "serviciosPromedioVisita",
  "diversidadServicios",
  "diasDesdeUltimaVisita",
  "antiguedadClienteDias",
  "proporcionCortes",
  "proporcionColor",
  "proporcionEstetica",
  "proporcionTratamientos",
  "proporcionUnas",
];
const CLUSTER_STYLES = [
  { border: "border-blue-200", soft: "bg-blue-50", text: "text-blue-900", bar: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
  { border: "border-emerald-200", soft: "bg-emerald-50", text: "text-emerald-900", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  { border: "border-amber-200", soft: "bg-amber-50", text: "text-amber-900", bar: "bg-amber-500", badge: "bg-amber-100 text-amber-800" },
  { border: "border-rose-200", soft: "bg-rose-50", text: "text-rose-900", bar: "bg-rose-500", badge: "bg-rose-100 text-rose-800" },
  { border: "border-violet-200", soft: "bg-violet-50", text: "text-violet-900", bar: "bg-violet-500", badge: "bg-violet-100 text-violet-800" },
];

function getAdminToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatInteger(value) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(toNumber(value));
}

function formatDecimal(value, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "N/D";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date)
    : "N/D";
}

function normalizeRow(row) {
  const normalized = { ...row };
  TABLE_COLUMNS.forEach((key) => {
    normalized[key] = toNumber(row[key]);
  });
  normalized.clusterId = toNumber(row.clusterId);
  return normalized;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadDataset(rows, datasetColumns) {
  const columns = [
    "clienteId", "cliente", ...datasetColumns, "servicioFavorito", "clusterId", "cluster", "recomendacionPrincipal",
  ];
  const csv = [columns, ...rows.map((row) => columns.map((key) => row[key]))]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dataset-clustering-recomendacion-servicios.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function formatCell(key, value) {
  if (["gastoTotal", "gastoPromedio"].includes(key)) return formatCurrency(value);
  if (["proporcionCortes", "proporcionColor", "proporcionEstetica", "proporcionTratamientos", "proporcionUnas"].includes(key)) {
    return `${(toNumber(value) * 100).toFixed(1)}%`;
  }
  if (["frecuenciaMensual", "serviciosPromedioVisita"].includes(key)) return formatDecimal(value, 2);
  return formatInteger(value);
}

function StatCard({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div className={`min-h-[104px] rounded-lg border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-black uppercase">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      {detail && <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>}
    </div>
  );
}

function CollectionCard({ title, fields, tone = "blue" }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`rounded-lg border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-black">
        <SidebarIcon name="database" className="h-4 w-4" /> {title}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <span key={field} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-600">{field}</span>
        ))}
      </div>
    </div>
  );
}

function ClusterCard({ cluster }) {
  const style = CLUSTER_STYLES[cluster.id % CLUSTER_STYLES.length];
  return (
    <div className={`rounded-lg border p-4 ${style.border} ${style.soft} ${style.text}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase opacity-60">Cluster {cluster.id + 1}</div>
          <h3 className="mt-1 text-base font-black">{cluster.label}</h3>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${style.badge}`}>{cluster.percentage}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-white/80">
        <div className={`h-full ${style.bar}`} style={{ width: `${cluster.percentage}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div><strong className="block text-base">{formatInteger(cluster.size)}</strong>clientes</div>
        <div><strong className="block text-base">{formatDecimal(cluster.centroid?.frecuenciaVisitas, 1)}</strong>visitas</div>
        <div><strong className="block text-base">{formatCurrency(cluster.centroid?.gastoPromedio)}</strong>ticket</div>
      </div>
      <div className="mt-4 border-t border-current/10 pt-3">
        <div className="text-xs font-black uppercase opacity-60">Servicios dominantes</div>
        <div className="mt-2 space-y-1.5">
          {(cluster.topServices || []).slice(0, 3).map((service) => (
            <div key={service.serviceId} className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="truncate" title={service.nombre}>{service.nombre}</span>
              <span className="shrink-0 opacity-60">{service.consumos}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RecomendacionServicios() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [model, setModel] = useState({ available: false });
  const [meta, setMeta] = useState({ datasetColumns: [], featureDefinitions: [] });
  const [clusters, setClusters] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [clusterFilter, setClusterFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [recommendationError, setRecommendationError] = useState("");

  const loadDataset = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminServicesClusteringDataset, { token: getAdminToken() });
      const normalizedRows = Array.isArray(data.dataset) ? data.dataset.map(normalizeRow) : [];
      const clientOptions = Array.isArray(data.options?.clients) ? data.options.clients : [];
      setRows(normalizedRows);
      setSummary(data.summary || {});
      setModel(data.model || { available: false });
      setMeta(data.meta || { datasetColumns: [], featureDefinitions: [] });
      setClusters(Array.isArray(data.clusters) ? data.clusters : []);
      setClients(clientOptions);
      setSelectedClient((current) => current || clientOptions[0]?.id || "");
      setRecommendation(null);
      setPage(1);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible generar el clustering de servicios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (clusterFilter !== "" && row.clusterId !== Number(clusterFilter)) return false;
      if (query && !`${row.cliente} ${row.servicioFavorito} ${row.cluster}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, clusterFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleRecommend = async () => {
    if (!selectedClient) return;
    setRecommending(true);
    setRecommendation(null);
    setRecommendationError("");
    try {
      const data = await requestJson(endpoints.adminServicesClusteringRecommend, {
        method: "POST",
        token: getAdminToken(),
        body: { clientId: selectedClient },
      });
      setRecommendation(data.recommendation || null);
    } catch (error) {
      setRecommendationError(error.message || "No fue posible recomendar servicios.");
    } finally {
      setRecommending(false);
    }
  };

  if (loading) return <LoadingSpinner text="Agrupando clientes y generando recomendaciones..." />;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-black uppercase text-amber-800">Propuesta 3</span>
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-black uppercase text-emerald-800">Recomendacion</span>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-black uppercase text-blue-800">K-Means</span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-900">Recomendación de servicios por clustering</h1>
          <p className="mt-1 text-sm text-slate-500">
            Agrupa clientes por comportamiento y recomienda los servicios más representativos de su cluster.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2 px-4 py-2" onClick={loadDataset}>
            <SidebarIcon name="stats" className="h-4 w-4" /> Actualizar
          </Button>
          <Button
            type="button"
            variant="emerald"
            className="gap-2 px-4 py-2"
            disabled={!rows.length}
            onClick={() => downloadDataset(rows, meta.datasetColumns || [])}
          >
            <SidebarIcon name="reports" className="h-4 w-4" /> Descargar CSV
          </Button>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Interacciones sinteticas" value={formatInteger(summary.syntheticInteractions)} detail={`${formatDate(summary.firstDate)} a ${formatDate(summary.lastDate)}`} tone="blue" />
        <StatCard label="Perfiles de clientes" value={formatInteger(summary.clients)} detail={`${formatInteger(summary.serviceItems)} consumos registrados`} tone="emerald" />
        <StatCard label="Clusters" value={`K = ${formatInteger(model.k)}`} detail={`${formatInteger(model.featureCount)} variables normalizadas`} tone="amber" />
        <StatCard label="Silhouette" value={formatDecimal(model.silhouette, 3)} detail="Cohesion y separacion" tone="rose" />
        <StatCard label="Convergencia" value={model.converged ? "Completa" : "Pendiente"} detail={`${formatInteger(model.iterations)} iteraciones`} tone="slate" />
      </div>

      <section className="border-y border-slate-200 bg-white py-5">
        <h2 className="text-lg font-black text-slate-900">Origen y transformación</h2>
        <p className="mt-1 text-sm text-slate-500">
          Unión de pagos con clientes y catálogo; las interacciones se resumen en una fila por cliente.
        </p>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <CollectionCard
            title="Colección: pagos_cliente"
            tone="blue"
            fields={["userId", "tipo", "total", "estatus", "createdAt", "detalle.itemId", "detalle.precio"]}
          />
          <CollectionCard
            title="Colección: usuarios"
            tone="emerald"
            fields={["_id", "nombre", "apellidoPaterno", "apellidoMaterno", "createdAt"]}
          />
          <CollectionCard
            title="Colección: servicios"
            tone="amber"
            fields={["_id", "nombre", "segmento", "subcategoria", "precio"]}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="border-l-4 border-blue-500 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase text-slate-500">1. Agregación</div>
            <p className="mt-1 text-sm font-semibold text-slate-700">Frecuencia, recencia, gasto y preferencias por cliente.</p>
          </div>
          <div className="border-l-4 border-emerald-500 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase text-slate-500">2. Escalamiento</div>
            <p className="mt-1 text-sm font-semibold text-slate-700">Estandarización z-score de las 15 variables numéricas.</p>
          </div>
          <div className="border-l-4 border-amber-500 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase text-slate-500">3. Agrupación</div>
            <p className="mt-1 text-sm font-semibold text-slate-700">K-Means++ con cinco centroides y semilla reproducible.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Variables X para agrupación</h2>
            <p className="mt-1 text-sm text-slate-500">Identificadores y nombres se conservan únicamente para trazabilidad.</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            Distancia euclidiana sobre variables estandarizadas.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(meta.featureDefinitions || []).map((feature) => (
            <span key={feature.key} className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700" title={feature.key}>
              X: {feature.label}
            </span>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Grupos obtenidos</h2>
            <p className="mt-1 text-sm text-slate-500">Centroides interpretados por comportamiento y preferencias dominantes.</p>
          </div>
          <div className="text-xs font-bold text-slate-500">Inercia: {formatDecimal(model.inertia, 2)}</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} />)}
        </div>
      </section>

      <section id="recomendador-servicios" className="scroll-mt-24 border-b border-slate-200 pb-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
          <div>
            <h2 className="text-lg font-black text-slate-900">Recomendación por cliente</h2>
            <p className="mt-1 text-sm text-slate-500">Servicios dominantes de su grupo que todavía no ha consumido.</p>
            <label className="mt-4 block">
              <span className="form-label">Cliente</span>
              <select className="form-input" value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.nombre} | {client.cluster}</option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="indigo"
              className="mt-4 w-full gap-2 px-4 py-3"
              disabled={!selectedClient || recommending || !model.available}
              onClick={handleRecommend}
            >
              <SidebarIcon name="predictive" className="h-4 w-4" />
              {recommending ? "Analizando..." : "Generar recomendación"}
            </Button>
            {recommendationError && <p className="mt-3 text-sm font-semibold text-rose-700">{recommendationError}</p>}
          </div>

          <div className="min-h-[250px] border-l-0 border-slate-200 lg:border-l lg:pl-5">
            {!recommendation ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm font-semibold text-slate-400">Recomendación pendiente</div>
            ) : (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase text-slate-500">{recommendation.cluster}</div>
                    <h3 className="mt-1 text-xl font-black text-slate-900">{recommendation.cliente}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Servicio favorito: <strong>{recommendation.servicioFavorito}</strong> | Grupo de {formatInteger(recommendation.clusterSize)} clientes
                    </p>
                  </div>
                  <span className="rounded bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-800">Cluster {recommendation.clusterId + 1}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {(recommendation.recommendations || []).map((service, index) => (
                    <div key={service.serviceId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-black uppercase text-slate-400">Opción {index + 1}</div>
                      <h4 className="mt-2 min-h-[40px] text-sm font-black text-slate-900">{service.nombre}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{service.subcategoria}</p>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <span className="text-base font-black text-emerald-700">{formatCurrency(service.precio)}</span>
                        <span className="text-xs font-bold text-slate-400">{service.consumos} consumos</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Dataset para K-Means</h2>
            <p className="mt-1 text-sm text-slate-500">{formatInteger(filteredRows.length)} perfiles visibles de {formatInteger(rows.length)}.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_220px_100px]">
            <label>
              <span className="form-label">Buscar cliente</span>
              <input className="form-input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nombre, cluster o servicio" />
            </label>
            <label>
              <span className="form-label">Cluster</span>
              <select className="form-input" value={clusterFilter} onChange={(event) => { setClusterFilter(event.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}
              </select>
            </label>
            <label>
              <span className="form-label">Filas</span>
              <select className="form-input" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto border-y border-slate-200 bg-white">
          <table className="min-w-[2550px] border-collapse text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border-b border-slate-200 px-3 py-3 font-black">Cliente</th>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-black">{FIELD_LABELS[column]}</th>
                ))}
                <th className="border-b border-slate-200 px-3 py-3 font-black">Servicio favorito</th>
                <th className="border-b border-slate-200 px-3 py-3 font-black">Cluster</th>
                <th className="border-b border-slate-200 px-3 py-3 font-black">Recomendación</th>
                <th className="border-b border-slate-200 px-3 py-3 font-black">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const style = CLUSTER_STYLES[row.clusterId % CLUSTER_STYLES.length];
                return (
                  <tr key={row.clienteId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-800">{row.cliente}</td>
                    {TABLE_COLUMNS.map((column) => (
                      <td key={column} className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatCell(column, row[column])}</td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.servicioFavorito}</td>
                    <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded px-2 py-1 font-black ${style.badge}`}>{row.cluster}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-indigo-700">{row.recomendacionPrincipal}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="rounded bg-indigo-100 px-2 py-1 font-bold text-indigo-700 hover:bg-indigo-200"
                        onClick={() => {
                          setSelectedClient(row.clienteId);
                          document.getElementById("recomendador-servicios")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-slate-500">Página {safePage} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button>
          </div>
        </div>
      </section>
    </div>
  );
}
