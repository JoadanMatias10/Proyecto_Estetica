import React, { useEffect, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const getDefaultFormValues = (slide = null) => ({
  imagePreview: slide?.image || "",
  imageName: "",
  imageFile: null,
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
  const fileInputRef = useRef(null);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        imagePreview: reader.result?.toString() || "",
        imageName: file.name || "",
        imageFile: file,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setFormValues((prev) => ({
      ...prev,
      imagePreview: currentSlide?.image || "",
      imageName: "",
      imageFile: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const hasImage = Boolean(formValues.imageFile || currentSlide?.image);
    if (!hasImage) {
      window.alert("Debes seleccionar una imagen para el carrusel.");
      return;
    }

    const payload = new FormData();
    payload.append("estado", formValues.estado);

    if (formValues.imageFile) {
      payload.append("imagen", formValues.imageFile);
    } else if (currentSlide?.image) {
      payload.append("image", currentSlide.image);
      if (currentSlide?.imagePublicId) {
        payload.append("imagePublicId", currentSlide.imagePublicId);
      }
    }

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
      window.dispatchEvent(new CustomEvent("carouselSlidesUpdated"));
      closeModal();
    } catch (error) {
      window.alert(error.message || "No fue posible guardar el slide.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar esta imagen del carrusel?")) return;
    try {
      await requestJson(endpoints.adminCarouselById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      await loadSlides();
      window.dispatchEvent(new CustomEvent("carouselSlidesUpdated"));
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
      window.dispatchEvent(new CustomEvent("carouselSlidesUpdated"));
    } catch (error) {
      window.alert(error.message || "No fue posible reordenar slides.");
      loadSlides();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion de Carrusel</h1>
          <p className="text-sm text-slate-500">
            Administra las imagenes del hero principal. El texto y botones del inicio quedan fijos encima del carrusel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          aria-label="Nueva imagen"
          title="Nueva imagen"
          className="h-10 w-10 rounded-full border-2 border-slate-300 bg-white p-0 text-black hover:bg-slate-50"
        >
          +
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando slides..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-800">
                <tr>
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Imagen</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="w-52 px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slides.map((slide, index) => (
                  <tr key={slide.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-sm font-semibold text-slate-700">{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, -1)}
                          disabled={index === 0}
                          className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 disabled:opacity-40"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, 1)}
                          disabled={index === slides.length - 1}
                          className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 disabled:opacity-40"
                        >
                          Bajar
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <img
                        src={slide.image}
                        alt={`Slide ${index + 1}`}
                        className="h-16 w-32 rounded-xl border border-slate-200 object-cover"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
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
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-500 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                          aria-label="Editar slide"
                        >
                          <SidebarIcon name="edit" className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(slide.id)}
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          aria-label="Eliminar slide"
                        >
                          <SidebarIcon name="delete" className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {slides.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">
                      No hay imagenes registradas para el carrusel.
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
        title={currentSlide ? "Editar imagen del carrusel" : "Nueva imagen del carrusel"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="form-label">Imagen del carrusel</label>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3">
              <label
                htmlFor="imagen-slide-input"
                className="inline-flex cursor-pointer items-center rounded-lg bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-200"
              >
                Elegir imagen
              </label>
              <span className="truncate text-sm text-slate-500">
                {formValues.imageName || (formValues.imagePreview ? "Imagen cargada" : "Ningun archivo seleccionado")}
              </span>
              {(formValues.imageFile || currentSlide?.image) && (
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
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="sr-only"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Esta imagen se sube a Cloudinary y se guarda su URL en la base de datos.
            </p>
            {formValues.imagePreview && (
              <div className="mt-3">
                <img
                  src={formValues.imagePreview}
                  alt="Preview slide"
                  className="h-48 w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentSlide ? "Guardar cambios" : "Crear slide"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
