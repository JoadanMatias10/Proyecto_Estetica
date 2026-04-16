import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ErrorPage from "../Error/ErrorPage";
import { endpoints, requestJson } from "../../api";

function getGalleryImages(service) {
  return (Array.isArray(service?.galeriaImagenes) ? service.galeriaImagenes : [])
    .filter((image) => image?.url);
}

function getServiceImage(service) {
  return service?.imagen
    || `https://placehold.co/1200x900/F5F3FF/7C3AED?text=${encodeURIComponent(service?.nombre || "Servicio")}`;
}

export default function DetalleServicio() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorType, setErrorType] = useState("");

  useEffect(() => {
    const loadService = async () => {
      if (!id) {
        setErrorType("not_found");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorType("");
      try {
        const data = await requestJson(endpoints.publicServiceById(id));
        setService(data.service || null);
      } catch (error) {
        if (error.status === 404) {
          setErrorType("not_found");
        } else {
          setErrorType("server_error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadService();
  }, [id]);

  const galleryImages = useMemo(() => getGalleryImages(service), [service]);

  if (errorType === "server_error") {
    return (
      <ErrorPage
        code="500"
        title="Error de Conexion"
        message="No se pudo cargar el servicio. Intenta de nuevo mas tarde."
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner text="Cargando servicio..." fullScreen={false} className="py-24" />;
  }

  if (!service || errorType === "not_found") {
    return (
      <div className="card min-h-[50vh] p-8 text-center flex flex-col items-center justify-center">
        <h1 className="mb-4 text-2xl font-bold text-slate-800">Servicio no encontrado</h1>
        <Link to="/servicios" className="font-medium text-violet-600 underline hover:text-violet-700">
          Volver al catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/servicios" className="inline-flex items-center gap-2 mb-8 text-sm font-medium text-violet-600 transition-colors hover:text-violet-700">
        <span>{"<-"}</span> Volver a servicios
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 lg:gap-16">
        <div className="space-y-4">
          <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-violet-100/60 bg-gradient-to-br from-violet-50 to-rose-50 shadow-sm">
            <img
              src={getServiceImage(service)}
              alt={service.nombre}
              className="aspect-[4/5] w-full object-cover object-center"
            />
          </div>

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryImages.map((image, index) => (
                <div key={`${service.id}-gallery-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={image.url}
                    alt={`${service.nombre} detalle ${index + 1}`}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-4 flex flex-wrap gap-2">
            {service.segmento ? (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
                {service.segmento}
              </span>
            ) : null}
            {service.subcategoria ? (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
                {service.subcategoria}
              </span>
            ) : null}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-900">
            {service.nombre}
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            {service.descripcion || "Consulta el detalle completo del servicio y agenda tu cita cuando quieras."}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Duracion</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{service.tiempo || "Por confirmar"}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400">Precio</p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">
                ${Number(service.precio || 0).toFixed(2)} <span className="text-sm font-medium text-rose-400">MXN</span>
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Link to="/login" className="inline-flex w-full sm:w-auto">
              <button className="w-full sm:min-w-[250px] h-12 px-5 rounded-xl bg-violet-600 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-violet-200 transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-violet-300">
                Iniciar sesion para agendar
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
