import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { fetchPublicProductsBundle } from "../../utils/publicCatalogApi";

export default function CatalogoProductos() {
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
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="page-title">Productos AVYNA</h1>
          <p className="page-subtitle mt-1">Catalogo exclusivo para clientes.</p>
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

          <Link
            to="/cliente/carrito"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-1 py-2 text-violet-600 font-semibold hover:text-violet-700 transition-colors"
          >
            <SidebarIcon name="cart" className="h-5 w-5" />
            <span>Ir al carrito</span>
          </Link>
        </div>
      </div>

      <div className="mb-8">
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

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-200 ${isFilterLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {isLoading ? (
            <div className="col-span-full h-[420px]" />
          ) : filteredProductos.length > 0 ? (
            filteredProductos.map((product) => (
              <div key={product.id} className="card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group rounded-2xl overflow-hidden flex flex-col h-full border border-slate-100/50">
                <div className="h-48 bg-gradient-to-br from-violet-50 to-rose-50 relative overflow-hidden group-hover:from-violet-100 group-hover:to-rose-100 transition-colors duration-500">
                  <img
                    src={product.imagen || `https://placehold.co/800x500/F5F3FF/7C3AED?text=AVYNA`}
                    alt={product.nombre}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-500 shadow-sm border border-rose-100 text-center">
                      {product.categoria}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col bg-white">
                  <div className="flex justify-between gap-3 items-start mb-2">
                    <h3 className="font-bold text-slate-800 leading-tight text-lg line-clamp-2 min-h-[3.5rem] group-hover:text-violet-600 transition-colors">
                      {product.nombre}
                    </h3>
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 shrink-0">
                      <span className="text-xs">*</span>
                      <span className="text-amber-600 font-bold text-xs">{Number(product.rating || 4.8).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="text-slate-600 mb-4 font-medium flex items-baseline gap-1">
                      <span className="font-bold text-2xl text-slate-900">${Number(product.precio || 0).toFixed(2)}</span>
                      <span className="text-xs text-slate-400 font-normal">MXN</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link to={`/cliente/productos/${product.id}`} className="w-full">
                        <Button
                          variant="outline"
                          className="w-full py-2.5 rounded-xl text-sm border-2 border-slate-100 hover:border-violet-200 hover:text-violet-600 hover:bg-violet-50 transition-all"
                        >
                          Detalle
                        </Button>
                      </Link>
                      <Link to={`/cliente/productos/pago/${product.id}`} className="w-full">
                        <Button className="w-full py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-300 transition-all transform hover:-translate-y-0.5">
                          Comprar
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-400 font-medium bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
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
