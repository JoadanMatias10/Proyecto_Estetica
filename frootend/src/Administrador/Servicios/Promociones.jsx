import React, { useCallback, useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const getDefaultFormValues = (promotion = null) => ({
  titulo: promotion?.titulo || "",
  descripcion: promotion?.descripcion || "",
  descuento: promotion?.descuento || "",
  estado: promotion?.estado || "Activa",
  destacadoInicio: Boolean(promotion?.destacadoInicio),
});

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

export default function Promociones() {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPromo, setCurrentPromo] = useState(null);
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminPromotions, { token: getAdminToken() });
      setPromociones(Array.isArray(data.promotions) ? data.promotions : []);
    } catch (error) {
      setErrorMessage(error.message || "No fue posible cargar promociones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const openModal = (promo = null) => {
    setCurrentPromo(promo);
    setFormValues(getDefaultFormValues(promo));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentPromo(null);
    setFormValues(getDefaultFormValues());
    setIsModalOpen(false);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Estas seguro de eliminar esta promocion?")) return;
    setErrorMessage("");
    try {
      await requestJson(endpoints.adminPromotionById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setPromociones((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setErrorMessage(error.message || "No fue posible eliminar promocion.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      const payload = {
        titulo: formValues.titulo.trim(),
        descripcion: formValues.descripcion.trim(),
        descuento: formValues.descuento.trim(),
        estado: formValues.estado,
        destacadoInicio: formValues.destacadoInicio,
      };

      if (currentPromo) {
        const data = await requestJson(endpoints.adminPromotionById(currentPromo.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setPromociones((prev) => prev.map((item) => (item.id === currentPromo.id ? data.promotion : item)));
      } else {
        const data = await requestJson(endpoints.adminPromotions, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setPromociones((prev) => [data.promotion, ...prev]);
      }
      closeModal();
    } catch (error) {
      setErrorMessage(error.message || "No fue posible guardar promocion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Promociones</h1>
          <p className="text-slate-500 text-sm">Gestiona las ofertas y descuentos vigentes.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => openModal()}
          aria-label="Nueva Promocion"
          title="Nueva Promocion"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <LoadingSpinner fullScreen={false} text="Cargando promociones..." className="py-14" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promociones.map((promo) => (
            <div key={promo.id} className="bg-white p-6 rounded-2xl shadow-sm border border-violet-100 hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => openModal(promo)}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-orange-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
                  aria-label="Editar promocion"
                >
                  <SidebarIcon name="edit" className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(promo.id)}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-red-200 bg-white text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shadow-sm"
                  aria-label="Eliminar promocion"
                >
                  <SidebarIcon name="delete" className="h-5 w-5" />
                </button>
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${promo.estado === "Activa" ? "text-emerald-600" : "text-slate-400"}`}>
                {promo.estado}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{promo.titulo}</h3>
              <p className="text-slate-600 text-sm mb-4">{promo.descripcion}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-2xl font-bold text-rose-600">{promo.descuento}</span>
              </div>
            </div>
          ))}
          {promociones.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400">
              No hay promociones registradas.
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentPromo ? "Editar Promocion" : "Nueva Promocion"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Titulo</label>
            <input
              name="titulo"
              value={formValues.titulo}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Ej. 2x1 en Cortes"
            />
          </div>
          <div>
            <label className="form-label">Descripcion</label>
            <textarea
              name="descripcion"
              value={formValues.descripcion}
              onChange={handleInputChange}
              rows="2"
              className="form-input resize-none"
              placeholder="Detalles de la promocion..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Descuento</label>
              <input
                name="descuento"
                value={formValues.descuento}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Ej. 50%, $100"
              />
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select
                name="estado"
                value={formValues.estado}
                onChange={handleInputChange}
                className="form-input"
              >
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200">Cancelar</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentPromo ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
