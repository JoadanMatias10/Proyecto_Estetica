import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import ServiceGalleryStrip from "../../components/services/ServiceGalleryStrip";
import { fetchPublicServicesBundle, getServiceSubcategoriesBySegment } from "../../utils/publicCatalogApi";

export default function ConsultaServicio() {
  const [services, setServices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [serviceSegments, setServiceSegments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const filterTimerRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await fetchPublicServicesBundle();
        setServices(data.services);
        setServiceCategories(data.serviceCategories);
        const uniqueSegments = Array.from(new Set(data.serviceSegments || []));
        setServiceSegments(uniqueSegments);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar servicios.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedSegment) return;
    const availableSubcategories = getServiceSubcategoriesBySegment(serviceCategories, services, selectedSegment);
    if (selectedSubcategory && !availableSubcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory(null);
    }
  }, [selectedSegment, selectedSubcategory, serviceCategories, services]);

  const filteredServices = useMemo(
    () =>
      services.filter((service) => {
        const matchesSearch = service.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSegment = selectedSegment ? service.segmento === selectedSegment : true;
        const matchesSubcategory = selectedSubcategory ? service.subcategoria === selectedSubcategory : true;
        return matchesSearch && matchesSegment && matchesSubcategory;
      }),
    [services, searchTerm, selectedSegment, selectedSubcategory]
  );

  const showFilterLoading = (callback) => {
    callback();
    setIsFilterLoading(true);

    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      setIsFilterLoading(false);
      filterTimerRef.current = null;
    }, 350);
  };

  const handleSegmentClick = (segment) => {
    showFilterLoading(() => {
      if (selectedSegment === segment) {
        setSelectedSegment(null);
        setSelectedSubcategory(null);
      } else {
        setSelectedSegment(segment);
        setSelectedSubcategory(null);
      }
    });
  };

  const handleResetFilters = () => {
    showFilterLoading(() => {
      setSelectedSegment(null);
      setSelectedSubcategory(null);
    });
  };

  const handleSubcategoryClick = (subcategory) => {
    showFilterLoading(() => {
      setSelectedSubcategory(selectedSubcategory === subcategory ? null : subcategory);
    });
  };

  const segmentSubcategories = selectedSegment
    ? getServiceSubcategoriesBySegment(serviceCategories, services, selectedSegment)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="page-subtitle mt-2">Explora por segmento y categoria para encontrar tu servicio ideal.</p>
        </div>
        <Link to="/login">
          <Button className="px-6 py-3 rounded-xl">Iniciar sesion para agendar</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto mb-8">
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SidebarIcon name="search" className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar servicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap gap-3 mb-4 justify-center md:justify-start">
          <button
            onClick={handleResetFilters}
            disabled={isFilterLoading}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${!selectedSegment
              ? "bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-600 ring-offset-2"
              : "bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-600"
              }`}
          >
            Todos
          </button>
          {serviceSegments.map((segment) => (
            <button
              key={segment}
              onClick={() => handleSegmentClick(segment)}
              disabled={isFilterLoading}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${selectedSegment === segment
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-600 ring-offset-2"
                : "bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-600"
                }`}
            >
              {segment}
            </button>
          ))}
        </div>

        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedSegment ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
          <div className="flex flex-wrap gap-3 items-center justify-center md:justify-start">
            <div className="w-full md:w-auto text-sm text-slate-400 font-medium mr-2 hidden md:block">Subcategorias:</div>
            {segmentSubcategories.map((subcategory) => (
              <button
                key={subcategory}
                onClick={() => handleSubcategoryClick(subcategory)}
                disabled={isFilterLoading}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${selectedSubcategory === subcategory
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm"
                  }`}
              >
                {subcategory}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className={`relative ${isLoading ? "min-h-[420px]" : ""}`}>
        {(isLoading || isFilterLoading) && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-3xl bg-white/70 pt-20 backdrop-blur-sm sm:pt-24">
            <LoadingSpinner
              fullScreen={false}
              className="py-6"
              showText
              text="Cargando servicios"
              spinnerClassName="h-12 w-12 border-[3px] border-sky-200 border-t-blue-600"
              textClassName="mt-4 text-base font-semibold text-blue-600 sm:text-lg"
            />
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${(isLoading || isFilterLoading) ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {isLoading ? (
            <div className="col-span-full h-[420px]" />
          ) : filteredServices.length > 0 ? (
            filteredServices.map((service) => (
              <div key={service.id} className="card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group rounded-2xl overflow-hidden flex flex-col h-full border border-slate-100/50">
                <div className="h-44 bg-gradient-to-br from-violet-50 to-rose-50 relative overflow-hidden group-hover:from-violet-100 group-hover:to-rose-100 transition-colors duration-500">
                  <img
                    src={service.imagen || `https://placehold.co/800x500/F5F3FF/7C3AED?text=${encodeURIComponent(service.nombre)}`}
                    alt={service.nombre}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-violet-600 shadow-sm border border-violet-100 text-center">
                      {service.segmento}
                    </span>
                    <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 shadow-sm border border-indigo-100 text-center">
                      {service.subcategoria}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col bg-white">
                  <h3 className="section-title mb-2">{service.nombre}</h3>
                  <p className="page-subtitle mt-1">{service.descripcion}</p>
                  <div className="mt-4 text-slate-600 text-sm">
                    Duracion: <span className="font-semibold">{service.tiempo}</span>
                  </div>
                  <div className="mt-1 text-slate-700">
                    Desde <span className="font-bold text-rose-600 text-xl">${Number(service.precio || 0).toFixed(2)}</span> <span className="text-xs">MXN</span>
                  </div>
                  <ServiceGalleryStrip service={service} />
                  <div className="mt-5">
                    <Link to="/login">
                      <Button variant="outline" className="w-full py-2.5 border-2 rounded-xl">
                        Iniciar sesion para agendar
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-400 font-medium bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="mb-3 inline-flex items-center justify-center rounded-2xl bg-violet-50 p-3 text-violet-600">
                <SidebarIcon name="search" className="h-8 w-8" />
              </div>
              <p className="text-lg text-slate-600 font-semibold">No encontramos servicios.</p>
              <p className="text-sm mt-1">Prueba con otro segmento, subcategoria o termino de busqueda.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSegment(null);
                  setSelectedSubcategory(null);
                }}
                className="mt-4 text-violet-600 font-medium hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
