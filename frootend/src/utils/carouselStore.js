const CAROUSEL_SLIDES_KEY = "admin.home.carousel.v1";

const DEFAULT_CAROUSEL_SLIDES = [
  {
    id: 1,
    title: "Transformaciones Increibles",
    description: "Nuestros estilistas certificados crean magia con cada corte",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=600&fit=crop",
    bgColor: "from-rose-400 to-violet-500",
    estado: "Activa",
  },
  {
    id: 2,
    title: "Productos AVYNA Premium",
    description: "Linea profesional para un cuidado excepcional del cabello",
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&h=600&fit=crop",
    bgColor: "from-violet-400 to-rose-400",
    estado: "Activa",
  },
  {
    id: 3,
    title: "Ambiente Relajante",
    description: "Disfruta de una experiencia premium en cada visita",
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200&h=600&fit=crop",
    bgColor: "from-amber-400 to-rose-400",
    estado: "Activa",
  },
  {
    id: 4,
    title: "Tendencias Actuales",
    description: "Siempre a la vanguardia de la moda y estilo",
    image: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1200&h=600&fit=crop",
    bgColor: "from-rose-500 to-violet-600",
    estado: "Activa",
  },
];

export const CAROUSEL_BG_OPTIONS = [
  "from-rose-400 to-violet-500",
  "from-violet-400 to-rose-400",
  "from-amber-400 to-rose-400",
  "from-rose-500 to-violet-600",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
];

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function safeWrite(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // Ignore localStorage write errors.
  }
}

function normalizeSlide(slide, index) {
  const bgColor = CAROUSEL_BG_OPTIONS.includes(slide?.bgColor)
    ? slide.bgColor
    : CAROUSEL_BG_OPTIONS[0];

  return {
    id: slide?.id || Date.now() + index,
    title: (slide?.title || "").toString().trim(),
    description: (slide?.description || "").toString().trim(),
    image: (slide?.image || "").toString().trim(),
    bgColor,
    estado: slide?.estado === "Inactiva" ? "Inactiva" : "Activa",
  };
}

export function getCarouselSlides() {
  const data = safeRead(CAROUSEL_SLIDES_KEY, DEFAULT_CAROUSEL_SLIDES);
  if (!Array.isArray(data)) return DEFAULT_CAROUSEL_SLIDES;

  const normalized = data
    .map(normalizeSlide)
    .filter((slide) => slide.title && slide.description && slide.image);

  return normalized.length ? normalized : DEFAULT_CAROUSEL_SLIDES;
}

export function saveCarouselSlides(slides) {
  const normalized = Array.isArray(slides) ? slides.map(normalizeSlide) : [];
  safeWrite(CAROUSEL_SLIDES_KEY, normalized);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("carouselSlidesUpdated"));
  }
}

