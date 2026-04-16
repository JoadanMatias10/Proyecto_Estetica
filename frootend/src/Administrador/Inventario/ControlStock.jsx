import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const PRESENTATION_UNITS = [
  { value: "", label: "Sin presentacion" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "g", label: "Gramos (g)" },
];

const PRESENTATION_QUANTITIES = {
  ml: [30, 60, 100, 125, 200, 250, 500, 1000],
  g: [50, 100, 150, 250, 500, 1000],
};

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function getDefaultUsuario() {
  try {
    const raw = localStorage.getItem("adminUser");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.nombre || parsed?.username || "Admin";
  } catch (_error) {
    return "Admin";
  }
}

function formatDateValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTimeValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatPresentation(record) {
  const cantidad = Number(record?.cantidadMedida);
  const unidad = String(record?.unidadMedida || "").trim();
  if (Number.isFinite(cantidad) && cantidad > 0 && unidad) {
    return `${cantidad} ${unidad}`;
  }
  return "Sin presentacion";
}

function formatPresentationQuantityValue(value) {
  const cantidad = Number(value);
  return Number.isFinite(cantidad) && cantidad > 0 ? cantidad : "-";
}

function formatPresentationUnitValue(value) {
  const unidad = String(value || "").trim();
  return unidad || "-";
}

function buildProductOptionLabel(product) {
  if (!product) return "";
  const parts = [
    product.nombre || "Producto",
    product.marca || "Sin marca",
    product.categoria || "Sin categoria",
    formatPresentation(product),
  ];
  return parts.join(" | ");
}

function getUniqueSortedOptions(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function buildCsv(rows) {
  const header = ["Fecha", "Hora", "Producto", "Marca", "Categoria", "Presentacion", "Accion", "Cantidad", "Usuario", "Stock Anterior", "Stock Actual"];
  const lines = rows.map((row) => [
    formatDateValue(row.createdAt),
    formatTimeValue(row.createdAt),
    row.producto,
    row.marca || "",
    row.categoria || "",
    formatPresentation(row),
    row.accion,
    Number(row.cantidad || 0),
    row.usuario,
    Number(row.stockAnterior || 0),
    Number(row.stockActual || 0),
  ]);
  return [header, ...lines]
    .map((line) => line.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function ControlStock() {
  const [filter, setFilter] = useState("Todos");
  const [products, setProducts] = useState([]);
  const [categoryRecords, setCategoryRecords] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    producto: "",
    marca: "",
    categoria: "",
    cantidadMedida: "",
    unidadMedida: "",
    cantidad: "",
    accion: "Entrada",
    usuario: getDefaultUsuario(),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const [productsData, categoriesData, movementsData, alertsData] = await Promise.all([
        requestJson(endpoints.adminProducts, { token }),
        requestJson(endpoints.adminProductCategories, { token }),
        requestJson(endpoints.adminInventoryMovements({ action: filter }), { token }),
        requestJson(endpoints.adminInventoryAlerts(5), { token }),
      ]);
      setProducts(Array.isArray(productsData.products) ? productsData.products : []);
      setCategoryRecords(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
      setLogs(Array.isArray(movementsData.movements) ? movementsData.movements : []);
      setAlerts(Array.isArray(alertsData.alerts) ? alertsData.alerts : []);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const brandOptions = useMemo(
    () => getUniqueSortedOptions(products.map((product) => product?.marca)),
    [products]
  );

  const categoryOptions = useMemo(() => {
    return getUniqueSortedOptions(categoryRecords.map((category) => category?.nombre));
  }, [categoryRecords]);

  const unitOptions = useMemo(() => {
    return getUniqueSortedOptions([
      ...PRESENTATION_UNITS.map((unit) => unit.value).filter(Boolean),
      ...products.map((product) => product?.unidadMedida),
    ]);
  }, [products]);

  const presentationQuantityOptions = useMemo(() => {
    const selectedUnit = normalizeText(entryForm.unidadMedida);
    const catalogQuantities = PRESENTATION_QUANTITIES[selectedUnit] || [];
    const inventoryQuantities = products
      .filter((product) => {
        const productUnit = normalizeText(product?.unidadMedida);
        if (!selectedUnit) return !productUnit;
        return productUnit === selectedUnit;
      })
      .map((product) => Number(product?.cantidadMedida))
      .filter((quantity) => Number.isFinite(quantity) && quantity > 0);

    return Array.from(new Set([...catalogQuantities, ...inventoryQuantities])).sort((a, b) => a - b);
  }, [products, entryForm.unidadMedida]);

  const defaultBrand = useMemo(() => {
    const avyna = brandOptions.find((brand) => normalizeText(brand) === "avyna");
    return avyna || brandOptions[0] || "";
  }, [brandOptions]);

  const defaultUnit = useMemo(() => unitOptions[0] || "", [unitOptions]);

  const defaultQuantityForUnit = useCallback((unitValue) => {
    const normalizedUnit = normalizeText(unitValue);
    if (!normalizedUnit) return "";

    const quantities = Array.from(new Set([
      ...(PRESENTATION_QUANTITIES[normalizedUnit] || []),
      ...products
        .filter((product) => normalizeText(product?.unidadMedida) === normalizedUnit)
        .map((product) => Number(product?.cantidadMedida))
        .filter((quantity) => Number.isFinite(quantity) && quantity > 0),
    ])).sort((a, b) => a - b);

    return quantities[0] ? String(quantities[0]) : "";
  }, [products]);

  const openModal = () => {
    const initialUnit = defaultUnit;
    setEntryForm({
      producto: "",
      marca: defaultBrand,
      categoria: categoryOptions[0] || "",
      cantidadMedida: defaultQuantityForUnit(initialUnit),
      unidadMedida: initialUnit,
      cantidad: "",
      accion: "Entrada",
      usuario: getDefaultUsuario(),
    });
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEntryForm({
      producto: "",
      marca: "",
      categoria: "",
      cantidadMedida: "",
      unidadMedida: "",
      cantidad: "",
      accion: "Entrada",
      usuario: getDefaultUsuario(),
    });
  };

  const handleEntryChange = useCallback((event) => {
    const { name, value } = event.target;
    setEntryForm((prev) => {
      if (name === "unidadMedida") {
        const nextUnit = value;
        return {
          ...prev,
          unidadMedida: nextUnit,
          cantidadMedida: defaultQuantityForUnit(nextUnit),
        };
      }

      return { ...prev, [name]: value };
    });
  }, [defaultQuantityForUnit]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const nameCompare = String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", { sensitivity: "base" });
      if (nameCompare !== 0) return nameCompare;

      const categoryCompare = String(a?.categoria || "").localeCompare(String(b?.categoria || ""), "es", { sensitivity: "base" });
      if (categoryCompare !== 0) return categoryCompare;

      return toSafeNumber(a?.cantidadMedida) - toSafeNumber(b?.cantidadMedida);
    });
  }, [products]);

  const matchingProducts = useMemo(() => {
    const nombre = normalizeText(entryForm.producto);
    const categoria = normalizeText(entryForm.categoria);
    const marca = normalizeText(entryForm.marca);
    const unidadMedida = normalizeText(entryForm.unidadMedida);
    const cantidadMedida = Number(entryForm.cantidadMedida);
    const hasPresentationData = Boolean(unidadMedida || String(entryForm.cantidadMedida || "").trim());

    if (!nombre || !categoria) return [];

    return sortedProducts.filter((product) => {
      if (normalizeText(product.nombre) !== nombre) return false;
      if (normalizeText(product.categoria) !== categoria) return false;
      if (marca && normalizeText(product.marca) !== marca) return false;

      const productUnit = normalizeText(product.unidadMedida);
      const productQuantity = Number(product.cantidadMedida);
      const hasProductPresentation = Boolean(productUnit || (Number.isFinite(productQuantity) && productQuantity > 0));

      if (!hasPresentationData) {
        return !hasProductPresentation;
      }

      if (!unidadMedida || !Number.isFinite(cantidadMedida) || cantidadMedida <= 0) {
        return false;
      }

      return productUnit === unidadMedida && Number(productQuantity) === cantidadMedida;
    });
  }, [
    sortedProducts,
    entryForm.producto,
    entryForm.categoria,
    entryForm.marca,
    entryForm.unidadMedida,
    entryForm.cantidadMedida,
  ]);

  const selectedProduct = matchingProducts.length === 1 ? matchingProducts[0] : null;

  const lookupState = useMemo(() => {
    const nombre = normalizeText(entryForm.producto);
    const categoria = normalizeText(entryForm.categoria);
    const unidadMedida = normalizeText(entryForm.unidadMedida);
    const cantidadMedida = String(entryForm.cantidadMedida || "").trim();
    const hasPresentationData = Boolean(unidadMedida || cantidadMedida);

    if (!nombre || !categoria) return "idle";
    if (hasPresentationData && (!unidadMedida || !cantidadMedida)) return "incomplete";
    if (matchingProducts.length === 1) return "matched";
    if (matchingProducts.length > 1) return "multiple";
    return "not_found";
  }, [
    entryForm.producto,
    entryForm.categoria,
    entryForm.unidadMedida,
    entryForm.cantidadMedida,
    matchingProducts.length,
  ]);

  const hasInsufficientStock = useMemo(() => {
    if (!selectedProduct || entryForm.accion !== "Salida") return false;
    return toSafeNumber(entryForm.cantidad, 0) > toSafeNumber(selectedProduct.stock, 0);
  }, [selectedProduct, entryForm.accion, entryForm.cantidad]);

  const handleRegisterEntry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      if (!selectedProduct) {
        if (lookupState === "multiple") {
          throw new Error("Hay varias coincidencias. Completa mejor la marca o la presentacion.");
        }
        if (lookupState === "incomplete") {
          throw new Error("Completa cantidad y unidad de presentacion, o deja ambas vacias.");
        }
        throw new Error("No se encontro un producto valido con los datos capturados.");
      }
      await requestJson(endpoints.adminInventoryMovements({ action: "Todos" }), {
        method: "POST",
        token: getAdminToken(),
        body: {
          productId: selectedProduct.id,
          producto: selectedProduct.nombre,
          cantidad: Number(entryForm.cantidad),
          accion: entryForm.accion,
          usuario: entryForm.usuario.trim(),
        },
      });
      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible registrar movimiento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!logs.length) return;
    const now = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventario-${now}.csv`, buildCsv(logs));
  };

  const alertMessage = useMemo(() => {
    if (alerts.length === 0) return "Sin alertas de stock bajo.";
    return `${alerts.length} producto(s) con stock bajo.`;
  }, [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Control de Inventario</h1>
          <p className="text-slate-500 text-sm">Monitorea el stock y revisa el historial de movimientos.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={!logs.length}
            className="inline-flex items-center gap-2 px-2 py-2 text-violet-600 font-semibold hover:text-violet-700 transition-colors disabled:opacity-50"
          >
            <SidebarIcon name="reports" className="h-4 w-4" />
            <span>Descargar Reporte</span>
          </button>
          <Button
            variant="outline"
            onClick={openModal}
            aria-label="Registrar movimiento"
            title="Registrar movimiento"
            className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
          >
            +
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">!</span>
        <div>
          <h3 className="font-bold text-amber-800">Alertas de Stock Bajo</h3>
          <p className="text-sm text-amber-700 mb-2">{alertMessage}</p>
          {alerts.length > 0 && (
            <ul className="list-disc list-inside text-sm text-amber-800">
              {alerts.map((item) => (
                <li key={item.id}>
                  {buildProductOptionLabel(item)} ({item.stock} unidades)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Historial de Movimientos</h3>
          <select className="text-sm border-slate-300 rounded-lg" onChange={(e) => setFilter(e.target.value)} value={filter}>
            <option>Todos</option>
            <option>Entrada</option>
            <option>Salida</option>
          </select>
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando movimientos..." className="py-12" />
        ) : (
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[1520px] text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 min-w-[120px] whitespace-nowrap">Fecha</th>
                  <th className="px-6 py-4 min-w-[110px] whitespace-nowrap">Hora</th>
                  <th className="px-6 py-4 min-w-[260px] whitespace-nowrap">Producto</th>
                  <th className="px-6 py-4 min-w-[140px] whitespace-nowrap">Marca</th>
                  <th className="px-6 py-4 min-w-[230px] whitespace-nowrap">Categoria</th>
                  <th className="px-6 py-4 min-w-[170px] whitespace-nowrap">Cant. presentacion</th>
                  <th className="px-6 py-4 min-w-[110px] whitespace-nowrap">Unidad</th>
                  <th className="px-6 py-4 min-w-[120px] whitespace-nowrap">Accion</th>
                  <th className="px-6 py-4 min-w-[120px] whitespace-nowrap">Cantidad</th>
                  <th className="px-6 py-4 min-w-[240px] whitespace-nowrap">Usuario</th>
                  <th className="px-6 py-4 min-w-[130px] whitespace-nowrap">Stock Antes</th>
                  <th className="px-6 py-4 min-w-[140px] whitespace-nowrap">Stock Despues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateValue(log.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatTimeValue(log.createdAt)}</td>
                    <td className="px-6 py-4 min-w-[260px] font-medium text-slate-900">{log.producto}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.marca || "-"}</td>
                    <td className="px-6 py-4 min-w-[230px]">{log.categoria || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatPresentationQuantityValue(log.cantidadMedida)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatPresentationUnitValue(log.unidadMedida)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.accion === "Entrada" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold">{log.cantidad}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{log.usuario}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{Number(log.stockAnterior || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{Number(log.stockActual || 0)}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="12" className="px-6 py-8 text-center text-slate-400">
                      No hay movimientos para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Registrar movimiento" maxWidthClass="max-w-4xl">
        <form onSubmit={handleRegisterEntry} className="space-y-4">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0">
              <label className="form-label">Producto</label>
              <input
                name="producto"
                value={entryForm.producto}
                onChange={handleEntryChange}
                required
                className="form-input"
                placeholder="Nombre del producto"
              />
            </div>

            <div className="min-w-0">
              <label className="form-label">Marca</label>
              <select
                name="marca"
                value={entryForm.marca}
                onChange={handleEntryChange}
                className="form-input"
              >
                {brandOptions.length === 0 && <option value="">Sin marcas</option>}
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="min-w-0 md:col-span-5">
              <label className="form-label">Categoria</label>
              <select
                name="categoria"
                value={entryForm.categoria}
                onChange={handleEntryChange}
                required
                className="form-input"
              >
                {categoryOptions.length === 0 && <option value="">Sin categorias</option>}
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="min-w-0 md:col-span-3">
              <label className="form-label">Unidad</label>
              <select
                name="unidadMedida"
                value={entryForm.unidadMedida}
                onChange={handleEntryChange}
                className="form-input"
              >
                {PRESENTATION_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
                {unitOptions.filter((unit) => !PRESENTATION_UNITS.some((baseUnit) => baseUnit.value === unit)).map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="min-w-0 md:col-span-4">
              <label className="form-label">Cantidad presentacion</label>
              <select
                name="cantidadMedida"
                value={entryForm.cantidadMedida}
                onChange={handleEntryChange}
                className="form-input"
                disabled={!entryForm.unidadMedida}
              >
                <option value="">{entryForm.unidadMedida ? "Selecciona cantidad" : "Sin cantidad"}</option>
                {presentationQuantityOptions.map((quantity) => (
                  <option key={`${entryForm.unidadMedida}-${quantity}`} value={String(quantity)}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Marca, categoria, unidad y cantidad usan las opciones existentes del catalogo para que el movimiento coincida mejor con el inventario.
          </p>

          {lookupState === "multiple" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Hay varias coincidencias. Completa mejor la marca o la presentacion.
            </div>
          )}

          {lookupState === "incomplete" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Si usas presentacion, completa cantidad y unidad.
            </div>
          )}

          {lookupState === "not_found" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              No se encontro un producto con esos datos dentro del inventario.
            </div>
          )}

          {hasInsufficientStock && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              La salida supera el stock disponible de esta variante.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="min-w-0">
              <label className="form-label">Cantidad</label>
              <input
                name="cantidad"
                type="number"
                min="1"
                value={entryForm.cantidad}
                onChange={handleEntryChange}
                required
                className="form-input"
                placeholder="0"
              />
            </div>
            <div className="min-w-0">
              <label className="form-label">Accion</label>
              <select name="accion" value={entryForm.accion} onChange={handleEntryChange} className="form-input">
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Usuario</label>
            <input
              name="usuario"
              value={entryForm.usuario}
              onChange={handleEntryChange}
              className="form-input"
              placeholder="Admin"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || hasInsufficientStock || !selectedProduct}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
