import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { endpoints, requestJson } from "../../api";

export default function Carousel() {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(true);

  const hasSlides = slides.length > 0;
  const activeIndex = useMemo(() => {
    if (!hasSlides) return 0;
    if (currentIndex >= slides.length) return 0;
    return currentIndex;
  }, [currentIndex, hasSlides, slides.length]);

  useEffect(() => {
    const loadSlides = async () => {
      setLoading(true);
      try {
        const data = await requestJson(endpoints.publicCarousel);
        setSlides(Array.isArray(data.slides) ? data.slides : []);
      } catch (_error) {
        setSlides([]);
      } finally {
        setLoading(false);
      }
    };

    loadSlides();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return undefined;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length, activeIndex]);

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

  if (loading) {
    return (
      <div className="relative w-full h-[320px] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-center px-6">
        <div>
          <h3 className="text-xl font-bold text-slate-700">Cargando carrusel...</h3>
        </div>
      </div>
    );
  }

  if (!hasSlides) {
    return (
      <div className="relative w-full h-[320px] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-center px-6">
        <div>
          <h3 className="text-xl font-bold text-slate-700">Sin slides activos</h3>
          <p className="text-slate-500 mt-2">Activa o crea slides desde Administrador &gt; Gestion de Carrusel.</p>
        </div>
      </div>
    );
  }

  const currentSlide = slides[activeIndex];

  return (
    <div className="relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-slate-200">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentSlide.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(event, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold) nextSlide();
            else if (swipe > swipeConfidenceThreshold) prevSlide();
          }}
          className="absolute w-full h-full"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${currentSlide.image})` }}
          />

          <div className="relative h-full flex items-center justify-center px-8 md:px-16">
            <div className="text-center max-w-3xl">
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg"
              >
                {currentSlide.title}
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg md:text-xl text-white/95 drop-shadow-md"
              >
                {currentSlide.description}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-violet-600 hover:text-violet-700 transition-all duration-300 hover:scale-110"
        aria-label="Anterior"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-violet-600 hover:text-violet-700 transition-all duration-300 hover:scale-110"
        aria-label="Siguiente"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === activeIndex ? "w-8 h-3 bg-white" : "w-3 h-3 bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Ir a slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
