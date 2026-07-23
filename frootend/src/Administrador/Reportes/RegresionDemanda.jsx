import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FIELD_LABELS = {
  periodo: "Periodo",
  periodoSiguiente: "Periodo objetivo",
  indiceMes: "Indice mes",
  anio: "Anio",
  mes: "Mes",
  trimestre: "Trimestre",
  mesObjetivo: "Mes objetivo",
  trimestreObjetivo: "Trim. objetivo",
  producto: "Producto",
  categoria: "Categoria",
  marca: "Marca",
  transaccionesMes: "Transacciones",
  unidadesVendidasMes: "Unidades mes",
  unidadesMesAnterior: "Unidades previas",
  promedioMovil3Meses: "Promedio 3 meses",
  promedioHistoricoProducto: "Promedio historico",
  unidadesMismoMesAnioAnterior: "Mismo mes ano anterior",
  demandaCategoriaMes: "Demanda categoria",
  participacionCategoriaMes: "Participacion categoria",
  diasConVenta: "Dias con venta",
  precioPromedio: "Precio promedio",
  ingresoMes: "Ingreso mes",
  ticketPromedioProducto: "Ticket promedio",
  proporcionEfectivo: "% Efectivo",
  proporcionTarjeta: "% Tarjeta",
  proporcionTransferencia: "% Transferencia",
  demandaMesSiguiente: "Y: demanda siguiente",
};
const TABLE_COLUMNS = [
  "periodo",
  "periodoSiguiente",
  "producto",
  "categoria",
  "marca",
  "indiceMes",
  "anio",
  "mes",
  "trimestre",
  "mesObjetivo",
  "trimestreObjetivo",
  "transaccionesMes",
  "unidadesVendidasMes",
  "unidadesMesAnterior",
  "promedioMovil3Meses",
  "promedioHistoricoProducto",
  "unidadesMismoMesAnioAnterior",
  "demandaCategoriaMes",
  "participacionCategoriaMes",
  "diasConVenta",
  "precioPromedio",
  "ingresoMes",
  "ticketPromedioProducto",
  "proporcionEfectivo",
  "proporcionTarjeta",
  "proporcionTransferencia",
  "demandaMesSiguiente",
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
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

function normalizeRow(row) {
  const numericFields = Object.keys(FIELD_LABELS).filter((key) => ![
    "periodo", "periodoSiguiente", "producto", "categoria", "marca", "demandaMesSiguiente",
  ].includes(key));
  const normalized = { ...row };
  numericFields.forEach((key) => {
    normalized[key] = toNumber(row[key]);
  });
  normalized.demandaMesSiguiente = row.demandaMesSiguiente === null
    ? null
    : toNumber(row.demandaMesSiguiente);
  return normalized;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadDataset(rows, datasetColumns) {
  const columns = ["periodo", "periodoSiguiente", "productId", ...datasetColumns];
  const csv = [columns, ...rows.map((row) => columns.map((key) => row[key]))]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dataset-regresion-demanda-productos.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function formatCell(key, value) {
  if (key === "demandaMesSiguiente" && value === null) return "Pendiente";
  if (["precioPromedio", "ingresoMes", "ticketPromedioProducto"].includes(key)) return formatCurrency(value);
  if (["participacionCategoriaMes", "proporcionEfectivo", "proporcionTarjeta", "proporcionTransferencia"].includes(key)) {
    return `${(toNumber(value) * 100).toFixed(1)}%`;
  }
  if (["promedioMovil3Meses", "promedioHistoricoProducto"].includes(key)) return formatDecimal(value, 2);
  return value ?? "N/D";
}

function StatCard({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div className={`min-h-[104px] rounded-lg border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-bold uppercase">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      {detail && <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>}
    </div>
  );
}

function CollectionCard({ title, fields, tone }) {
  const styles = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="flex items-center gap-2 text-sm font-black">
        <SidebarIcon name="database" className="h-4 w-4" />
        {title}
      </div>
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

export default function RegresionDemanda() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [model, setModel] = useState({ available: false });
  const [meta, setMeta] = useState({ datasetColumns: [] });
  const [products, setProducts] = useState([]);
  const [periodDemand, setPeriodDemand] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [tableProduct, setTableProduct] = useState("");
  const [tablePeriod, setTablePeriod] = useState("");
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
      const data = await requestJson(endpoints.adminSalesRegressionDataset, { token: getAdminToken() });
      const normalizedRows = Array.isArray(data.dataset) ? data.dataset.map(normalizeRow) : [];
      const productOptions = Array.isArray(data.options?.products) ? data.options.products : [];
      setRows(normalizedRows);
      setSummary(data.summary || {});
      setModel(data.model || { available: false });
      setMeta(data.meta || { datasetColumns: [] });
      setProducts(productOptions);
      setPeriodDemand(Array.isArray(data.periodDemand) ? data.periodDemand : []);
      setSelectedProduct((current) => current || productOptions[0]?.id || "");
      setPrediction(null);
      setPage(1);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible generar el dataset de regresion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataset();
    // La carga inicial entrena y deja el modelo en cache para las predicciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availablePeriods = useMemo(
    () => Array.from(new Set(rows.map((row) => row.periodo))).sort().reverse(),
    [rows]
  );
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (tableProduct && row.productId !== tableProduct) return false;
    if (tablePeriod && row.periodo !== tablePeriod) return false;
    return true;
  }), [rows, tableProduct, tablePeriod]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const maxMonthlyDemand = Math.max(1, ...periodDemand.map((entry) => toNumber(entry.units)));
  const improvement = model.baselineMae > 0
    ? Math.max(0, (1 - (toNumber(model.mae) / toNumber(model.baselineMae))) * 100)
    : 0;

  const handlePredict = async () => {
    if (!selectedProduct) return;
    setPredicting(true);
    setPredictionError("");
    setPrediction(null);
    try {
      const data = await requestJson(endpoints.adminSalesRegressionPredict, {
        method: "POST",
        token: getAdminToken(),
        body: { productId: selectedProduct },
      });
      setPrediction(data.prediction || null);
    } catch (error) {
      setPredictionError(error.message || "No fue posible calcular la demanda.");
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Construyendo dataset mensual y entrenando Random Forest..." />;
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-black uppercase text-blue-800">Propuesta 2</span>
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-black uppercase text-emerald-800">Regresion</span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-900">Demanda mensual de productos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Random Forest Regressor para estimar cuantas unidades se venderan durante el siguiente mes.
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Ventas sinteticas" value={formatInteger(summary.syntheticTransactions)} detail={`${formatInteger(summary.sourceTransactions)} ventas activas utilizadas`} tone="blue" />
        <StatCard label="Productos" value={formatInteger(summary.products)} detail={`${formatInteger(summary.itemLines)} lineas de venta`} tone="emerald" />
        <StatCard label="Dataset mensual" value={formatInteger(summary.transformedRows)} detail={`${formatInteger(summary.labelledRows)} filas con Y conocida`} tone="amber" />
        <StatCard label="Meses analizados" value={formatInteger(summary.periods)} detail={`${formatDate(summary.firstDate)} a ${formatDate(summary.lastDate)}`} tone="slate" />
        <StatCard label="Mayor demanda" value={summary.highestDemandPeriod?.periodo || "N/D"} detail={`${formatInteger(summary.highestDemandPeriod?.units)} unidades`} tone="rose" />
      </div>

      <section className="border-y border-slate-200 bg-white py-5">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900">Origen y transformacion del dataset</h2>
          <p className="mt-1 text-sm text-slate-500">
            Union por <code>ventas.items.productId</code> con <code>productos._id</code>.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.1fr]">
          <CollectionCard
            title="Coleccion: ventas"
            tone="blue"
            fields={["createdAt", "metodoPago", "items.productId", "items.producto", "items.cantidad", "items.precioUnitario", "items.subtotal", "estado", "usuario"]}
          />
          <CollectionCard
            title="Coleccion: productos"
            tone="emerald"
            fields={["_id", "nombre", "categoria", "marca", "precio", "stock"]}
          />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-center gap-2 text-sm font-black">
              <SidebarIcon name="predictive" className="h-4 w-4" /> Dataset producto + mes
            </div>
            <p className="mt-3 text-sm leading-6">
              `createdAt` se transforma en anio, mes, trimestre, mes objetivo e indice cronologico. Se agregan cantidades,
              transacciones, ingresos, precios, formas de pago y antecedentes mensuales.
            </p>
            <p className="mt-2 text-xs font-bold">La fecha original es trazabilidad y no entra al entrenamiento.</p>
          </div>
        </div>
      </section>

      <section id="pronostico-demanda" className="scroll-mt-24 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Variables del modelo</h2>
            <p className="mt-1 text-sm text-slate-500">
              X: historial conocido del producto. Y: unidades vendidas en `{meta.target || "demandaMesSiguiente"}`.
            </p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <strong>Variable Y:</strong> demandaMesSiguiente, valor numerico continuo utilizado para planear compras y stock.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(meta.datasetColumns || []).map((column) => (
            <span
              key={column}
              className={`rounded px-2 py-1 text-xs font-bold ${column === meta.target ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}
            >
              {column === meta.target ? `Y: ${column}` : `X: ${column}`}
            </span>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 pb-6">
        <h2 className="text-lg font-black text-slate-900">Evaluacion del Random Forest Regressor</h2>
        <p className="mt-1 text-sm text-slate-500">Prueba cronologica con los cuatro meses mas recientes del historial conocido.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="MAE" value={`${formatDecimal(model.mae)} uds.`} detail="Error absoluto promedio" tone="emerald" />
          <StatCard label="RMSE" value={`${formatDecimal(model.rmse)} uds.`} detail="Penaliza errores grandes" tone="blue" />
          <StatCard label="R cuadrada" value={formatDecimal(model.r2, 3)} detail="Ajuste sobre meses futuros" tone="amber" />
          <StatCard label="Mejora vs. base" value={`${formatDecimal(improvement, 1)}%`} detail={`Base: ${formatDecimal(model.baselineMae)} uds.`} tone="rose" />
          <StatCard label="Entrenamiento" value={formatInteger(model.trainingRows)} detail={`${formatInteger(model.testRows)} filas de prueba`} tone="slate" />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-black text-slate-800">Variables con mayor importancia</h3>
            <div className="mt-3 space-y-2">
              {(model.topFeatures || []).map((feature) => (
                <div key={feature.name} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 truncate text-xs font-semibold text-slate-600" title={feature.name}>{feature.name}</div>
                    <div className="h-2 overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(2, toNumber(feature.importance) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right text-xs font-black text-slate-700">{(toNumber(feature.importance) * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Demanda observada por periodo</h3>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
              {periodDemand.map((entry) => (
                <div key={entry.periodo} className="grid grid-cols-[72px_minmax(0,1fr)_70px] items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">{entry.periodo}</span>
                  <div className="h-3 overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.max(2, (toNumber(entry.units) / maxMonthlyDemand) * 100)}%` }} />
                  </div>
                  <span className="text-right font-black text-slate-700">{formatInteger(entry.units)} uds.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 pb-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="text-lg font-black text-slate-900">Pronostico por producto</h2>
            <p className="mt-1 text-sm text-slate-500">El modelo toma el ultimo mes disponible y estima el siguiente.</p>
            <label className="mt-4 block">
              <span className="form-label">Producto</span>
              <select className="form-input" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.nombre} | {product.categoria}</option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="indigo"
              className="mt-4 w-full gap-2 px-4 py-3"
              disabled={!selectedProduct || predicting || !model.available}
              onClick={handlePredict}
            >
              <SidebarIcon name="predictive" className="h-4 w-4" />
              {predicting ? "Calculando..." : "Predecir demanda"}
            </Button>
            {predictionError && <p className="mt-3 text-sm font-semibold text-rose-700">{predictionError}</p>}
          </div>
          <div className="min-h-[220px] rounded-lg border border-slate-200 bg-slate-50 p-5">
            {!prediction ? (
              <div className="flex min-h-[178px] items-center justify-center text-center text-sm font-semibold text-slate-400">
                Pronostico pendiente
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase text-slate-500">{prediction.forecastPeriod}</div>
                    <h3 className="mt-1 text-lg font-black text-slate-900">{prediction.producto}</h3>
                    <p className="text-sm text-slate-500">{prediction.categoria} | {prediction.marca}</p>
                  </div>
                  <span className="rounded bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-800">Random Forest</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Demanda estimada" value={`${formatDecimal(prediction.predictedDemand)} uds.`} tone="blue" />
                  <StatCard label="Stock actual" value={`${formatInteger(prediction.stockActual)} uds.`} tone="emerald" />
                  <StatCard label="Reposicion sugerida" value={`${formatInteger(prediction.restockSuggested)} uds.`} tone={prediction.restockSuggested > 0 ? "rose" : "slate"} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-600">
                  {prediction.restockSuggested > 0
                    ? `El stock no cubre la demanda estimada; se sugieren al menos ${formatInteger(prediction.restockSuggested)} unidades adicionales.`
                    : prediction.coverageMonths === null
                      ? "La demanda estimada es cero; no se requiere reposicion por este pronostico."
                      : `El inventario cubre aproximadamente ${formatDecimal(prediction.coverageMonths)} meses al ritmo estimado.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Dataset transformado</h2>
            <p className="mt-1 text-sm text-slate-500">{formatInteger(filteredRows.length)} filas visibles de {formatInteger(rows.length)}.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span className="form-label">Producto</span>
              <select className="form-input" value={tableProduct} onChange={(event) => { setTableProduct(event.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
              </select>
            </label>
            <label>
              <span className="form-label">Periodo</span>
              <select className="form-input" value={tablePeriod} onChange={(event) => { setTablePeriod(event.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {availablePeriods.map((period) => <option key={period} value={period}>{period}</option>)}
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
          <table className="min-w-[3500px] border-collapse text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column} className={`whitespace-nowrap border-b border-slate-200 px-3 py-3 font-black ${column === "demandaMesSiguiente" ? "bg-rose-100 text-rose-800" : ""}`}>
                    {FIELD_LABELS[column] || column}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-3 font-black">Accion</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={`${row.productId}-${row.periodo}`} className="border-b border-slate-100 hover:bg-slate-50">
                  {TABLE_COLUMNS.map((column) => (
                    <td key={column} className={`whitespace-nowrap px-3 py-2.5 ${column === "demandaMesSiguiente" ? "bg-rose-50 font-black text-rose-800" : "text-slate-600"}`}>
                      {formatCell(column, row[column])}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="rounded bg-indigo-100 px-2 py-1 font-bold text-indigo-700 hover:bg-indigo-200"
                      onClick={() => {
                        setSelectedProduct(row.productId);
                        document.getElementById("pronostico-demanda")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Seleccionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-slate-500">Pagina {safePage} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button>
          </div>
        </div>
      </section>
    </div>
  );
}
