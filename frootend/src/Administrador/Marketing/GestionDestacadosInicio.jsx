import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const HOME_HIGHLIGHTS_STORAGE_KEY = "admin.home.highlights.v1";

const TAB_CONFIG = [
  {
    key: "products",
    label: "Productos",
    icon: "products",
    emptyTitle: "No hay productos disponibles",
    emptyDescription: "Primero registra productos en el catalogo para poder destacarlos en la pagina principal.",
    highlightLabel: "productos",
  },
  {
    key: "services",
    label: "Servicios",
    icon: "services",
    emptyTitle: "No hay servicios disponibles",
    emptyDescription: "Primero registra servicios para poder seleccionarlos como destacados del inicio.",
    highlightLabel: "servicios",
  },
  {
    key: "promotions",
    label: "Promociones",
    icon: "promotions",
    emptyTitle: "No hay promociones disponibles",
    emptyDescription: "Cuando registres promociones, podras elegir cuales se muestran en el inicio.",
    highlightLabel: "promociones",
  },
];

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function readStoredHighlights() {
  try {
    const rawValue = localStorage.getItem(HOME_HIGHLIGHTS_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    return {
      products: Array.isArray(parsed?.products) ? parsed.products.map(String) : [],
      services: Array.isArray(parsed?.services) ? parsed.services.map(String) : [],
      promotions: Array.isArray(parsed?.promotions) ? parsed.promotions.map(String) : [],
    };
  } catch (_error) {
    return null;
  }
}

function writeStoredHighlights(value) {
  localStorage.setItem(HOME_HIGHLIGHTS_STORAGE_KEY, JSON.stringify({
    products: Array.isArray(value?.products) ? value.products : [],
    services: Array.isArray(value?.services) ? value.services : [],
    promotions: Array.isArray(value?.promotions) ? value.promotions : [],
  }));
}

function intersectIds(selectedIds, items) {
  const availableIds = new Set((Array.isArray(items) ? items : []).map((item) => item.id));
  return (Array.isArray(selectedIds) ? selectedIds : []).filter((id) => availableIds.has(id));
}

function getHighlightsAdminErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

function normalizeProductPresentation(item) {
  const rawUnit = String(item?.unidadMedida || "").trim().toLowerCase();
  const rawQuantity = Number(item?.cantidadMedida);
  const hasValidUnit = rawUnit === "ml" || rawUnit === "g";
  const hasValidQuantity = Number.isFinite(rawQuantity) && rawQuantity > 0;

  if (!hasValidUnit || !hasValidQuantity) {
    return {
      unidadMedida: "",
      cantidadMedida: "",
    };
  }

  return {
    unidadMedida: rawUnit,
    cantidadMedida: rawQuantity,
  };
}

function buildProductUpdatePayload(item, destacadoInicio) {
  const presentation = normalizeProductPresentation(item);

  return {
    nombre: String(item?.nombre || "").trim(),
    marca: String(item?.marca || "").trim(),
    precio: Number(item?.precio || 0),
    stock: Number(item?.stock || 0),
    categoria: String(item?.categoria || "").trim(),
    descripcion: String(item?.descripcion || "").trim(),
    rating: Number(item?.rating || 4.8),
    unidadMedida: presentation.unidadMedida,
    cantidadMedida: presentation.cantidadMedida === "" ? "" : String(presentation.cantidadMedida),
    destacadoInicio,
  };
}

function buildServiceUpdatePayload(item, destacadoInicio) {
  const galleryImages = Array.isArray(item?.galeriaImagenes) ? item.galeriaImagenes : [];

  return {
    nombre: String(item?.nombre || "").trim(),
    segmento: String(item?.segmento || "").trim(),
    subcategoria: String(item?.subcategoria || "").trim(),
    precio: Number(item?.precio || 0),
    tiempo: String(item?.tiempo || "").trim(),
    descripcion: String(item?.descripcion || "").trim(),
    galeriaImagenesActivas: JSON.stringify(galleryImages.map((image) => Boolean(image?.url))),
    destacadoInicio,
  };
}

function buildPromotionUpdatePayload(item, destacadoInicio) {
  return {
    titulo: String(item?.titulo || "").trim(),
    descripcion: String(item?.descripcion || "").trim(),
    descuento: String(item?.descuento || "").trim(),
    estado: String(item?.estado || "Activa").trim() || "Activa",
    destacadoInicio,
  };
}

function getChangedItems(items, selectedIds, savedIds) {
  const selectedSet = new Set(selectedIds);
  const savedSet = new Set(savedIds);

  return (Array.isArray(items) ? items : []).filter((item) => {
    const isSelected = selectedSet.has(item.id);
    const wasSelected = savedSet.has(item.id);
    return isSelected !== wasSelected;
  });
}

async function saveHighlightsWithFallback({ catalog, selectedIds, savedIds, token }) {
  try {
    await requestJson(endpoints.adminHomeHighlights, {
      method: "PUT",
      token,
      body: {
        productIds: selectedIds.products,
        serviceIds: selectedIds.services,
        promotionIds: selectedIds.promotions,
      },
    });
    return;
  } catch (error) {
    if (Number(error?.status) !== 404) {
      throw error;
    }
  }

  const changedProducts = getChangedItems(catalog.products, selectedIds.products, savedIds.products);
  const changedServices = getChangedItems(catalog.services, selectedIds.services, savedIds.services);
  const changedPromotions = getChangedItems(catalog.promotions, selectedIds.promotions, savedIds.promotions);

  await Promise.all([
    ...changedProducts.map((item) =>
      requestJson(endpoints.adminProductById(item.id), {
        method: "PUT",
        token,
        body: buildProductUpdatePayload(item, selectedIds.products.includes(item.id)),
      })
    ),
    ...changedServices.map((item) =>
      requestJson(endpoints.adminServiceById(item.id), {
        method: "PUT",
        token,
        body: buildServiceUpdatePayload(item, selectedIds.services.includes(item.id)),
      })
    ),
    ...changedPromotions.map((item) =>
      requestJson(endpoints.adminPromotionById(item.id), {
        method: "PUT",
        token,
        body: buildPromotionUpdatePayload(item, selectedIds.promotions.includes(item.id)),
      })
    ),
  ]);
}

function buildSelectedIds(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.destacadoInicio)
    .map((item) => item.id);
}

function sortIds(ids) {
  return [...ids].sort((a, b) => String(a).localeCompare(String(b)));
}

function areSameIds(a, b) {
  const left = sortIds(a);
  const right = sortIds(b);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function filterItems(items, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const haystack = [
      item?.nombre,
      item?.titulo,
      item?.descripcion,
      item?.categoria,
      item?.marca,
      item?.segmento,
      item?.subcategoria,
      item?.descuento,
      item?.estado,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function buildItemsWithSelection(items, selectedIds) {
  const selectedSet = new Set(selectedIds);
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    destacadoInicio: selectedSet.has(item.id),
  }));
}

function SummaryCard({ title, count, icon, accentClass, textClass }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentClass}`}>
          <SidebarIcon name={icon} className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`text-3xl font-bold ${textClass}`}>{count}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Si queda en `0`, esa seccion no aparece en el inicio publico.
      </p>
    </div>
  );
}

function ProductCard({ item, selected, onToggle }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-100 to-rose-100">
          {item.imagen ? (
            <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-violet-500">
              <SidebarIcon name="products" className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {item.categoria ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                {item.categoria}
              </span>
            ) : null}
            {item.marca ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {item.marca}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 truncate text-lg font-bold text-slate-800">{item.nombre}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.descripcion || "Sin descripcion."}</p>
          <p className="mt-3 text-sm font-semibold text-rose-600">${Number(item.precio || 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Inicio publico</p>
          <p className="text-xs text-slate-500">
            {selected ? "Este producto si aparecera en home." : "Este producto no aparecera en home."}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            selected
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          }`}
        >
          {selected ? "Destacado" : "Oculto"}
        </button>
      </div>
    </div>
  );
}

function ServiceCard({ item, selected, onToggle }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100">
          {item.imagen ? (
            <img src={item.imagen} alt={item.nombre} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-cyan-600">
              <SidebarIcon name="services" className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {item.segmento ? (
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                {item.segmento}
              </span>
            ) : null}
            {item.subcategoria ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                {item.subcategoria}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 truncate text-lg font-bold text-slate-800">{item.nombre}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.descripcion || "Sin descripcion."}</p>
          <p className="mt-3 text-sm font-semibold text-rose-600">
            ${Number(item.precio || 0).toFixed(2)} · {item.tiempo || "Tiempo no definido"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Inicio publico</p>
          <p className="text-xs text-slate-500">
            {selected ? "Este servicio si aparecera en home." : "Este servicio no aparecera en home."}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            selected
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          }`}
        >
          {selected ? "Destacado" : "Oculto"}
        </button>
      </div>
    </div>
  );
}

function PromotionCard({ item, selected, onToggle }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 text-rose-600">
          <SidebarIcon name="promotions" className="h-6 w-6" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.estado === "Activa" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {item.estado}
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
            {item.descuento}
          </span>
        </div>
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-800">{item.titulo}</h3>
      <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-slate-500">
        {item.descripcion || "Sin descripcion."}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Inicio publico</p>
          <p className="text-xs text-slate-500">
            {selected ? "Esta promocion quedo marcada para home." : "Esta promocion no se mostrara en home."}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            selected
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          }`}
        >
          {selected ? "Destacada" : "Oculta"}
        </button>
      </div>

      {item.estado !== "Activa" ? (
        <p className="mt-3 text-xs text-amber-600">
          Esta promocion solo aparecera en home cuando tambien este activa.
        </p>
      ) : null}
    </div>
  );
}

function FeaturedItemCard({ tabKey, item, selected, onToggle }) {
  if (tabKey === "products") {
    return <ProductCard item={item} selected={selected} onToggle={onToggle} />;
  }
  if (tabKey === "services") {
    return <ServiceCard item={item} selected={selected} onToggle={onToggle} />;
  }
  return <PromotionCard item={item} selected={selected} onToggle={onToggle} />;
}

export default function GestionDestacadosInicio() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [catalog, setCatalog] = useState({
    products: [],
    services: [],
    promotions: [],
  });
  const [selectedIds, setSelectedIds] = useState({
    products: [],
    services: [],
    promotions: [],
  });
  const [savedIds, setSavedIds] = useState({
    products: [],
    services: [],
    promotions: [],
  });

  useEffect(() => {
    let isMounted = true;

    const loadHighlights = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const token = getAdminToken();
        const [productsData, servicesData, promotionsData] = await Promise.all([
          requestJson(endpoints.adminProducts, { token }),
          requestJson(endpoints.adminServices, { token }),
          requestJson(endpoints.adminPromotions, { token }),
        ]);

        if (!isMounted) return;

        const nextCatalog = {
          products: Array.isArray(productsData.products) ? productsData.products : [],
          services: Array.isArray(servicesData.services) ? servicesData.services : [],
          promotions: Array.isArray(promotionsData.promotions) ? promotionsData.promotions : [],
        };
        const nextSelectedIds = {
          products: buildSelectedIds(nextCatalog.products),
          services: buildSelectedIds(nextCatalog.services),
          promotions: buildSelectedIds(nextCatalog.promotions),
        };
        const storedHighlights = readStoredHighlights();
        const shouldUseStoredHighlights =
          nextSelectedIds.products.length === 0 &&
          nextSelectedIds.services.length === 0 &&
          nextSelectedIds.promotions.length === 0 &&
          storedHighlights;
        const effectiveSelectedIds = shouldUseStoredHighlights
          ? {
            products: intersectIds(storedHighlights.products, nextCatalog.products),
            services: intersectIds(storedHighlights.services, nextCatalog.services),
            promotions: intersectIds(storedHighlights.promotions, nextCatalog.promotions),
          }
          : nextSelectedIds;

        setCatalog(nextCatalog);
        setSelectedIds(effectiveSelectedIds);
        setSavedIds(effectiveSelectedIds);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getHighlightsAdminErrorMessage(error, "No fue posible cargar los destacados de inicio."));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHighlights();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCount = {
    products: selectedIds.products.length,
    services: selectedIds.services.length,
    promotions: selectedIds.promotions.length,
  };

  const hasChanges = !(
    areSameIds(selectedIds.products, savedIds.products) &&
    areSameIds(selectedIds.services, savedIds.services) &&
    areSameIds(selectedIds.promotions, savedIds.promotions)
  );

  const activeItems = useMemo(() => catalog[activeTab] || [], [activeTab, catalog]);
  const filteredItems = useMemo(
    () => filterItems(activeItems, searchTerm),
    [activeItems, searchTerm]
  );

  const activeSelectedSet = useMemo(
    () => new Set(selectedIds[activeTab] || []),
    [activeTab, selectedIds]
  );

  const handleToggle = (tabKey, itemId) => {
    setSuccessMessage("");
    setSelectedIds((prev) => {
      const currentIds = prev[tabKey] || [];
      const nextIds = currentIds.includes(itemId)
        ? currentIds.filter((id) => id !== itemId)
        : [...currentIds, itemId];

      return {
        ...prev,
        [tabKey]: nextIds,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await saveHighlightsWithFallback({
        catalog,
        selectedIds,
        savedIds,
        token: getAdminToken(),
      });

      const nextCatalog = {
        products: buildItemsWithSelection(catalog.products, selectedIds.products),
        services: buildItemsWithSelection(catalog.services, selectedIds.services),
        promotions: buildItemsWithSelection(catalog.promotions, selectedIds.promotions),
      };

      setCatalog(nextCatalog);
      setSavedIds({
        products: [...selectedIds.products],
        services: [...selectedIds.services],
        promotions: [...selectedIds.promotions],
      });
      writeStoredHighlights(selectedIds);
      setSuccessMessage("Los destacados de inicio se guardaron correctamente.");
      window.dispatchEvent(new CustomEvent("homeHighlightsUpdated"));
    } catch (error) {
      setErrorMessage(getHighlightsAdminErrorMessage(error, "No fue posible guardar los destacados."));
    } finally {
      setSaving(false);
    }
  };

  const activeTabMeta = TAB_CONFIG.find((tab) => tab.key === activeTab) || TAB_CONFIG[0];

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-r from-white via-amber-50/60 to-rose-50/60 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 shadow-sm">
              <SidebarIcon name="highlights" className="h-4 w-4" />
              Destacados de inicio
            </div>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">Controla lo que se muestra en la portada</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Aqui eliges que productos, servicios y promociones aparecen en el home publico. Si dejas una categoria sin seleccion, esa seccion desaparece por completo del inicio.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-6 py-3"
            >
              {saving ? "Guardando..." : "Guardar destacados"}
            </Button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Productos destacados"
          count={selectedCount.products}
          icon="products"
          accentClass="bg-violet-100 text-violet-600"
          textClass="text-violet-700"
        />
        <SummaryCard
          title="Servicios destacados"
          count={selectedCount.services}
          icon="services"
          accentClass="bg-cyan-100 text-cyan-600"
          textClass="text-cyan-700"
        />
        <SummaryCard
          title="Promociones destacadas"
          count={selectedCount.promotions}
          icon="promotions"
          accentClass="bg-amber-100 text-amber-600"
          textClass="text-amber-700"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_CONFIG.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSearchTerm("");
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <SidebarIcon name={tab.icon} className="h-4 w-4" />
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>
                    {selectedCount[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SidebarIcon name="search" className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Buscar ${activeTabMeta.highlightLabel}...`}
              className="search-input pl-10"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
          La portada solo mostrara los elementos marcados como destacados en esta pantalla.
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando destacados..." className="py-16" />
        ) : filteredItems.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <FeaturedItemCard
                key={item.id}
                tabKey={activeTab}
                item={item}
                selected={activeSelectedSet.has(item.id)}
                onToggle={() => handleToggle(activeTab, item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <SidebarIcon name={activeTabMeta.icon} className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-800">
              {activeItems.length > 0 ? "No encontramos coincidencias" : activeTabMeta.emptyTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              {activeItems.length > 0
                ? "Prueba con otra busqueda para encontrar lo que quieres destacar en el home."
                : activeTabMeta.emptyDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
