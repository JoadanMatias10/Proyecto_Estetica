import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Carousel from "../components/ui/Carousel";
import {
  fetchPublicProductsBundle,
  fetchPublicPromotions,
  fetchPublicServicesBundle,
} from "../utils/publicCatalogApi";
import { formatProductPresentation } from "../utils/productPresentation";

const HOME_HIGHLIGHTS_STORAGE_KEY = "admin.home.highlights.v1";

function truncateText(value, maxLength = 110) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function isHomeFeatured(item) {
  return Boolean(item?.destacadoInicio);
}

function readStoredHighlights() {
  try {
    const rawValue = localStorage.getItem(HOME_HIGHLIGHTS_STORAGE_KEY);
    if (!rawValue) {
      return {
        products: [],
        services: [],
        promotions: [],
      };
    }

    const parsed = JSON.parse(rawValue);
    return {
      products: Array.isArray(parsed?.products) ? parsed.products.map(String) : [],
      services: Array.isArray(parsed?.services) ? parsed.services.map(String) : [],
      promotions: Array.isArray(parsed?.promotions) ? parsed.promotions.map(String) : [],
    };
  } catch (_error) {
    return {
      products: [],
      services: [],
      promotions: [],
    };
  }
}

function getHomeHighlights(items, storedIds) {
  const featuredFromApi = (Array.isArray(items) ? items : []).filter(isHomeFeatured).slice(0, 4);
  if (featuredFromApi.length > 0) {
    return featuredFromApi;
  }

  const storedSet = new Set((Array.isArray(storedIds) ? storedIds : []).map(String));
  if (storedSet.size === 0) {
    return [];
  }

  return (Array.isArray(items) ? items : [])
    .filter((item) => storedSet.has(String(item?.id || "")))
    .slice(0, 4);
}

function SectionHeader({ title, subtitle, ctaLabel, ctaTo }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="page-title">{title}</h2>
        <p className="page-subtitle mt-2">{subtitle}</p>
      </div>

      {ctaLabel && ctaTo ? (
        <Link to={ctaTo}>
          <Button variant="outline" className="px-5 py-2.5">
            {ctaLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadHighlights = async () => {
      try {
        const storedHighlights = readStoredHighlights();
        const [servicesResult, productsResult, promotionsResult] = await Promise.allSettled([
          fetchPublicServicesBundle(),
          fetchPublicProductsBundle(),
          fetchPublicPromotions(),
        ]);

        if (!isMounted) return;

        const publicServices = servicesResult.status === "fulfilled"
          ? (servicesResult.value.services || [])
          : [];
        const publicProducts = productsResult.status === "fulfilled"
          ? (productsResult.value.products || [])
          : [];
        const publicPromotions = promotionsResult.status === "fulfilled"
          ? (promotionsResult.value || [])
          : [];

        setServices(
          getHomeHighlights(publicServices, storedHighlights.services)
        );
        setProducts(
          getHomeHighlights(publicProducts, storedHighlights.products)
        );
        setPromotions(
          getHomeHighlights(publicPromotions, storedHighlights.promotions)
        );
      } catch (_error) {
        if (!isMounted) return;
        setServices([]);
        setProducts([]);
        setPromotions([]);
      }
    };

    loadHighlights();

    const handleHighlightsUpdated = () => {
      loadHighlights();
    };

    const handleStorageChange = (event) => {
      if (event.key && event.key !== HOME_HIGHLIGHTS_STORAGE_KEY) {
        return;
      }
      loadHighlights();
    };

    window.addEventListener("homeHighlightsUpdated", handleHighlightsUpdated);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener("homeHighlightsUpdated", handleHighlightsUpdated);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <div>
      <section>
        <Carousel
          className="h-[72vh] min-h-[560px] w-full shadow-2xl md:h-[78vh] md:min-h-[640px]"
          overlay={(
            <div className="mx-auto flex h-full w-full max-w-7xl items-center px-6 py-14 sm:px-8 md:px-10 lg:px-12">
              <div className="w-full max-w-3xl">

                <motion.h1
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.05 }}
                  className="mt-6 max-w-2xl text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
                >
                  Renueva tu estilo con <span className="text-rose-200">expertos</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 }}
                  className="mt-5 max-w-2xl text-lg leading-relaxed text-white/90 drop-shadow-[0_2px_10px_rgba(15,23,42,0.25)] md:text-xl"
                >
                  Agenda tu proxima visita, descubre servicios profesionales y conoce la linea AVYNA desde un
                  solo lugar.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.15 }}
                  className="flex flex-col gap-4 pt-8 sm:flex-row"
                >
                  <Link to="/login">
                    <Button className="px-6 py-3 text-base md:px-8 md:py-4">
                      Agendar cita
                    </Button>
                  </Link>

                  <Link to="/servicios">
                    <Button
                      variant="outline"
                      className="border-white/50 bg-white/15 px-6 py-3 text-base text-white backdrop-blur-sm hover:border-white hover:bg-white/25 hover:text-white md:px-8 md:py-4"
                    >
                      Ver servicios
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </div>
          )}
        />
      </section>

      <div className="bg-gradient-to-b from-rose-100 via-rose-50 to-rose-100/90 pt-16 pb-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="border-t-2 border-slate-200/50 max-w-xs mx-auto my-16"></div>

          {promotions.length > 0 ? (
            <section className="mb-16">
              <SectionHeader
                title="Promociones destacadas"
                subtitle="Solo se muestran las promociones activas seleccionadas desde administrador."
                ctaLabel="Ver promociones"
                ctaTo="/promociones"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {promotions.map((promotion) => (
                  <div
                    key={promotion.id}
                    className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-violet-50 p-6 shadow-sm"
                  >
                    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
                      Promo activa
                    </span>
                    <h3 className="mt-4 text-xl font-bold text-slate-800">{promotion.titulo}</h3>
                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">
                      {truncateText(promotion.descripcion || "Consulta esta promocion en sucursal o desde tu cuenta.")}
                    </p>
                    <div className="mt-5 text-3xl font-extrabold text-rose-600">{promotion.descuento}</div>
                    <Link to="/promociones" className="mt-6 inline-flex">
                      <Button variant="outline" className="px-4 py-2.5">
                        Ver detalle
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {services.length > 0 ? (
            <section className="mb-16">
              <SectionHeader
                title="Servicios destacados"
                ctaLabel="Ver todos los servicios"
                ctaTo="/servicios"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-3xl overflow-hidden flex flex-col h-full border border-slate-100/70"
                  >
                    <div className="h-64 sm:h-72 bg-gradient-to-br from-violet-50 to-rose-50 overflow-hidden">
                      <img
                        src={service.imagen || `https://placehold.co/800x500/F5F3FF/7C3AED?text=${encodeURIComponent(service.nombre || "Servicio")}`}
                        alt={service.nombre}
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-5">
                      <h3 className="text-xl font-bold text-slate-800">{service.nombre}</h3>
                      <div className="mt-2 text-slate-500 font-medium">
                        <span className="font-bold text-rose-600 text-xl">${Number(service.precio || 0).toFixed(2)}</span>{" "}
                        <span className="text-xs">MXN</span>
                      </div>

                      <div className="mt-5">
                        <Link to={`/servicios/${service.id}`}>
                          <Button variant="outline" className="w-full py-2.5">
                            Ver detalle
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {products.length > 0 ? (
            <section className="mb-16">
              <SectionHeader
                title="Productos AVYNA destacados"
                ctaLabel="Ver catalogo"
                ctaTo="/productos"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {products.map((product) => {
                  const presentation = formatProductPresentation(product);

                  return (
                    <motion.div
                      key={product.id}
                      whileHover={{ y: -6 }}
                      className="card hover:shadow-xl transition-shadow duration-300 rounded-2xl overflow-hidden group"
                    >
                      <div className="h-64 sm:h-72 bg-gradient-to-br from-violet-100 to-rose-100 flex items-center justify-center relative overflow-hidden">
                        <img
                          src={product.imagen || "https://placehold.co/600x400/EDE9FE/7C3AED?text=AVYNA"}
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
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg text-slate-800 leading-tight">{product.nombre}</h3>
                            {presentation && (
                              <p className="mt-1 text-sm font-medium text-slate-500">{presentation}</p>
                            )}
                          </div>
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
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="border-t-2 border-slate-200/50 max-w-xs mx-auto my-16"></div>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Servicios", desc: "Consulta servicios, segmentos y precios visibles al publico.", to: "/servicios" },
              { title: "Productos AVYNA", desc: "Lleva el catalogo directo al inicio y empuja la venta desde la portada.", to: "/productos" },
              { title: "Promociones", desc: "Las promociones activas ahora pueden verse tanto en su pagina como en el inicio.", to: "/promociones" },
            ].map((card) => (
              <div key={card.title} className="card card-hover p-8">
                <h3 className="section-title">{card.title}</h3>
                <p className="page-subtitle mt-2 mb-5">{card.desc}</p>
                <Link to={card.to}>
                  <Button variant="outline" className="px-5 py-2.5">
                    Ir
                  </Button>
                </Link>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
