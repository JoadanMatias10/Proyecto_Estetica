import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ErrorPage from "../Error/ErrorPage";
import { endpoints, requestJson } from "../../api";
import { formatProductPresentation } from "../../utils/productPresentation";

export default function DetalleProducto() {
  const { id } = useParams();
  const [cantidad] = useState(1);
  const [prod, setProd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorType, setErrorType] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) {
        setErrorType("not_found");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorType("");
      try {
        const data = await requestJson(endpoints.publicProductById(id));
        setProd(data.product || null);
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

    loadProduct();
  }, [id]);

  if (errorType === "server_error") {
    return (
      <ErrorPage
        code="500"
        title="Error de Conexion"
        message="No se pudo cargar el producto. Intenta de nuevo mas tarde."
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner text="Cargando producto..." fullScreen={false} className="py-24" />;
  }

  if (!prod || errorType === "not_found") {
    return (
      <div className="card p-8 text-center min-h-[50vh] flex flex-col justify-center items-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Producto no encontrado</h1>
        <Link to="/productos" className="text-violet-600 hover:text-violet-700 font-medium underline">Volver al catalogo</Link>
      </div>
    );
  }

  const presentation = formatProductPresentation(prod);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/productos" className="text-violet-600 hover:text-violet-700 text-sm font-medium transition-colors mb-8 inline-flex items-center gap-2">
        <span>{"<-"}</span> Volver al catalogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        <div className="bg-gradient-to-br from-violet-50 to-rose-50 rounded-3xl flex items-center justify-center p-8 aspect-square lg:aspect-auto lg:h-[600px] shadow-sm border border-violet-100/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <img
            src={prod.imagen || `https://placehold.co/800x800/F5F3FF/7C3AED?text=${encodeURIComponent(prod.nombre)}`}
            alt={prod.nombre}
            className="w-full h-full object-contain relative z-10 transition-transform duration-700 group-hover:scale-105"
          />
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-2">
            <span className="bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {prod.categoria}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2 leading-tight">
            {prod.nombre}
          </h1>

          {(presentation || prod.marca) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {presentation && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                  Presentacion: {presentation}
                </span>
              )}
              {prod.marca && (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-600">
                  Marca: {prod.marca}
                </span>
              )}
            </div>
          )}

          <div className="text-3xl font-bold text-rose-500 mt-4 mb-6">
            ${Number(prod.precio || 0).toFixed(2)} <span className="text-lg text-slate-400 font-normal">MXN</span>
          </div>

          <div className="prose prose-slate max-w-none text-slate-600 mb-8 leading-relaxed">
            <p className="text-lg">{prod.descripcion || "Producto profesional AVYNA."}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mt-4 pb-8 border-b border-slate-100">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl w-full sm:w-40 h-14 px-4 opacity-60 cursor-not-allowed" title="Inicia sesion para comprar">
              <button
                className="text-slate-400 font-bold text-xl px-2 cursor-not-allowed"
                disabled
              >-</button>
              <span className="text-slate-400 font-bold text-lg">{cantidad}</span>
              <button
                className="text-slate-400 font-bold text-xl px-2 cursor-not-allowed"
                disabled
              >+</button>
            </div>

            <Link to="/login" className="w-full sm:w-auto flex-1">
              <button className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center gap-2">
                <span>Iniciar sesion para comprar</span>
              </button>
            </Link>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-8 text-xs font-bold tracking-widest text-slate-400 uppercase">
            <div>Categoria: <span className="font-medium text-slate-600 ml-2">{prod.categoria}</span></div>
            {presentation && (
              <div>Presentacion: <span className="font-medium text-slate-600 ml-2">{presentation}</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
