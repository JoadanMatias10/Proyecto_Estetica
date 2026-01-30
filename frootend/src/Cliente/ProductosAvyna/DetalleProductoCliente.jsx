import React from "react";
import { useParams, Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const data = [
  { id: 1, nombre: "Shampoo AVYNA Nutritivo", precio: 220, desc: "Nutrición y brillo con limpieza suave." },
  { id: 2, nombre: "Mascarilla AVYNA Reparadora", precio: 280, desc: "Repara la fibra capilar y reduce frizz." },
  { id: 3, nombre: "Aceite AVYNA Brillo", precio: 190, desc: "Control del frizz y acabado luminoso." },
  { id: 4, nombre: "Spray AVYNA Termoprotector", precio: 210, desc: "Protección para plancha y secadora." },
];

export default function DetalleProductoCliente() {
  const { id } = useParams();
  const prod = data.find((p) => String(p.id) === String(id));

  if (!prod) {
    return (
      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 text-center shadow-md">
        <h1 className="text-2xl font-bold text-rose-700 mb-4">Producto no encontrado</h1>
        <Link to="/cliente/productos" className="text-rose-600 hover:text-rose-700 font-medium underline">Volver al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/cliente/productos" className="text-pink-600 hover:text-pink-700 text-sm">← Volver al catálogo</Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-pink-100 rounded-2xl overflow-hidden shadow-sm">
          <img
            src={`https://placehold.co/1200x800/pink-100/pink-700?text=${encodeURIComponent(prod.nombre)}`}
            alt={prod.nombre}
            className="w-full h-[420px] object-cover"
          />
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md h-fit top-24 sticky">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent leading-tight">{prod.nombre}</h1>
          <p className="text-rose-700/80 mt-4 text-lg leading-relaxed">{prod.desc}</p>

          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-rose-50 to-white border border-rose-100 shadow-inner">
            <div className="text-rose-600 font-medium uppercase tracking-wider text-sm">Precio</div>
            <div className="text-4xl font-bold text-rose-700 mt-1">${prod.precio} <span className="text-lg text-rose-400 font-normal">MXN</span></div>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <Link to={`/cliente/productos/pago/${prod.id}`} className="w-full">
              <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold text-lg hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Comprar ahora</Button>
            </Link>
            <Link to="/cliente/carrito" className="w-full">
              <Button variant="outline" className="w-full py-4 rounded-xl border-rose-300 text-rose-600 border-2 font-semibold hover:bg-rose-50">Agregar al carrito</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
