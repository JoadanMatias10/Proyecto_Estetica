import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { endpoints, requestJson } from "../../api";

const CAROUSEL_CACHE_KEY = "public.home.carousel.cache.v1";

function readCachedSlides() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(CAROUSEL_CACHE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeCachedSlides(slides) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CAROUSEL_CACHE_KEY, JSON.stringify(Array.isArray(slides) ? slides : []));
  } catch (_error) {
    // Ignore localStorage write errors.
  }
}

export default function Carousel({ className = "", overlay = null }) {
  const cachedSlidesRef = useRef(readCachedSlides());
  const hasFetchedOnceRef = useRef(false);
  const [slides, setSlides] = useState(cachedSlidesRef.current);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(cachedSlidesRef.current.length === 0);
  const [loadedImages, setLoadedImages] = useState({});

  const hasSlides = slides.length > 0;
  const activeIndex = useMemo(() => {
    if (!hasSlides) return 0;
    if (currentIndex >= slides.length) return 0;
    return currentIndex;
  }, [currentIndex, hasSlides, slides.length]);

  useEffect(() => {
    let isMounted = true;

    const loadSlides = async () => {
      const shouldShowLoader = !hasFetchedOnceRef.current && cachedSlidesRef.current.length === 0;
      if (shouldShowLoader) {
        setLoading(true);
      }

      try {
        const data = await requestJson(endpoints.publicCarousel);
        if (!isMounted) return;

        const nextSlides = Array.isArray(data.slides) ? data.slides : [];
        cachedSlidesRef.current = nextSlides;
        setSlides(nextSlides);
        writeCachedSlides(nextSlides);
      } catch (_error) {
        if (!isMounted) return;

        setSlides(cachedSlidesRef.current);
      } finally {
        hasFetchedOnceRef.current = true;
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSlides();
    window.addEventListener("carouselSlidesUpdated", loadSlides);

    return () => {
      isMounted = false;
      window.removeEventListener("carouselSlidesUpdated", loadSlides);
    };
  }, []);

  useEffect(() => {
    if (!slides.length || typeof Image === "undefined") return undefined;

    let isCancelled = false;
    const preloaders = [];

    slides.forEach((slide) => {
      const imageUrl = slide?.image;
      if (!imageUrl) return;

      const preloader = new Image();
      const markAsReady = () => {
        if (isCancelled) return;
        setLoadedImages((prev) => (prev[imageUrl] ? prev : { ...prev, [imageUrl]: true }));
      };

      preloader.onload = markAsReady;
      preloader.onerror = markAsReady;
      preloader.src = imageUrl;

      if (preloader.complete) {
        markAsReady();
      }

      preloaders.push(preloader);
    });

    return () => {
      isCancelled = true;
      preloaders.forEach((preloader) => {
        preloader.onload = null;
        preloader.onerror = null;
      });
    };
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    if (!hasSlides) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    if (!hasSlides) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    if (!hasSlides) return;
    setDirection(index > activeIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 1000 : -1000, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (dir) => ({ zIndex: 0, x: dir < 0 ? 1000 : -1000, opacity: 0 }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset, velocity) => Math.abs(offset) * velocity;
  const currentSlide = hasSlides ? slides[activeIndex] : null;
  const currentSlideReady = !currentSlide?.image || Boolean(loadedImages[currentSlide.image]);
  const showLoadingSurface = loading || (hasSlides && !currentSlideReady);

  return (
    <div className={`relative isolate h-full w-full overflow-hidden bg-slate-950 ${className}`}>
      {showLoadingSurface ? (
        <div className="absolute inset-0 h-full w-full animate-pulse bg-gradient-to-br from-rose-100 via-slate-200 to-violet-100" />
      ) : null}

      {hasSlides ? (
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentSlide?.id || "fallback-slide"}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag={hasSlides ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(event, { offset, velocity }) => {
              if (!hasSlides) return;
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold) nextSlide();
              else if (swipe > swipeConfidenceThreshold) prevSlide();
            }}
            className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
              currentSlideReady ? "opacity-100" : "opacity-0"
            }`}
          >
            {currentSlide?.image ? (
              <img
                src={currentSlide.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                draggable="false"
              />
            ) : (
              <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
            )}
          </motion.div>
        </AnimatePresence>
      ) : !loading ? (
        <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
      ) : null}

      <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/78 via-slate-950/50 to-slate-950/20" />
      <div className="absolute inset-0 h-full w-full bg-gradient-to-t from-slate-950/55 via-slate-950/8 to-transparent" />

      {overlay ? <div className="relative z-10 h-full w-full">{overlay}</div> : null}

      {hasSlides && slides.length > 1 ? (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-violet-600 shadow-lg transition-all duration-300 hover:scale-110 hover:bg-white hover:text-violet-700 md:left-6"
            aria-label="Anterior"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-violet-600 shadow-lg transition-all duration-300 hover:scale-110 hover:bg-white hover:text-violet-700 md:right-6"
            aria-label="Siguiente"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`rounded-full transition-all duration-300 ${
                  index === activeIndex ? "h-3 w-8 bg-white" : "h-3 w-3 bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Ir a slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
