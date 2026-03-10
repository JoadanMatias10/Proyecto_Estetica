import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const FALLBACK_SEGMENTS = ["Mujer", "Hombre", "Nino"];

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function getSubcategoriesBySegment(records, segment) {
  if (!segment) return [];
  const unique = new Set(
    (Array.isArray(records) ? records : [])
      .filter((record) => record.segmento === segment)
      .map((record) => record.nombre)
      .filter(Boolean)
  );
  return Array.from(unique);
}

function getDefaultFormValues(service = null, serviceCategories = []) {
  const segments = Array.from(
    new Set([
      ...serviceCategories.map((category) => category.segmento).filter(Boolean),
      ...FALLBACK_SEGMENTS,
    ])
  );
  const segmento = service?.segmento || segments[0];
  const subcategories = getSubcategoriesBySegment(serviceCategories, segmento);

  return {
    nombre: service?.nombre || "",
    segmento,
    subcategoria: service?.subcategoria || subcategories[0] || "",
    precio: service?.precio ?? "",
    tiempo: service?.tiempo || "",
    descripcion: service?.descripcion || "",
    imagen: service?.imagen || "",
    imagenNombre: service?.imagenNombre || "",
  };
}

export default function GestionServicios() {
  const [servicios, setServicios] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const segments = useMemo(
    () =>
      Array.from(
        new Set([
          ...serviceCategories.map((category) => category.segmento).filter(Boolean),
          ...FALLBACK_SEGMENTS,
        ])
      ),
    [serviceCategories]
  );

  const availableSubcategories = useMemo(() => {
    const list = getSubcategoriesBySegment(serviceCategories, formValues.segmento);
    if (!list.length) return [formValues.subcategoria || ""].filter(Boolean);
    if (formValues.subcategoria && !list.includes(formValues.subcategoria)) {
      return [...list, formValues.subcategoria];
    }
    return list;
  }, [formValues.segmento, formValues.subcategoria, serviceCategories]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const [servicesData, categoriesData] = await Promise.all([
        requestJson(endpoints.adminServices, { token }),
        requestJson(endpoints.adminServiceCategories, { token }),
      ]);
      setServicios(Array.isArray(servicesData.services) ? servicesData.services : []);
      setServiceCategories(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar servicios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (service = null) => {
    setCurrentService(service);
    setFormValues(getDefaultFormValues(service, serviceCategories));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentService(null);
    setFormValues(getDefaultFormValues(null, serviceCategories));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Estas seguro de eliminar este servicio?")) return;
    try {
      await requestJson(endpoints.adminServiceById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setServicios((prev) => prev.filter((service) => service.id !== id));
    } catch (error) {
      window.alert(error.message || "No fue posible eliminar el servicio.");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    if (name === "segmento") {
      const subcategories = getSubcategoriesBySegment(serviceCategories, value);
      setFormValues((prev) => ({
        ...prev,
        segmento: value,
        subcategoria: subcategories.includes(prev.subcategoria) ? prev.subcategoria : (subcategories[0] || ""),
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
    if (!formValues.subcategoria) {
      window.alert("Selecciona una subcategoria valida.");
      return;
    }
    if (!currentService && !formValues.imagen) {
      window.alert("Selecciona una imagen para el servicio.");
      return;
    }

    const payload = {
      nombre: formValues.nombre.trim(),
      segmento: formValues.segmento,
      subcategoria: formValues.subcategoria,
      precio: Number(formValues.precio),
      tiempo: formValues.tiempo.trim(),
      descripcion: formValues.descripcion.trim(),
      imagen: formValues.imagen || "",
      imagenNombre: formValues.imagenNombre || "",
    };

    setSubmitting(true);
    try {
      if (currentService) {
        const data = await requestJson(endpoints.adminServiceById(currentService.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setServicios((prev) =>
          prev.map((service) => (service.id === currentService.id ? data.service : service))
        );
      } else {
        const data = await requestJson(endpoints.adminServices, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setServicios((prev) => [data.service, ...prev]);
      }

      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar el servicio.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion de Servicios</h1>
          <p className="text-slate-500 text-sm">Administra el catalogo de servicios ofrecidos.</p>
        </div>

        <Button
          variant="outline"
          onClick={() => openModal()}
          aria-label="Nuevo Servicio"
          title="Nuevo Servicio"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando servicios..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Imagen</th>
                  <th className="px-6 py-4">Segmento</th>
                  <th className="px-6 py-4">Subcategoria</th>
                  <th className="px-6 py-4">Precio</th>
                  <th className="px-6 py-4">Tiempo</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {servicios.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{service.nombre}</div>
                      <div className="text-xs text-slate-400 font-normal">{service.descripcion}</div>
                    </td>
                    <td className="px-6 py-4">
                      {service.imagen ? (
                        <img
                          src={service.imagen}
                          alt={service.nombre}
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Sin imagen</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-violet-50 text-violet-600 px-2 py-1 rounded-md text-xs font-semibold">{service.segmento}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-xs font-semibold">{service.subcategoria}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">${Number(service.precio || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{service.tiempo}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(service)} className="btn-edit">Editar</button>
                      <button onClick={() => handleDelete(service.id)} className="btn-delete">Eliminar</button>
                    </td>
                  </tr>
                ))}

                {servicios.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                      No hay servicios registrados.
                    </td>
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
        title={currentService ? "Editar Servicio" : "Nuevo Servicio"}
        maxWidthClass={currentService ? "max-w-3xl" : "max-w-2xl"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Servicio</label>
            <input
              name="nombre"
              value={formValues.nombre}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Ej. Corte Clasico"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Segmento</label>
              <select name="segmento" value={formValues.segmento} onChange={handleInputChange} className="form-input">
                {segments.map((segment) => (
                  <option key={segment} value={segment}>{segment}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Subcategoria</label>
              <select name="subcategoria" value={formValues.subcategoria} onChange={handleInputChange} className="form-input">
                {availableSubcategories.length === 0 && <option value="">Sin categorias</option>}
                {availableSubcategories.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>{subcategory}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="form-label">Tiempo Estimado</label>
              <input
                name="tiempo"
                value={formValues.tiempo}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Ej. 30-40 min"
              />
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
              placeholder="Breve descripcion del servicio..."
            />
          </div>
          <div>
            <label className="form-label">Imagen del Servicio</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-wrap items-center gap-3">
              <label
                htmlFor="imagen-servicio-input"
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
                id="imagen-servicio-input"
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
                  alt="Preview servicio"
                  className="h-20 w-20 rounded-xl object-cover border border-slate-200 shadow-sm"
                />
                <p className="text-xs text-slate-500">Vista previa</p>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentService ? "Guardar Cambios" : "Crear Servicio"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
