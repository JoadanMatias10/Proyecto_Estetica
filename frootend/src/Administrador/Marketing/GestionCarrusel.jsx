import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const CAROUSEL_BG_OPTIONS = [
  "from-rose-400 to-violet-500",
  "from-violet-400 to-rose-400",
  "from-amber-400 to-rose-400",
  "from-rose-500 to-violet-600",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
];

const getDefaultFormValues = (slide = null) => ({
  title: slide?.title || "",
  description: slide?.description || "",
  image: slide?.image || "",
  imageName: "",
  bgColor: slide?.bgColor || CAROUSEL_BG_OPTIONS[0],
  estado: slide?.estado || "Activa",
});

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

export default function GestionCarrusel() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(null);
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const slidesOrdenados = useMemo(() => slides, [slides]);

  const loadSlides = async () => {
    setLoading(true);
    try {
      const data = await requestJson(endpoints.adminCarousel, {
        token: getAdminToken(),
      });
      setSlides(Array.isArray(data.slides) ? data.slides : []);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar slides.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlides();
  }, []);

  const openModal = (slide = null) => {
    setCurrentSlide(slide);
    setFormValues(getDefaultFormValues(slide));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentSlide(null);
    setFormValues(getDefaultFormValues());
    setIsModalOpen(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
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
        image: reader.result?.toString() || "",
        imageName: file.name || "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setFormValues((prev) => ({ ...prev, image: "", imageName: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const title = formValues.title.trim();
    const description = formValues.description.trim();
    const image = formValues.image.trim();
    if (!title || !description || !image) {
      window.alert("Completa titulo, descripcion e imagen.");
      return;
    }

    const payload = {
      title,
      description,
      image,
      bgColor: formValues.bgColor,
      estado: formValues.estado,
    };

    setSubmitting(true);
    try {
      if (currentSlide) {
        await requestJson(endpoints.adminCarouselById(currentSlide.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
      } else {
        await requestJson(endpoints.adminCarousel, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
      }

      await loadSlides();
      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar el slide.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar este slide del carrusel?")) return;
    try {
      await requestJson(endpoints.adminCarouselById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      await loadSlides();
    } catch (error) {
      window.alert(error.message || "No fue posible eliminar el slide.");
    }
  };

  const moveSlide = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const nextSlides = [...slides];
    const [item] = nextSlides.splice(index, 1);
    nextSlides.splice(targetIndex, 0, item);
    setSlides(nextSlides);

    try {
      const data = await requestJson(endpoints.adminCarouselReorder, {
        method: "PUT",
        token: getAdminToken(),
        body: { ids: nextSlides.map((slide) => slide.id) },
      });
      setSlides(Array.isArray(data.slides) ? data.slides : nextSlides);
    } catch (error) {
      window.alert(error.message || "No fue posible reordenar slides.");
      loadSlides();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion de Carrusel</h1>
          <p className="text-slate-500 text-sm">Administra imagenes y textos del carrusel de la pagina de inicio.</p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          aria-label="Nuevo Slide"
          title="Nuevo Slide"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando slides..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Imagen</th>
                  <th className="px-6 py-4">Titulo</th>
                  <th className="px-6 py-4">Descripcion</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right w-52">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slidesOrdenados.map((slide, index) => (
                  <tr key={slide.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 w-5">{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, -1)}
                          disabled={index === 0}
                          className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, 1)}
                          disabled={index === slidesOrdenados.length - 1}
                          className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
                        >
                          Bajar
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <img src={slide.image} alt={slide.title} className="h-12 w-20 rounded-lg object-cover border border-slate-200" />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{slide.title}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{slide.description}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          slide.estado === "Activa"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {slide.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          onClick={() => openModal(slide)}
                          type="button"
                          className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-orange-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
                          aria-label="Editar slide"
                        >
                          <SidebarIcon name="edit" className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(slide.id)}
                          type="button"
                          className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-red-200 bg-white text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shadow-sm"
                          aria-label="Eliminar slide"
                        >
                          <SidebarIcon name="delete" className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {slidesOrdenados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-400">No hay slides registrados.</td>
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
        title={currentSlide ? "Editar Slide" : "Nuevo Slide"}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Titulo</label>
            <input
              name="title"
              value={formValues.title}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ej. Promociones de temporada"
              required
            />
          </div>
          <div>
            <label className="form-label">Descripcion</label>
            <textarea
              name="description"
              value={formValues.description}
              onChange={handleInputChange}
              rows="3"
              className="form-input resize-none"
              placeholder="Texto que se mostrara en el carrusel..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Color del degradado</label>
              <select name="bgColor" value={formValues.bgColor} onChange={handleInputChange} className="form-input">
                {CAROUSEL_BG_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
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
            <label className="form-label">Imagen del Slide</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-wrap items-center gap-3">
              <label
                htmlFor="imagen-slide-input"
                className="inline-flex items-center px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold cursor-pointer hover:bg-violet-200 transition-colors"
              >
                Elegir imagen
              </label>
              <span className="text-sm text-slate-500 truncate">
                {formValues.imageName || (formValues.image ? "Imagen cargada" : "Ningun archivo seleccionado")}
              </span>
              {formValues.image && (
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              )}
              <input
                id="imagen-slide-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="sr-only"
              />
            </div>
            {formValues.image && (
              <div className="mt-3">
                <img
                  src={formValues.image}
                  alt="Preview slide"
                  className="h-28 w-full max-w-sm rounded-xl object-cover border border-slate-200 shadow-sm"
                />
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
              {submitting ? "Guardando..." : currentSlide ? "Guardar Cambios" : "Crear Slide"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
