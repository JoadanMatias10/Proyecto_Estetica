import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const MONTHS = [
  [1, "Enero"],
  [2, "Febrero"],
  [3, "Marzo"],
  [4, "Abril"],
  [5, "Mayo"],
  [6, "Junio"],
  [7, "Julio"],
  [8, "Agosto"],
  [9, "Septiembre"],
  [10, "Octubre"],
  [11, "Noviembre"],
  [12, "Diciembre"],
];
const DAY_OPTIONS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_DATASET_COLUMNS = [
  "mesCita",
  "diaSemanaCita",
  "horaCita",
  "esFinSemana",
  "diasAnticipacion",
  "servicio",
  "segmentoServicio",
  "subcategoriaServicio",
  "precioServicio",
  "duracionMinutos",
  "recordatorioActivo",
  "canalRecordatorio",
  "anticipacionRecordatorioHoras",
  "citasPrevias",
  "cancelacionesPrevias",
  "tasaCancelacionPrevia",
  "diasDesdeRegistroCliente",
  "citaCancelada",
];
const DATAFRAME_FIELDS = [
  "mesCita",
  "diaSemanaCita",
  "horaCita",
  "esFinSemana",
  "diasAnticipacion",
  "servicio",
  "segmentoServicio",
  "subcategoriaServicio",
  "precioServicio",
  "duracionMinutos",
  "recordatorioActivo",
  "canalRecordatorio",
  "anticipacionRecordatorioHoras",
  "citasPrevias",
  "cancelacionesPrevias",
  "tasaCancelacionPrevia",
  "diasDesdeRegistroCliente",
];

function getAdminToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRow(row) {
  return {
    ...row,
    mesCita: toNumber(row.mesCita, 1),
    horaCita: toNumber(row.horaCita),
    esFinSemana: toNumber(row.esFinSemana),
    precioServicio: toNumber(row.precioServicio),
    duracionMinutos: toNumber(row.duracionMinutos, 30),
    diasAnticipacion: toNumber(row.diasAnticipacion),
    recordatorioActivo: row.recordatorioActivo ? 1 : 0,
    anticipacionRecordatorioHoras: toNumber(row.anticipacionRecordatorioHoras),
    citasPrevias: toNumber(row.citasPrevias),
    cancelacionesPrevias: toNumber(row.cancelacionesPrevias),
    tasaCancelacionPrevia: toNumber(row.tasaCancelacionPrevia),
    diasDesdeRegistroCliente: toNumber(row.diasDesdeRegistroCliente),
    citaCancelada: toNumber(row.citaCancelada),
  };
}

function getClassSummary(rows) {
  const canceladas = rows.filter((row) => row.citaCancelada === 1).length;
  return {
    totalRows: rows.length,
    labelledRows: rows.length,
    canceladas,
    noCanceladas: rows.length - canceladas,
    tasaCancelacion: rows.length ? Number(((canceladas / rows.length) * 100).toFixed(1)) : 0,
  };
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(rows, columns) {
  return [columns, ...rows.map((row) => columns.map((key) => row[key]))]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");
}

function downloadDataset(rows, columns) {
  const blob = new Blob([buildCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dataset-clasificacion-citas-completo.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function formatMetric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(1)}%` : "N/D";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function buildInputFromRow(row) {
  return {
    mesCita: row?.mesCita || new Date().getMonth() + 1,
    diaSemanaCita: row?.diaSemanaCita || "Viernes",
    horaCita: row?.horaCita ?? 16,
    servicio: row?.servicio || "",
    segmentoServicio: row?.segmentoServicio || "Sin segmento",
    subcategoriaServicio: row?.subcategoriaServicio || "Sin subcategoria",
    precioServicio: row?.precioServicio ?? 220,
    duracionMinutos: row?.duracionMinutos ?? 60,
    diasAnticipacion: row?.diasAnticipacion ?? 3,
    recordatorioActivo: row ? Boolean(row.recordatorioActivo) : true,
    canalRecordatorio: row?.canalRecordatorio || "Email",
    anticipacionRecordatorioHoras: row?.anticipacionRecordatorioHoras ?? 24,
    citasPrevias: row?.citasPrevias ?? 2,
    cancelacionesPrevias: row?.cancelacionesPrevias ?? 0,
    diasDesdeRegistroCliente: row?.diasDesdeRegistroCliente ?? 180,
  };
}

function StatCard({ label, value, tone = "slate", detail = "" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };

  return (
    <div className={`min-h-[104px] rounded-lg border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-bold uppercase opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      {detail && <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>}
    </div>
  );
}

function CollectionPanel({ title, fields, tone }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone] || tones.blue}`}>
      <div className="text-sm font-black">{title}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <span key={field} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-600">
            {field}
          </span>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const styles = {
    Bajo: "bg-emerald-100 text-emerald-800",
    Medio: "bg-amber-100 text-amber-800",
    Alto: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`inline-flex rounded px-3 py-1 text-xs font-black uppercase ${styles[level] || styles.Bajo}`}>
      Riesgo {level}
    </span>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="form-label">{label}</span>
      <select className="form-input" value={value} onChange={onChange}>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return <option key={String(optionValue)} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

export default function ClasificacionCitas() {
  const [filters, setFilters] = useState({ desde: "", hasta: "", limit: 1000 });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(getClassSummary([]));
  const [model, setModel] = useState({ available: false });
  const [meta, setMeta] = useState({ datasetColumns: DEFAULT_DATASET_COLUMNS });
  const [options, setOptions] = useState({});
  const [input, setInput] = useState(buildInputFromRow(null));
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [predictionError, setPredictionError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadDataset = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminAppointmentsClassificationDataset(filters), {
        token: getAdminToken(),
      });
      const apiRows = Array.isArray(data.dataset) ? data.dataset.map(normalizeRow) : [];
      setRows(apiRows);
      setSummary(data.summary || getClassSummary(apiRows));
      setModel(data.model || { available: false });
      setMeta(data.meta || { datasetColumns: DEFAULT_DATASET_COLUMNS });
      setOptions(data.options || {});
      setPage(1);
      setPrediction(null);
      if (apiRows.length) setInput(buildInputFromRow(apiRows[0]));
      if (!apiRows.length) setErrorMessage("No se encontraron citas completadas o canceladas con los filtros seleccionados.");
    } catch (error) {
      setRows([]);
      setSummary(getClassSummary([]));
      setModel({ available: false });
      setErrorMessage(error.message || "No fue posible cargar el dataset desde MongoDB.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const datasetColumns = Array.isArray(meta.datasetColumns) && meta.datasetColumns.length
    ? meta.datasetColumns
    : DEFAULT_DATASET_COLUMNS;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);
  const cancellationWidth = `${clamp(summary.tasaCancelacion, 0, 100)}%`;
  const topFeatureMax = Number(model.topFeatures?.[0]?.importance || 1);

  const recommendations = useMemo(() => {
    if (!prediction) return [];
    if (prediction.predictedClass === 1) {
      return ["Confirmar asistencia directamente", "Enviar un recordatorio adicional", "Preparar lista de espera para el horario"];
    }
    if (prediction.level === "Medio") {
      return ["Mantener el recordatorio activo", "Confirmar servicios largos o de precio alto", "Monitorear cambios de ultimo momento"];
    }
    return ["Mantener el flujo normal de la cita", "Conservar el recordatorio configurado", "Registrar el resultado para futuras evaluaciones"];
  }, [prediction]);

  const loadRowAsInput = (row) => {
    setInput(buildInputFromRow(row));
    setPrediction(null);
    setPredictionError("");
    document.getElementById("clasificador-random-forest")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleServiceChange = (serviceName) => {
    const reference = rows.find((row) => row.servicio === serviceName);
    setInput((previous) => ({
      ...previous,
      servicio: serviceName,
      ...(reference ? {
        segmentoServicio: reference.segmentoServicio,
        subcategoriaServicio: reference.subcategoriaServicio,
        precioServicio: reference.precioServicio,
        duracionMinutos: reference.duracionMinutos,
      } : {}),
    }));
  };

  const submitPrediction = async (event) => {
    event.preventDefault();
    setPredicting(true);
    setPredictionError("");
    try {
      const data = await requestJson(endpoints.adminAppointmentsClassificationPredict, {
        method: "POST",
        token: getAdminToken(),
        body: {
          ...input,
          mesCita: toNumber(input.mesCita),
          horaCita: toNumber(input.horaCita),
          precioServicio: toNumber(input.precioServicio),
          duracionMinutos: toNumber(input.duracionMinutos),
          diasAnticipacion: toNumber(input.diasAnticipacion),
          anticipacionRecordatorioHoras: toNumber(input.anticipacionRecordatorioHoras),
          citasPrevias: toNumber(input.citasPrevias),
          cancelacionesPrevias: toNumber(input.cancelacionesPrevias),
          diasDesdeRegistroCliente: toNumber(input.diasDesdeRegistroCliente),
          recordatorioActivo: Boolean(input.recordatorioActivo),
        },
      });
      setPrediction(data.prediction || null);
      if (data.model) setModel(data.model);
    } catch (error) {
      setPrediction(null);
      setPredictionError(error.message || "No fue posible calcular la prediccion.");
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Entrenando Random Forest con las citas..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-800">
            <SidebarIcon name="predictive" className="h-4 w-4" />
            Random Forest Classifier
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-900">Riesgo de cancelacion de citas</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Dataset supervisado construido desde usuarios, citas y servicios registrados en MongoDB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <span className="badge badge-emerald">Fuente: MongoDB</span>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            disabled={!rows.length}
            onClick={() => downloadDataset(rows, datasetColumns)}
          >
            <SidebarIcon name="reports" className="h-4 w-4" />
            Descargar {rows.length} filas
          </Button>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registros" value={summary.totalRows} detail="Filas cargadas" />
        <StatCard label="Clase 0" value={summary.noCanceladas} tone="emerald" detail="Citas completadas" />
        <StatCard label="Clase 1" value={summary.canceladas} tone="rose" detail="Citas canceladas" />
        <StatCard label="Tasa cancelacion" value={`${summary.tasaCancelacion}%`} tone="blue" detail="Datos etiquetados" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Evaluacion del modelo</h2>
            <p className="text-sm text-slate-500">Prueba cronologica con el 20% mas reciente del dataset.</p>
          </div>
          <span className={`badge ${model.available ? "badge-emerald" : "badge-amber"}`}>
            {model.available ? `${model.estimators} arboles` : "Modelo no disponible"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Exactitud" value={formatMetric(model.accuracy)} tone="blue" detail={`${model.testRows || 0} filas de prueba`} />
          <StatCard label="Precision clase 1" value={formatMetric(model.precision)} tone="violet" />
          <StatCard label="Recall clase 1" value={formatMetric(model.recall)} tone="rose" />
          <StatCard label="F1 clase 1" value={formatMetric(model.f1)} tone="emerald" />
        </div>

        {model.available && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-800">Matriz de confusion</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded border border-emerald-200 bg-white p-3"><strong>{model.confusionMatrix?.trueNegative || 0}</strong><div className="text-xs text-slate-500">Verdadero 0</div></div>
                <div className="rounded border border-amber-200 bg-white p-3"><strong>{model.confusionMatrix?.falsePositive || 0}</strong><div className="text-xs text-slate-500">Falso 1</div></div>
                <div className="rounded border border-amber-200 bg-white p-3"><strong>{model.confusionMatrix?.falseNegative || 0}</strong><div className="text-xs text-slate-500">Falso 0</div></div>
                <div className="rounded border border-rose-200 bg-white p-3"><strong>{model.confusionMatrix?.truePositive || 0}</strong><div className="text-xs text-slate-500">Verdadero 1</div></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-black text-slate-800">Variables con mayor importancia</span>
                <span className="text-xs font-semibold text-slate-500">{model.featureCount || 0} variables codificadas</span>
              </div>
              <div className="mt-3 space-y-2">
                {(model.topFeatures || []).slice(0, 6).map((feature) => (
                  <div key={feature.name} className="grid grid-cols-[minmax(150px,0.8fr)_1.2fr_52px] items-center gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-600" title={feature.name}>{feature.name}</span>
                    <div className="h-2 overflow-hidden rounded bg-slate-100">
                      <div className="h-full rounded bg-violet-500" style={{ width: `${clamp((feature.importance / topFeatureMax) * 100, 2, 100)}%` }} />
                    </div>
                    <span className="text-right font-bold text-slate-500">{(feature.importance * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">Origen y transformacion</h2>
          <p className="mt-1 text-sm text-slate-500">Las columnas se obtienen de documentos reales y del historial anterior de cada cliente.</p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <CollectionPanel title="usuarios" tone="blue" fields={["createdAt", "reminderSettings", "notificationPreferences"]} />
          <CollectionPanel title="citas" tone="rose" fields={["userId", "serviceId", "fechaHora", "createdAt", "estado"]} />
          <CollectionPanel title="servicios" tone="emerald" fields={["nombre", "segmento", "subcategoria", "precio", "tiempo"]} />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-800">Variables X del DataFrame</h3>
            <span className="rounded bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">Y = citaCancelada</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {DATAFRAME_FIELDS.map((field) => (
              <span key={field} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {field}
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            La fecha se transforma en mes, dia, hora y fin de semana. Los campos fecha, cliente, id y estado se conservan solo para trazabilidad y no entrenan el modelo.
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Distribucion de la clase cancelada</span>
            <span>{summary.tasaCancelacion}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded bg-rose-500 transition-all duration-700" style={{ width: cancellationWidth }} />
          </div>
        </div>
      </section>

      <section id="clasificador-random-forest" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Prediccion con Random Forest</h2>
            <p className="mt-1 text-sm text-slate-500">La consulta se procesa en el servidor con el modelo entrenado sobre las citas.</p>
          </div>
          {prediction && <RiskBadge level={prediction.level} />}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <form onSubmit={submitPrediction}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="Mes de la cita" value={input.mesCita} options={MONTHS} onChange={(event) => setInput((previous) => ({ ...previous, mesCita: event.target.value }))} />
              <SelectField label="Dia de la semana" value={input.diaSemanaCita} options={options.diasSemana?.length ? options.diasSemana : DAY_OPTIONS} onChange={(event) => setInput((previous) => ({ ...previous, diaSemanaCita: event.target.value }))} />
              <label className="block"><span className="form-label">Hora</span><input className="form-input" type="number" min="0" max="23" value={input.horaCita} onChange={(event) => setInput((previous) => ({ ...previous, horaCita: event.target.value }))} /></label>

              <SelectField label="Servicio" value={input.servicio} options={options.servicios?.length ? options.servicios : [input.servicio || "Servicio"]} onChange={(event) => handleServiceChange(event.target.value)} />
              <SelectField label="Segmento" value={input.segmentoServicio} options={options.segmentos?.length ? options.segmentos : [input.segmentoServicio]} onChange={(event) => setInput((previous) => ({ ...previous, segmentoServicio: event.target.value }))} />
              <SelectField label="Subcategoria" value={input.subcategoriaServicio} options={options.subcategorias?.length ? options.subcategorias : [input.subcategoriaServicio]} onChange={(event) => setInput((previous) => ({ ...previous, subcategoriaServicio: event.target.value }))} />

              <label className="block"><span className="form-label">Precio del servicio</span><input className="form-input" type="number" min="0" value={input.precioServicio} onChange={(event) => setInput((previous) => ({ ...previous, precioServicio: event.target.value }))} /></label>
              <label className="block"><span className="form-label">Duracion en minutos</span><input className="form-input" type="number" min="15" value={input.duracionMinutos} onChange={(event) => setInput((previous) => ({ ...previous, duracionMinutos: event.target.value }))} /></label>
              <label className="block"><span className="form-label">Dias de anticipacion</span><input className="form-input" type="number" min="0" value={input.diasAnticipacion} onChange={(event) => setInput((previous) => ({ ...previous, diasAnticipacion: event.target.value }))} /></label>

              <label className="block"><span className="form-label">Citas previas</span><input className="form-input" type="number" min="0" value={input.citasPrevias} onChange={(event) => setInput((previous) => ({ ...previous, citasPrevias: event.target.value }))} /></label>
              <label className="block"><span className="form-label">Cancelaciones previas</span><input className="form-input" type="number" min="0" value={input.cancelacionesPrevias} onChange={(event) => setInput((previous) => ({ ...previous, cancelacionesPrevias: event.target.value }))} /></label>
              <label className="block"><span className="form-label">Dias desde registro</span><input className="form-input" type="number" min="0" value={input.diasDesdeRegistroCliente} onChange={(event) => setInput((previous) => ({ ...previous, diasDesdeRegistroCliente: event.target.value }))} /></label>

              <SelectField label="Canal de recordatorio" value={input.canalRecordatorio} options={options.canalesRecordatorio?.length ? options.canalesRecordatorio : [input.canalRecordatorio]} onChange={(event) => setInput((previous) => ({ ...previous, canalRecordatorio: event.target.value }))} />
              <label className="block"><span className="form-label">Anticipacion recordatorio (h)</span><input className="form-input" type="number" min="0" value={input.anticipacionRecordatorioHoras} onChange={(event) => setInput((previous) => ({ ...previous, anticipacionRecordatorioHoras: event.target.value }))} /></label>
              <label className="flex min-h-[66px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={input.recordatorioActivo} onChange={(event) => setInput((previous) => ({ ...previous, recordatorioActivo: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
                Recordatorio activo
              </label>
            </div>

            {predictionError && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{predictionError}</div>}

            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="cyan" disabled={predicting || !model.available} className="h-11 px-5 text-sm">
                <SidebarIcon name="predictive" className="h-4 w-4" />
                {predicting ? "Calculando..." : "Calcular riesgo"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs font-black uppercase text-slate-500">Resultado</div>
            {prediction ? (
              <>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-4xl font-black text-slate-900">{prediction.risk}%</div>
                    <div className="mt-1 text-sm font-semibold text-slate-500">Probabilidad de cancelacion</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">Clase</div>
                    <div className="text-3xl font-black text-violet-700">{prediction.predictedClass}</div>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded bg-white">
                  <div className={`h-full rounded ${prediction.level === "Alto" ? "bg-rose-500" : prediction.level === "Medio" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${prediction.risk}%` }} />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-600">Confianza de la clase: {prediction.confidence}%</div>
                <div className="mt-1 text-xs text-slate-500">Tasa historica calculada: {(prediction.tasaCancelacionPrevia * 100).toFixed(1)}%</div>
                <div className="mt-5 space-y-2">
                  {recommendations.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded bg-violet-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
                Sin prediccion calculada
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Dataset completo de clasificacion</h2>
            <p className="mt-1 text-sm text-slate-500">Una fila por cita; la columna Y se calcula desde el estado historico.</p>
          </div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_100px_auto]" onSubmit={(event) => { event.preventDefault(); void loadDataset(); }}>
            <input aria-label="Fecha inicial" className="form-input h-10 py-2 text-sm" type="date" value={filters.desde} onChange={(event) => setFilters((previous) => ({ ...previous, desde: event.target.value }))} />
            <input aria-label="Fecha final" className="form-input h-10 py-2 text-sm" type="date" value={filters.hasta} onChange={(event) => setFilters((previous) => ({ ...previous, hasta: event.target.value }))} />
            <select aria-label="Limite de filas" className="form-input h-10 py-2 text-sm" value={filters.limit} onChange={(event) => setFilters((previous) => ({ ...previous, limit: event.target.value }))}>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
            <Button type="submit" variant="cyan" className="h-10 px-4 text-sm">Cargar</Button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[2480px] text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Fecha*</th>
                <th className="px-3 py-3">Mes</th>
                <th className="px-3 py-3">Dia</th>
                <th className="px-3 py-3">Hora</th>
                <th className="px-3 py-3">Fin semana</th>
                <th className="px-3 py-3">Servicio</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3">Subcategoria</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">Duracion</th>
                <th className="px-3 py-3">Anticipacion</th>
                <th className="px-3 py-3">Recordatorio</th>
                <th className="px-3 py-3">Canal</th>
                <th className="px-3 py-3">Antic. record.</th>
                <th className="px-3 py-3">Citas previas</th>
                <th className="px-3 py-3">Cancel. previas</th>
                <th className="px-3 py-3">Tasa previa</th>
                <th className="px-3 py-3">Antiguedad</th>
                <th className="px-3 py-3 text-violet-700">Y</th>
                <th className="px-3 py-3">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">{row.fecha}</td>
                  <td className="px-3 py-3">{row.mesCita}</td>
                  <td className="px-3 py-3">{row.diaSemanaCita}</td>
                  <td className="px-3 py-3">{row.horaCita}:00</td>
                  <td className="px-3 py-3">{row.esFinSemana ? "Si" : "No"}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{row.servicio}</td>
                  <td className="px-3 py-3">{row.segmentoServicio}</td>
                  <td className="px-3 py-3">{row.subcategoriaServicio}</td>
                  <td className="px-3 py-3">{formatCurrency(row.precioServicio)}</td>
                  <td className="px-3 py-3">{row.duracionMinutos} min</td>
                  <td className="px-3 py-3">{row.diasAnticipacion} dias</td>
                  <td className="px-3 py-3">{row.recordatorioActivo ? "Si" : "No"}</td>
                  <td className="px-3 py-3">{row.canalRecordatorio}</td>
                  <td className="px-3 py-3">{row.anticipacionRecordatorioHoras} h</td>
                  <td className="px-3 py-3">{row.citasPrevias}</td>
                  <td className="px-3 py-3">{row.cancelacionesPrevias}</td>
                  <td className="px-3 py-3">{(row.tasaCancelacionPrevia * 100).toFixed(1)}%</td>
                  <td className="px-3 py-3">{row.diasDesdeRegistroCliente} dias</td>
                  <td className="px-3 py-3"><span className={`rounded px-2 py-1 text-xs font-black ${row.citaCancelada ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{row.citaCancelada}</span></td>
                  <td className="px-3 py-3"><button type="button" className="btn-view" onClick={() => loadRowAsInput(row)}>Probar fila</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold text-slate-500">
            * Fecha visible solo para trazabilidad. Mostrando {rows.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, rows.length)} de {rows.length} registros.
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Filas por pagina" className="form-input h-9 w-20 py-1 text-sm" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <Button type="button" variant="outline" className="h-9 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
            <span className="min-w-[72px] text-center text-xs font-bold text-slate-600">{page} / {totalPages}</span>
            <Button type="button" variant="outline" className="h-9 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
