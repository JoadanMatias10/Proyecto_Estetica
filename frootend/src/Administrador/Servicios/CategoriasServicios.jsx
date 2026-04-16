import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const SERVICE_SEGMENTS = ["Dama", "Caballero", "Niño"];

const getDefaultFormValues = (category = null) => ({
  nombre: category?.nombre || "",
  segmento: category?.segmento || SERVICE_SEGMENTS[0],
  estado: category?.estado || "Activa",
  descripcion: category?.descripcion || "",
});

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

export default function CategoriasServicios() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [filtroSegmento, setFiltroSegmento] = useState("Todos");
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const categoriasFiltradas = useMemo(() => {
    const filtered = filtroSegmento === "Todos"
      ? categorias
      : categorias.filter((category) => category.segmento === filtroSegmento);

    return [...filtered].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [categorias, filtroSegmento]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await requestJson(endpoints.adminServiceCategories, {
        token: getAdminToken(),
      });
      setCategorias(Array.isArray(data.categories) ? data.categories : []);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar categorias de servicios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openModal = (category = null) => {
    setCurrentCategory(category);
    setFormValues(getDefaultFormValues(category));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentCategory(null);
    setFormValues(getDefaultFormValues());
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Seguro que quieres eliminar esta categoria de servicio?")) return;
    try {
      await requestJson(endpoints.adminServiceCategoryById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setCategorias((prev) => prev.filter((category) => category.id !== id));
    } catch (error) {
      window.alert(error.message || "No fue posible eliminar la categoria.");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nombre = formValues.nombre.trim();
    const segmento = formValues.segmento;
    if (!nombre || !segmento) return;

    setSubmitting(true);
    try {
      const payload = {
        nombre,
        segmento,
        estado: formValues.estado,
        descripcion: formValues.descripcion.trim(),
      };

      if (currentCategory) {
        const data = await requestJson(endpoints.adminServiceCategoryById(currentCategory.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setCategorias((prev) =>
          prev.map((category) => (category.id === currentCategory.id ? data.category : category))
        );
      } else {
        const data = await requestJson(endpoints.adminServiceCategories, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setCategorias((prev) => [...prev, data.category]);
      }

      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar la categoria.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Categorias de Servicios</h1>
          <p className="text-slate-500 text-sm">Las categorias creadas aqui se usan en Gestion de Servicios.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filtroSegmento}
            onChange={(event) => setFiltroSegmento(event.target.value)}
            className="form-input min-w-40"
          >
            <option value="Todos">Todos</option>
            {SERVICE_SEGMENTS.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => openModal()}
            aria-label="Nueva Categoria de Servicio"
            title="Nueva Categoria de Servicio"
            className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50 shrink-0"
          >
            +
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando categorias..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Segmento</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Descripcion</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoriasFiltradas.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{category.nombre}</td>
                    <td className="px-6 py-4">
                      <span className="bg-violet-50 text-violet-600 px-2 py-1 rounded-md text-xs font-semibold">
                        {category.segmento}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          category.estado === "Activa"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {category.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{category.descripcion || "-"}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openModal(category)}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-orange-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
                        aria-label="Editar categoria"
                      >
                        <SidebarIcon name="edit" className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-red-200 bg-white text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shadow-sm"
                        aria-label="Eliminar categoria"
                      >
                        <SidebarIcon name="delete" className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {categoriasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                      No hay categorias registradas para este segmento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentCategory ? "Editar Categoria de Servicio" : "Nueva Categoria de Servicio"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre</label>
            <input
              name="nombre"
              value={formValues.nombre}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Ej. Tratamientos Capilares"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Segmento</label>
              <select name="segmento" value={formValues.segmento} onChange={handleInputChange} className="form-input">
                {SERVICE_SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select name="estado" value={formValues.estado} onChange={handleInputChange} className="form-input">
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
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
              placeholder="Descripcion interna para esta categoria..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentCategory ? "Guardar Cambios" : "Crear Categoria"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
