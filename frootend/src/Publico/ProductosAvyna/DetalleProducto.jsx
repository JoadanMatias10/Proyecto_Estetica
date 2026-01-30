import React from "react";
import { useParams, Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const productos = [
  { id: 1, nombre: "Shampoo AVYNA Nutritivo", precio: 220, desc: "Limpieza suave + nutrición." },
  { id: 2, nombre: "Mascarilla AVYNA Reparadora", precio: 280, desc: "Repara y fortalece la fibra capilar." },
  { id: 3, nombre: "Aceite AVYNA Brillo", precio: 190, desc: "Brillo y control del frizz." },
  { id: 4, nombre: "Spray AVYNA Termoprotector", precio: 210, desc: "Protección térmica para plancha/secadora." },
];

export default function DetalleProducto() {
  const { id } = useParams();
  const prod = productos.find((p) => String(p.id) === String(id));

  if (!prod) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-rose-700">Producto no encontrado</h1>
        <Link to="/productos" className="text-rose-600 hover:text-rose-700 transition-colors">Volver al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link to="/productos" className="text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors">← Volver</Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-6">
        <div className="rounded-3xl overflow-hidden shadow-xl bg-gradient-to-br from-rose-200 to-rose-300">
          <img
            src={`https://placehold.co/1000x700/FFD1E3/C94FA0?text=${encodeURIComponent(prod.nombre)}`}
            alt={prod.nombre}
            className="w-full h-[420px] md:h-[520px] object-cover"
          />
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-3xl p-8 shadow-xl">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">{prod.nombre}</h1>
          <p className="text-rose-700/70 mt-3 leading-relaxed">{prod.desc}</p>

          <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/50">
            <p className="text-rose-700/70 text-sm font-medium">Precio:</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">${prod.precio} MXN</p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link to="/login" className="w-full">
              <Button className="w-full py-3 rounded-xl">Comprar (requiere cuenta)</Button>
            </Link>
            <Link to="/promociones" className="w-full">
              <Button variant="outline" className="w-full py-3 rounded-xl border-2">Ver promociones</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
