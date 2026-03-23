import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { fetchPublicProductsBundle } from "../../utils/publicCatalogApi";

export default function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const filterTimerRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await fetchPublicProductsBundle();
        setProductos(data.products);
        setCategoriesMap(data.categoriesMap);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar productos.");
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
    if (!selectedCategory) return;
    if (!categoriesMap[selectedCategory]) {
      setSelectedCategory(null);
    }
  }, [categoriesMap, selectedCategory]);

  const filteredProductos = useMemo(
    () =>
      productos.filter((product) => {
        const matchesSearch = product.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory ? product.categoria === selectedCategory : true;
        return matchesSearch && matchesCategory;
      }),
    [productos, searchTerm, selectedCategory]
  );

  const categories = useMemo(() => Object.keys(categoriesMap), [categoriesMap]);

  const showFilterLoading = (callback) => {
    callback();
    setIsFilterLoading(true);

    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      setIsFilterLoading(false);
      filterTimerRef.current = null;
    }, 350);
  };

  const handleCategoryClick = (category) => {
    showFilterLoading(() => {
      if (selectedCategory === category) {
        setSelectedCategory(null);
      } else {
        setSelectedCategory(category);
      }
    });
  };

  const handleResetCategoryFilters = () => {
    showFilterLoading(() => {
      setSelectedCategory(null);
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="page-title">Catalogo AVYNA</h1>
          <p className="page-subtitle mt-2">Explora productos profesionales para tu cuidado.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SidebarIcon name="search" className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <Link to="/promociones" className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors whitespace-nowrap">
            Ver promociones ->
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <div className="flex flex-wrap gap-3 mb-4 justify-center md:justify-start">
          <button
            onClick={handleResetCategoryFilters}
            disabled={isFilterLoading}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${!selectedCategory
              ? "bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-600 ring-offset-2"
              : "bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-600"
              }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              disabled={isFilterLoading}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${selectedCategory === cat
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-600 ring-offset-2"
                : "bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-600"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className={`relative ${isLoading ? "min-h-[420px]" : ""}`}>
        {(isLoading || isFilterLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm">
            <LoadingSpinner fullScreen={false} className="py-10" showText text="Cargando" />
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-200 ${isFilterLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {isLoading ? (
            <div className="col-span-full h-[420px]" />
          ) : filteredProductos.length > 0 ? (
            filteredProductos.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ y: -6 }}
                className="card hover:shadow-xl transition-shadow duration-300 rounded-2xl overflow-hidden group"
              >
                <div className="h-64 sm:h-72 bg-gradient-to-br from-violet-100 to-rose-100 flex items-center justify-center relative overflow-hidden">
                  <img
                    src={product.imagen || `https://placehold.co/600x400/EDE9FE/7C3AED?text=AVYNA`}
                    alt={product.nombre}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-indigo-600 shadow-sm">
                      {product.categoria}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{product.nombre}</h3>
                    <span className="text-amber-500 font-bold text-sm bg-amber-50 px-1.5 rounded border border-amber-100 flex items-center h-fit">* {Number(product.rating || 4.8).toFixed(1)}</span>
                  </div>
                  <div className="mt-2 text-slate-500 font-medium">
                    <span className="font-bold text-rose-600 text-xl">${Number(product.precio || 0).toFixed(2)}</span> <span className="text-xs">MXN</span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link to={`/productos/${product.id}`} className="w-full">
                      <Button className="w-full py-2.5">Ver detalle</Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-400 font-medium bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="mb-3 inline-flex items-center justify-center rounded-2xl bg-violet-50 p-3 text-violet-600">
                <SidebarIcon name="search" className="h-8 w-8" />
              </div>
              <p className="text-lg text-slate-600 font-semibold">No encontramos productos.</p>
              <p className="text-sm mt-1">Intenta con otra categoria o termino de busqueda.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory(null);
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
