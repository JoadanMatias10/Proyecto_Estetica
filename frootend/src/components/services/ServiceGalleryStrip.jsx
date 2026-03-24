import React from "react";

function getServiceGalleryImages(service) {
  return (Array.isArray(service?.galeriaImagenes) ? service.galeriaImagenes : [])
    .filter((image) => image?.url);
}

export default function ServiceGalleryStrip({ service }) {
  const galleryImages = getServiceGalleryImages(service);

  if (!galleryImages.length) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Galeria del servicio
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {galleryImages.map((image, index) => (
          <img
            key={`${service?.id || service?.nombre || "service"}-gallery-${index}`}
            src={image.url}
            alt={`${service?.nombre || "Servicio"} imagen ${index + 1}`}
            className="h-20 w-full rounded-xl object-cover border border-slate-200 shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
