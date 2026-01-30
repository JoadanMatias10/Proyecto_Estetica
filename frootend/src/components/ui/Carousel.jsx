import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const carouselItems = [
    {
        id: 1,
        title: "Transformaciones Increíbles",
        description: "Nuestros estilistas certificados crean magia con cada corte",
        image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=600&fit=crop",
        bgColor: "from-rose-400 to-rose-500"
    },
    {
        id: 2,
        title: "Productos AVYNA Premium",
        description: "Línea profesional para un cuidado excepcional del cabello",
        image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&h=600&fit=crop",
        bgColor: "from-pink-400 to-rose-400"
    },
    {
        id: 3,
        title: "Ambiente Relajante",
        description: "Disfruta de una experiencia premium en cada visita",
        image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200&h=600&fit=crop",
        bgColor: "from-rose-300 to-pink-400"
    },
    {
        id: 4,
        title: "Tendencias Actuales",
        description: "Siempre a la vanguardia de la moda y estilo",
        image: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1200&h=600&fit=crop",
        bgColor: "from-pink-500 to-rose-500"
    }
];

export default function Carousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            nextSlide();
        }, 5000); // Cambia cada 5 segundos

        return () => clearInterval(timer);
    }, [currentIndex]);

    const nextSlide = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    };

    const prevSlide = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
    };

    const goToSlide = (index) => {
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
    };

    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0
        })
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => {
        return Math.abs(offset) * velocity;
    };

    return (
        <div className="relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-rose-100 to-rose-200">
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={currentIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                        const swipe = swipePower(offset.x, velocity.x);

                        if (swipe < -swipeConfidenceThreshold) {
                            nextSlide();
                        } else if (swipe > swipeConfidenceThreshold) {
                            prevSlide();
                        }
                    }}
                    className="absolute w-full h-full"
                >
                    {/* Imagen de fondo */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${carouselItems[currentIndex].image})`,
                        }}
                    >
                        {/* Overlay con gradiente */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${carouselItems[currentIndex].bgColor} opacity-75`}></div>
                    </div>

                    {/* Contenido */}
                    <div className="relative h-full flex items-center justify-center px-8 md:px-16">
                        <div className="text-center max-w-3xl">
                            <motion.h2
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg"
                            >
                                {carouselItems[currentIndex].title}
                            </motion.h2>
                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-lg md:text-xl text-white/95 drop-shadow-md"
                            >
                                {carouselItems[currentIndex].description}
                            </motion.p>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Botones de navegación */}
            <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all duration-300 hover:scale-110"
                aria-label="Anterior"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all duration-300 hover:scale-110"
                aria-label="Siguiente"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Indicadores */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {carouselItems.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`transition-all duration-300 rounded-full ${index === currentIndex
                                ? 'w-8 h-3 bg-white'
                                : 'w-3 h-3 bg-white/50 hover:bg-white/75'
                            }`}
                        aria-label={`Ir a slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
