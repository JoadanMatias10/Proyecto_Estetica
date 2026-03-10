import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function getCategoryNames(records) {
  const unique = new Set(
    (Array.isArray(records) ? records : [])
      .map((record) => record?.nombre)
      .filter(Boolean)
  );
  return Array.from(unique);
}

const PRESENTATION_UNITS = [
  { value: "ml", label: "Mililitros (ml)" },
  { value: "g", label: "Gramos (g)" },
];

const PRESENTATION_QUANTITIES = {
  ml: [30, 60, 125, 250, 500, 1000],
  g: [50, 100, 150, 250, 500, 1000],
};

const DEFAULT_PRESENTATION_QUANTITY = {
  ml: 250,
  g: 250,
};

function getDefaultPresentationQuantity(unit) {
  const options = PRESENTATION_QUANTITIES[unit];
  const preferred = DEFAULT_PRESENTATION_QUANTITY[unit];
  if (options?.includes(preferred)) return preferred;
  return options?.[0] ?? 0;
}

const getDefaultFormValues = (product, categories, brands) => {
  const categoria = product?.categoria && categories.includes(product.categoria)
    ? product.categoria
    : (categories[0] || "");

  const unitFromProduct = String(product?.unidadMedida || "").toLowerCase();
  const unidadMedida = PRESENTATION_UNITS.some((unit) => unit.value === unitFromProduct)
    ? unitFromProduct
    : PRESENTATION_UNITS[0].value;

  const parsedCantidad = Number(product?.cantidadMedida);
  const cantidadMedida = Number.isFinite(parsedCantidad) && parsedCantidad > 0
    ? parsedCantidad
    : getDefaultPresentationQuantity(unidadMedida);

  return {
    nombre: product?.nombre || "",
    marca: product?.marca || brands[0] || "",
    precio: product?.precio ?? "",
    stock: product?.stock ?? "",
    categoria,
    descripcion: product?.descripcion || "",
    imagen: product?.imagen || "",
    imagenNombre: product?.imagenNombre || "",
    unidadMedida,
    cantidadMedida: String(cantidadMedida),
  };
};

export default function CatalogoProductosAdmin() {
  const [productos, setProductos] = useState([]);
  const [categoryRecords, setCategoryRecords] = useState([]);
  const [brandRecords, setBrandRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const categories = useMemo(() => getCategoryNames(categoryRecords), [categoryRecords]);
  const brands = useMemo(() => brandRecords.map((brand) => brand.nombre), [brandRecords]);
  const [formValues, setFormValues] = useState(() =>
    getDefaultFormValues(null, [], [])
  );

  const availableCategories = categories;
  const availableBrands = useMemo(() => {
    if (!formValues.marca) return brands;
    if (brands.includes(formValues.marca)) return brands;
    return [...brands, formValues.marca];
  }, [brands, formValues.marca]);
  const availablePresentationQuantities = useMemo(() => {
    const baseOptions = PRESENTATION_QUANTITIES[formValues.unidadMedida] || [];
    const currentQuantity = Number(formValues.cantidadMedida);
    if (!Number.isFinite(currentQuantity) || baseOptions.includes(currentQuantity)) {
      return baseOptions;
    }
    return [...baseOptions, currentQuantity].sort((a, b) => a - b);
  }, [formValues.unidadMedida, formValues.cantidadMedida]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const [productsData, categoriesData, brandsData] = await Promise.all([
        requestJson(endpoints.adminProducts, { token }),
        requestJson(endpoints.adminProductCategories, { token }),
        requestJson(endpoints.adminProductBrands, { token }),
      ]);

      setProductos(Array.isArray(productsData.products) ? productsData.products : []);
      setCategoryRecords(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
      setBrandRecords(Array.isArray(brandsData.brands) ? brandsData.brands : []);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar catalogo de productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    setFormValues((prev) => {
      if (!prev.categoria || !availableCategories.includes(prev.categoria)) {
        const nextCategory = availableCategories[0] || "";
        return { ...prev, categoria: nextCategory };
      }
      return prev;
    });
  }, [availableCategories, isModalOpen]);

  const openModal = (product = null) => {
    setCurrentProduct(product);
    setFormValues(getDefaultFormValues(product, availableCategories, brands));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar producto del inventario?")) return;
    try {
      await requestJson(endpoints.adminProductById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setProductos((prev) => prev.filter((product) => product.id !== id));
    } catch (error) {
      window.alert(error.message || "No fue posible eliminar el producto.");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    if (name === "unidadMedida") {
      const nextQuantity = getDefaultPresentationQuantity(value);
      setFormValues((prev) => ({
        ...prev,
        unidadMedida: value,
        cantidadMedida: String(nextQuantity),
      }));
      return;
    }

    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Selecciona un archivo de imagen valido.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormValues((prev) => ({
        ...prev,
        imagen: reader.result?.toString() || "",
        imagenNombre: file.name || "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setFormValues((prev) => ({ ...prev, imagen: "", imagenNombre: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.categoria) {
      window.alert("Selecciona una categoria valida.");
      return;
    }
    if (!formValues.marca) {
      window.alert("Selecciona una marca valida.");
      return;
    }
    if (!formValues.unidadMedida || !formValues.cantidadMedida) {
      window.alert("Selecciona cantidad y unidad de presentacion.");
      return;
    }
    if (!currentProduct && !formValues.imagen) {
      window.alert("Selecciona una imagen para el producto.");
      return;
    }

    const payload = {
      nombre: formValues.nombre.trim(),
      marca: formValues.marca.trim(),
      precio: Number(formValues.precio),
      stock: Number(formValues.stock),
      categoria: formValues.categoria,
      descripcion: formValues.descripcion.trim(),
      imagen: formValues.imagen || "",
      imagenNombre: formValues.imagenNombre || "",
      cantidadMedida: Number(formValues.cantidadMedida),
      unidadMedida: formValues.unidadMedida,
      rating: currentProduct?.rating || 4.8,
    };

    setSubmitting(true);
    try {
      if (currentProduct) {
        const data = await requestJson(endpoints.adminProductById(currentProduct.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setProductos((prev) =>
          prev.map((product) => (product.id === currentProduct.id ? data.product : product))
        );
      } else {
        const data = await requestJson(endpoints.adminProducts, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setProductos((prev) => [data.product, ...prev]);
      }

      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar el producto.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catalogo de Productos</h1>
          <p className="text-slate-500 text-sm">Usa categorias y marcas creadas por administrador.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => openModal()}
          aria-label="Nuevo Producto"
          title="Nuevo Producto"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando productos..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Imagen</th>
                  <th className="px-6 py-4">Marca</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Precio</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{product.nombre}</div>
                      {Number(product.cantidadMedida) > 0 && product.unidadMedida && (
                        <div className="text-xs text-slate-500">
                          {product.cantidadMedida} {product.unidadMedida}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 font-normal truncate max-w-xs">{product.descripcion}</div>
                    </td>
                    <td className="px-6 py-4">
                      {product.imagen ? (
                        <img
                          src={product.imagen}
                          alt={product.nombre}
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Sin imagen</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{product.marca}</td>
                    <td className="px-6 py-4">
                      <span className="bg-violet-50 text-violet-600 px-2 py-1 rounded-md text-xs font-semibold">{product.categoria}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">${Number(product.precio || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${Number(product.stock) < 10 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {product.stock} u.
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openModal(product)}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-orange-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
                        aria-label="Editar producto"
                      >
                        <SidebarIcon name="edit" className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-red-200 bg-white text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shadow-sm"
                        aria-label="Eliminar producto"
                      >
                        <SidebarIcon name="delete" className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {productos.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">No hay productos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentProduct ? "Editar Producto" : "Nuevo Producto"}
        maxWidthClass={currentProduct ? "max-w-3xl" : "max-w-2xl"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nombre</label>
              <input
                name="nombre"
                value={formValues.nombre}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Nombre del producto"
              />
            </div>
            <div>
              <label className="form-label">Marca</label>
              <select
                name="marca"
                value={formValues.marca}
                onChange={handleInputChange}
                required
                className="form-input"
              >
                {availableBrands.length === 0 && <option value="">Sin marcas</option>}
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div>
              <label className="form-label">Categoria</label>
              <select
                name="categoria"
                value={formValues.categoria}
                onChange={handleInputChange}
                className="form-input"
                required
              >
                {availableCategories.length === 0 && <option value="">Sin categorias</option>}
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Precio ($)</label>
              <input
                name="precio"
                type="number"
                step="0.01"
                value={formValues.precio}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="form-label">Stock</label>
              <input
                name="stock"
                type="number"
                value={formValues.stock}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Unidad</label>
              <select
                name="unidadMedida"
                value={formValues.unidadMedida}
                onChange={handleInputChange}
                required
                className="form-input"
              >
                {PRESENTATION_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Cantidad</label>
              <select
                name="cantidadMedida"
                value={formValues.cantidadMedida}
                onChange={handleInputChange}
                required
                className="form-input"
              >
                {availablePresentationQuantities.map((quantity) => (
                  <option key={`${formValues.unidadMedida}-${quantity}`} value={String(quantity)}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Descripcion</label>
            <textarea
              name="descripcion"
              value={formValues.descripcion}
              onChange={handleInputChange}
              rows="3"
              className="form-input resize-none"
              placeholder="Descripcion del producto..."
            />
          </div>
          <div>
            <label className="form-label">Imagen del Producto</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-wrap items-center gap-3">
              <label
                htmlFor="imagen-producto-input"
                className="inline-flex items-center px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold cursor-pointer hover:bg-violet-200 transition-colors"
              >
                Elegir imagen
              </label>
              <span className="text-sm text-slate-500 truncate">
                {formValues.imagenNombre || (formValues.imagen ? "Imagen cargada" : "Ningun archivo seleccionado")}
              </span>
              {formValues.imagen && (
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              )}
              <input
                id="imagen-producto-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="sr-only"
              />
            </div>
            {formValues.imagen && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={formValues.imagen}
                  alt="Preview producto"
                  className="h-20 w-20 rounded-xl object-cover border border-slate-200 shadow-sm"
                />
                <p className="text-xs text-slate-500">Vista previa</p>
              </div>
            )}
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentProduct ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
