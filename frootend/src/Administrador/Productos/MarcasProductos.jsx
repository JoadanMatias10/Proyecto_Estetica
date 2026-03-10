import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const getDefaultFormValues = (brand = null) => ({
  nombre: brand?.nombre || "",
  pais: brand?.pais || "",
  estado: brand?.estado || "Activa",
  descripcion: brand?.descripcion || "",
});

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

export default function MarcasProductos() {
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBrand, setCurrentBrand] = useState(null);
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const marcasOrdenadas = useMemo(
    () => [...marcas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [marcas]
  );

  const loadBrands = async () => {
    setLoading(true);
    try {
      const data = await requestJson(endpoints.adminProductBrands, {
        token: getAdminToken(),
      });
      setMarcas(Array.isArray(data.brands) ? data.brands : []);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar marcas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const openModal = (brand = null) => {
    setCurrentBrand(brand);
    setFormValues(getDefaultFormValues(brand));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentBrand(null);
    setFormValues(getDefaultFormValues());
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Seguro que quieres eliminar esta marca?")) return;
    try {
      await requestJson(endpoints.adminProductBrandById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setMarcas((prev) => prev.filter((brand) => brand.id !== id));
    } catch (error) {
      window.alert(error.message || "No fue posible eliminar la marca.");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nombre = formValues.nombre.trim();
    if (!nombre) return;

    setSubmitting(true);
    try {
      const payload = {
        nombre,
        pais: formValues.pais.trim(),
        estado: formValues.estado,
        descripcion: formValues.descripcion.trim(),
      };

      if (currentBrand) {
        const data = await requestJson(endpoints.adminProductBrandById(currentBrand.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setMarcas((prev) => prev.map((brand) => (brand.id === currentBrand.id ? data.brand : brand)));
      } else {
        const data = await requestJson(endpoints.adminProductBrands, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setMarcas((prev) => [...prev, data.brand]);
      }

      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar la marca.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Marcas de Productos</h1>
          <p className="text-slate-500 text-sm">Registra nuevas marcas para que aparezcan en catalogo de productos.</p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          aria-label="Nueva Marca"
          title="Nueva Marca"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando marcas..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Marca</th>
                  <th className="px-6 py-4">Pais</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Descripcion</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marcasOrdenadas.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{brand.nombre}</td>
                    <td className="px-6 py-4">{brand.pais || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          brand.estado === "Activa"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {brand.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{brand.descripcion || "-"}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(brand)} className="btn-edit">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(brand.id)} className="btn-delete">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {marcasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                      No hay marcas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentBrand ? "Editar Marca" : "Nueva Marca"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre</label>
            <input
              name="nombre"
              value={formValues.nombre}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Ej. Schwarzkopf"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Pais</label>
              <input
                name="pais"
                value={formValues.pais}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Ej. Italia"
              />
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
              placeholder="Descripcion interna para esta marca..."
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
              {submitting ? "Guardando..." : currentBrand ? "Guardar Cambios" : "Crear Marca"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
